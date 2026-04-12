<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageData } from './$types';
	import ProfileTooltip from '$lib/components/profile/ProfileTooltip.svelte';
	import { openProfileCard } from '$lib/stores/profileOverlay.js';
	import { normalizeBedType, BED_TYPE_LABELS } from '$lib/bed-types.js';
	import kingBedIconUrl from '$lib/assets/images/beds/king.svg.svg?url';
	import queenBedIconUrl from '$lib/assets/images/beds/queen.svg.svg?url';
	import twinBedIconUrl from '$lib/assets/images/beds/twin.svg.svg?url';
	import bunkBedIconUrl from '$lib/assets/images/beds/bunk.svg.svg?url';
	import sofaBedIconUrl from '$lib/assets/images/beds/sofabed.svg.svg?url';

	let { data }: { data: PageData } = $props();
	let toastMessage = $state<string | null>(null);
	let toastType = $state<'success' | 'error'>('success');

	const rooms = $derived(data.rooms ?? []);
	const roomAssignments = $derived(data.roomAssignments ?? []);
	const roomPricing = $derived(data.roomPricing ?? []);
	const isHost = data.isHost ?? false;
	const tripId = data.trip?.id ?? '';
	const currentUserId = data.currentUserId ?? null;

	const BED_ICONS: Record<string, string> = {
		king: kingBedIconUrl,
		queen: queenBedIconUrl,
		twin: twinBedIconUrl,
		bunk: bunkBedIconUrl,
		sofa_bed: sofaBedIconUrl,
		sofa: sofaBedIconUrl,
		full: queenBedIconUrl,
		air_mattress: sofaBedIconUrl,
		other: queenBedIconUrl
	};

	function getBedIcon(bedType: string): string {
		return BED_ICONS[normalizeBedType(bedType)] ?? queenBedIconUrl;
	}

	function showToast(msg: string, type: 'success' | 'error' = 'success') {
		toastMessage = msg;
		toastType = type;
		setTimeout(() => (toastMessage = null), 3500);
	}

	/** Per-room pricing lookup: roomId -> { bedId -> priceDisplay } */
	const bedPriceByRoom = $derived.by(() => {
		const map = new Map<number, Map<string, string>>();
		for (const rp of roomPricing) {
			const bedMap = new Map<string, string>();
			for (const bp of rp.bedPricing ?? []) {
				bedMap.set(bp.bedId, bp.priceDisplay);
			}
			map.set(rp.roomId, bedMap);
		}
		return map;
	});

	function getBedPrice(roomId: number, bedId: string): string | null {
		return bedPriceByRoom.get(roomId)?.get(bedId) ?? null;
	}

	/** For each room, build list of { bed, assignedUser }, match by bedId first, then by bedType */
	const roomSlots = $derived.by(() => {
		return rooms.map((room) => {
			const assignments = roomAssignments.filter((a) => a.roomId === room.id);
			const byBedId = new Map<string, (typeof roomAssignments)[0]>();
			const byBedType = new Map<string, (typeof roomAssignments)[0][]>();
			for (const a of assignments) {
				if (a.bedId) byBedId.set(a.bedId, a);
				else {
					const type = normalizeBedType(a.bedType);
					const list = byBedType.get(type) ?? [];
					list.push(a);
					byBedType.set(type, list);
				}
			}
			const slots: {
				bed: { id: string; bedType: string; capacitySlots?: number | null };
				user: { id: string; name: string | null; avatarUrl: string | null } | null;
			}[] = [];
			for (const bed of room.beds ?? []) {
				const assigned = byBedId.get(bed.id) ?? (() => {
					const queue = byBedType.get(normalizeBedType(bed.bedType)) ?? [];
					const a = queue.shift();
					if (queue.length > 0) byBedType.set(normalizeBedType(bed.bedType), queue);
					else byBedType.delete(normalizeBedType(bed.bedType));
					return a;
				})();
				slots.push({
					bed,
					user: assigned?.user ?? null
				});
			}
			return { roomData: room, slots };
		});
	});

	/** Total spots (respecting capacitySlots), claimed, and rooms that are full. */
	const bedsStats = $derived.by(() => {
		let totalSpots = 0;
		let claimed = 0;
		let fullRooms = 0;
		for (const { slots } of roomSlots) {
			let roomClaimed = 0;
			let roomSpots = 0;
			for (const { bed, user } of slots) {
				const spots = bed.capacitySlots ?? 1;
				roomSpots += spots;
				totalSpots += spots;
				if (user) {
					claimed += 1;
					roomClaimed += 1;
				}
			}
			if (roomSpots > 0 && roomClaimed >= roomSpots) fullRooms += 1;
		}
		return { totalBeds: totalSpots, claimedBeds: claimed, totalRooms: rooms.length, fullRooms };
	});

	const currentUserHasBed = $derived(
		roomAssignments.some((a) => a.userId === currentUserId)
	);

	function canRequestToJoin(slot: { user: { id: string } | null }): boolean {
		if (!currentUserId) return false;
		return slot.user != null && slot.user.id !== currentUserId;
	}

	function canClaimBed(slot: { user: { id: string } | null }): boolean {
		if (!currentUserId || currentUserHasBed) return false;
		return slot.user == null;
	}

	function bedLabel(bedType: string): string {
		return BED_TYPE_LABELS[normalizeBedType(bedType)] ?? bedType;
	}

	function initials(name: string | null): string {
		if (!name?.trim()) return '?';
		const parts = name.trim().split(/\s+/);
		return parts.length >= 2
			? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
			: name.slice(0, 2).toUpperCase();
	}

	function enhanceWithToast(successMsg: string, errorMsg: string) {
		return () => {
			return async ({ result, update }: { result: { type: string; data?: { message?: string } }; update: () => Promise<void> }) => {
				if (result.type === 'success') {
					showToast(successMsg, 'success');
					await update();
				} else if (result.type === 'failure') {
					showToast((result.data as { message?: string })?.message ?? errorMsg, 'error');
				} else {
					showToast(errorMsg, 'error');
				}
			};
		};
	}
