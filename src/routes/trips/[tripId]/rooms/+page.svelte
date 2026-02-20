<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import type { PageData } from './$types';
	import ProfileTooltip from '$lib/components/profile/ProfileTooltip.svelte';
	import { openProfileCard } from '$lib/stores/profileOverlay.js';
	import kingBedIconUrl from '$lib/assets/images/beds/king.svg.svg?url';
	import queenBedIconUrl from '$lib/assets/images/beds/queen.svg.svg?url';
	import twinBedIconUrl from '$lib/assets/images/beds/twin.svg.svg?url';
	import bunkBedIconUrl from '$lib/assets/images/beds/bunk.svg.svg?url';
	import sofaBedIconUrl from '$lib/assets/images/beds/sofabed.svg.svg?url';

	let { data }: { data: PageData } = $props();
	let requestSentToast = $state(false);

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
		other: queenBedIconUrl
	};

	function normalizeBedType(bt: string | null): string {
		if (!bt) return 'other';
		const t = bt.trim().toLowerCase().replace(/\s+/g, '_');
		return t || 'other';
	}

	function getBedIcon(bedType: string): string {
		return BED_ICONS[bedType] ?? BED_ICONS.other ?? queenBedIconUrl;
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

	/** For each room, build list of { bed, assignedUser } — match by bedId first, then by bedType */
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

	/** Total beds, claimed beds, and rooms that are full (every bed has someone). */
	const bedsStats = $derived.by(() => {
		let total = 0;
		let claimed = 0;
		let fullRooms = 0;
		for (const { slots } of roomSlots) {
			let roomClaimed = 0;
			for (const { user } of slots) {
				total += 1;
				if (user) {
					claimed += 1;
					roomClaimed += 1;
				}
			}
			if (slots.length > 0 && roomClaimed === slots.length) fullRooms += 1;
		}
		return { totalBeds: total, claimedBeds: claimed, totalRooms: rooms.length, fullRooms };
	});

	/** Show "Request to join" for any bed that has someone else in it (not you). */
	function canRequestToJoin(slot: { user: { id: string } | null }): boolean {
		if (!currentUserId) return false;
		return slot.user != null && slot.user.id !== currentUserId;
	}

	function initials(name: string | null): string {
		if (!name?.trim()) return '?';
		const parts = name.trim().split(/\s+/);
		return parts.length >= 2
			? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
			: name.slice(0, 2).toUpperCase();
	}
</script>

<div class="page">
	<div class="page-header">
		<h1 class="page-title">Where everyone is staying</h1>
		{#if isHost}
			<a href="/trips/{tripId}/settings" class="manage-link">Manage rooms</a>
		{/if}
		<p class="page-subtitle">See who’s in each room and bed. Open spots? Request to join — your bed mate will get a notification to approve. Prices update as more people RSVP.</p>
	</div>

	{#if rooms.length === 0}
		<div class="empty-state">
			<p>No rooms set up yet.</p>
			{#if isHost}
				<a href="/trips/{tripId}/rooms/edit" class="btn-primary">Add rooms</a>
			{/if}
		</div>
	{:else}
		<div class="stats-strip">
			<span class="stats-pill">{bedsStats.claimedBeds} of {bedsStats.totalBeds} beds claimed</span>
			<span class="stats-pill">{bedsStats.fullRooms} of {bedsStats.totalRooms} rooms full</span>
		</div>
		<div class="rooms-grid">
			{#each roomSlots as { roomData, slots }, i (roomData.id)}
				{@const roomDisplayName = (roomData.name && roomData.name.trim()) || `Bedroom ${i + 1}`}
				<article class="room-card">
					<div class="room-card-photos">
						{#if (roomData.photoUrls?.length ?? 0) > 0}
							<img src={roomData.photoUrls[0]} alt="" class="room-card-hero" />
							<div class="room-card-photo-label">
								<span class="room-card-photo-label-text">{roomDisplayName}</span>
							</div>
							{#if (roomData.photoUrls?.length ?? 0) > 1}
								<div class="room-card-thumbnails">
									{#each roomData.photoUrls.slice(1, 4) as url}
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
										<span class="bed-slot-type">{bed.bedType}</span>
										{#if slotsCount > 1}
											<span class="bed-slot-spots">{slotsCount} spots</span>
										{/if}
										{#if priceDisplay}
											<span class="bed-slot-price">{priceDisplay}</span>
										{/if}
										{#if user && canRequestToJoin({ user })}
											<form method="POST" action="?/requestBedShare" class="bed-request-form" use:enhance={async ({ result }) => {
												if (result.type === 'success') {
													requestSentToast = true;
													setTimeout(() => (requestSentToast = false), 3000);
													await invalidateAll();
												}
											}}>
												<input type="hidden" name="bedId" value={bed.id} />
												<button type="submit" class="btn-request-join">Request to join</button>
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

	{#if requestSentToast}
		<div class="toast-request-sent" role="status">Request sent! They'll get a notification to approve.</div>
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
		display: flex;
		flex-wrap: wrap;
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
		max-width: 360px;
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

	/* Beds: each bed is a card with visual + info + price + request CTA */
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
		text-transform: capitalize;
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

	.toast-request-sent {
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
