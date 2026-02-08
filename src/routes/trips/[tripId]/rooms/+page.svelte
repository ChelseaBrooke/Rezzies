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
			<a href="/trips/{tripId}/rooms/edit" class="manage-link">Manage rooms & beds</a>
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
				<article class="room-box">
					{#if (roomData.photoUrls?.length ?? 0) > 0}
						<div class="room-cover">
							<img src={roomData.photoUrls[0]} alt="" />
						</div>
					{/if}
					<div class="room-box-body">
						<h2 class="room-box-title">{roomData.name}</h2>
						{#if roomData.maxOccupancy}
							<p class="room-box-meta">Max {roomData.maxOccupancy} guests</p>
						{/if}
						<div class="beds-row">
							{#each slots as { bed, user } (bed.id)}
								<div class="bed-slot">
									<div class="bed-icon-wrap" title={bed.bedType}>
										<img src={getBedIcon(bed.bedType)} alt="" class="bed-icon" />
									</div>
									<div class="bed-avatar-wrap">
										{#if user}
											<ProfileTooltip userId={user.id}>
												<button type="button" class="avatar avatar-btn" title={user.name ?? 'Assigned'} onclick={() => openProfileCard(user.id)}>
													{#if user.avatarUrl}
														<img src={user.avatarUrl} alt="" />
													{:else}
														<span class="avatar-initials">{initials(user.name)}</span>
													{/if}
												</button>
											</ProfileTooltip>
										{:else}
											<span class="bed-empty">—</span>
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
	.page-header { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.75rem; margin-bottom: 1.25rem; }
	.page-title { font-size: 1.5rem; font-weight: 600; margin: 0; color: var(--text); }
	.manage-link {
		font-size: 0.875rem;
		color: var(--primary);
		text-decoration: none;
		font-weight: 500;
	}
	.manage-link:hover { text-decoration: underline; }

	.empty-state { text-align: center; padding: 3rem 1.5rem; color: var(--muted); }
	.empty-state p { margin: 0 0 1rem 0; }
	.btn-primary { display: inline-block; padding: 0.5rem 1rem; background: var(--primary); color: white; border-radius: var(--radius-md); font-weight: 500; text-decoration: none; font-size: 0.9375rem; }
	.btn-primary:hover { filter: brightness(1.05); }

	.rooms-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
		gap: 1.25rem;
	}
	.room-box {
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		overflow: hidden;
		display: flex;
		flex-direction: column;
	}
	.room-cover {
		aspect-ratio: 16/10;
		background: var(--surface2);
		overflow: hidden;
	}
	.room-cover img { width: 100%; height: 100%; object-fit: cover; }
	.room-box-body { padding: 1rem; display: flex; flex-direction: column; gap: 0.75rem; }
	.room-box-title { font-size: 1.125rem; font-weight: 600; margin: 0; color: var(--text); }
	.room-box-meta { font-size: 0.8125rem; color: var(--muted); margin: 0; }
	.beds-row { display: flex; flex-wrap: wrap; gap: 1rem; margin-top: 0.25rem; }
	.bed-slot {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.5rem;
		min-width: 64px;
	}
	.bed-icon-wrap { width: 48px; height: 32px; display: flex; align-items: center; justify-content: center; }
	.bed-icon { max-width: 100%; max-height: 100%; object-fit: contain; }
	.bed-avatar-wrap { min-height: 2rem; display: flex; align-items: center; justify-content: center; }
	.avatar {
		width: 2rem;
		height: 2rem;
		border-radius: 50%;
		overflow: hidden;
		background: var(--surface2);
		border: 2px solid var(--border);
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.avatar-btn {
		padding: 0;
		cursor: pointer;
		font: inherit;
	}
	.avatar-btn:hover { opacity: 0.9; }
	.avatar img { width: 100%; height: 100%; object-fit: cover; }
	.avatar-initials { font-size: 0.6875rem; font-weight: 600; color: var(--text); }
	.bed-empty { font-size: 0.875rem; color: var(--muted); }
</style>
