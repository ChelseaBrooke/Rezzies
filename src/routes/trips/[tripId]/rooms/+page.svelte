<script lang="ts">
	import type { PageData } from './$types';
	import ProfileTooltip from '$lib/components/profile/ProfileTooltip.svelte';
	import { openProfileCard } from '$lib/stores/profileOverlay.js';
	import kingBedIconUrl from '$lib/assets/images/beds/king.svg.svg?url';
	import queenBedIconUrl from '$lib/assets/images/beds/queen.svg.svg?url';
	import twinBedIconUrl from '$lib/assets/images/beds/twin.svg.svg?url';
	import bunkBedIconUrl from '$lib/assets/images/beds/bunk.svg.svg?url';
	import sofaBedIconUrl from '$lib/assets/images/beds/sofabed.svg.svg?url';

	let { data }: { data: PageData } = $props();

	const rooms = $derived(data.rooms ?? []);
	const roomAssignments = $derived(data.roomAssignments ?? []);
	const isHost = data.isHost ?? false;
	const tripId = data.trip?.id ?? '';

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

	/** For each room, build list of { bed, assignedUser } by matching assignments to beds by bedType */
	const roomSlots = $derived.by(() => {
		return rooms.map((room) => {
			const assignments = roomAssignments.filter((a) => a.roomId === room.id);
			const byBedType = new Map<string, { user: { id: string; name: string | null; avatarUrl: string | null } }[]>();
			for (const a of assignments) {
				const type = normalizeBedType(a.bedType);
				const list = byBedType.get(type) ?? [];
				list.push({ user: a.user });
				byBedType.set(type, list);
			}
			const slots: { bed: { id: string; bedType: string }; user: { id: string; name: string | null; avatarUrl: string | null } | null }[] = [];
			for (const bed of room.beds ?? []) {
				const type = normalizeBedType(bed.bedType);
				const queue = byBedType.get(type) ?? [];
				const assigned = queue.shift()?.user ?? null;
				if (queue.length > 0) byBedType.set(type, queue);
				else byBedType.delete(type);
				slots.push({ bed, user: assigned });
			}
			return { roomData: room, slots };
		});
	});

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
		<h1 class="page-title">Rooms & Beds</h1>
		{#if isHost}
			<a href="/trips/{tripId}/settings" class="manage-link">Manage</a>
		{/if}
	</div>

	{#if rooms.length === 0}
		<div class="empty-state">
			<p>No rooms set up yet.</p>
			{#if isHost}
				<a href="/trips/{tripId}/rooms/edit" class="btn-primary">Add rooms</a>
			{/if}
		</div>
	{:else}
		<div class="rooms-grid">
			{#each roomSlots as { roomData, slots } (roomData.id)}
				<article class="room-card">
					<!-- Room photo(s) -->
					<div class="room-card-photos">
						{#if (roomData.photoUrls?.length ?? 0) > 0}
							<img src={roomData.photoUrls[0]} alt="" class="room-card-hero" />
							{#if (roomData.photoUrls?.length ?? 0) > 1}
								<div class="room-card-thumbnails">
									{#each roomData.photoUrls.slice(1, 4) as url}
										<img src={url} alt="" />
									{/each}
								</div>
							{/if}
						{:else}
							<div class="room-card-placeholder"></div>
						{/if}
					</div>
					<div class="room-card-body">
						<h2 class="room-card-title">{roomData.name}</h2>
						{#if roomData.maxOccupancy}
							<p class="room-card-meta">Max {roomData.maxOccupancy} guests</p>
						{/if}
						<!-- Beds: icon with avatar layered on top (person in bed) -->
						<div class="room-card-beds">
							{#each slots as { bed, user } (bed.id)}
								<div class="bed-in-slot" title={bed.bedType}>
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
											<span class="bed-in-slot-empty">Empty</span>
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
</div>

<style>
	.page { padding: 0; max-width: none; }
	.page-header { display: flex; flex-direction: column; align-items: flex-start; gap: 0.25rem; margin-bottom: 1.25rem; }
	.page-title { font-size: 1.5rem; font-weight: 600; margin: 0; color: var(--text); }
	.manage-link {
		font-size: 0.875rem;
		color: var(--primary);
		text-decoration: none;
		font-weight: 500;
		margin-top: 0.15rem;
	}
	.manage-link:hover { text-decoration: underline; }

	.empty-state { text-align: center; padding: 3rem 1.5rem; color: var(--muted); }
	.empty-state p { margin: 0 0 1rem 0; }
	.btn-primary { display: inline-block; padding: 0.5rem 1rem; background: var(--primary); color: white; border-radius: var(--radius-md); font-weight: 500; text-decoration: none; font-size: 0.9375rem; }
	.btn-primary:hover { filter: brightness(1.05); }

	.rooms-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
		gap: 1.5rem;
	}

	.room-card {
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius-xl);
		overflow: hidden;
		display: flex;
		flex-direction: column;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
	}

	.room-card-photos {
		position: relative;
		aspect-ratio: 4/3;
		background: var(--surface2);
		overflow: hidden;
	}

	.room-card-hero {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}

	.room-card-placeholder {
		width: 100%;
		height: 100%;
		background: linear-gradient(135deg, var(--surface2) 0%, var(--border-soft) 100%);
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
		gap: 0.5rem;
	}

	.room-card-title {
		font-size: 1.25rem;
		font-weight: 700;
		margin: 0;
		color: var(--text);
		letter-spacing: -0.02em;
	}

	.room-card-meta {
		font-size: 0.8125rem;
		color: var(--muted);
		margin: 0;
	}

	/* Beds: each bed is a “person in bed” visual – bed icon with avatar layered on top */
	.room-card-beds {
		display: flex;
		flex-wrap: wrap;
		gap: 1rem;
		margin-top: 0.75rem;
		padding-top: 0.75rem;
		border-top: 1px solid var(--border);
	}

	.bed-in-slot {
		position: relative;
		width: 90px;
		height: 68px;
		flex-shrink: 0;
	}

	.bed-in-slot-icon-wrap {
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

	.bed-in-slot-icon {
		width: 100%;
		max-height: 100%;
		object-fit: contain;
		opacity: 0.92;
	}

	.bed-in-slot-avatar-wrap {
		position: absolute;
		top: 0;
		left: 50%;
		transform: translateX(-50%);
		z-index: 2;
		display: flex;
		align-items: center;
		justify-content: center;
		/* Sit avatar on the “pillow” area – centered and slightly above the bed base */
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