</script>

<div class="page">
	<div class="page-header">
		<h1 class="page-title">Where everyone is staying</h1>
		{#if isHost}
			<a href="/trips/{tripId}/settings/step/1" class="manage-link">Manage rooms</a>
		{/if}
		<p class="page-subtitle">See who's in each room and bed. Open spots? Claim a bed or request to share.</p>
	</div>

	{#if rooms.length === 0}
		<div class="empty-state">
			<p>No rooms set up yet.</p>
			{#if isHost}
				<a href="/trips/{tripId}/settings/step/1" class="btn-primary">Add rooms</a>
			{/if}
		</div>
	{:else}
		<div class="stats-strip">
			<span class="stats-pill">{bedsStats.claimedBeds} of {bedsStats.totalBeds} spot{bedsStats.totalBeds !== 1 ? 's' : ''} claimed</span>
			<span class="stats-pill">{bedsStats.fullRooms} of {bedsStats.totalRooms} room{bedsStats.totalRooms !== 1 ? 's' : ''} full</span>
		</div>
		<div class="rooms-grid">
			{#each roomSlots as { roomData, slots }, i (roomData.id)}
				{@const roomDisplayName = roomData.name?.trim() || `Bedroom ${i + 1}`}
				<article class="room-card">
					<div class="room-card-photos">
						{#if (roomData.photoUrls?.length ?? 0) > 0}
							<img src={roomData.photoUrls?.[0]} alt="" class="room-card-hero" />
							<div class="room-card-photo-label">
								<span class="room-card-photo-label-text">{roomDisplayName}</span>
							</div>
							{#if (roomData.photoUrls?.length ?? 0) > 1}
								<div class="room-card-thumbnails">
									{#each (roomData.photoUrls ?? []).slice(1, 4) as url}
										<img src={url} alt="" />
									{/each}
								</div>
							{/if}
						{:else}
							<div class="room-card-placeholder">
								<span class="room-card-photo-label-text">{roomDisplayName}</span>
							</div>
						{/if}
					</div>
					<div class="room-card-body">
						<div class="room-card-beds">
							{#each slots as { bed, user } (bed.id)}
								{@const slotsCount = bed.capacitySlots ?? 1}
								{@const priceDisplay = getBedPrice(roomData.id, bed.id)}
								<div class="bed-slot">
									<div class="bed-slot-visual">
										<div class="bed-in-slot-icon-wrap">
											<img src={getBedIcon(bed.bedType)} alt="" class="bed-in-slot-icon" />
										</div>
										<div class="bed-in-slot-avatar-wrap">
											{#if user}
												<ProfileTooltip userId={user.id}>
													<button type="button" class="bed-avatar bed-avatar-btn" title={user.name ?? 'Assigned'} onclick={() => openProfileCard(user.id)}>
														{#if user.avatarUrl}
															<img src={user.avatarUrl} alt="" />
														{:else}
															<span class="bed-avatar-initials">{initials(user.name)}</span>
														{/if}
													</button>
												</ProfileTooltip>
											{:else}
												<span class="bed-in-slot-empty">Open</span>
											{/if}
										</div>
									</div>
									<div class="bed-slot-info">
										<span class="bed-slot-type">{bedLabel(bed.bedType)}</span>
										{#if slotsCount > 1}
											<span class="bed-slot-spots">{slotsCount} spots</span>
										{/if}
										{#if priceDisplay}
											<span class="bed-slot-price">{priceDisplay}</span>
										{/if}
										{#if canClaimBed({ user })}
											<form method="POST" action="?/claimBed" class="bed-request-form"
												use:enhance={enhanceWithToast('Bed claimed!', 'Could not claim bed')}>
												<input type="hidden" name="bedId" value={bed.id} />
												<button type="submit" class="btn-claim-bed">Claim this bed</button>
											</form>
										{:else if user && canRequestToJoin({ user })}
											<form method="POST" action="?/requestBedShare" class="bed-request-form"
												use:enhance={enhanceWithToast("Request sent! They'll get a notification.", 'Could not send request')}>
												<input type="hidden" name="bedId" value={bed.id} />
												<button type="submit" class="btn-request-join">Request to share</button>
											</form>
										{/if}
									</div>
								</div>
							{/each}
						</div>
					</div>
				</article>
			{/each}
		</div>
	{/if}

	{#if toastMessage}
		<div class="toast" class:toast-error={toastType === 'error'} role="status">{toastMessage}</div>
	{/if}
</div>

<style>
	.page { padding: 0; max-width: none; display: flex; flex-direction: column; align-items: center; }
	.page-header { display: flex; flex-direction: column; align-items: center; gap: 0.15rem; margin-bottom: 1.5rem; text-align: center; width: 100%; max-width: 640px; }
	.page-title { font-size: 1.5rem; font-weight: 600; margin: 0; color: var(--text); }
	.manage-link {
		display: inline-block;
		font-size: 0.8125rem;
		color: #2563eb;
		text-decoration: none;
		font-weight: 500;
		margin: 0;
	}
	.manage-link:hover { text-decoration: underline; }
	.page-subtitle {
		font-size: 0.9375rem;
		color: var(--muted);
		margin: 0;
		max-width: 52ch;
		line-height: 1.4;
	}
	.stats-strip {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		align-items: center;
		gap: 0.5rem 1rem;
		width: 100%;
		max-width: 1200px;
		margin-bottom: 1.25rem;
		padding: 0.5rem 0;
	}
	.stats-pill {
		display: inline-block;
		font-size: 0.8125rem;
		font-weight: 500;
		color: var(--muted);
		background: var(--surface2);
		padding: 0.4rem 0.75rem;
		border-radius: 9999px;
		border: 1px solid var(--border);
	}
	.empty-state { text-align: center; padding: 3rem 1.5rem; color: var(--muted); }
	.empty-state p { margin: 0 0 1rem 0; }
	.btn-primary { display: inline-block; padding: 0.5rem 1rem; background: var(--primary); color: white; border-radius: var(--radius-md); font-weight: 500; text-decoration: none; font-size: 0.9375rem; }
	.btn-primary:hover { filter: brightness(1.05); }

	.rooms-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(320px, 360px));
		justify-content: center;
		gap: 1.5rem;
		width: 100%;
		max-width: 1200px;
	}

	.room-card {
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius-xl);
		overflow: visible;
		display: flex;
		flex-direction: column;
		align-items: center;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
		width: 100%;
	}

	.room-card-photos {
		position: relative;
		aspect-ratio: 4/3;
		background: var(--surface2);
		overflow: hidden;
		border-radius: var(--radius-xl) var(--radius-xl) 0 0;
	}
	.room-card-photo-label {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		padding: 0.75rem 1rem;
		background: rgba(0, 0, 0, 0.75);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1;
	}
	.room-card-photo-label-text {
		font-size: 1.25rem;
		font-weight: 700;
		color: #fff;
		letter-spacing: -0.02em;
		text-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
	}
	.room-card-placeholder {
		width: 100%;
		height: 100%;
		background: linear-gradient(135deg, var(--surface2) 0%, var(--border-soft) 100%);
		display: flex;
		align-items: flex-end;
		justify-content: flex-start;
		padding: 1rem;
	}
	.room-card-placeholder .room-card-photo-label-text {
		background: rgba(0, 0, 0, 0.7);
		padding: 0.6rem 1rem;
		border-radius: var(--radius-md);
		color: #fff;
		font-size: 1.25rem;
		font-weight: 700;
	}

	.room-card-hero {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}

	.room-card-thumbnails {
		position: absolute;
		bottom: 0.5rem;
		left: 0.5rem;
		right: 0.5rem;
		display: flex;
		gap: 0.35rem;
		justify-content: center;
	}

	.room-card-thumbnails img {
		width: 2.5rem;
		height: 2.5rem;
		object-fit: cover;
		border-radius: 6px;
		border: 2px solid rgba(255, 255, 255, 0.9);
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
	}

	.room-card-body {
		padding: 1.25rem;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.5rem;
		width: 100%;
	}

	.room-card-beds {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 1rem;
		margin-top: 0.75rem;
		padding-top: 0.75rem;
		border-top: 1px solid var(--border);
		width: 100%;
	}

	.bed-slot {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		gap: 0.5rem;
		min-width: 100px;
		padding: 0.5rem;
		background: var(--surface2, #f8fafc);
		border-radius: var(--radius-lg);
		border: 1px solid var(--border);
	}

	.bed-slot-visual {
		position: relative;
		width: 90px;
		height: 68px;
		flex-shrink: 0;
	}
	.bed-slot-visual .bed-in-slot-icon-wrap {
		position: absolute;
		bottom: 0;
		left: 50%;
		transform: translateX(-50%);
		width: 84px;
		height: 52px;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.bed-slot-visual .bed-in-slot-avatar-wrap {
		position: absolute;
		top: 0;
		left: 50%;
		transform: translateX(-50%);
		z-index: 2;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.bed-slot-info {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.2rem;
		width: 100%;
	}
	.bed-slot-type {
		font-size: 0.8125rem;
		font-weight: 600;
		color: var(--text);
	}
	.bed-slot-spots {
		font-size: 0.75rem;
		color: var(--muted);
	}
	.bed-slot-price {
		font-size: 0.75rem;
		color: var(--muted);
		margin-top: 0.15rem;
	}
	.bed-request-form { margin-top: 0.35rem; }
	.btn-claim-bed {
		font-size: 0.8125rem;
		padding: 0.3rem 0.75rem;
		background: var(--primary);
		border: none;
		color: white;
		cursor: pointer;
		font-weight: 600;
		border-radius: var(--radius-sm);
		transition: filter 0.12s;
	}
	.btn-claim-bed:hover { filter: brightness(1.08); }
	.btn-request-join {
		font-size: 0.8125rem;
		padding: 0;
		background: none;
		border: none;
		color: var(--primary);
		text-decoration: underline;
		cursor: pointer;
		font-weight: 500;
	}
	.btn-request-join:hover { text-decoration: none; opacity: 0.85; }

	.toast {
		position: fixed;
		bottom: 1.5rem;
		left: 50%;
		transform: translateX(-50%);
		padding: 0.75rem 1.25rem;
		background: var(--text, #0f172a);
		color: #fff;
		border-radius: var(--radius-lg);
		font-size: 0.875rem;
		box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
		z-index: 10000;
		animation: toast-in 0.25s ease;
	}
	.toast-error {
		background: #b91c1c;
	}
	@keyframes toast-in {
		from { opacity: 0; transform: translateX(-50%) translateY(0.5rem); }
		to { opacity: 1; transform: translateX(-50%) translateY(0); }
	}

	.bed-in-slot-icon {
		width: 100%;
		max-height: 100%;
		object-fit: contain;
		opacity: 0.92;
	}

	.bed-avatar {
		width: 36px;
		height: 36px;
		border-radius: 50%;
		overflow: hidden;
		background: var(--surface2);
		border: 2px solid var(--surface);
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.bed-avatar-btn {
		padding: 0;
		cursor: pointer;
		font: inherit;
		transition: transform 0.15s ease, box-shadow 0.15s ease;
	}

	.bed-avatar-btn:hover {
		transform: scale(1.08);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
	}

	.bed-avatar img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.bed-avatar-initials {
		font-size: 0.75rem;
		font-weight: 700;
		color: var(--copper, #bf4e30);
	}

	.bed-in-slot-empty {
		font-size: 0.6875rem;
		font-weight: 500;
		color: var(--muted);
		text-transform: uppercase;
		letter-spacing: 0.03em;
	}
</style>
