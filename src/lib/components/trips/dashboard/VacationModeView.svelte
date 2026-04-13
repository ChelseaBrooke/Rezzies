<script lang="ts">
	import { onMount } from 'svelte';
	import ProfileTooltip from '$lib/components/profile/ProfileTooltip.svelte';
	import PollCardContainer from '$lib/components/trips/polls/PollCardContainer.svelte';
	import { openProfileCard } from '$lib/stores/profileOverlay.js';
	import { getTripGames, GAME_DEFS } from '$lib/stores/tripGames.js';
	import type { TripGame, GameDef } from '$lib/stores/tripGames.js';

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
		roomId?: number;
		partySize?: number;
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

	const checkInTime = $derived(trip?.checkInTime ?? null);
	const checkOutTime = $derived(trip?.checkOutTime ?? null);

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
	const parkingNotes = $derived(trip?.parkingNotes ?? null);
	const houseRules = $derived(trip?.houseRules ?? null);

	const houseCheckInDisplay = $derived((checkInTime ?? '').trim() ? formatTime12(checkInTime) : '');
	const houseCheckOutDisplay = $derived((checkOutTime ?? '').trim() ? formatTime12(checkOutTime) : '');
	const houseParkingDisplay = $derived((parkingNotes ?? '').trim());
	const houseAddressDisplay = $derived(address);
	const houseRulesLines = $derived.by((): string[] => {
		const raw = (houseRules ?? '').trim();
		if (!raw) return [];
		const byNl = raw.split(/\n+/).map((l) => l.trim()).filter(Boolean);
		if (byNl.length > 1) return byNl;
		const bySemi = raw.split(/\s*;\s*/).map((l) => l.trim()).filter(Boolean);
		if (bySemi.length > 1) return bySemi;
		const byBullet = raw.split(/\s*•\s*|\s*[·•]\s*/).map((l) => l.trim()).filter(Boolean);
		if (byBullet.length > 1) return byBullet;
		return [raw];
	});

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

	function firstToken(name: string | null | undefined): string {
		const s = name?.trim();
		if (!s) return '';
		return (s.split(/\s+/)[0] ?? s).trim();
	}

	function formatBedDisplay(raw: string | null | undefined): string {
		const s = raw?.trim();
		if (!s) return '';
		const lower = s.toLowerCase();
		return lower.charAt(0).toUpperCase() + lower.slice(1);
	}

	/** Second guest first name when full name lists two people (e.g. "Chelsea & Brett Smith"). */
	function secondGuestFirstFromCombinedName(full: string | null | undefined): string {
		const s = full?.trim();
		if (!s) return '';
		const parts = s.split(/\s*(?:&|\+|\/|,|\band\b)\s*/i).filter(Boolean);
		if (parts.length < 2) return '';
		return firstToken(parts[1]);
	}

	// First room photo for current user (my room); host: any guest room photo as preview
	const myRoomPhoto = $derived.by(() => {
		for (const a of myAssignments ?? []) {
			const url = a.room?.photoUrls?.[0];
			if (url) return url;
		}
		const mine = myAssignment?.room?.photoUrls?.[0];
		if (mine) return mine;
		if (isHost) {
			for (const a of roomAssignments ?? []) {
				const url = a.room?.photoUrls?.[0];
				if (url) return url;
			}
		}
		return null;
	});
	const myRoomName = $derived(myAssignment?.room?.name ?? (myAssignments?.[0]?.room?.name) ?? null);
	const myBedType = $derived(myAssignment?.bed?.bedType ?? (myAssignments?.[0]?.bed?.bedType) ?? null);
	const primaryAssignment = $derived(myAssignment ?? myAssignments?.[0] ?? null);
	const stayPartySize = $derived.by(() => {
		const ps = primaryAssignment?.partySize;
		if (typeof ps === 'number' && ps > 0) return ps;
		const adults = userRsvp?.adultsCount ?? 1;
		const kids = userRsvp?.kidsCount ?? 0;
		return Math.max(1, adults + kids);
	});
	const stayPrimaryFirst = $derived(firstToken(currentUserName) || (isHost ? 'Host' : 'Guest'));
	const stayPlusFirst = $derived(secondGuestFirstFromCombinedName(currentUserName));
	const stayShowPlusSlot = $derived(stayPartySize > 1 || !!stayPlusFirst);
	/** Human-readable room name only; omit awkward aggregates (e.g. host with many rooms). */
	const stayRoomValue = $derived.by(() => {
		if (isHost) {
			const ids = new Set((roomAssignments ?? []).map((a) => a.roomId).filter((id) => id != null));
			if (ids.size !== 1) return '';
			return roomAssignments.find((a) => a.room?.name?.trim())?.room?.name?.trim() ?? '';
		}
		return myRoomName?.trim() ?? '';
	});
	const stayBedValue = $derived(isHost ? '' : formatBedDisplay(myBedType));
	const stayPartyValue = $derived(String(stayPartySize));
	const stayCheckInValue = $derived((checkInTime ?? '').trim() ? formatTime12(checkInTime) : '');
	const stayCheckOutValue = $derived((checkOutTime ?? '').trim() ? formatTime12(checkOutTime) : '');
	const stayGuestLine = $derived.by(() => {
		const a = stayPrimaryFirst;
		if (!stayShowPlusSlot) return a;
		const b = stayPlusFirst;
		if (b) return `${a} + ${b}`;
		return `${a} +`;
	});
	/** Single polished line: bed + party (e.g. "Queen bed · 2 guests"). */
	const stayBedPartySummary = $derived.by(() => {
		const n = stayPartySize;
		const guestWord = n === 1 ? 'guest' : 'guests';
		const partyPart = `${n} ${guestWord}`;
		const bed = (stayBedValue ?? '').trim();
		if (bed) return `${bed} · ${partyPart}`;
		return partyPart;
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
			<div class="v-hero-title-stack">
				<h1 class="v-hero-title">{displayTripName}</h1>
				{#if hostName}<p class="v-hero-host">Hosted by {hostName}</p>{/if}
				{#if (trip.description ?? '').trim()}
					<p class="v-hero-desc">{(trip.description ?? '').trim()}</p>
				{/if}
			</div>
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

			<!-- My Stay — primary reservation card (warmer, more composed than House Info) -->
			<section class="v-tile v-suite-stay" aria-labelledby="v-stay-title">
				<header class="v-suite-head v-suite-head--stay">
					<h2 class="v-suite-head-title" id="v-stay-title">My Stay</h2>
					<p class="v-suite-head-dek">Your room and reservation details</p>
				</header>

				<div class="v-suite-stay-main">
					<figure class="v-suite-stay-figure">
						{#if myRoomPhoto}
							<img src={myRoomPhoto} alt="" class="v-suite-stay-img" />
						{:else}
							<div class="v-suite-stay-placeholder" aria-hidden="true">
								<svg
									xmlns="http://www.w3.org/2000/svg"
									width="40"
									height="40"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="1"
									stroke-linecap="round"
									stroke-linejoin="round"
								>
									<path d="M3 10.5V20a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1v-9.5" />
									<path d="M3 10.5 12 4l9 6.5" />
									<path d="M9 21v-6h6v6" />
								</svg>
							</div>
						{/if}
					</figure>
					<div class="v-suite-stay-panel">
						<p class="v-suite-stay-room" class:v-suite-stay-room--empty={!stayRoomValue}>
							{stayRoomValue || '\u2014'}
						</p>
						<p
							class="v-suite-stay-guests"
							class:v-suite-stay-guests--placeholder={stayShowPlusSlot && !stayPlusFirst}
						>
							{stayGuestLine}
						</p>
						<p class="v-suite-stay-summary" aria-label="Bed and party size">{stayBedPartySummary}</p>
					</div>
				</div>

				<div class="v-suite-stay-times" aria-label="Arrival and departure times">
					<div class="v-suite-stay-time">
						<span class="v-suite-stay-time-k">Check-in</span>
						<span class="v-suite-stay-time-v" class:v-suite-stay-time-v--empty={!stayCheckInValue}
							>{stayCheckInValue || '\u2014'}</span
						>
					</div>
					<div class="v-suite-stay-time">
						<span class="v-suite-stay-time-k">Check-out</span>
						<span class="v-suite-stay-time-v" class:v-suite-stay-time-v--empty={!stayCheckOutValue}
							>{stayCheckOutValue || '\u2014'}</span
						>
					</div>
				</div>
			</section>

			<!-- House Info — secondary guest guide (quieter, flatter) -->
			<section class="v-tile v-suite-house" aria-labelledby="v-house-title">
				<header class="v-suite-head v-suite-head--quiet">
					<h2 class="v-suite-head-title" id="v-house-title">House Info</h2>
					<p class="v-suite-head-dek">Everything you need during your stay</p>
				</header>

				<div class="v-suite-house-grid">
					<div class="v-suite-kv">
						<span class="v-suite-k">Check-in</span>
						<span class="v-suite-v" class:v-suite-v--empty={!houseCheckInDisplay}>{houseCheckInDisplay || '\u2014'}</span>
					</div>
					<div class="v-suite-kv">
						<span class="v-suite-k">Check-out</span>
						<span class="v-suite-v" class:v-suite-v--empty={!houseCheckOutDisplay}>{houseCheckOutDisplay || '\u2014'}</span>
					</div>
					<div class="v-suite-kv v-suite-span2">
						<span class="v-suite-k">Parking</span>
						<span class="v-suite-v" class:v-suite-v--empty={!houseParkingDisplay}>{houseParkingDisplay || '\u2014'}</span>
					</div>
					<div class="v-suite-kv v-suite-span2 v-suite-kv--wifi">
						<span class="v-suite-k">Wi-Fi</span>
						<div class="v-suite-wifi-lines">
							<p class="v-suite-wifi-line">
								<span class="v-suite-wifi-label">Network</span>
								<span class="v-suite-v" class:v-suite-v--empty={!(wifiName ?? '').trim()}
									>{(wifiName ?? '').trim() || '\u2014'}</span
								>
							</p>
							<p class="v-suite-wifi-line">
								<span class="v-suite-wifi-label">Password</span>
								<span class="v-suite-v" class:v-suite-v--empty={!(wifiPassword ?? '').trim()}
									>{(wifiPassword ?? '').trim() || '\u2014'}</span
								>
							</p>
						</div>
					</div>
					<div class="v-suite-kv v-suite-span2">
						<span class="v-suite-k">Address</span>
						{#if houseAddressDisplay}
							{#if mapsUrl}
								<a href={mapsUrl} target="_blank" rel="noopener noreferrer" class="v-suite-v v-suite-link">{houseAddressDisplay}</a>
							{:else}
								<span class="v-suite-v">{houseAddressDisplay}</span>
							{/if}
						{:else}
							<span class="v-suite-v v-suite-v--empty">{'\u2014'}</span>
						{/if}
					</div>
				</div>

				<div class="v-suite-rules">
					<h3 class="v-suite-rules-title" id="v-house-rules-heading">House rules</h3>
					{#if houseRulesLines.length > 0}
						<ul class="v-suite-rules-list" aria-labelledby="v-house-rules-heading">
							{#each houseRulesLines as line}
								<li>{line}</li>
							{/each}
						</ul>
					{:else}
						<p class="v-suite-rules-empty">Nothing listed yet. Your host may share notes before you arrive.</p>
					{/if}
				</div>
			</section>
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

				<!-- Today's games (same tiles as main Trip Games; vacation sidebar) -->
				<section class="v-today" aria-labelledby="v-assistant-games-heading">
					<h3 class="v-today-heading" id="v-assistant-games-heading">Today's games</h3>
					{#if tripGamesList.length === 0}
						<div class="v-today-empty">
							<span class="v-today-empty-icon" aria-hidden="true">🎲</span>
							<p>No games on this trip yet.</p>
						</div>
					{:else}
						<div class="v-games-grid v-games-grid--assistant">
							{#each tripGamesList as tg}
								{@const def = gameDef(tg)}
								<a
									href="/trips/{tripId}/games?tab={tg.gameId}"
									class="v-game-tile v-game-tile--{tg.gameId}"
									data-trip-game-id={tg.id}
								>
									<span class="v-game-tile-icon">{def?.icon ?? '🎮'}</span>
									<span class="v-game-tile-name">{gameDisplayName(tg)}</span>
								</a>
							{/each}
						</div>
					{/if}
					<a href="/trips/{tripId}/games" class="v-today-link">All games →</a>
				</section>
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
		display: flex; flex-direction: column; gap: 0.65rem;
	}
	.v-hero-title-stack {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 0.15rem;
		max-width: min(40rem, 100%);
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
		margin: 0;
		font-size: 0.875rem;
		font-weight: 500;
		color: rgba(255,255,255,0.9);
		line-height: 1.3;
	}
	.v-hero-desc {
		margin: 0.25rem 0 0;
		font-size: 0.875rem;
		font-weight: 400;
		line-height: 1.45;
		color: rgba(255,255,255,0.82);
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

	/* ── Left: My Stay + House Info side by side (stack on narrow viewports) ── */
	.v-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: var(--v-gap);
		padding-right: 1.5rem;
		margin-right: var(--v-right);
		align-items: stretch;
	}
	@media (max-width: 900px) {
		.v-grid {
			grid-template-columns: 1fr;
		}
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
	/* ── My Stay (primary): warmer, deeper, more composed ── */
	.v-tile.v-suite-stay {
		display: flex;
		flex-direction: column;
		gap: 1.3rem;
		padding: 1.5rem 1.55rem 1.55rem;
		border-radius: 18px;
		background: linear-gradient(158deg, #fffbf7 0%, #fdf5eb 38%, #f6ebe0 100%);
		border: 1px solid rgba(118, 78, 48, 0.12);
		box-shadow:
			0 1px 0 rgba(255, 255, 255, 0.98) inset,
			0 0 0 1px rgba(255, 255, 255, 0.45) inset,
			0 18px 44px rgba(48, 32, 22, 0.11),
			0 6px 16px rgba(48, 32, 22, 0.07);
		transition: transform 180ms ease, box-shadow 180ms ease;
	}
	.v-tile.v-suite-stay:hover {
		transform: translateY(-2px);
		box-shadow:
			0 1px 0 rgba(255, 255, 255, 0.98) inset,
			0 0 0 1px rgba(255, 255, 255, 0.5) inset,
			0 22px 50px rgba(48, 32, 22, 0.13),
			0 8px 20px rgba(48, 32, 22, 0.08);
	}

	/* ── House Info (secondary): flatter, lower contrast, utility guide ── */
	.v-tile.v-suite-house {
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
		padding: 1.1rem 1.2rem 1.15rem;
		border-radius: var(--v-radius);
		background: #f7f6f4;
		border: 1px solid rgba(62, 58, 52, 0.07);
		box-shadow: 0 1px 0 rgba(255, 255, 255, 0.85) inset, 0 6px 22px rgba(30, 28, 26, 0.04);
		transition: transform 180ms ease, box-shadow 180ms ease;
	}
	.v-tile.v-suite-house:hover {
		transform: translateY(-1px);
		box-shadow: 0 1px 0 rgba(255, 255, 255, 0.9) inset, 0 10px 28px rgba(30, 28, 26, 0.06);
	}

	.v-suite-head {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
	}
	.v-suite-head-title {
		margin: 0;
		font-family: 'Fraunces', Georgia, serif;
		font-size: 1.0625rem;
		font-weight: 600;
		letter-spacing: -0.02em;
		line-height: 1.2;
		color: #152a2c;
	}
	.v-suite-head--stay .v-suite-head-title {
		font-size: 1.1875rem;
		letter-spacing: -0.028em;
		color: #102428;
	}
	.v-suite-head--stay .v-suite-head-dek {
		color: rgba(48, 42, 38, 0.52);
	}
	.v-suite-head--quiet .v-suite-head-title {
		font-size: 0.9375rem;
		font-weight: 600;
		color: rgba(38, 44, 43, 0.78);
	}
	.v-suite-head--quiet .v-suite-head-dek {
		font-size: 0.75rem;
		color: rgba(38, 44, 43, 0.4);
	}
	.v-suite-head-dek {
		margin: 0;
		font-size: 0.8125rem;
		font-weight: 500;
		line-height: 1.45;
		color: rgba(42, 49, 48, 0.5);
		max-width: 28rem;
	}
	.v-suite-kv {
		display: flex;
		flex-direction: column;
		gap: 0.22rem;
		min-width: 0;
	}
	.v-suite-k {
		font-size: 0.6875rem;
		font-weight: 500;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: rgba(42, 49, 48, 0.4);
	}
	.v-suite-v {
		margin: 0;
		font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
		font-size: 0.9375rem;
		font-weight: 600;
		line-height: 1.45;
		color: #1a2322;
		word-break: break-word;
	}
	.v-suite-v--empty {
		color: rgba(26, 35, 34, 0.38);
		font-weight: 500;
	}
	.v-tile.v-suite-house .v-suite-v {
		font-size: 0.875rem;
		font-weight: 600;
		color: rgba(34, 40, 39, 0.86);
	}
	.v-tile.v-suite-house .v-suite-k {
		font-size: 0.625rem;
		letter-spacing: 0.07em;
		color: rgba(38, 44, 43, 0.34);
	}
	.v-tile.v-suite-house .v-suite-v--empty {
		color: rgba(34, 40, 39, 0.32);
	}
	.v-tile.v-suite-house .v-suite-wifi-label {
		color: rgba(38, 44, 43, 0.36);
	}
	.v-suite-link {
		color: #1a3d3f;
		text-decoration: none;
		border-bottom: 1px solid rgba(47, 119, 120, 0.25);
		transition: color 0.15s ease, border-color 0.15s ease;
	}
	.v-suite-link:hover {
		color: var(--primary);
		border-bottom-color: rgba(47, 119, 120, 0.45);
	}
	.v-tile.v-suite-house .v-suite-link {
		color: rgba(34, 40, 39, 0.88);
		border-bottom-color: rgba(47, 119, 120, 0.16);
	}

	/* My Stay: photo + tinted summary panel */
	.v-suite-stay-main {
		display: grid;
		grid-template-columns: minmax(11rem, 42%) minmax(0, 1fr);
		gap: 1.15rem 1.25rem;
		align-items: stretch;
	}
	@media (max-width: 520px) {
		.v-suite-stay-main {
			grid-template-columns: 1fr;
		}
	}
	.v-suite-stay-figure {
		margin: 0;
		border-radius: 16px;
		overflow: hidden;
		aspect-ratio: 4 / 3;
		background: linear-gradient(145deg, #e6d9cc 0%, #d4c4b4 55%, #c9b8a6 100%);
		box-shadow:
			0 0 0 1px rgba(92, 62, 40, 0.12) inset,
			0 10px 28px rgba(42, 28, 18, 0.12);
		align-self: start;
	}
	.v-suite-stay-img {
		width: 100%;
		height: 100%;
		min-height: 9rem;
		object-fit: cover;
		display: block;
	}
	.v-suite-stay-placeholder {
		min-height: 9rem;
		aspect-ratio: 4 / 3;
		display: flex;
		align-items: center;
		justify-content: center;
		color: rgba(72, 52, 36, 0.28);
	}
	.v-suite-stay-panel {
		min-width: 0;
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: 0;
		padding: 1rem 1.1rem 1.05rem;
		border-radius: 14px;
		background: linear-gradient(180deg, rgba(255, 252, 248, 0.92) 0%, rgba(250, 242, 232, 0.55) 100%);
		box-shadow: 0 0 0 1px rgba(118, 78, 48, 0.07) inset;
	}
	.v-suite-stay-room {
		margin: 0 0 0.45rem;
		font-family: 'Fraunces', Georgia, serif;
		font-size: clamp(1.28rem, 2.6vw, 1.58rem);
		font-weight: 600;
		letter-spacing: -0.035em;
		line-height: 1.14;
		color: #0e2224;
		word-break: break-word;
	}
	.v-suite-stay-room--empty {
		color: rgba(14, 34, 36, 0.34);
		font-weight: 600;
	}
	.v-suite-stay-guests {
		margin: 0 0 0.65rem;
		font-size: 0.875rem;
		font-weight: 500;
		line-height: 1.45;
		color: rgba(42, 38, 34, 0.72);
	}
	.v-suite-stay-guests--placeholder {
		color: rgba(42, 38, 34, 0.52);
	}
	.v-suite-stay-summary {
		margin: 0;
		font-size: 0.8125rem;
		font-weight: 600;
		letter-spacing: 0.03em;
		color: rgba(52, 44, 38, 0.68);
		line-height: 1.45;
	}
	.v-suite-stay-times {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.75rem 1.25rem;
		padding: 0.95rem 1.1rem;
		border-radius: 14px;
		background: rgba(88, 56, 32, 0.065);
		box-shadow: 0 0 0 1px rgba(88, 56, 32, 0.06) inset;
	}
	.v-suite-stay-time {
		display: flex;
		flex-direction: column;
		gap: 0.18rem;
		min-width: 0;
	}
	.v-suite-stay-time-k {
		font-size: 0.625rem;
		font-weight: 500;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: rgba(48, 42, 38, 0.42);
	}
	.v-suite-stay-time-v {
		font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
		font-size: 0.9375rem;
		font-weight: 600;
		line-height: 1.35;
		color: #1a2322;
	}
	.v-suite-stay-time-v--empty {
		color: rgba(26, 35, 34, 0.36);
		font-weight: 500;
	}

	/* House Info: compact two-column essentials + rules */
	.v-suite-house-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.75rem 1.25rem;
	}
	@media (max-width: 560px) {
		.v-suite-house-grid {
			grid-template-columns: 1fr;
		}
		.v-suite-span2 {
			grid-column: auto;
		}
	}
	.v-suite-span2 {
		grid-column: 1 / -1;
	}
	.v-suite-kv--wifi .v-suite-wifi-lines {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		margin-top: 0.05rem;
	}
	.v-suite-wifi-line {
		margin: 0;
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 0.35rem 0.55rem;
		line-height: 1.45;
	}
	.v-suite-wifi-label {
		font-size: 0.75rem;
		font-weight: 500;
		color: rgba(42, 49, 48, 0.45);
		min-width: 4.25rem;
	}
	.v-tile.v-suite-house .v-suite-rules {
		padding-top: 0.75rem;
		margin-top: 0.1rem;
		border-top: 1px solid rgba(62, 58, 52, 0.08);
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
	}
	.v-suite-rules-title {
		margin: 0;
		font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
		font-size: 0.6875rem;
		font-weight: 600;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: rgba(38, 44, 43, 0.38);
	}
	.v-suite-rules-list {
		margin: 0;
		padding: 0 0 0 0.85rem;
		border-left: 2px solid rgba(47, 119, 120, 0.14);
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}
	.v-suite-rules-list li {
		font-size: 0.84375rem;
		font-weight: 500;
		line-height: 1.52;
		color: rgba(34, 40, 39, 0.82);
	}
	.v-suite-rules-empty {
		margin: 0;
		font-size: 0.8125rem;
		font-weight: 500;
		line-height: 1.5;
		color: rgba(38, 44, 43, 0.44);
	}
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

	.v-games-grid {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 0.5rem;
	}
	.v-games-grid--assistant {
		justify-content: flex-start;
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

	.v-badge {
		padding: 0.15rem 0.5rem; border-radius: 9999px;
		background: rgba(47,119,120,0.1); color: var(--slate);
		font-size: 0.75rem; font-weight: 600;
	}

	/* ── House Info accordion ── */
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
	.v-assistant-inner > .v-today ~ .v-today {
		margin-top: 0;
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

	/* ── Responsive ──
	   Stack the Daily Assistant below 1100px so we do not reserve --v-right on
	   the main column (that margin pushed the page scrollbar left of the screen edge). */
	@media (max-width: 1100px) {
		.v-main { display: flex; flex-direction: column; }
		.v-assistant {
			order: -1;
			position: static;
			width: 100%;
			border-radius: var(--v-radius);
			margin-bottom: var(--v-gap);
			box-shadow: var(--v-lift);
			border: 1px solid var(--border-soft);
		}
		.v-assistant-inner {
			padding: 1.5rem;
		}
		.v-grid {
			margin-right: 0;
			padding-right: 0;
			grid-template-columns: 1fr;
		}
		.v-day-badge {
			top: 1rem;
			right: 1rem;
		}
		.v-hero-who {
			right: 1.25rem;
		}
	}
</style>
