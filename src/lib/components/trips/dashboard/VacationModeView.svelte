<script lang="ts">
	import { onMount } from 'svelte';
	import ProfileTooltip from '$lib/components/profile/ProfileTooltip.svelte';
	import { openProfileCard } from '$lib/stores/profileOverlay.js';
	import { getTripGames, GAME_DEFS } from '$lib/stores/tripGames.js';
	import type { TripGame } from '$lib/stores/tripGames.js';

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
		tripName = '',
		tripLocation = '',
		checkInDate = '',
		checkOutDate = '',
		hostName = '',
		currentUserName = '',
		activities = [],
		mealSlots = [],
		roomAssignments = [],
		rsvps = [],
		members = [],
		myAssignment = null,
		myAssignments = [],
		announcements = []
	}: {
		tripId: string;
		isHost?: boolean;
		trip: {
			fullAddress?: string | null;
			location?: string | null;
			parkingNotes?: string | null;
			houseRules?: string | null;
			description?: string | null;
			listingCoverPhoto?: string | null;
			checkInTime?: string | null;
			checkOutTime?: string | null;
			wifiName?: string | null;
			wifiPassword?: string | null;
			doorCode?: string | null;
			trashInstructions?: string | null;
		};
		announcements?: string[];
		tripName?: string;
		tripLocation?: string;
		checkInDate?: string | Date | null;
		checkOutDate?: string | Date | null;
		hostName?: string;
		currentUserName?: string;
		activities?: Activity[];
		mealSlots?: MealSlot[];
		roomAssignments?: RoomAssignment[];
		rsvps?: Rsvp[];
		members?: Array<{ user?: { id: string; name: string | null; avatarUrl?: string | null } | null }>;
		myAssignment?: RoomAssignment | null;
		myAssignments?: RoomAssignment[];
		announcements?: string[];
		tripGames?: TripGame[];
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

	const todayItinerary = $derived.by((): Array<{ type: 'activity'; data: Activity } | { type: 'meal'; data: MealSlot }> => {
		const entries: Array<{ type: 'activity'; data: Activity } | { type: 'meal'; data: MealSlot }> = [
			...todayActivities.map((a) => ({ type: 'activity' as const, data: a })),
			...todayMeals.map((m) => ({ type: 'meal' as const, data: m }))
		];
		const timeToNum = (t: string | null | undefined) => {
			if (!t) return 9999;
			const [h, m] = String(t).slice(0, 5).split(':').map(Number);
			return (h ?? 0) * 60 + (m ?? 0);
		};
		entries.sort((a, b) => {
			const ta = a.type === 'activity' ? timeToNum(a.data.time) : timeToNum(a.data.time);
			const tb = b.type === 'activity' ? timeToNum(b.data.time) : timeToNum(b.data.time);
			return ta - tb;
		});
		return entries;
	});

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

	function formatTodayLong(dateKey: string): string {
		if (!dateKey) return '';
		const d = new Date(dateKey + 'T12:00:00');
		const day = d.getDate();
		const suffix = day === 1 || day === 21 || day === 31 ? 'st' : day === 2 || day === 22 ? 'nd' : day === 3 || day === 23 ? 'rd' : 'th';
		const weekday = d.toLocaleDateString('en-US', { weekday: 'long' });
		const month = d.toLocaleDateString('en-US', { month: 'long' });
		return `${weekday}, ${month} ${day}${suffix}`;
	}
	const todayFormatted = $derived(formatTodayLong(todayKey));
	const displayName = $derived(currentUserName?.trim() || 'there');

	function toDateString(val: string | Date | null | undefined): string {
		if (val == null || val === '') return '';
		const d = typeof val === 'string' ? new Date(val) : val;
		return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
	}
	function formatDateRange(start: string | Date | null | undefined, end: string | Date | null | undefined): string {
		const a = toDateString(start);
		const b = toDateString(end);
		if (!a && !b) return '';
		if (!a) return new Date(b).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
		if (!b) return new Date(a).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
		const s = new Date(a);
		const e = new Date(b);
		return `${s.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} \u2013 ${e.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
	}
	const tripDateRange = $derived(formatDateRange(checkInDate, checkOutDate));
	const displayTripName = $derived((tripName || '').trim() || 'This trip');
	const displayTripLocation = $derived((tripLocation || (trip?.location ?? '')).trim());

	const greetingTime = $derived.by(() => {
		const h = new Date().getHours();
		if (h < 12) return { text: 'Good morning', emoji: '\u2600\uFE0F' };
		if (h < 17) return { text: 'Good afternoon', emoji: '\u2728' };
		return { text: 'Good evening', emoji: '\uD83C\uDF19' };
	});

	const wifiName = $derived(trip?.wifiName ?? null);
	const wifiPassword = $derived(trip?.wifiPassword ?? null);
	const doorCode = $derived(trip?.doorCode ?? null);
	const parkingNotes = $derived(trip?.parkingNotes ?? null);
	const houseRules = $derived(trip?.houseRules ?? null);
	const trashInstructions = $derived(trip?.trashInstructions ?? null);
	const hasHouseInfo = $derived(
		!!(wifiName || wifiPassword || doorCode || parkingNotes || houseRules || trashInstructions)
	);

	const totalInvited = $derived(members.length);
	const arrivedCount = $derived(yesRsvps.length);
	const everyoneArrived = $derived(totalInvited > 0 && arrivedCount >= totalInvited);
	const whoHereCopy = $derived(
		everyoneArrived && totalInvited > 0
			? 'Everyone has arrived \uD83C\uDF89'
			: totalInvited > 0
				? `${arrivedCount} of ${totalInvited} guest${totalInvited === 1 ? '' : 's'} here`
				: ''
	);
	const coverPhoto = $derived(trip?.listingCoverPhoto ?? null);
	const checkInTime = $derived(trip?.checkInTime ?? null);
	const checkOutTime = $derived(trip?.checkOutTime ?? null);

	// First room photo for current user (my room)
	const myRoomPhoto = $derived.by(() => {
		for (const a of myAssignments ?? []) {
			const url = a.room?.photoUrls?.[0];
			if (url) return url;
		}
		return myAssignment?.room?.photoUrls?.[0] ?? null;
	});
	const myRoomName = $derived(myAssignment?.room?.name ?? (myAssignments?.[0]?.room?.name) ?? null);
	const myBedType = $derived(myAssignment?.bed?.bedType ?? (myAssignments?.[0]?.bed?.bedType) ?? null);
	const hasMyRoom = $derived(!!(myRoomName || myBedType || myAssignments?.length || myAssignment));

	// Trip games: use server data when passed, else fall back to client store (e.g. legacy)
	const tripGamesProp = $derived(tripGames ?? []);
	let tripGamesLocal = $state<TripGame[]>([]);
	onMount(() => {
		if (tripGamesProp.length === 0) tripGamesLocal = getTripGames(tripId);
	});
	const tripGamesList = $derived(tripGamesProp.length > 0 ? tripGamesProp : tripGamesLocal);
	function gameDisplayName(tg: TripGame): string {
		const def = GAME_DEFS.find((d) => d.id === tg.gameId);
		return def?.name ?? tg.name ?? tg.gameId;
	}
</script>

<!-- ════════════════ TEMPLATE ════════════════ -->
<div class="v">
	<!-- 1 ── HERO (full width, compact, arrival energy) -->
	<header class="v-hero">
		{#if coverPhoto}
			<img src={coverPhoto} alt="" class="v-hero-bg" />
		{:else}
			<div class="v-hero-bg v-hero-bg--tint" aria-hidden="true"></div>
		{/if}
		<div class="v-hero-overlay" aria-hidden="true"></div>

		{#if tripGamesList.length > 0}
			<div class="v-hero-games">
				<span class="v-hero-games-title">🎲 Trip Games</span>
				<div class="v-hero-games-chips">
					{#each tripGamesList as tg}
						<a href="/trips/{tripId}/games?tab={tg.id}" class="v-hero-games-chip v-hero-games-chip--{tg.gameId}" data-trip-game-id={tg.id}>{gameDisplayName(tg)}</a>
					{/each}
				</div>
			</div>
		{/if}

		<div class="v-hero-body">
			<h1 class="v-hero-title">{displayTripName}</h1>
			<div class="v-hero-meta">
				{#if displayTripLocation}<span>{displayTripLocation}</span>{/if}
				{#if tripDateRange}<span>{tripDateRange}</span>{/if}
			</div>
			{#if hostName}<p class="v-hero-host">Hosted by {hostName}</p>{/if}
			{#if mapsUrl}
				<a href={mapsUrl} target="_blank" rel="noopener noreferrer" class="v-pill v-pill--hero">
					<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
					Open Directions
				</a>
			{/if}
		</div>
	</header>

	<!-- Announcement banner -->
	{#if announcements?.length > 0}
		<div class="v-announce">
			<span aria-hidden="true">📢</span>
			<p>{announcements[0]}</p>
		</div>
	{/if}

	<!-- 2 ── MAIN: left grid + right assistant -->
	<div class="v-main">
		<!-- LEFT: 2-col grid -->
		<div class="v-grid">
			<!-- Combined Trip info + My room (full width, two columns) -->
			<section class="v-tile v-tile--tripinfo v-tile--combined">
				<h3 class="v-tile-heading">Trip info</h3>
				<div class="v-tripinfo-grid">
					<div class="v-tripinfo-col">
						{#if (trip?.description ?? '').trim()}
							<div class="v-tripinfo-block">
								<span class="v-tripinfo-label">Trip description</span>
								<p class="v-tripinfo-text">{trip.description}</p>
							</div>
						{/if}
						<div class="v-tripinfo-block">
							<span class="v-tripinfo-label">Check-in / Check-out</span>
							<p class="v-tripinfo-text">
								Check-in: {checkInTime?.trim() || '\u2014'} &middot; Check-out: {checkOutTime?.trim() || '\u2014'}
							</p>
						</div>
						<div class="v-tripinfo-block">
							<span class="v-tripinfo-label">Location</span>
							{#if address}
								{#if mapsUrl}
									<a href={mapsUrl} target="_blank" rel="noopener noreferrer" class="v-tripinfo-link">{address}</a>
								{:else}
									<p class="v-tripinfo-text">{address}</p>
								{/if}
							{:else}
								<p class="v-tripinfo-text v-muted">No address yet</p>
							{/if}
						</div>
					</div>
					<div class="v-tripinfo-col">
						<!-- My room (with photo when available) -->
						<div class="v-tripinfo-block v-tripinfo-room">
							<span class="v-tripinfo-label">My room</span>
							{#if isHost}
								{#if roomAssignments.length > 0}
									<p class="v-tripinfo-text">{roomAssignments.length} room{roomAssignments.length === 1 ? '' : 's'} assigned</p>
								{:else}
									<p class="v-tripinfo-text v-muted">No assignments yet</p>
								{/if}
								<a href="/trips/{tripId}/rooms" class="v-pill v-pill--ghost">View rooms</a>
							{:else if hasMyRoom}
								<div class="v-myroom">
									{#if myRoomPhoto}
										<div class="v-myroom-photo">
											<img src={myRoomPhoto} alt="" />
										</div>
									{:else}
										<div class="v-myroom-photo v-myroom-photo--placeholder" aria-hidden="true">
											<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 4v16"/><path d="M2 8h18a2 2 0 0 1 2 2v10"/><path d="M2 17h20"/><path d="M6 8V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v4"/></svg>
										</div>
									{/if}
									<div class="v-myroom-body">
										<p class="v-tripinfo-text v-myroom-name">{myRoomName ?? 'Room'}{#if myBedType} <span class="v-badge">{myBedType}</span>{/if}</p>
										<a href="/trips/{tripId}/rooms" class="v-pill v-pill--ghost">View rooms</a>
									</div>
								</div>
							{:else}
								<p class="v-tripinfo-text v-muted">No room assigned yet</p>
								<a href="/trips/{tripId}/rooms" class="v-pill v-pill--ghost">View rooms</a>
							{/if}
						</div>
						<div class="v-tripinfo-block">
							<span class="v-tripinfo-label">Parking / transportation</span>
							<p class="v-tripinfo-text">{(trip?.parkingNotes ?? '').trim() || '\u2014'}</p>
						</div>
						<div class="v-tripinfo-block">
							<span class="v-tripinfo-label">Rules</span>
							<p class="v-tripinfo-text">{(trip?.houseRules ?? '').trim() || '\u2014'}</p>
						</div>
					</div>
				</div>
			</section>

			{#if hasHouseInfo}
				<section class="v-tile v-tile--house">
					<h3 class="v-tile-heading">House info</h3>
					{#if wifiName || wifiPassword}
						<details class="v-acc">
							<summary><span>📶</span> WiFi</summary>
							<div class="v-acc-body">
								{#if wifiName}<p><strong>Network</strong> {wifiName}</p>{/if}
								{#if wifiPassword}<p><strong>Password</strong> {wifiPassword}</p>{/if}
							</div>
						</details>
					{/if}
					{#if doorCode}
						<details class="v-acc">
							<summary><span>🔑</span> Door code</summary>
							<div class="v-acc-body"><p>{doorCode}</p></div>
						</details>
					{/if}
					{#if parkingNotes}
						<details class="v-acc">
							<summary><span>🅿️</span> Parking</summary>
							<div class="v-acc-body"><p>{parkingNotes}</p></div>
						</details>
					{/if}
					{#if trashInstructions}
						<details class="v-acc">
							<summary><span>🗑️</span> Trash</summary>
							<div class="v-acc-body"><p>{trashInstructions}</p></div>
						</details>
					{/if}
					{#if houseRules}
						<details class="v-acc">
							<summary><span>📋</span> House rules</summary>
							<div class="v-acc-body"><p>{houseRules}</p></div>
						</details>
					{/if}
				</section>
			{/if}

			<!-- Games (when trip has add-on games): consider a tile here or a link in the right panel.
			     Data: getTripGames(tripId) from $lib/stores/tripGames.js - pass as prop tripGames from parent if needed. -->

			<!-- Bottom row: Who's Here (attendees) -->
			<section class="v-tile v-tile--who">
				<div class="v-stack">
					{#each yesRsvps.slice(0, 8) as r, i}
						{#if r.user?.id}
							<ProfileTooltip userId={r.user.id}>
								<button type="button" class="v-stack-avatar" style="z-index:{8 - i}" title={r.user.name ?? ''} onclick={() => openProfileCard(r.user!.id)}>
									{#if r.user.avatarUrl}
										<img src={r.user.avatarUrl} alt="" />
									{:else}
										<span>{initials(r.user.name)}</span>
									{/if}
									<i class="v-dot" aria-hidden="true"></i>
								</button>
							</ProfileTooltip>
						{:else}
							<span class="v-stack-avatar" style="z-index:{8 - i}">
								<span>{initials(r.user?.name)}</span>
								<i class="v-dot" aria-hidden="true"></i>
							</span>
						{/if}
					{/each}
					{#if yesRsvps.length > 8}<span class="v-stack-avatar v-stack-more">+{yesRsvps.length - 8}</span>{/if}
				</div>
				{#if whoHereCopy}
					<p class="v-who-copy">{whoHereCopy}</p>
				{:else}
					<p class="v-muted">No one has checked in yet</p>
				{/if}
			</section>
		</div>

		<!-- RIGHT: Daily Assistant -->
		<aside class="v-assistant" aria-label="Daily assistant">
			<div class="v-assistant-inner">
				<header class="v-greet">
					<span class="v-greet-emoji" aria-hidden="true">{greetingTime.emoji}</span>
					<h2 class="v-greet-text">{greetingTime.text}, {displayName}.</h2>
					<p class="v-greet-date">{todayFormatted}</p>
				</header>

				<div class="v-weather">
					<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/></svg>
					<span>&mdash;</span>
				</div>

				<section class="v-today">
					<h3 class="v-today-heading">Today</h3>
					{#if todayItinerary.length === 0}
						<div class="v-today-empty">
							<span class="v-today-empty-icon" aria-hidden="true">✨</span>
							<p>Nothing planned today &mdash; enjoy the downtime.</p>
						</div>
					{:else}
						<ul class="v-today-list">
							{#each todayItinerary as entry}
								{#if entry.type === 'activity'}
									{@const a = entry.data}
									<li class="v-today-item">
										<span class="v-today-time">{a.time ? String(a.time).slice(0, 5) : '\u2014'}</span>
										<div class="v-today-body">
											<span class="v-today-title">{a.title}</span>
											{#if a.location}<span class="v-today-sub">{a.location}</span>{/if}
										</div>
										<span class="v-tag v-tag--activity">Activity</span>
									</li>
								{:else}
									{@const m = entry.data}
									<li class="v-today-item">
										<span class="v-today-time">{m.time ? String(m.time).slice(0, 5) : '\u2014'}</span>
										<div class="v-today-body">
											<span class="v-today-title">{mealLabel(m.mealType)}</span>
											{#if m.menuText}<span class="v-today-sub">{m.menuText}</span>{/if}
											{#if m.assignedUser?.name}<span class="v-today-sub">Cook: {m.assignedUser.name}</span>{/if}
										</div>
										<span class="v-tag v-tag--meal">Meal</span>
									</li>
								{/if}
							{/each}
						</ul>
					{/if}
					<a href="/trips/{tripId}/itinerary" class="v-today-link">View full itinerary</a>
				</section>
			</div>
		</aside>
	</div>
</div>

<!-- ════════════════ STYLES ════════════════ -->
<style>
	/* ── Shell ── */
	.v {
		--v-right: min(380px, 34vw);
		--v-gap: 1.25rem;
		--v-radius: 16px;
		--v-lift: 0 8px 28px rgba(0,0,0,0.07);
		--v-lift-hover: 0 12px 36px rgba(0,0,0,0.10);
		padding-top: 3.75rem;
		position: relative;
		width: 100%;
	}

	/* ── Hero ── */
	.v-hero {
		position: relative;
		width: 100%;
		min-height: 160px;
		border-radius: var(--v-radius);
		overflow: hidden;
		margin-bottom: var(--v-gap);
		box-shadow: 0 6px 24px rgba(0,0,0,0.12);
	}
	.v-hero-bg {
		position: absolute; inset: 0;
		width: 100%; height: 100%;
		object-fit: cover;
	}
	.v-hero-bg--tint {
		background: linear-gradient(135deg, #1a3a4f 0%, #294C60 100%);
	}
	.v-hero-overlay {
		position: absolute; inset: 0;
		background: linear-gradient(to top, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.25) 50%, transparent 100%);
		pointer-events: none;
	}

	/* Floating Trip Games card (top-right of hero, to the left of the right panel) */
	.v-hero-games {
		position: absolute;
		top: 50%;
		right: calc(var(--v-right) + 1rem);
		transform: translateY(-50%);
		width: 280px;
		padding: 1.25rem 1.5rem;
		background: rgba(255, 255, 255, 0.32);
		backdrop-filter: blur(6px);
		-webkit-backdrop-filter: blur(6px);
		border-radius: 20px;
		box-shadow: 0 12px 48px rgba(0, 0, 0, 0.22), 0 4px 16px rgba(0, 0, 0, 0.12);
		border: 1px solid rgba(255, 255, 255, 0.28);
		text-decoration: none;
		color: inherit;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		transition: transform 200ms ease, box-shadow 200ms ease;
		overflow: hidden;
		z-index: 5;
	}
	.v-hero-games::before {
		content: '';
		position: absolute;
		inset: -20%;
		border-radius: 20px;
		background: radial-gradient(ellipse 120% 100% at 50% 50%, rgba(0, 0, 0, 0.28) 0%, rgba(0, 0, 0, 0.08) 50%, transparent 75%);
		pointer-events: none;
		z-index: -1;
	}
	.v-hero-games:hover {
		transform: translateY(calc(-50% - 3px));
		box-shadow: 0 16px 56px rgba(0, 0, 0, 0.26), 0 6px 20px rgba(0, 0, 0, 0.14);
	}
	.v-hero-games-title {
		font-size: 0.6875rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: rgba(255, 255, 255, 0.72);
		text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
	}
	.v-hero-games-chips {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
	}
	.v-hero-games-chip {
		display: inline-block;
		padding: 0.3rem 0.6rem;
		font-size: 0.8125rem;
		font-weight: 500;
		border-radius: 9999px;
		text-shadow: 0 1px 2px rgba(0, 0, 0, 0.15);
		border: 1px solid rgba(255, 255, 255, 0.2);
		text-decoration: none;
		color: #fff;
		transition: transform 120ms ease, box-shadow 120ms ease;
	}
	.v-hero-games-chip:hover {
		transform: translateY(-1px);
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
	}
	.v-hero-games-chip--scavenger-bingo {
		background: rgba(20, 184, 166, 0.75);
	}
	.v-hero-games-chip--caption-this {
		background: rgba(245, 158, 11, 0.8);
	}
	.v-hero-games-chip--alphabet-hunt {
		background: rgba(139, 92, 246, 0.75);
	}
	.v-hero-games-chip--daily-trivia {
		background: rgba(236, 72, 153, 0.75);
	}
	.v-hero-body {
		position: relative;
		padding: 2.5rem 1.75rem 1.75rem;
		display: flex; flex-direction: column; gap: 0.25rem;
	}
	.v-hero-title {
		margin: 0;
		font-size: clamp(1.5rem, 3.5vw, 2rem);
		font-weight: 800; letter-spacing: -0.03em; line-height: 1.15;
		color: #fff;
	}
	.v-hero-meta {
		display: flex; flex-wrap: wrap; gap: 0.25rem 0.75rem;
		font-size: 0.9375rem; color: rgba(255,255,255,0.85);
	}
	.v-hero-host {
		margin: 0.25rem 0 0;
		font-size: 0.8125rem; color: rgba(255,255,255,0.65);
	}
	.v-pill--hero {
		align-self: flex-start;
		margin-top: 0.75rem;
		padding: 0.35rem 0.875rem;
		font-size: 0.8125rem;
		background: rgba(255,255,255,0.2); backdrop-filter: blur(8px);
		color: #fff;
		box-shadow: 0 2px 12px rgba(0,0,0,0.15);
	}
	.v-pill--hero:hover { background: rgba(255,255,255,0.3); }

	/* ── Announcement ── */
	.v-announce {
		display: flex; align-items: flex-start; gap: 0.75rem;
		padding: 0.875rem 1.25rem;
		margin-bottom: var(--v-gap);
		border-radius: var(--v-radius);
		background: linear-gradient(135deg, rgba(180,83,9,0.1) 0%, rgba(251,191,36,0.06) 100%);
		box-shadow: 0 2px 12px rgba(180,83,9,0.08);
	}
	.v-announce span { font-size: 1.125rem; flex-shrink: 0; }
	.v-announce p { margin: 0; font-size: 0.9375rem; font-weight: 500; color: var(--text); line-height: 1.45; }

	/* ── Main layout ── */
	.v-main {
		display: block; position: relative; min-height: 0;
	}

	/* ── Left: 2-col grid ── */
	.v-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--v-gap);
		padding-right: 1.5rem;
		margin-right: var(--v-right);
	}

	/* ── Shared tile ── */
	.v-tile {
		background: var(--surfaceSolid);
		border-radius: var(--v-radius);
		padding: 1.25rem;
		box-shadow: var(--v-lift);
		transition: transform 200ms ease, box-shadow 200ms ease;
	}
	.v-tile:hover { transform: translateY(-2px); box-shadow: var(--v-lift-hover); }

	.v-tile-icon {
		width: 44px; height: 44px; border-radius: 12px;
		display: flex; align-items: center; justify-content: center;
		flex-shrink: 0; margin-bottom: 0.75rem;
	}
	.v-tile-icon--teal { background: rgba(13,148,136,0.12); color: #0d9488; }
	.v-tile-icon--indigo { background: rgba(99,102,241,0.12); color: #6366f1; }
	.v-tile-text { margin: 0 0 0.75rem; font-size: 0.9375rem; color: var(--text); line-height: 1.4; }
	.v-tile-heading { margin: 0 0 0.625rem; font-size: 0.9375rem; font-weight: 700; color: var(--text); }

	/* ── Pill buttons ── */
	.v-pill {
		display: inline-flex; align-items: center; gap: 0.4rem;
		padding: 0.5rem 1rem;
		font-size: 0.875rem; font-weight: 700;
		border-radius: 9999px; border: none; cursor: pointer;
		text-decoration: none; font: inherit;
		transition: transform 150ms ease, box-shadow 150ms ease, background 150ms ease;
	}
	.v-pill--maps {
		color: #fff; background: #0d9488;
		box-shadow: 0 2px 10px rgba(13,148,136,0.3);
	}
	.v-pill--maps:hover { background: #0f766e; transform: translateY(-1px); }
	.v-pill--ghost {
		color: var(--slate); background: rgba(41,76,96,0.07);
	}
	.v-pill--ghost:hover { background: rgba(41,76,96,0.13); }

	/* ── Muted text ── */
	.v-muted { margin: 0; font-size: 0.875rem; color: var(--muted); }

	/* ── Who's here: avatar stack ── */
	.v-tile--who {
		grid-column: 1 / -1;
		display: flex; flex-direction: column; gap: 0.5rem;
	}
	.v-stack { display: flex; flex-wrap: wrap; }
	.v-stack-avatar {
		width: 42px; height: 42px; border-radius: 50%;
		background: linear-gradient(135deg, var(--slate), var(--primary));
		color: #fff; font-size: 0.6875rem; font-weight: 600;
		display: inline-flex; align-items: center; justify-content: center;
		margin-left: -10px; border: 2.5px solid var(--surfaceSolid);
		overflow: hidden; position: relative; cursor: pointer;
		transition: transform 150ms ease;
	}
	.v-stack-avatar:first-child { margin-left: 0; }
	.v-stack-avatar:hover { transform: scale(1.1); z-index: 10 !important; }
	.v-stack-avatar img { width: 100%; height: 100%; object-fit: cover; }
	.v-stack-more { background: var(--surface2); color: var(--muted); font-weight: 700; cursor: default; }
	.v-dot {
		position: absolute; bottom: 1px; right: 1px;
		width: 10px; height: 10px; border-radius: 50%;
		background: #22c55e; border: 2px solid var(--surfaceSolid);
		font-style: normal;
	}
	.v-who-copy { margin: 0; font-size: 0.9375rem; font-weight: 600; color: var(--text); }

	/* ── Room tile ── */
	.v-tile--room { display: flex; flex-direction: column; gap: 0.5rem; }
	.v-room-body { display: flex; flex-direction: column; gap: 0; flex: 1; }
	.v-room-row {
		display: flex; flex-wrap: wrap; align-items: center; gap: 0.4rem;
		padding: 0.4rem 0; font-size: 0.875rem;
	}
	.v-room-row + .v-room-row { border-top: 1px solid rgba(0,0,0,0.05); }
	.v-room-name { font-weight: 600; color: var(--text); }
	.v-badge {
		padding: 0.15rem 0.5rem; border-radius: 9999px;
		background: rgba(99,102,241,0.12); color: #6366f1;
		font-size: 0.75rem; font-weight: 600;
	}
	.v-room-guest { color: var(--muted); margin-left: auto; }

	/* ── House info accordion ── */
	.v-acc { border-bottom: 1px solid rgba(0,0,0,0.05); }
	.v-acc:last-child { border-bottom: none; }
	.v-acc summary {
		display: flex; align-items: center; gap: 0.5rem;
		padding: 0.75rem 0; font-size: 0.875rem; font-weight: 600;
		color: var(--text); cursor: pointer; list-style: none;
	}
	.v-acc summary::-webkit-details-marker { display: none; }
	.v-acc summary span { font-size: 1rem; }
	.v-acc-body { padding: 0 0 0.75rem 1.5rem; }
	.v-acc-body p { margin: 0; font-size: 0.875rem; color: var(--muted); line-height: 1.5; }

	/* ── Trip info tile (combined with My room, two columns) ── */
	.v-tile--tripinfo { display: flex; flex-direction: column; gap: 0.75rem; }
	.v-tile--combined { grid-column: 1 / -1; }
	.v-tripinfo-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1.5rem 2rem;
		align-items: start;
	}
	@media (max-width: 640px) {
		.v-tripinfo-grid { grid-template-columns: 1fr; }
	}
	.v-tripinfo-col { display: flex; flex-direction: column; gap: 0.75rem; min-width: 0; }
	.v-tripinfo-block { display: flex; flex-direction: column; gap: 0.2rem; }
	.v-tripinfo-room .v-myroom {
		display: flex;
		align-items: center;
		gap: 1rem;
		margin-top: 0.25rem;
	}
	.v-myroom-photo {
		width: 80px;
		height: 80px;
		border-radius: var(--v-radius);
		background-color: var(--surface2);
		flex-shrink: 0;
		overflow: hidden;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.v-myroom-photo img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.v-myroom-photo--placeholder {
		color: var(--muted);
	}
	.v-myroom-body { display: flex; flex-direction: column; gap: 0.5rem; min-width: 0; }
	.v-myroom-name { margin: 0; display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
	.v-tripinfo-label {
		font-size: 0.6875rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em;
		color: var(--muted);
	}
	.v-tripinfo-text { margin: 0; font-size: 0.875rem; color: var(--text); line-height: 1.5; }
	.v-tripinfo-link {
		font-size: 0.875rem; color: var(--slate); font-weight: 500;
		text-decoration: none;
	}
	.v-tripinfo-link:hover { text-decoration: underline; }

	/* ── Right: Daily Assistant ── */
	.v-assistant {
		position: fixed; top: 0; right: 0; bottom: 0;
		width: var(--v-right);
		background: linear-gradient(175deg, #fef6ed 0%, #fdebd6 50%, #fce0c5 100%);
		border-radius: 20px 0 0 0;
		box-shadow: -8px 0 40px rgba(0,0,0,0.06);
		overflow-y: auto; z-index: 1;
	}
	.v-assistant-inner {
		padding: 3.75rem 1.75rem 2rem;
		display: flex; flex-direction: column; gap: 1.5rem;
		min-height: 100%;
	}

	/* Greeting */
	.v-greet { margin: 0; }
	.v-greet-emoji { display: block; font-size: 1.75rem; line-height: 1; margin-bottom: 0.35rem; }
	.v-greet-text {
		margin: 0; font-size: 1.5rem; font-weight: 800;
		letter-spacing: -0.03em; line-height: 1.15; color: rgba(0,0,0,0.88);
	}
	.v-greet-date {
		margin: 0.3rem 0 0; font-size: 0.9375rem;
		color: rgba(0,0,0,0.5); font-weight: 500;
	}

	/* Weather */
	.v-weather {
		display: flex; align-items: center; gap: 0.5rem;
		color: rgba(0,0,0,0.5); font-size: 1rem; font-weight: 600;
	}

	/* Today card */
	.v-today {
		background: rgba(255,255,255,0.65); backdrop-filter: blur(6px);
		border-radius: var(--v-radius);
		box-shadow: 0 4px 20px rgba(0,0,0,0.05);
		padding: 1.25rem;
		max-height: 280px;
		display: flex; flex-direction: column;
		margin-bottom: 1rem;
	}
	.v-today-heading { margin: 0 0 0.75rem; font-size: 1rem; font-weight: 700; color: var(--text); }
	.v-today-empty {
		display: flex; flex-direction: column; align-items: center; justify-content: center;
		gap: 0.5rem; padding: 1.5rem 0.5rem; text-align: center;
		min-height: 0;
	}
	.v-today-empty-icon { font-size: 2.5rem; opacity: 0.85; }
	.v-today-empty p { margin: 0; font-size: 0.9375rem; color: var(--muted); line-height: 1.45; }
	.v-today-list {
		list-style: none; margin: 0; padding: 0;
		display: flex; flex-direction: column; gap: 0.5rem;
		min-height: 0; overflow-y: auto; flex: 1;
	}
	.v-today-item {
		display: grid; grid-template-columns: auto 1fr auto;
		gap: 0.6rem; align-items: start;
		padding: 0.625rem 0.75rem;
		background: rgba(255,255,255,0.75); border-radius: 12px;
		box-shadow: 0 2px 8px rgba(0,0,0,0.04);
	}
	.v-today-time { font-size: 0.8125rem; font-weight: 700; color: var(--text); white-space: nowrap; }
	.v-today-body { min-width: 0; display: flex; flex-direction: column; gap: 0.1rem; }
	.v-today-title { font-size: 0.9375rem; font-weight: 600; color: var(--text); }
	.v-today-sub { font-size: 0.8125rem; color: var(--muted); }
	.v-tag {
		font-size: 0.6875rem; font-weight: 700; text-transform: uppercase;
		letter-spacing: 0.04em; padding: 0.15rem 0.45rem; border-radius: 9999px;
		white-space: nowrap;
	}
	.v-tag--activity { background: rgba(41,76,96,0.1); color: var(--slate); }
	.v-tag--meal { background: rgba(13,148,136,0.1); color: #0d9488; }
	.v-today-link {
		display: inline-block; margin-top: 0.75rem;
		font-size: 0.875rem; font-weight: 600; color: var(--slate);
		text-decoration: none;
	}
	.v-today-link:hover { text-decoration: underline; }

	/* ── Responsive ── */
	@media (max-width: 1100px) {
		.v-grid { grid-template-columns: 1fr; }
	}
	@media (max-width: 900px) {
		.v-main { display: flex; flex-direction: column; }
		.v-assistant {
			order: -1; position: static;
			width: 100%; border-radius: var(--v-radius);
			margin-bottom: var(--v-gap);
			box-shadow: var(--v-lift);
		}
		.v-assistant-inner { padding: 1.5rem; }
		.v-grid { margin-right: 0; padding-right: 0; }
	}
</style>
