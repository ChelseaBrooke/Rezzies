<script lang="ts">
	import DashboardCard from './DashboardCard.svelte';
	import ProfileTooltip from '$lib/components/profile/ProfileTooltip.svelte';
	import { openProfileCard } from '$lib/stores/profileOverlay.js';

	interface Activity {
		id: string;
		title: string;
		date: Date | string;
		time?: string | null;
		location?: string | null;
		participants?: Array<{ user?: { id: string; name: string | null } | null; userId?: string }>;
	}
	interface MealSlot {
		id: string;
		date: Date | string;
		mealType: string;
		time?: string | null;
		menuText?: string | null;
		assignedUser?: { id: string; name: string | null } | null;
	}
	interface RoomAssignment {
		room?: { id: string; name: string | null; photoUrls?: string[] } | null;
		bed?: { bedType: string | null } | null;
		user?: { id: string; name: string | null; avatarUrl?: string | null } | null;
		userId: string;
	}
	interface Rsvp {
		status: string;
		user?: { id: string; name: string | null; avatarUrl?: string | null } | null;
		arrivalDatetime?: Date | string | null;
	}

	let {
		tripId,
		isHost = false,
		trip,
		activities = [],
		mealSlots = [],
		roomAssignments = [],
		rsvps = [],
		members = [],
		myAssignment = null,
		myAssignments = []
	}: {
		tripId: string;
		isHost?: boolean;
		trip: {
			fullAddress?: string | null;
			location?: string | null;
			parkingNotes?: string | null;
			houseRules?: string | null;
			description?: string | null;
		};
		activities?: Activity[];
		mealSlots?: MealSlot[];
		roomAssignments?: RoomAssignment[];
		rsvps?: Rsvp[];
		members?: Array<{ user?: { id: string; name: string | null; avatarUrl?: string | null } | null }>;
		myAssignment?: RoomAssignment | null;
		myAssignments?: RoomAssignment[];
	} = $props();

	const todayKey = $derived(new Date().toISOString().slice(0, 10));
	const todayActivities = $derived(
		activities
			.filter((a) => new Date(a.date).toISOString().slice(0, 10) === todayKey)
			.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
	);
	const todayMeals = $derived(
		mealSlots
			.filter((m) => new Date(m.date).toISOString().slice(0, 10) === todayKey)
			.sort((a, b) => {
				const order: Record<string, number> = { breakfast: 0, lunch: 1, dinner: 2, snack: 3 };
				return (order[a.mealType] ?? 9) - (order[b.mealType] ?? 9);
			})
	);

	const timeGreeting = $derived.by(() => {
		const h = new Date().getHours();
		if (h < 12) return 'Good morning';
		if (h < 17) return 'Good afternoon';
		return 'Good evening';
	});

	const nextItem = $derived(todayActivities[0] ?? null);
	const nextMeal = $derived(todayMeals[0] ?? null);

	const address = $derived((trip?.fullAddress ?? trip?.location ?? '').trim());
	const mapsUrl = $derived(
		address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}` : null
	);

	const yesRsvps = $derived(rsvps.filter((r) => r.status === 'yes'));

	const mealLabel = (type: string) =>
		({ breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snacks' }[type] ?? type);

	function initials(name: string | null | undefined): string {
		if (!name?.trim()) return '?';
		const parts = name.trim().split(/\s+/);
		return parts.length >= 2 ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase() : name.slice(0, 2).toUpperCase();
	}

	const myRoomPhoto = $derived.by(() => {
		for (const a of myAssignments) {
			const urls = a.room?.photoUrls;
			if (urls?.length) return urls[0];
		}
		if (myAssignment?.room?.photoUrls?.length) return myAssignment.room.photoUrls[0];
		return null;
	});

	const hasResources = $derived(!!(trip?.description || trip?.houseRules || trip?.parkingNotes));
</script>

<div class="vac-wrapper">
	<!-- Greeting bar -->
	<div class="vac-greeting">
		<span class="vac-greeting-sun" aria-hidden="true">
			<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>
		</span>
		<div class="vac-greeting-text">
			<h2 class="vac-greeting-heading">{timeGreeting}</h2>
			<p class="vac-greeting-sub">Here's your day at a glance.</p>
		</div>
	</div>

	<div class="vac-layout">
		<!-- LEFT COLUMN: Today's schedule (overlapping hero like sticky note) -->
		<div class="vac-col-schedule">
			<div class="vac-schedule-card">
				<div class="vac-schedule-header">
					<span class="vac-schedule-pin" aria-hidden="true">
						<span class="vac-pin-bg"></span>
						<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/></svg>
					</span>
					<h3 class="vac-schedule-title">Today's schedule</h3>
					<a href="/trips/{tripId}/itinerary" class="vac-schedule-link">Full itinerary</a>
				</div>

				{#if todayActivities.length === 0 && todayMeals.length === 0}
					<div class="vac-schedule-empty">
						<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" opacity="0.3"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>
						<p>Nothing scheduled today — enjoy the downtime!</p>
					</div>
				{:else}
					<div class="vac-timeline">
						{#if nextItem || nextMeal}
							<div class="vac-next-up">
								<span class="vac-pulse"></span>
								<span class="vac-next-label">Next up</span>
								<span class="vac-next-title">{nextItem?.title ?? mealLabel(nextMeal?.mealType ?? '')}</span>
								{#if (nextItem?.time ?? nextMeal?.time)}
									<span class="vac-next-time">{String(nextItem?.time ?? nextMeal?.time ?? '').slice(0, 5)}</span>
								{/if}
							</div>
						{/if}

						{#each todayActivities as a, i}
							<div class="vac-tl-item" class:first={i === 0}>
								<div class="vac-tl-dot activity-dot"></div>
								<div class="vac-tl-content">
									<span class="vac-tl-time">{a.time ? String(a.time).slice(0, 5) : '—'}</span>
									<span class="vac-tl-title">{a.title}</span>
									{#if a.location}
										<span class="vac-tl-loc">
											<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
											{a.location}
										</span>
									{/if}
									{#if a.participants?.length}
										<div class="vac-tl-avatars">
											{#each a.participants.slice(0, 5) as p}
												<span class="vac-mini-avatar" title={p.user?.name ?? ''}>{initials(p.user?.name)}</span>
											{/each}
											{#if (a.participants.length) > 5}
												<span class="vac-mini-avatar vac-mini-more">+{a.participants.length - 5}</span>
											{/if}
										</div>
									{/if}
								</div>
							</div>
						{/each}

						{#each todayMeals as m}
							<div class="vac-tl-item">
								<div class="vac-tl-dot meal-dot"></div>
								<div class="vac-tl-content">
									<span class="vac-tl-time">{m.time ? String(m.time).slice(0, 5) : '—'}</span>
									<span class="vac-tl-title">{mealLabel(m.mealType)}</span>
									{#if m.menuText}
										<span class="vac-tl-menu">{m.menuText}</span>
									{/if}
									{#if m.assignedUser?.name}
										<span class="vac-tl-chef">
											<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 21c-5.5 0-10-3.5-10-8V9a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v4c0 4.5-4.5 8-10 8z"/></svg>
											{m.assignedUser.name}
										</span>
									{/if}
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		</div>

		<!-- RIGHT COLUMN: Room card + Address -->
		<div class="vac-col-right">
			<!-- Room & Bed (styled like GuestRsvpSummaryCard with photo header) -->
			<div class="vac-room-card">
				<div class="vac-room-head" class:has-photo={!!myRoomPhoto}>
					{#if myRoomPhoto}
						<img src={myRoomPhoto} alt="" class="vac-room-img" />
						<div class="vac-room-shade"></div>
					{:else}
						<div class="vac-room-noimg">
							<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.4"><path d="M2 4v16"/><path d="M2 8h18a2 2 0 0 1 2 2v10"/><path d="M2 17h20"/><path d="M6 8V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v4"/></svg>
						</div>
					{/if}
					<span class="vac-room-label">
						<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 4v16"/><path d="M2 8h18a2 2 0 0 1 2 2v10"/><path d="M2 17h20"/><path d="M6 8V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v4"/></svg>
						Your room
					</span>
				</div>
				<div class="vac-room-body">
					{#if isHost}
						{#if roomAssignments.length > 0}
							<ul class="vac-room-list">
								{#each roomAssignments.slice(0, 6) as a}
									<li>
										<span class="vac-room-person">{a.user?.name ?? 'Guest'}</span>
										<span class="vac-room-detail">{a.room?.name ?? 'Room'}{#if a.bed?.bedType} · {a.bed.bedType}{/if}</span>
									</li>
								{/each}
								{#if roomAssignments.length > 6}
									<li class="vac-room-more">+{roomAssignments.length - 6} more</li>
								{/if}
							</ul>
						{:else}
							<p class="vac-empty">No room assignments yet.</p>
						{/if}
					{:else}
						{#if myAssignments?.length > 0}
							{#each myAssignments as a}
								<div class="vac-my-room">
									<span class="vac-my-room-name">{a.room?.name ?? 'Room'}</span>
									{#if a.bed?.bedType}
										<span class="vac-my-room-bed">{a.bed.bedType}</span>
									{/if}
								</div>
							{/each}
						{:else if myAssignment}
							<div class="vac-my-room">
								<span class="vac-my-room-name">{myAssignment.room?.name ?? 'Room'}</span>
								{#if myAssignment.bed?.bedType}
									<span class="vac-my-room-bed">{myAssignment.bed.bedType}</span>
								{/if}
							</div>
						{:else}
							<p class="vac-empty">No room assigned yet.</p>
						{/if}
					{/if}
					<a href="/trips/{tripId}/rooms" class="vac-room-cta">View all rooms</a>
				</div>
			</div>

			<!-- Address & Directions -->
			<div class="vac-address-card">
				<div class="vac-address-icon" aria-hidden="true">
					<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
				</div>
				{#if address}
					<p class="vac-address-text">{address}</p>
					{#if mapsUrl}
						<a href={mapsUrl} target="_blank" rel="noopener noreferrer" class="vac-maps-btn">
							<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
							Open in Maps
						</a>
					{/if}
				{:else}
					<p class="vac-empty">No address added yet.</p>
				{/if}
			</div>
		</div>

		<!-- FULL-WIDTH ROW: Who's here -->
		<div class="vac-whos-here">
			<div class="vac-whos-header">
				<h3 class="vac-whos-title">Who's here</h3>
				<span class="vac-whos-count">{yesRsvps.length} attending</span>
			</div>
			<div class="vac-avatar-row">
				{#each yesRsvps as r}
					{#if r.user?.id}
						<ProfileTooltip userId={r.user.id}>
							<button type="button" class="vac-avatar" title={r.user.name ?? ''} onclick={() => openProfileCard(r.user!.id)}>
								{#if r.user.avatarUrl}
									<img src={r.user.avatarUrl} alt="" class="vac-avatar-img" />
								{:else}
									{initials(r.user.name)}
								{/if}
								<span class="vac-here-dot"></span>
							</button>
						</ProfileTooltip>
					{:else}
						<span class="vac-avatar" title={r.user?.name ?? 'Guest'}>
							{initials(r.user?.name)}
							<span class="vac-here-dot"></span>
						</span>
					{/if}
				{/each}
				{#if yesRsvps.length === 0}
					<p class="vac-empty">No one has RSVP'd yet.</p>
				{/if}
			</div>
		</div>

		<!-- BOTTOM ROW: Resources | Weather + Games -->
		<div class="vac-bottom-left">
			<div class="vac-resources-card">
				<div class="vac-res-header">
					<span class="vac-res-pin" aria-hidden="true">
						<span class="vac-res-pin-bg"></span>
						<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/></svg>
					</span>
					<h3 class="vac-res-title">House info</h3>
				</div>
				{#if hasResources}
					<div class="vac-res-items">
						{#if trip?.description}
							<div class="vac-res-item">
								<span class="vac-res-icon">
									<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
								</span>
								<div>
									<span class="vac-res-label">Wi-Fi / Info</span>
									<p class="vac-res-value">{trip.description}</p>
								</div>
							</div>
						{/if}
						{#if trip?.houseRules}
							<div class="vac-res-item">
								<span class="vac-res-icon">
									<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
								</span>
								<div>
									<span class="vac-res-label">House rules</span>
									<p class="vac-res-value">{trip.houseRules}</p>
								</div>
							</div>
						{/if}
						{#if trip?.parkingNotes}
							<div class="vac-res-item">
								<span class="vac-res-icon">
									<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 17V7h4a3 3 0 0 1 0 6H9"/></svg>
								</span>
								<div>
									<span class="vac-res-label">Parking</span>
									<p class="vac-res-value">{trip.parkingNotes}</p>
								</div>
							</div>
						{/if}
					</div>
				{:else}
					<p class="vac-empty vac-res-empty">No shared resources added yet.</p>
				{/if}
			</div>
		</div>

		<div class="vac-bottom-right">
			<!-- Weather -->
			<DashboardCard title="Weather">
				<div class="vac-weather-placeholder">
					<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.35"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/></svg>
					<span>Weather integration coming soon</span>
				</div>
			</DashboardCard>

			<!-- Games -->
			<DashboardCard title="Games" titleHref="/trips/{tripId}/games">
				<div class="vac-games-placeholder">
					<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.35"><rect width="12" height="12" x="2" y="10" rx="2"/><path d="m17.92 14 3.5-3.5a2.24 2.24 0 0 0 0-3l-5-4.92a2.24 2.24 0 0 0-3 0L10 6"/><path d="M6 18h.01"/><path d="M10 14h.01"/></svg>
					<a href="/trips/{tripId}/games" class="vac-games-link">View games & add-ons</a>
				</div>
			</DashboardCard>
		</div>

		<!-- HOST: Announcements (full width, prominent) -->
		{#if isHost}
			<div class="vac-announce-row">
				<div class="vac-announce-card">
					<div class="vac-announce-header">
						<span class="vac-announce-icon" aria-hidden="true">
							<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 11 18-5v12L3 13v-2z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/></svg>
						</span>
						<h3 class="vac-announce-title">Announcements</h3>
					</div>
					<p class="vac-announce-body">Broadcast updates to your group instantly. Coming soon.</p>
				</div>
			</div>
		{/if}
	</div>
</div>

<style>
	.vac-wrapper {
		position: relative;
		width: 100%;
		padding-left: 2.5rem;
	}

	/* ── Greeting ── */
	.vac-greeting {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		margin-top: 1.5rem;
		margin-bottom: 1.5rem;
		position: relative;
	}
	.vac-greeting-sun {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 44px;
		height: 44px;
		border-radius: 50%;
		background: linear-gradient(135deg, #fbbf24, #f59e0b);
		color: white;
		flex-shrink: 0;
		box-shadow: 0 4px 14px rgba(245, 158, 11, 0.3);
	}
	.vac-greeting-heading {
		margin: 0;
		font-size: 1.375rem;
		font-weight: 700;
		color: var(--text);
		letter-spacing: -0.02em;
	}
	.vac-greeting-sub {
		margin: 0;
		font-size: 0.875rem;
		color: var(--muted);
	}

	/* ── Layout ── */
	.vac-layout {
		display: grid;
		grid-template-columns: minmax(0, 1.2fr) 1.25rem minmax(0, 1fr);
		grid-template-rows: auto auto auto auto;
		gap: 0;
		row-gap: 1.25rem;
		position: relative;
	}

	.vac-col-schedule { grid-column: 1; grid-row: 1; }
	.vac-col-right { grid-column: 3; grid-row: 1; display: flex; flex-direction: column; gap: 1rem; }
	.vac-whos-here { grid-column: 1 / 4; grid-row: 2; }
	.vac-bottom-left { grid-column: 1; grid-row: 3; }
	.vac-bottom-right { grid-column: 3; grid-row: 3; display: flex; flex-direction: column; gap: 1rem; }
	.vac-announce-row { grid-column: 1 / 4; grid-row: 4; }

	/* ── Schedule card (like sticky note) ── */
	.vac-schedule-card {
		background: linear-gradient(
			to bottom,
			rgba(255, 253, 230, 0.68) 0%,
			rgba(252, 248, 200, 0.85) 45%,
			rgba(250, 235, 140, 0.97) 100%
		);
		backdrop-filter: blur(8px);
		border-radius: var(--radius-2xl);
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
		padding: 1.25rem 1.25rem 1rem;
		min-height: 280px;
	}

	.vac-schedule-header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 1rem;
	}

	.vac-schedule-pin {
		position: relative;
		width: 28px;
		height: 28px;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}
	.vac-pin-bg {
		position: absolute;
		inset: 0;
		background: #111827;
		border-radius: 50%;
	}
	.vac-schedule-pin svg {
		position: relative;
		z-index: 1;
		color: rgba(255, 255, 255, 0.95);
	}

	.vac-schedule-title {
		margin: 0;
		font-size: 0.9375rem;
		font-weight: 600;
		color: var(--text);
	}

	.vac-schedule-link {
		margin-left: auto;
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--primary);
		text-decoration: none;
	}
	.vac-schedule-link:hover { text-decoration: underline; }

	.vac-schedule-empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		padding: 2rem 1rem;
		text-align: center;
		color: var(--muted);
		font-size: 0.875rem;
	}

	/* ── "Next up" spotlight ── */
	.vac-next-up {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		background: rgba(191, 78, 48, 0.08);
		border: 1px solid rgba(191, 78, 48, 0.2);
		border-radius: var(--radius-lg);
		padding: 0.625rem 0.875rem;
		margin-bottom: 0.75rem;
	}
	.vac-pulse {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--copper);
		flex-shrink: 0;
		animation: vacPulse 2s ease-in-out infinite;
	}
	@keyframes vacPulse {
		0%, 100% { box-shadow: 0 0 0 0 rgba(191, 78, 48, 0.4); }
		50% { box-shadow: 0 0 0 6px rgba(191, 78, 48, 0); }
	}
	.vac-next-label {
		font-size: 0.6875rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--copper);
	}
	.vac-next-title {
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--text);
	}
	.vac-next-time {
		margin-left: auto;
		font-size: 0.8125rem;
		font-weight: 600;
		color: var(--muted);
	}

	/* ── Timeline ── */
	.vac-timeline {
		display: flex;
		flex-direction: column;
		gap: 0;
	}
	.vac-tl-item {
		display: flex;
		gap: 0.75rem;
		padding: 0.5rem 0;
		position: relative;
	}
	.vac-tl-item:not(:last-child)::after {
		content: '';
		position: absolute;
		left: 6px;
		top: calc(0.5rem + 14px);
		bottom: -0.5rem;
		width: 1px;
		background: rgba(0, 0, 0, 0.12);
	}
	.vac-tl-dot {
		width: 13px;
		height: 13px;
		border-radius: 50%;
		flex-shrink: 0;
		margin-top: 2px;
		border: 2px solid;
	}
	.vac-tl-dot.activity-dot {
		border-color: var(--copper);
		background: rgba(191, 78, 48, 0.15);
	}
	.vac-tl-dot.meal-dot {
		border-color: #14b8a6;
		background: rgba(20, 184, 166, 0.15);
	}
	.vac-tl-content {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		min-width: 0;
	}
	.vac-tl-time {
		font-size: 0.6875rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.03em;
		color: var(--muted);
	}
	.vac-tl-title {
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--text);
	}
	.vac-tl-loc, .vac-tl-chef {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		font-size: 0.8125rem;
		color: var(--muted);
	}
	.vac-tl-menu {
		font-size: 0.8125rem;
		color: var(--muted);
		font-style: italic;
	}
	.vac-tl-avatars {
		display: flex;
		gap: 0.25rem;
		margin-top: 0.25rem;
	}
	.vac-mini-avatar {
		width: 22px;
		height: 22px;
		border-radius: 50%;
		background: linear-gradient(135deg, var(--slate), var(--primary));
		color: white;
		font-size: 0.5rem;
		font-weight: 600;
		display: inline-flex;
		align-items: center;
		justify-content: center;
	}
	.vac-mini-more {
		background: var(--surface2);
		color: var(--muted);
		font-size: 0.5625rem;
	}

	/* ── Room card ── */
	.vac-room-card {
		border-radius: var(--radius-2xl);
		overflow: hidden;
		background: var(--surfaceSolid);
		box-shadow: var(--shadow-soft);
		border: 1px solid var(--border-soft);
	}
	.vac-room-head {
		position: relative;
		height: 100px;
		display: flex;
		align-items: flex-end;
		padding: 0 0.875rem 0.625rem;
		overflow: hidden;
		background: linear-gradient(165deg, #e8e6e3, #d4d1cc);
	}
	.vac-room-head.has-photo { background: #e0e0e0; }
	.vac-room-img {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.vac-room-shade {
		position: absolute;
		inset: 0;
		background: linear-gradient(to top, rgba(0,0,0,0.45), rgba(0,0,0,0.1) 45%, transparent 70%);
	}
	.vac-room-noimg {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.vac-room-label {
		position: relative;
		z-index: 1;
		display: flex;
		align-items: center;
		gap: 0.375rem;
		font-size: 0.8125rem;
		font-weight: 600;
		color: white;
		text-shadow: 0 1px 3px rgba(0,0,0,0.5);
	}
	.vac-room-head:not(.has-photo) .vac-room-label {
		color: #5c534a;
		text-shadow: none;
	}
	.vac-room-body {
		padding: 0.875rem 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.vac-room-list {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.vac-room-list li {
		display: flex;
		justify-content: space-between;
		padding: 0.3rem 0;
		border-bottom: 1px solid var(--border-soft);
		font-size: 0.8125rem;
	}
	.vac-room-list li:last-child { border-bottom: none; }
	.vac-room-person { font-weight: 500; color: var(--text); }
	.vac-room-detail { color: var(--muted); }
	.vac-room-more { color: var(--muted); font-size: 0.8125rem; font-style: italic; }
	.vac-my-room {
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
	}
	.vac-my-room-name {
		font-size: 1rem;
		font-weight: 600;
		color: var(--text);
	}
	.vac-my-room-bed {
		font-size: 0.8125rem;
		color: var(--muted);
	}
	.vac-room-cta {
		display: inline-block;
		margin-top: 0.25rem;
		font-size: 0.8125rem;
		font-weight: 600;
		color: var(--primary);
		text-decoration: none;
	}
	.vac-room-cta:hover { text-decoration: underline; }

	/* ── Address card ── */
	.vac-address-card {
		background: var(--surfaceSolid);
		border-radius: var(--radius-2xl);
		box-shadow: var(--shadow-soft);
		border: 1px solid var(--border-soft);
		padding: 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.vac-address-icon {
		width: 36px;
		height: 36px;
		border-radius: 50%;
		background: rgba(191, 78, 48, 0.1);
		color: var(--copper);
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}
	.vac-address-text {
		margin: 0;
		font-size: 0.875rem;
		color: var(--text);
		line-height: 1.5;
	}
	.vac-maps-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.4rem 0.75rem;
		border-radius: 9999px;
		font-size: 0.8125rem;
		font-weight: 600;
		color: white;
		background: var(--primary);
		text-decoration: none;
		align-self: flex-start;
		transition: background var(--transition-fast), transform var(--transition-fast);
	}
	.vac-maps-btn:hover {
		background: var(--primaryHover);
		transform: translateY(-1px);
	}

	/* ── Who's here ── */
	.vac-whos-here {
		background: var(--surfaceSolid);
		border-radius: var(--radius-2xl);
		box-shadow: var(--shadow-soft);
		border: 1px solid var(--border-soft);
		padding: 0.875rem 1.25rem;
	}
	.vac-whos-header {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		margin-bottom: 0.75rem;
	}
	.vac-whos-title {
		margin: 0;
		font-size: 0.9375rem;
		font-weight: 600;
		color: var(--text);
	}
	.vac-whos-count {
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--muted);
		background: var(--surface2);
		padding: 0.2rem 0.5rem;
		border-radius: 9999px;
	}
	.vac-avatar-row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}
	.vac-avatar {
		width: 38px;
		height: 38px;
		border-radius: 50%;
		background: linear-gradient(135deg, var(--slate), var(--primary));
		color: white;
		font-size: 0.6875rem;
		font-weight: 600;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		overflow: hidden;
		position: relative;
		border: none;
		padding: 0;
		cursor: pointer;
		font: inherit;
		transition: transform var(--transition-fast);
	}
	.vac-avatar:hover { transform: scale(1.08); }
	.vac-avatar-img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.vac-here-dot {
		position: absolute;
		bottom: 1px;
		right: 1px;
		width: 10px;
		height: 10px;
		border-radius: 50%;
		background: #22c55e;
		border: 2px solid var(--surfaceSolid);
	}

	/* ── Resources (bulletin board note) ── */
	.vac-resources-card {
		background: linear-gradient(135deg, rgba(219, 234, 254, 0.6) 0%, rgba(191, 219, 254, 0.7) 100%);
		backdrop-filter: blur(6px);
		border-radius: var(--radius-2xl);
		box-shadow: 0 6px 20px rgba(0, 0, 0, 0.08);
		padding: 1.125rem 1.25rem 1rem;
	}
	.vac-res-header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 0.75rem;
	}
	.vac-res-pin {
		position: relative;
		width: 26px;
		height: 26px;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}
	.vac-res-pin-bg {
		position: absolute;
		inset: 0;
		background: #1e3a5f;
		border-radius: 50%;
	}
	.vac-res-pin svg {
		position: relative;
		z-index: 1;
		color: rgba(255, 255, 255, 0.95);
	}
	.vac-res-title {
		margin: 0;
		font-size: 0.9375rem;
		font-weight: 600;
		color: var(--text);
	}
	.vac-res-items {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}
	.vac-res-item {
		display: flex;
		gap: 0.625rem;
		align-items: flex-start;
	}
	.vac-res-icon {
		width: 32px;
		height: 32px;
		border-radius: var(--radius-md);
		background: rgba(255, 255, 255, 0.6);
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		color: var(--slate);
	}
	.vac-res-label {
		font-size: 0.6875rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--muted);
	}
	.vac-res-value {
		margin: 0.15rem 0 0;
		font-size: 0.8125rem;
		color: var(--text);
		line-height: 1.45;
	}
	.vac-res-empty {
		padding: 1rem 0;
	}

	/* ── Weather / Games placeholders ── */
	.vac-weather-placeholder, .vac-games-placeholder {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		padding: 1.5rem 1rem;
		text-align: center;
		font-size: 0.8125rem;
		color: var(--muted);
	}
	.vac-games-link {
		color: var(--primary);
		font-weight: 600;
		font-size: 0.8125rem;
		text-decoration: none;
	}
	.vac-games-link:hover { text-decoration: underline; }

	/* ── Announcements (host) ── */
	.vac-announce-card {
		background: linear-gradient(135deg, rgba(191, 78, 48, 0.06) 0%, rgba(191, 78, 48, 0.12) 100%);
		border: 1px solid rgba(191, 78, 48, 0.2);
		border-radius: var(--radius-2xl);
		padding: 1.125rem 1.25rem;
	}
	.vac-announce-header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 0.5rem;
	}
	.vac-announce-icon {
		width: 36px;
		height: 36px;
		border-radius: 50%;
		background: var(--copper);
		color: white;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}
	.vac-announce-title {
		margin: 0;
		font-size: 0.9375rem;
		font-weight: 600;
		color: var(--text);
	}
	.vac-announce-body {
		margin: 0;
		font-size: 0.875rem;
		color: var(--muted);
		line-height: 1.5;
	}

	/* ── Shared ── */
	.vac-empty {
		color: var(--muted);
		font-size: 0.8125rem;
		margin: 0;
	}

	/* ── Responsive ── */
	@media (max-width: 1024px) {
		.vac-wrapper { padding-left: 0; }
		.vac-greeting { margin-top: 0; }
		.vac-layout {
			grid-template-columns: 1fr;
			grid-template-rows: auto;
		}
		.vac-col-schedule { grid-column: 1; grid-row: 1; }
		.vac-col-right { grid-column: 1; grid-row: 2; }
		.vac-whos-here { grid-column: 1; grid-row: 3; }
		.vac-bottom-left { grid-column: 1; grid-row: 4; }
		.vac-bottom-right { grid-column: 1; grid-row: 5; }
		.vac-announce-row { grid-column: 1; grid-row: 6; }
	}
</style>
