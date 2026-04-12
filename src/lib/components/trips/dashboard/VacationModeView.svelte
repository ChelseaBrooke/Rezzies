<script lang="ts">
	import { onMount } from 'svelte';
	import ProfileTooltip from '$lib/components/profile/ProfileTooltip.svelte';
	import PollCardContainer from '$lib/components/trips/polls/PollCardContainer.svelte';
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
		announcements = [],
		tripGames = [],
		userRsvp = null
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
		tripGames?: TripGame[];
		userRsvp?: { adultsCount?: number; kidsCount?: number } | null;
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

	type TodayEntry =
		| { type: 'activity'; data: Activity }
		| { type: 'meal'; data: MealSlot }
		| { type: 'checkin'; time: string | null }
		| { type: 'checkout'; time: string | null };

	const todayItinerary = $derived.by((): TodayEntry[] => {
		const entries: TodayEntry[] = [
			...todayActivities.map((a) => ({ type: 'activity' as const, data: a })),
			...todayMeals.map((m) => ({ type: 'meal' as const, data: m }))
		];
		const checkInDateStr = toDateString(checkInDate);
		const checkOutDateStr = toDateString(checkOutDate);
		if (checkInDateStr === todayKey && (checkInTime ?? '').trim())
			entries.push({ type: 'checkin', time: checkInTime?.trim() ?? null });
		if (checkOutDateStr === todayKey && (checkOutTime ?? '').trim())
			entries.push({ type: 'checkout', time: checkOutTime?.trim() ?? null });

		const timeToNum = (t: string | null | undefined) => {
			if (!t) return 9999;
			const s = String(t).trim();
			const pm = /\s*PM\s*$/i.test(s);
			const am = /\s*AM\s*$/i.test(s);
			const [h, m] = s.replace(/\s*(AM|PM)\s*$/i, '').slice(0, 5).split(':').map(Number);
			let hours = h ?? 0;
			if (pm && hours !== 12) hours += 12;
			if (am && hours === 12) hours = 0;
			return hours * 60 + (m ?? 0);
		};
		const getSortTime = (e: TodayEntry): number => {
			if (e.type === 'checkin') return timeToNum(e.time) || 0;
			if (e.type === 'checkout') return timeToNum(e.time) || 24 * 60 - 1;
			const d = e.type === 'activity' ? e.data : e.data;
			return timeToNum(d.time);
		};
		entries.sort((a, b) => getSortTime(a) - getSortTime(b));
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

	function formatTime12(t: string | null | undefined): string {
		if (!t) return '—';
		const m24 = /^(\d{1,2}):(\d{2})$/.exec(t.trim());
		if (m24) {
			let h = +m24[1];
			const min = m24[2];
			const ap = h < 12 ? 'AM' : 'PM';
			if (h === 0) h = 12;
			else if (h > 12) h -= 12;
			return `${h}:${min} ${ap}`;
		}
		return t; // already formatted
	}

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
		totalInvited > 0
			? `${arrivedCount} of ${totalInvited} guest${totalInvited === 1 ? '' : 's'} here`
			: arrivedCount > 0
				? `${arrivedCount} guest${arrivedCount === 1 ? '' : 's'} here`
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
	/** e.g. "Bedroom 1 - queen" */
	const myRoomAndBed = $derived.by(() => {
		const name = myRoomName?.trim() || 'Room';
		const bed = myBedType?.trim();
		return bed ? `${name} – ${bed.toLowerCase()}` : name;
	});
	/** e.g. "Me & TJ" style: current user name + " & X other(s)" when party > 1 */
	const myPartyLabel = $derived.by(() => {
		const name = currentUserName?.trim() || 'Me';
		const adults = userRsvp?.adultsCount ?? 1;
		const kids = userRsvp?.kidsCount ?? 0;
		const total = adults + kids;
		if (total <= 1) return 'Me';
		const others = total - 1;
		return others === 1 ? `${name} & 1 other` : `${name} & ${others} others`;
	});

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
	function gameDef(tg: TripGame): GameDef | undefined {
		return GAME_DEFS.find((d) => d.id === tg.gameId);
	}
	const dayNumber = $derived.by(() => {
		const checkIn = toDateString(checkInDate);
		if (!checkIn) return null;
		const start = new Date(checkIn + 'T00:00:00');
		const today = new Date();
		today.setHours(0, 0, 0, 0);
		const diff = Math.floor((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
		return diff >= 1 ? diff : 1;
	});
	const totalDays = $derived.by(() => {
		const checkIn = toDateString(checkInDate);
		const checkOut = toDateString(checkOutDate);
		if (!checkIn || !checkOut) return null;
		const start = new Date(checkIn + 'T00:00:00');
		const end = new Date(checkOut + 'T00:00:00');
		return Math.max(1, Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);
	});
</script>

<!-- ════════════════ TEMPLATE ════════════════ -->
<div class="v">
	<PollCardContainer tripId={tripId} placement="sidebar-left" {isHost} />
	<!-- 1 ── HERO -->
	<header class="v-hero">
		<div class="v-hero-clip">
			{#if coverPhoto}
				<img src={coverPhoto} alt="" class="v-hero-bg" />
			{:else}
				<div class="v-hero-bg v-hero-bg--tint" aria-hidden="true"></div>
			{/if}
			<div class="v-hero-overlay" aria-hidden="true"></div>
		</div>

		<!-- Day counter badge -->
		{#if dayNumber !== null && totalDays !== null}
			<div class="v-day-badge">
				<span class="v-day-num">{dayNumber}</span>
				<span class="v-day-label">of {totalDays}<br/>days</span>
			</div>
		{/if}

		<div class="v-hero-body">
			<h1 class="v-hero-title">{displayTripName}</h1>
			<div class="v-hero-meta">
				{#if displayTripLocation}
					{#if mapsUrl}
						<a href={mapsUrl} target="_blank" rel="noopener noreferrer" class="v-hero-location-link">{displayTripLocation}</a>
					{:else}
						<span>{displayTripLocation}</span>
					{/if}
				{/if}
				{#if tripDateRange}<span>{tripDateRange}</span>{/if}
			</div>
			{#if hostName}<p class="v-hero-host">Hosted by {hostName}</p>{/if}
			{#if mapsUrl}
				<a href={mapsUrl} target="_blank" rel="noopener noreferrer" class="v-pill v-pill--hero">
					<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
					Open Directions
				</a>
			{/if}
		</div>

		<!-- Who's here: bottom-right inside hero, right-justified -->
		{#if yesRsvps.length > 0}
			<div class="v-hero-who">
				<span class="v-who-float-label">Who's here</span>
				<div class="v-hero-avatars">
					{#each yesRsvps.slice(0, 14) as r, i}
						{#if r.user?.id}
							<ProfileTooltip userId={r.user.id}>
								<button type="button" class="v-hero-avatar" style="z-index:{14 - i}" title={r.user.name ?? ''} onclick={() => openProfileCard(r.user!.id)}>
									{#if r.user.avatarUrl}
										<img src={r.user.avatarUrl} alt="" />
									{:else}
										<span>{initials(r.user.name)}</span>
									{/if}
								</button>
							</ProfileTooltip>
						{:else}
							<span class="v-hero-avatar" style="z-index:{14 - i}">
								<span>{initials(r.user?.name)}</span>
							</span>
						{/if}
					{/each}
					{#if yesRsvps.length > 14}
						<span class="v-hero-avatar v-hero-avatar--more">+{yesRsvps.length - 14}</span>
					{/if}
				</div>
			</div>
		{/if}
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
		<div class="v-grid">

			<!-- ROW 1: My Stay (full width) -->
			<section class="v-tile v-tile--tripinfo v-tile--combined">
				<h3 class="v-tile-heading">My Stay</h3>
				<div class="v-ti-rows">
					<div class="v-ti-row v-ti-row--check">
						<span class="v-ti-label">Check-in & out</span>
						<div class="v-ti-time-chips">
							<span class="v-ti-time-chip">
								<span class="v-ti-time-dot in" aria-hidden="true"></span>
								<span class="v-ti-time-dir">In</span>
								{checkInTime?.trim() || '—'}
							</span>
							<span class="v-ti-time-chip">
								<span class="v-ti-time-dot out" aria-hidden="true"></span>
								<span class="v-ti-time-dir">Out</span>
								{checkOutTime?.trim() || '—'}
							</span>
						</div>
					</div>
					<div class="v-ti-row">
						<span class="v-ti-label">My room & bed</span>
						<span class="v-ti-val">
							{#if isHost}
								{roomAssignments.length > 0 ? `${roomAssignments.length} room${roomAssignments.length === 1 ? '' : 's'} assigned` : '—'}
								<a href="/trips/{tripId}/rooms" class="v-ti-link">View →</a>
							{:else if hasMyRoom}
								{myRoomAndBed}
								<a href="/trips/{tripId}/rooms" class="v-ti-link">View →</a>
							{:else}
								<span class="v-muted">Not assigned yet</span>
								<a href="/trips/{tripId}/rooms" class="v-ti-link">View →</a>
							{/if}
						</span>
					</div>
					<div class="v-ti-row">
						<span class="v-ti-label">My Party</span>
						<span class="v-ti-val">{myPartyLabel}</span>
					</div>
					<div class="v-ti-row">
						<span class="v-ti-label">Parking</span>
						<span class="v-ti-val">{(trip?.parkingNotes ?? '').trim() || '—'}</span>
					</div>
					<div class="v-ti-row">
						<span class="v-ti-label">House rules</span>
						<span class="v-ti-val v-ti-clamp">{(trip?.houseRules ?? '').trim() || '—'}</span>
					</div>
				</div>
			</section>

			<!-- ROW 2: Trip Games (full width) -->
			{#if tripGamesList.length > 0}
				<section class="v-tile v-tile--games v-tile--combined">
					<div class="v-games-header">
						<h3 class="v-tile-heading">🎲 Trip Games</h3>
						<span class="v-games-desc">These are games that have been added to your trip for all guests to play. Click one to be directed to the game page.</span>
					</div>
					<div class="v-games-grid">
						{#each tripGamesList as tg}
							{@const def = gameDef(tg)}
							<a href="/trips/{tripId}/games?tab={tg.gameId}" class="v-game-tile v-game-tile--{tg.gameId}" data-trip-game-id={tg.id}>
								<span class="v-game-tile-icon">{def?.icon ?? '🎮'}</span>
								<span class="v-game-tile-name">{gameDisplayName(tg)}</span>
							</a>
						{/each}
					</div>
				</section>
			{/if}

			<!-- ROW 3: House Info (if present, wifi, door code, etc.) -->
			{#if hasHouseInfo}
				<section class="v-tile v-tile--house">
					<h3 class="v-tile-heading">🏠 House Info</h3>
					{#if wifiName || wifiPassword}
						<details class="v-acc">
							<summary><span>📶</span> WiFi</summary>
							<div class="v-acc-body">
								{#if wifiName}<p><strong>Network:</strong> {wifiName}</p>{/if}
								{#if wifiPassword}<p><strong>Password:</strong> {wifiPassword}</p>{/if}
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
		</div>

		<!-- RIGHT: Daily Assistant sidebar -->
		<aside class="v-assistant" aria-label="Daily assistant">
			<div class="v-assistant-inner">
				<header class="v-greet">
					<span class="v-greet-emoji" aria-hidden="true">{greetingTime.emoji}</span>
					<h2 class="v-greet-text">{greetingTime.text}, {displayName}.</h2>
					<p class="v-greet-date">{todayFormatted}</p>
					<p class="v-greet-weather">
						<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/></svg>
						<span>—</span>
					</p>
				</header>

				<!-- Today's schedule -->
				<section class="v-today">
					<h3 class="v-today-heading">Today's Schedule</h3>
					{#if todayItinerary.length === 0}
						<div class="v-today-empty">
							<span class="v-today-empty-icon" aria-hidden="true">✨</span>
							<p>Nothing planned, enjoy the downtime.</p>
						</div>
					{:else}
						<ul class="v-today-list">
							{#each todayItinerary as entry}
								{#if entry.type === 'activity'}
									{@const a = entry.data}
									<li class="v-today-item v-today-item--activity">
										<span class="v-today-time">{formatTime12(a.time)}</span>
										<div class="v-today-body">
											<span class="v-today-title">{a.title}</span>
											{#if a.location}<span class="v-today-sub">{a.location}</span>{/if}
										</div>
										<span class="v-tag v-tag--activity">Activity</span>
									</li>
								{:else if entry.type === 'meal'}
									{@const m = entry.data}
									<li class="v-today-item v-today-item--meal">
										<span class="v-today-time">{formatTime12(m.time)}</span>
										<div class="v-today-body">
											<span class="v-today-title">{mealLabel(m.mealType)}</span>
											{#if m.menuText}<span class="v-today-sub">{m.menuText}</span>{/if}
											{#if m.assignedUser?.name}<span class="v-today-sub">Cook: {m.assignedUser.name}</span>{/if}
										</div>
										<span class="v-tag v-tag--meal">Meal</span>
									</li>
								{:else if entry.type === 'checkin'}
									<li class="v-today-item v-today-item--checkin">
										<span class="v-today-time">{formatTime12(entry.time)}</span>
										<div class="v-today-body">
											<span class="v-today-title">Check-in</span>
										</div>
										<span class="v-tag v-tag--checkin">Check-in</span>
									</li>
								{:else if entry.type === 'checkout'}
									<li class="v-today-item v-today-item--checkout">
										<span class="v-today-time">{formatTime12(entry.time)}</span>
										<div class="v-today-body">
											<span class="v-today-title">Check-out</span>
										</div>
										<span class="v-tag v-tag--checkout">Check-out</span>
									</li>
								{/if}
							{/each}
						</ul>
					{/if}
					<a href="/trips/{tripId}/itinerary" class="v-today-link">View full itinerary →</a>
				</section>

				<!-- Quick nav links -->
				<div class="v-quick-links">
					<p class="v-quick-title">Quick Links</p>
					<a href="/trips/{tripId}/polls" class="v-quick-link">
						<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
						Polls
					</a>
					{#if tripGamesList.length > 0}
						<a href="/trips/{tripId}/games" class="v-quick-link">
							<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 3h-4m2-2v4"/><circle cx="8" cy="14" r="1" fill="currentColor"/><circle cx="12" cy="14" r="1" fill="currentColor"/><circle cx="16" cy="14" r="1" fill="currentColor"/></svg>
							Games
						</a>
					{/if}
					<a href="/trips/{tripId}/rooms" class="v-quick-link">
						<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 4v16"/><path d="M2 8h18a2 2 0 0 1 2 2v10"/><path d="M2 17h20"/><path d="M6 8V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v4"/></svg>
						Rooms
					</a>
				</div>
			</div>
		</aside>
	</div>
</div>

<!-- ════════════════ STYLES ════════════════ -->
<style>
	/* ── Shell ── */
	.v {
		--v-right: min(360px, 32vw);
		--v-gap: 1.25rem;
		--v-radius: 14px;
		--v-lift: 0 2px 10px rgba(0,0,0,0.06);
		--v-lift-hover: 0 6px 24px rgba(0,0,0,0.10);
		padding-top: 3.75rem;
		position: relative;
		width: 100%;
	}

	/* ── Hero ── */
	.v-hero {
		position: relative;
		width: 100%;
		min-height: 280px;
		border-radius: 20px;
		overflow: visible;   /* so ProfileTooltip can escape */
		margin-bottom: var(--v-gap);
		box-shadow: 0 8px 32px rgba(0,0,0,0.14);
	}
	.v-hero-clip {
		position: absolute; inset: 0;
		border-radius: 20px;
		overflow: hidden;
	}
	.v-hero-bg {
		position: absolute; inset: 0;
		width: 100%; height: 100%;
		object-fit: cover;
	}
	.v-hero-bg--tint {
		background: linear-gradient(135deg, var(--navy) 0%, var(--slate) 100%);
	}
	.v-hero-overlay {
		position: absolute; inset: 0;
		background: linear-gradient(to top, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.28) 55%, rgba(0,0,0,0.08) 100%);
		pointer-events: none;
	}

	/* Day counter badge, top-right corner of hero */
	.v-day-badge {
		position: absolute;
		top: 4.8rem;
		right: 1.75rem;
		display: flex;
		align-items: baseline;
		gap: 0.4rem;
		background: var(--warm);
		border-radius: 16px;
		padding: 0.75rem 1.125rem 0.75rem 1rem;
		box-shadow: 0 4px 20px rgba(206,86,18,0.4);
		z-index: 2;
	}
	.v-day-num {
		font-family: 'Fraunces', Georgia, serif;
		font-size: 2.75rem;
		font-weight: 800;
		color: #fff;
		line-height: 1;
		letter-spacing: -0.05em;
	}
	.v-day-label {
		font-size: 0.6875rem;
		font-weight: 700;
		color: rgba(255,255,255,0.82);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		line-height: 1.35;
	}

	.v-hero-body {
		position: relative;
		padding: 2.75rem 1.75rem 2rem;
		display: flex; flex-direction: column; gap: 0.25rem;
	}
	.v-hero-title {
		font-family: 'Fraunces', Georgia, serif;
		margin: 0;
		font-size: clamp(1.75rem, 3.5vw, 2.25rem);
		font-weight: 700; letter-spacing: -0.03em; line-height: 1.15;
		color: #fff;
		text-shadow: 0 2px 8px rgba(0,0,0,0.25);
	}
	.v-hero-meta {
		display: flex; flex-wrap: wrap; gap: 0.25rem 0.75rem;
		font-size: 0.9375rem; color: rgba(255,255,255,0.84);
	}
	.v-hero-location-link {
		color: inherit;
		text-decoration: none;
	}
	.v-hero-location-link:hover {
		color: #fff;
		text-decoration: underline;
		text-underline-offset: 2px;
	}
	.v-hero-host {
		margin: 0.2rem 0 0;
		font-size: 0.8125rem; color: rgba(255,255,255,0.6);
	}
	.v-pill--hero {
		align-self: flex-start;
		margin-top: 0.875rem;
		padding: 0.4rem 1rem;
		font-size: 0.8125rem; font-weight: 600;
		background: rgba(255,255,255,0.18); backdrop-filter: blur(8px);
		color: #fff;
		border: 1px solid rgba(255,255,255,0.22);
		box-shadow: 0 2px 10px rgba(0,0,0,0.12);
	}
	.v-pill--hero:hover { background: rgba(255,255,255,0.28); }

	/* ── Announcement ── */
	.v-announce {
		display: flex; align-items: flex-start; gap: 0.75rem;
		padding: 0.875rem 1.25rem;
		margin-bottom: var(--v-gap);
		border-radius: var(--v-radius);
		background: linear-gradient(135deg, rgba(206,86,18,0.07) 0%, rgba(247,170,41,0.04) 100%);
		border: 1px solid rgba(206,86,18,0.12);
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
		grid-template-columns: 2fr 3fr;
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
		border: 1px solid var(--border-soft);
		transition: transform 180ms ease, box-shadow 180ms ease;
	}
	.v-tile:hover { transform: translateY(-2px); box-shadow: var(--v-lift-hover); }
	.v-tile-heading {
		margin: 0 0 0.875rem;
		font-family: 'Fraunces', Georgia, serif;
		font-size: 0.9375rem; font-weight: 600; color: var(--text);
	}
	.v-tile--combined { grid-column: 1 / -1; }
	.v-tile--house { grid-column: 1 / -1; }
	.v-tile--full { grid-column: 1 / -1; }

	/* ── Pills ── */
	.v-pill {
		display: inline-flex; align-items: center; gap: 0.4rem;
		padding: 0.45rem 0.875rem;
		font-size: 0.8125rem; font-weight: 600;
		border-radius: 9999px; border: none; cursor: pointer;
		text-decoration: none; font: inherit;
		transition: transform 150ms ease, background 150ms ease;
	}
	.v-pill--ghost {
		color: var(--slate); background: rgba(47,119,120,0.08);
		border: 1px solid rgba(47,119,120,0.14);
	}
	.v-pill--ghost:hover { background: rgba(47,119,120,0.14); }

	/* ── Muted ── */
	.v-muted { margin: 0; font-size: 0.875rem; color: var(--muted); }

	/* ── Who's here: inside hero, bottom-right, right-justified ── */
	.v-hero-who {
		position: absolute;
		bottom: 1.25rem;
		right: calc(var(--v-right) + 0.5rem);
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 0.35rem;
		z-index: 10;
	}
	.v-who-float-label {
		font-size: 0.5625rem; font-weight: 700;
		text-transform: uppercase; letter-spacing: 0.1em;
		color: rgba(255,255,255,0.85);
		text-shadow: 0 1px 4px rgba(0,0,0,0.5);
		line-height: 1;
	}
	.v-hero-avatars {
		display: flex;
		flex-wrap: nowrap;
		align-items: center;
		justify-content: flex-end;
		gap: 0.25rem;
	}
	.v-hero-avatar {
		width: 36px; height: 36px; border-radius: 50%;
		background: linear-gradient(135deg, var(--slate), var(--navy));
		color: #fff; font-size: 0.625rem; font-weight: 600;
		display: inline-flex; align-items: center; justify-content: center;
		border: none;
		overflow: hidden; position: relative; cursor: pointer;
		transition: transform 150ms ease;
		flex-shrink: 0;
	}
	.v-hero-avatar:hover { transform: scale(1.15); }
	.v-hero-avatar img { width: 100%; height: 100%; object-fit: cover; }
	.v-hero-avatar--more {
		background: rgba(255,255,255,0.22); backdrop-filter: blur(4px);
		color: #fff; font-size: 0.6875rem; font-weight: 700; cursor: default;
		border: none;
	}

	/* ── Trip Games tile (full-width) ── */
	.v-tile--games {
		display: flex; flex-direction: column; gap: 0.875rem;
		background: var(--surfaceSolid);
	}
	.v-games-header {
		display: flex; align-items: baseline; gap: 0.75rem; flex-wrap: wrap;
	}
	.v-games-header .v-tile-heading { margin-bottom: 0; flex-shrink: 0; }
	.v-games-desc {
		font-size: 0.8125rem; color: var(--muted); line-height: 1.45;
		border-left: 1px solid var(--border);
		padding-left: 0.75rem;
	}
	.v-games-grid {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 0.5rem;
	}
	.v-game-tile {
		display: flex; flex-direction: column;
		align-items: center; justify-content: center;
		gap: 0.375rem;
		width: 100px;
		height: 100px;
		flex-shrink: 0;
		padding: 0.5rem;
		border-radius: 12px;
		text-decoration: none; color: #fff;
		text-align: center;
		transition: transform 150ms ease, box-shadow 150ms ease;
		box-sizing: border-box;
	}
	.v-game-tile:hover { transform: translateY(-2px); box-shadow: 0 6px 18px rgba(0,0,0,0.18); }
	.v-game-tile--scavenger-bingo { background: rgba(13,148,136,0.12); color: #0a7a70; }
	.v-game-tile--caption-this    { background: rgba(224,123,26,0.12); color: #b5590d; }
	.v-game-tile--alphabet-hunt   { background: rgba(124,58,237,0.11); color: #6d28d9; }
	.v-game-tile--daily-trivia    { background: rgba(219,39,119,0.11); color: #be185d; }
	.v-game-tile-icon { font-size: 1.75rem; line-height: 1; }
	.v-game-tile-name {
		font-size: 0.7rem; font-weight: 700; line-height: 1.25;
		color: inherit;
		overflow: hidden; text-overflow: ellipsis; display: -webkit-box;
		-webkit-line-clamp: 2; -webkit-box-orient: vertical;
	}

	/* ── Trip Info tile (compact key-value rows, half-width) ── */
	.v-tile--tripinfo { display: flex; flex-direction: column; gap: 0.5rem; }
	.v-ti-rows { display: flex; flex-direction: column; gap: 0; }
	.v-ti-row {
		display: grid; grid-template-columns: 6.5rem 1fr;
		align-items: baseline; gap: 0.5rem 0.75rem;
		padding: 0.4rem 0;
		border-bottom: 1px solid var(--border-soft);
	}
	.v-ti-row:last-child { border-bottom: none; }
	.v-ti-row--check { align-items: center; }
	.v-ti-time-chips {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}
	.v-ti-time-chip {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		font-size: 0.75rem;
		font-weight: 500;
		color: var(--text);
		background: var(--surface2);
		border: 1px solid var(--border-soft);
		border-radius: 6px;
		padding: 0.25rem 0.625rem;
		width: fit-content;
	}
	.v-ti-time-dot {
		width: 5px;
		height: 5px;
		border-radius: 50%;
		flex-shrink: 0;
	}
	.v-ti-time-dot.in { background: #22c55e; }
	.v-ti-time-dot.out { background: #f97316; }
	.v-ti-time-dir {
		font-size: 0.5625rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--muted);
	}
	.v-ti-label {
		font-size: 0.625rem; font-weight: 700; text-transform: uppercase;
		letter-spacing: 0.07em; color: var(--muted);
		white-space: nowrap; flex-shrink: 0;
	}
	.v-ti-val {
		font-size: 0.875rem; color: var(--text); line-height: 1.45;
		display: flex; align-items: baseline; gap: 0.5rem; flex-wrap: wrap;
	}
	.v-ti-clamp {
		overflow: hidden; display: -webkit-box;
		-webkit-line-clamp: 2; -webkit-box-orient: vertical;
	}
	.v-ti-link {
		font-size: 0.75rem; font-weight: 600; color: var(--slate);
		text-decoration: none; white-space: nowrap;
	}
	.v-ti-link:hover { text-decoration: underline; }
	.v-tripinfo-link { font-size: 0.875rem; color: var(--slate); font-weight: 500; text-decoration: none; }
	.v-tripinfo-link:hover { text-decoration: underline; }
	.v-badge {
		padding: 0.15rem 0.5rem; border-radius: 9999px;
		background: rgba(47,119,120,0.1); color: var(--slate);
		font-size: 0.75rem; font-weight: 600;
	}

	/* ── House Info accordion ── */
	.v-acc { border-bottom: 1px solid var(--border-soft); }
	.v-acc:last-child { border-bottom: none; }
	.v-acc summary {
		display: flex; align-items: center; gap: 0.5rem;
		padding: 0.625rem 0; font-size: 0.875rem; font-weight: 600;
		color: var(--text); cursor: pointer; list-style: none;
	}
	.v-acc summary::-webkit-details-marker { display: none; }
	.v-acc summary span { font-size: 1rem; }
	.v-acc-body { padding: 0 0 0.75rem 1.5rem; }
	.v-acc-body p { margin: 0 0 0.25rem; font-size: 0.875rem; color: var(--muted); line-height: 1.5; }

	/* ── Right: Daily Assistant ── */
	.v-assistant {
		position: fixed; top: 0; right: 0; bottom: 0;
		width: var(--v-right);
		/* Warm desert sand feel matching the divvi coastal palette, fully opaque */
		background: linear-gradient(175deg,
			#fdf5e6 0%,
			#fdf8f0 40%,
			#ffffff 70%
		);
		border-left: 1px solid rgba(227,206,170,0.55);
		box-shadow: -5px 0 28px rgba(0,0,0,0.05);
		overflow-y: auto; z-index: 1;
	}
	.v-assistant-inner {
		padding: 3.75rem 1.5rem 2rem;
		display: flex; flex-direction: column; gap: 1.375rem;
		min-height: 100%;
	}

	/* Greeting */
	.v-greet-emoji { display: block; font-size: 1.625rem; line-height: 1; margin-bottom: 0.3rem; }
	.v-greet-text {
		margin: 0; font-size: 1.375rem; font-weight: 800;
		letter-spacing: -0.03em; line-height: 1.2; color: var(--navy);
		font-family: 'Fraunces', Georgia, serif;
	}
	.v-greet-date {
		margin: 0.25rem 0 0; font-size: 0.875rem;
		color: var(--muted); font-weight: 500;
	}
	.v-greet-weather {
		display: flex; align-items: center; gap: 0.35rem;
		margin: 0.35rem 0 0; font-size: 0.8125rem;
		color: var(--muted); font-weight: 500;
	}
	.v-greet-weather svg { flex-shrink: 0; color: var(--slate); }

	/* Today card */
	.v-today {
		margin-top: 1.5rem;
		background: var(--surfaceSolid);
		border-radius: var(--v-radius);
		box-shadow: var(--v-lift);
		border: 1px solid var(--border-soft);
		padding: 1rem 1.125rem;
		display: flex; flex-direction: column;
	}
	.v-today-heading {
		margin: 0 0 0.75rem;
		font-family: 'Fraunces', Georgia, serif;
		font-size: 0.9375rem; font-weight: 600; color: var(--text);
	}
	.v-today-empty {
		display: flex; flex-direction: column; align-items: center;
		gap: 0.4rem; padding: 1.25rem 0.5rem; text-align: center;
	}
	.v-today-empty-icon { font-size: 1.875rem; opacity: 0.8; }
	.v-today-empty p { margin: 0; font-size: 0.875rem; color: var(--muted); line-height: 1.45; }
	.v-today-list {
		list-style: none; margin: 0; padding: 0;
		display: flex; flex-direction: column; gap: 0.4rem;
	}
	.v-today-item {
		display: grid; grid-template-columns: auto 1fr auto;
		gap: 0.5rem; align-items: start;
		padding: 0.5rem 0.625rem;
		border-radius: 9px;
		background: rgba(244,245,247,0.7);
		border-left: 3px solid transparent;
	}
	.v-today-item--activity { border-left-color: var(--slate); }
	.v-today-item--meal { border-left-color: var(--sky); }
	.v-today-item--checkin { border-left-color: #22c55e; }
	.v-today-item--checkout { border-left-color: #f97316; }
	.v-tag--checkin { background: rgba(34,197,94,0.12); color: #16a34a; }
	.v-tag--checkout { background: rgba(249,115,22,0.12); color: #ea580c; }
	.v-today-time { font-size: 0.75rem; font-weight: 700; color: var(--text); white-space: nowrap; }
	.v-today-body { min-width: 0; display: flex; flex-direction: column; gap: 0.05rem; }
	.v-today-title { font-size: 0.875rem; font-weight: 600; color: var(--text); }
	.v-today-sub { font-size: 0.75rem; color: var(--muted); }
	.v-tag {
		font-size: 0.625rem; font-weight: 700; text-transform: uppercase;
		letter-spacing: 0.04em; padding: 0.15rem 0.4rem; border-radius: 9999px;
		white-space: nowrap;
	}
	.v-tag--activity { background: rgba(47,119,120,0.1); color: var(--slate); }
	.v-tag--meal { background: rgba(122,206,211,0.18); color: #0a8f94; }
	.v-today-link {
		display: inline-block; margin-top: 0.75rem;
		font-size: 0.8125rem; font-weight: 600; color: var(--slate);
		text-decoration: none;
	}
	.v-today-link:hover { text-decoration: underline; }

	/* Quick links */
	.v-quick-links { display: flex; flex-direction: column; gap: 0.3rem; }
	.v-quick-title {
		font-size: 0.625rem; font-weight: 700; text-transform: uppercase;
		letter-spacing: 0.07em; color: var(--muted); margin: 0 0 0.25rem;
	}
	.v-quick-link {
		display: inline-flex; align-items: center; gap: 0.5rem;
		padding: 0.5rem 0.75rem;
		border-radius: 10px;
		font-size: 0.875rem; font-weight: 500;
		color: var(--text); text-decoration: none;
		background: rgba(47,119,120,0.05);
		border: 1px solid rgba(47,119,120,0.08);
		transition: background 140ms ease;
	}
	.v-quick-link:hover { background: rgba(47,119,120,0.11); }
	.v-quick-link svg { color: var(--slate); flex-shrink: 0; }

	/* ── Responsive ── */
	@media (max-width: 1100px) {
		.v-grid { grid-template-columns: 1fr 1fr; }
	}
	@media (max-width: 900px) {
		.v-main { display: flex; flex-direction: column; }
		.v-assistant {
			order: -1; position: static;
			width: 100%; border-radius: var(--v-radius);
			margin-bottom: var(--v-gap);
			box-shadow: var(--v-lift);
			border: 1px solid var(--border-soft);
		}
		.v-assistant-inner { padding: 1.5rem; }
		.v-grid { margin-right: 0; padding-right: 0; grid-template-columns: 1fr; }
		.v-day-badge { top: 1rem; right: 1rem; }
	}
</style>
