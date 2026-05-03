<script lang="ts">
	import ProfileTooltip from '$lib/components/profile/ProfileTooltip.svelte';
	import VacationHeroPollsCarousel from '$lib/components/trips/dashboard/VacationHeroPollsCarousel.svelte';
	import { openProfileCard } from '$lib/stores/profileOverlay.js';
	import { roomTypeDisplayLabel } from '$lib/room-type-display.js';

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
		room?: { id: string | number; name: string | null; photoUrls?: string[] } | null;
		bed?: { bedType: string | null } | null;
		user?: { id: string; name: string | null; avatarUrl?: string | null } | null;
		userId: string;
		roomId?: number;
		partySize?: number;
	}
	type StayRoomRow = { id: number; name?: string | null; roomType?: string | null };
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
		userRsvp = null,
		/** Trip rooms list, used to label your stay when assignment.room is missing but roomId is set */
		stayRoomLookup = [],
		/** Resolved on the trip dashboard load (guest), avoids client/prop sync issues */
		serverStayRoomLabel = null as string | null,
		gamesUiEnabled = false
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
		userRsvp?: { adultsCount?: number; kidsCount?: number } | null;
		stayRoomLookup?: StayRoomRow[];
		serverStayRoomLabel?: string | null;
		gamesUiEnabled?: boolean;
	} = $props();

	function stayRoomLabelFromAssignment(a: RoomAssignment | null | undefined): string | null {
		if (!a) return null;
		const fromRel = a.room?.name?.trim();
		if (fromRel) return fromRel;
		const rid = a.roomId;
		if (rid == null || !Number.isFinite(rid)) return null;
		const row = (stayRoomLookup ?? []).find((x) => x.id === rid);
		if (!row) return null;
		const nm = row.name?.trim();
		if (nm) return nm;
		return roomTypeDisplayLabel(row);
	}

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
		if (!t) return '-';
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
	const myRoomName = $derived.by(() => {
		for (const a of myAssignments ?? []) {
			const label = stayRoomLabelFromAssignment(a);
			if (label) return label;
		}
		return stayRoomLabelFromAssignment(myAssignment);
	});
	const myBedType = $derived.by(() => {
		for (const a of myAssignments ?? []) {
			const t = a.bed?.bedType?.trim();
			if (t) return t;
		}
		return myAssignment?.bed?.bedType?.trim() ?? null;
	});
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
		const fromServer = serverStayRoomLabel?.trim();
		if (fromServer) return fromServer;
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

	/** Last calendar day of the trip (checkout day): show a gentle reminder at the top of the dashboard. */
	const isCheckoutDay = $derived(
		toDateString(checkOutDate) === todayKey && Boolean((checkOutTime ?? '').trim())
	);
	const checkoutBannerLine = $derived(
		isCheckoutDay ? `Check-out today at ${formatTime12(checkOutTime)}` : ''
	);

	let houseInfoDialog = $state<HTMLDialogElement | null>(null);

	function openHouseInfo() {
		houseInfoDialog?.showModal();
	}

	function closeHouseInfo() {
		houseInfoDialog?.close();
	}
</script>

<!-- ════════════════ TEMPLATE ════════════════ -->
<div class="v">
	{#if isCheckoutDay}
		<div class="v-checkout-banner" role="status">
			<span class="v-checkout-banner-icon" aria-hidden="true">🧳</span>
			<p class="v-checkout-banner-text">{checkoutBannerLine}</p>
		</div>
	{/if}
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
			<div class="v-hero-actions">
				{#if mapsUrl}
					<a href={mapsUrl} target="_blank" rel="noopener noreferrer" class="v-pill v-pill--hero">
						<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
						Open Directions
					</a>
				{/if}
				<button type="button" class="v-pill v-pill--hero v-pill--hero-secondary" onclick={openHouseInfo}>
					<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
					House info
				</button>
			</div>
		</div>

		<VacationHeroPollsCarousel {tripId} {isHost} />

		<!-- Who's here: bottom-right inside hero, overlapping avatar bubbles -->
		<div class="v-hero-who">
			<span class="v-who-float-label">Who's here</span>
			<div class="v-hero-avatars">
				{#if yesRsvps.length > 0}
					{#each yesRsvps.slice(0, 14) as r, i}
						{#if r.user?.id}
							<ProfileTooltip userId={r.user.id}>
								<button type="button" class="v-hero-avatar" style="z-index: {i}" title={r.user.name ?? ''} onclick={() => openProfileCard(r.user!.id)}>
									{#if r.user.avatarUrl}
										<img src={r.user.avatarUrl} alt="" />
									{:else}
										<span>{initials(r.user.name)}</span>
									{/if}
								</button>
							</ProfileTooltip>
						{:else}
							<span class="v-hero-avatar" style="z-index: {i}">
								<span>{initials(r.user?.name)}</span>
							</span>
						{/if}
					{/each}
					{#if yesRsvps.length > 14}
						<span class="v-hero-avatar v-hero-avatar--more" style="z-index: 14">+{yesRsvps.length - 14}</span>
					{/if}
				{:else}
					<span class="v-hero-avatar v-hero-avatar--placeholder" title="RSVP yes to show up here">-</span>
				{/if}
			</div>
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
		<div class="v-grid">
			<!-- My Stay, full width -->
			<section class="v-tile v-suite-stay v-tile--full" aria-labelledby="v-stay-title">
				<div class="v-suite-stay-compact">
					<figure class="v-suite-stay-thumb">
						{#if myRoomPhoto}
							<img src={myRoomPhoto} alt="" class="v-suite-stay-thumb-img" />
						{:else}
							<div class="v-suite-stay-thumb-placeholder" aria-hidden="true">
								<svg
									xmlns="http://www.w3.org/2000/svg"
									width="28"
									height="28"
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
					<div class="v-suite-stay-copy">
						<div class="v-suite-stay-top">
							<h2 id="v-stay-title" class="v-suite-stay-h2">My Stay</h2>
							<div class="v-suite-stay-chips" aria-label="Arrival and departure times">
								<div class="v-suite-stay-chip">
									<span class="v-suite-stay-chip-k">Check-in</span>
									<span class="v-suite-stay-chip-v" class:v-suite-stay-chip-v--empty={!stayCheckInValue}
										>{stayCheckInValue || '-'}</span
									>
								</div>
								<div class="v-suite-stay-chip">
									<span class="v-suite-stay-chip-k">Check-out</span>
									<span class="v-suite-stay-chip-v" class:v-suite-stay-chip-v--empty={!stayCheckOutValue}
										>{stayCheckOutValue || '-'}</span
									>
								</div>
							</div>
						</div>
						<p class="v-suite-stay-roomline" class:v-suite-stay-roomline--empty={!stayRoomValue}>
							{stayRoomValue || 'Room TBD'}
						</p>
						<p
							class="v-suite-stay-metarow"
							class:v-suite-stay-metarow--placeholder={stayShowPlusSlot && !stayPlusFirst}
						>
							<span class="v-suite-stay-meta-strong">{stayGuestLine}</span>
							<span class="v-suite-stay-meta-dot" aria-hidden="true">·</span>
							<span>{stayBedPartySummary}</span>
						</p>
					</div>
				</div>
			</section>

			<!-- Quick actions: 2×2 feature tiles, warm + teal brand shell (fills card, not a skinny list) -->
			<section class="v-tile v-suite-quick v-tile--full" aria-labelledby="v-main-quick-title">
				<div class="v-quick-pack">
					<header class="v-quick-pack__head">
						<div class="v-quick-pack__head-inner">
							<p class="v-quick-pack__eyebrow">While you’re here</p>
							<h2 class="v-quick-pack__title" id="v-main-quick-title">Do something fun</h2>
						</div>
					</header>
					<div class="v-quick-tiles">
						{#if gamesUiEnabled}
							<a href="/trips/{tripId}/games" class="v-quick-tile v-quick-tile--games">
								<span class="v-quick-tile__icon" aria-hidden="true">
									<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
										<rect x="2" y="6" width="20" height="12" rx="4" />
										<line x1="7" y1="12" x2="10" y2="12" />
										<line x1="8.5" y1="10.5" x2="8.5" y2="13.5" />
										<circle cx="16" cy="12" r="0.9" fill="currentColor" stroke="none" />
										<circle cx="19" cy="12" r="0.9" fill="currentColor" stroke="none" />
									</svg>
								</span>
								<span class="v-quick-tile__body">
									<span class="v-quick-tile__kicker">Play</span>
									<span class="v-quick-tile__name">Group games</span>
									<span class="v-quick-tile__sub">Scoreboards, prompts &amp; laughs</span>
								</span>
								<span class="v-quick-tile__arrow" aria-hidden="true">
									<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6" /></svg>
								</span>
							</a>
						{/if}
						<a href="/trips/{tripId}/files" class="v-quick-tile v-quick-tile--gallery">
							<span class="v-quick-tile__icon" aria-hidden="true">
								<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
									<rect x="3" y="5" width="18" height="16" rx="2.5" />
									<path d="m3 17 4.2-3.3a1.2 1.2 0 0 1 1.5 0L14 16.5" />
									<circle cx="8" cy="10" r="1" fill="currentColor" stroke="none" />
									<path d="M15 8.5a1.5 1.5 0 0 1 2.2-1.3L21 10" />
								</svg>
							</span>
							<span class="v-quick-tile__body">
								<span class="v-quick-tile__kicker">Gallery</span>
								<span class="v-quick-tile__name">Drop a photo</span>
								<span class="v-quick-tile__sub">Build the trip album</span>
							</span>
							<span class="v-quick-tile__arrow" aria-hidden="true">
								<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6" /></svg>
							</span>
						</a>
						<a href="/trips/{tripId}/polls" class="v-quick-tile v-quick-tile--polls">
							<span class="v-quick-tile__icon" aria-hidden="true">
								<svg
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="1.5"
									stroke-linecap="round"
									stroke-linejoin="round"
								>
									<line x1="5" y1="20" x2="5" y2="11" stroke-width="2.3" />
									<line x1="9.5" y1="20" x2="9.5" y2="4" stroke-width="2.3" />
									<line x1="14" y1="20" x2="14" y2="13" stroke-width="2.3" />
									<line x1="18.5" y1="20" x2="18.5" y2="8" stroke-width="2.3" />
								</svg>
							</span>
							<span class="v-quick-tile__body">
								<span class="v-quick-tile__kicker">Decide</span>
								<span class="v-quick-tile__name">Polls</span>
								<span class="v-quick-tile__sub">Meals, times &amp; group picks</span>
							</span>
							<span class="v-quick-tile__arrow" aria-hidden="true">
								<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6" /></svg>
							</span>
						</a>
						<a href="/trips/{tripId}/itinerary" class="v-quick-tile v-quick-tile--plan">
							<span class="v-quick-tile__icon" aria-hidden="true">
								<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
									<rect x="3" y="5" width="18" height="16" rx="2" />
									<path d="M8 2v4M16 2v4M2 10h20" />
									<path d="M7 14.5h.01M12 14.5h.01M17 14.5h.01" />
								</svg>
							</span>
							<span class="v-quick-tile__body">
								<span class="v-quick-tile__kicker">Plan</span>
								<span class="v-quick-tile__name">Itinerary</span>
								<span class="v-quick-tile__sub">Add moments to the day</span>
							</span>
							<span class="v-quick-tile__arrow" aria-hidden="true">
								<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6" /></svg>
							</span>
						</a>
					</div>
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
						<span>-</span>
					</p>
				</header>

				<!-- Today's schedule + day badge overlapping card top -->
				<div class="v-today-with-badge">
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
				{#if dayNumber !== null && totalDays !== null}
					<div class="v-sidebar-day-wrap">
						<div class="v-day-badge" aria-label="Trip day {dayNumber} of {totalDays}">
							<span class="v-day-num">{dayNumber}</span>
							<span class="v-day-label">of {totalDays}<br/>days</span>
						</div>
					</div>
				{/if}
				</div>
			</div>
		</aside>
	</div>

	<!-- House info (same content as former card; opened from hero) -->
	<dialog
		bind:this={houseInfoDialog}
		class="v-house-modal"
		aria-labelledby="v-house-modal-title"
		onclick={(e) => {
			if (e.target === e.currentTarget) closeHouseInfo();
		}}
	>
		<div class="v-house-modal-panel">
			<header class="v-house-modal-head">
				<div>
					<h2 id="v-house-modal-title" class="v-house-modal-title">House info</h2>
					<p class="v-house-modal-dek">Everything you need during your stay</p>
				</div>
				<button type="button" class="v-house-modal-close" onclick={closeHouseInfo} aria-label="Close house info">
					<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
				</button>
			</header>

			<div class="v-tile v-suite-house v-house-modal-body">
				<div class="v-suite-house-grid">
					<div class="v-suite-kv">
						<span class="v-suite-k">Check-in</span>
						<span class="v-suite-v" class:v-suite-v--empty={!houseCheckInDisplay}>{houseCheckInDisplay || '-'}</span>
					</div>
					<div class="v-suite-kv">
						<span class="v-suite-k">Check-out</span>
						<span class="v-suite-v" class:v-suite-v--empty={!houseCheckOutDisplay}>{houseCheckOutDisplay || '-'}</span>
					</div>
					<div class="v-suite-kv v-suite-span2">
						<span class="v-suite-k">Parking</span>
						<span class="v-suite-v" class:v-suite-v--empty={!houseParkingDisplay}>{houseParkingDisplay || '-'}</span>
					</div>
					<div class="v-suite-kv v-suite-span2 v-suite-kv--wifi">
						<span class="v-suite-k">Wi-Fi</span>
						<div class="v-suite-wifi-lines">
							<p class="v-suite-wifi-line">
								<span class="v-suite-wifi-label">Network</span>
								<span class="v-suite-v" class:v-suite-v--empty={!(wifiName ?? '').trim()}
									>{(wifiName ?? '').trim() || '-'}</span
								>
							</p>
							<p class="v-suite-wifi-line">
								<span class="v-suite-wifi-label">Password</span>
								<span class="v-suite-v" class:v-suite-v--empty={!(wifiPassword ?? '').trim()}
									>{(wifiPassword ?? '').trim() || '-'}</span
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
							<span class="v-suite-v v-suite-v--empty">-</span>
						{/if}
					</div>
				</div>

				<div class="v-suite-rules">
					<h3 class="v-suite-rules-title" id="v-house-modal-rules-heading">House rules</h3>
					{#if houseRulesLines.length > 0}
						<ul class="v-suite-rules-list" aria-labelledby="v-house-modal-rules-heading">
							{#each houseRulesLines as line}
								<li>{line}</li>
							{/each}
						</ul>
					{:else}
						<p class="v-suite-rules-empty">Nothing listed yet. Your host may share notes before you arrive.</p>
					{/if}
				</div>
			</div>
		</div>
	</dialog>
</div>

<!-- ════════════════ STYLES ════════════════ -->
<style>
	/* ── Shell ── */
	/* One canvas for main column + assistant (must match .v-assistant exactly) */
	.v,
	.v-assistant {
		background: linear-gradient(175deg, #fdf5e6 0%, #fdf8f0 40%, #ffffff 70%);
		background-attachment: fixed;
	}

	.v {
		--v-right: min(360px, 32vw);
		--v-gap: 1.25rem;
		--v-radius: 14px;
		--v-lift: 0 2px 10px rgba(0,0,0,0.06);
		--v-lift-hover: 0 6px 24px rgba(0,0,0,0.10);
		/*
		 * Match planning dash: top of `.v-hero` photo = only AppShell
		 * `--trip-dash-hero-offset` on `.main-content-inner`, do not stack extra padding here.
		 */
		padding-top: 0;
		position: relative;
		width: 100%;
		min-height: 100%;
		box-sizing: border-box;
	}

	.v-checkout-banner {
		display: flex;
		align-items: center;
		gap: 0.65rem;
		padding: 0.55rem 1rem;
		margin-bottom: 0.65rem;
		border-radius: 10px;
		background: linear-gradient(90deg, rgba(47, 119, 120, 0.09) 0%, rgba(122, 206, 211, 0.08) 100%);
		border: 1px solid rgba(47, 119, 120, 0.18);
		box-shadow: 0 1px 0 rgba(255, 255, 255, 0.7) inset;
	}
	.v-checkout-banner-icon {
		font-size: 1.125rem;
		line-height: 1;
		flex-shrink: 0;
	}
	.v-checkout-banner-text {
		margin: 0;
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--text);
		letter-spacing: 0.01em;
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

	/* Day badge: overlaps top edge of Today's Schedule card (assistant column) */
	.v-today-with-badge {
		position: relative;
		margin-top: 0.75rem;
	}
	.v-today-with-badge .v-today {
		margin-top: 0;
	}
	.v-sidebar-day-wrap {
		position: absolute;
		top: 0;
		right: 1.1rem;
		z-index: 7;
		display: flex;
		justify-content: flex-end;
		width: auto;
		margin: 0;
		padding: 0;
		transform: translateY(calc(-50% + 3px));
		pointer-events: none;
	}
	.v-sidebar-day-wrap .v-day-badge {
		pointer-events: auto;
	}
	.v-day-badge {
		display: flex;
		align-items: baseline;
		gap: 0.4rem;
		background: var(--warm);
		border-radius: 16px;
		padding: 0.75rem 1.125rem 0.75rem 1rem;
		box-shadow: 0 4px 20px rgba(206,86,18,0.4);
		flex-shrink: 0;
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
	.v-hero-actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem;
		margin-top: 0.875rem;
	}
	.v-pill--hero {
		align-self: flex-start;
		margin-top: 0;
		padding: 0.4rem 1rem;
		font-size: 0.8125rem; font-weight: 600;
		background: rgba(255,255,255,0.18); backdrop-filter: blur(8px);
		color: #fff;
		border: 1px solid rgba(255,255,255,0.22);
		box-shadow: 0 2px 10px rgba(0,0,0,0.12);
		cursor: pointer;
		font: inherit;
		text-decoration: none;
	}
	.v-pill--hero:hover { background: rgba(255,255,255,0.28); }
	a.v-pill--hero {
		cursor: pointer;
	}
	.v-pill--hero-secondary {
		background: rgba(255,255,255,0.18);
		border-color: rgba(255,255,255,0.22);
	}
	.v-pill--hero-secondary:hover {
		background: rgba(255,255,255,0.28);
	}

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

	/* ── Left: My Stay + quick actions (full width column) ── */
	.v-grid {
		display: grid;
		grid-template-columns: 1fr;
		gap: var(--v-gap);
		padding-right: 1.5rem;
		margin-right: var(--v-right);
		align-items: stretch;
	}

	/* ── Shared tile ── */
	.v-tile {
		/* Slightly warm white so card faces match vacation sand, not cool gray-white */
		background: linear-gradient(180deg, #fffefb 0%, #fffdf9 100%);
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
	/* ── My Stay: compact strip (room photo + summary + inline times) ── */
	.v-tile.v-suite-stay {
		display: block;
		padding: 1.15rem 1.3rem 1.25rem;
		border-radius: 16px;
		background: linear-gradient(145deg, #fffbf7 0%, #faf4ec 45%, #f3ebe2 100%);
		border: 1px solid rgba(118, 78, 48, 0.1);
		box-shadow:
			0 1px 0 rgba(255, 255, 255, 0.95) inset,
			0 8px 24px rgba(48, 32, 22, 0.07);
		transition: transform 180ms ease, box-shadow 180ms ease;
	}
	.v-tile.v-suite-stay:hover {
		transform: translateY(-1px);
		box-shadow:
			0 1px 0 rgba(255, 255, 255, 0.98) inset,
			0 10px 28px rgba(48, 32, 22, 0.09);
	}
	.v-suite-stay-compact {
		display: grid;
		grid-template-columns: 168px minmax(0, 1fr);
		gap: 0.75rem 1.1rem;
		align-items: center;
		min-width: 0;
	}
	@media (max-width: 520px) {
		.v-suite-stay-compact {
			grid-template-columns: 132px minmax(0, 1fr);
			gap: 0.75rem 0.9rem;
		}
	}
	@media (max-width: 400px) {
		.v-suite-stay-compact {
			grid-template-columns: 1fr;
		}
		.v-suite-stay-thumb {
			max-width: 200px;
			width: 100%;
			height: 128px;
			margin: 0 auto;
		}
	}
	.v-suite-stay-thumb {
		margin: 0;
		width: 168px;
		height: 120px;
		border-radius: 12px;
		overflow: hidden;
		flex-shrink: 0;
		background: linear-gradient(145deg, #e6d9cc 0%, #d4c4b4 100%);
		box-shadow: 0 0 0 1px rgba(92, 62, 40, 0.1) inset, 0 4px 14px rgba(48, 32, 22, 0.1);
	}
	.v-suite-stay-thumb-img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}
	.v-suite-stay-thumb-placeholder {
		width: 100%;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		color: rgba(72, 52, 36, 0.3);
	}
	.v-suite-stay-copy {
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 0.32rem;
		padding: 0.05rem 0 0;
	}
	.v-suite-stay-top {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0.45rem 0.75rem;
		margin-bottom: 0.1rem;
	}
	.v-suite-stay-h2 {
		margin: 0;
		font-family: 'Fraunces', Georgia, serif;
		font-size: 1.15rem;
		font-weight: 700;
		letter-spacing: -0.02em;
		line-height: 1.2;
		color: #102428;
	}
	.v-suite-stay-chips {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
		align-items: center;
	}
	.v-suite-stay-chip {
		display: inline-flex;
		align-items: baseline;
		gap: 0.3rem;
		padding: 0.15rem 0.45rem 0.2rem;
		border-radius: 8px;
		background: rgba(88, 56, 32, 0.07);
		box-shadow: 0 0 0 1px rgba(88, 56, 32, 0.06) inset;
	}
	.v-suite-stay-chip-k {
		font-size: 0.5625rem;
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: rgba(48, 42, 38, 0.45);
	}
	.v-suite-stay-chip-v {
		font-size: 0.75rem;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
		color: #1a2322;
	}
	.v-suite-stay-chip-v--empty {
		color: rgba(26, 35, 34, 0.38);
		font-weight: 600;
	}
	.v-suite-stay-roomline {
		margin: 0.2rem 0 0;
		font-family: 'Fraunces', Georgia, serif;
		font-size: clamp(1.05rem, 2.2vw, 1.3rem);
		font-weight: 600;
		letter-spacing: -0.03em;
		line-height: 1.2;
		color: #0e2224;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.v-suite-stay-roomline--empty {
		color: rgba(14, 34, 36, 0.38);
		font-style: italic;
		font-weight: 600;
	}
	.v-suite-stay-metarow {
		margin: 0;
		font-size: 0.78rem;
		font-weight: 500;
		line-height: 1.35;
		color: rgba(42, 38, 34, 0.72);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.v-suite-stay-metarow--placeholder {
		color: rgba(42, 38, 34, 0.55);
	}
	.v-suite-stay-meta-strong {
		font-weight: 600;
		color: rgba(34, 30, 28, 0.88);
	}
	.v-suite-stay-meta-dot {
		margin: 0 0.2rem;
		opacity: 0.45;
	}
	@media (max-width: 640px) {
		.v-suite-stay-roomline,
		.v-suite-stay-metarow {
			white-space: normal;
		}
		.v-suite-stay-top {
			flex-direction: column;
			align-items: flex-start;
		}
		.v-suite-stay-chips {
			width: 100%;
		}
	}

	/* ── House Info (secondary): flatter, lower contrast, utility guide ── */
	.v-tile.v-suite-house {
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
		padding: 1.1rem 1.2rem 1.15rem;
		border-radius: var(--v-radius);
		background: linear-gradient(180deg, #faf7f2 0%, #f4efe8 100%);
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
	.v-tile--full {
		grid-column: 1 / -1;
	}

	.v-tile.v-suite-quick {
		padding: 0;
		background: transparent;
		border: none;
		box-shadow: none;
	}
	.v-tile.v-suite-quick:hover,
	.v-tile.v-suite-quick:focus-within {
		transform: none;
		box-shadow: none;
	}
	/* Warm + teal shell (My Stay / Divvi trip energy), not flat white */
	.v-quick-pack {
		position: relative;
		border-radius: 18px;
		border: 1px solid rgba(118, 78, 48, 0.12);
		background:
			radial-gradient(120% 80% at 100% 0%, rgba(122, 206, 211, 0.2) 0%, transparent 55%),
			radial-gradient(80% 60% at 0% 0%, rgba(255, 247, 235, 0.95) 0%, transparent 50%),
			linear-gradient(180deg, #fffcf8 0%, #fff 38%, #faf7f1 100%);
		box-shadow:
			0 1px 0 rgba(255, 255, 255, 0.95) inset,
			0 12px 40px rgba(48, 32, 22, 0.1),
			0 2px 8px rgba(29, 77, 78, 0.08);
		padding: 0.1rem 0.1rem 0.2rem;
		overflow: hidden;
	}
	.v-quick-pack::before {
		content: '';
		position: absolute;
		left: 0;
		right: 0;
		top: 0;
		height: 3px;
		background: linear-gradient(90deg, #ce5612 0%, #e8922c 28%, #2f7778 60%, #6fb8ba 100%);
		opacity: 0.9;
	}
	.v-quick-pack__head {
		padding: 0.8rem 1rem 0.35rem;
	}
	.v-quick-pack__head-inner {
		text-align: center;
		max-width: 20rem;
		margin: 0 auto;
	}
	.v-quick-pack__eyebrow {
		margin: 0 0 0.18rem;
		font-size: 0.62rem;
		font-weight: 700;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--slate, #2f7778);
		opacity: 0.75;
	}
	.v-quick-pack__title {
		margin: 0;
		font-family: 'Fraunces', Georgia, serif;
		font-size: 1.2rem;
		font-weight: 700;
		letter-spacing: -0.03em;
		line-height: 1.15;
		color: var(--navy, #1d4d4e);
	}
	.v-quick-tiles {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.55rem;
		padding: 0.45rem 0.7rem 0.8rem;
	}
	@media (max-width: 480px) {
		.v-quick-tiles {
			grid-template-columns: 1fr;
		}
	}
	.v-quick-tile {
		--t-accent: #2f7778;
		--t-ink: #0f1f20;
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 0.4rem;
		min-height: 5.75rem;
		padding: 0.75rem 0.8rem 1.75rem;
		text-decoration: none;
		color: var(--t-ink);
		border-radius: 14px;
		border: 1px solid rgba(255, 255, 255, 0.7);
		background-color: #fff;
		background-image: linear-gradient(
			150deg,
			rgba(255, 255, 255, 0.95) 0%,
			color-mix(in srgb, var(--t-accent) 7%, #fff) 100%
		);
		box-shadow:
			0 1px 0 rgba(255, 255, 255, 0.85) inset,
			0 6px 18px rgba(29, 55, 56, 0.08);
		transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
	}
	.v-quick-tile::after {
		content: '';
		position: absolute;
		inset: 0;
		border-radius: 14px;
		background: linear-gradient(135deg, color-mix(in srgb, var(--t-accent) 14%, transparent) 0%, transparent 55%);
		pointer-events: none;
		opacity: 0.5;
	}
	.v-quick-tile:hover {
		transform: translateY(-3px);
		box-shadow:
			0 1px 0 rgba(255, 255, 255, 0.95) inset,
			0 14px 32px color-mix(in srgb, var(--t-accent) 22%, rgba(0, 0, 0, 0.04));
		border-color: color-mix(in srgb, var(--t-accent) 28%, rgba(255, 255, 255, 0.5));
	}
	.v-quick-tile:focus-visible {
		outline: 2px solid var(--t-accent);
		outline-offset: 2px;
	}
	.v-quick-tile--games {
		--t-accent: #2f7778;
	}
	.v-quick-tile--gallery {
		--t-accent: #ce5612;
		--t-ink: #3a2317;
	}
	.v-quick-tile--polls {
		--t-accent: #1d4d4e;
	}
	.v-quick-tile--plan {
		--t-accent: #0f766e;
	}
	.v-quick-tile__icon {
		position: relative;
		z-index: 1;
		width: 2.35rem;
		height: 2.35rem;
		border-radius: 12px;
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--t-accent);
		background: linear-gradient(150deg, rgba(255, 255, 255, 0.95) 0%, rgba(255, 255, 255, 0.4) 100%);
		box-shadow: 0 0 0 1px color-mix(in srgb, var(--t-accent) 18%, transparent) inset, 0 2px 8px rgba(0, 0, 0, 0.04);
	}
	.v-quick-tile__icon svg {
		width: 1.2rem;
		height: 1.2rem;
		display: block;
	}
	.v-quick-tile__body {
		position: relative;
		z-index: 1;
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
		min-width: 0;
	}
	.v-quick-tile__kicker {
		font-size: 0.55rem;
		font-weight: 700;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--t-accent);
		opacity: 0.85;
	}
	.v-quick-tile__name {
		font-family: 'Fraunces', Georgia, serif;
		font-size: 0.88rem;
		font-weight: 700;
		letter-spacing: -0.02em;
		line-height: 1.18;
		color: var(--t-ink);
	}
	.v-quick-tile__sub {
		font-size: 0.65rem;
		font-weight: 500;
		line-height: 1.3;
		color: color-mix(in srgb, var(--t-ink) 50%, #555);
	}
	.v-quick-tile__arrow {
		position: absolute;
		z-index: 1;
		right: 0.6rem;
		bottom: 0.5rem;
		display: flex;
		color: var(--t-accent);
		opacity: 0.55;
		transition: transform 0.2s ease, opacity 0.2s ease;
	}
	.v-quick-tile__arrow svg {
		width: 1.1rem;
		height: 1.1rem;
		display: block;
	}
	.v-quick-tile:hover .v-quick-tile__arrow {
		opacity: 0.95;
		transform: translateX(3px);
	}

	/* House info dialog */
	.v-house-modal {
		width: min(100vw - 1rem, 500px);
		max-height: none;
		padding: 1.25rem;
		border: none;
		border-radius: 0;
		box-shadow: none;
		background: transparent;
		overflow: visible;
		margin: auto;
	}
	.v-house-modal::backdrop {
		background: rgba(15, 23, 42, 0.45);
		backdrop-filter: blur(3px);
	}
	.v-house-modal-panel {
		padding: 1.25rem 1.35rem 1.5rem;
		max-height: min(90vh - 2.5rem, 680px);
		overflow-y: auto;
		box-sizing: border-box;
		background: var(--surfaceSolid, #fff);
		border-radius: 16px;
		box-shadow: 0 24px 60px rgba(15, 23, 42, 0.2);
		border: 1px solid var(--border-soft, rgba(15, 23, 42, 0.08));
	}
	.v-house-modal-head {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1rem;
		margin-bottom: 1rem;
	}
	.v-house-modal-title {
		margin: 0;
		font-family: 'Fraunces', Georgia, serif;
		font-size: 1.25rem;
		font-weight: 700;
		color: #152a2c;
	}
	.v-house-modal-dek {
		margin: 0.35rem 0 0;
		font-size: 0.8125rem;
		color: var(--muted);
		line-height: 1.45;
	}
	.v-house-modal-close {
		flex-shrink: 0;
		width: 40px;
		height: 40px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border: none;
		border-radius: 10px;
		background: rgba(15, 23, 42, 0.06);
		color: #334155;
		cursor: pointer;
		transition: background 0.15s ease;
	}
	.v-house-modal-close:hover {
		background: rgba(15, 23, 42, 0.1);
	}
	.v-house-modal-body.v-tile {
		margin: 0;
		box-shadow: none;
		transform: none;
	}
	.v-house-modal-body.v-tile:hover {
		transform: none;
		box-shadow: none;
	}

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
		gap: 0;
	}
	.v-hero-avatar {
		width: 38px;
		height: 38px;
		border-radius: 50%;
		background: linear-gradient(135deg, var(--slate), var(--navy));
		color: #fff;
		font-size: 0.625rem;
		font-weight: 600;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border: 2px solid rgba(255, 255, 255, 0.92);
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
		overflow: hidden;
		position: relative;
		cursor: pointer;
		transition: transform 150ms ease, z-index 0s;
		flex-shrink: 0;
		margin-left: -10px;
	}
	.v-hero-avatar:first-child {
		margin-left: 0;
	}
	.v-hero-avatar:hover {
		transform: scale(1.08);
		z-index: 50 !important;
	}
	.v-hero-avatar img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.v-hero-avatar--more {
		background: rgba(255, 255, 255, 0.22);
		backdrop-filter: blur(4px);
		color: #fff;
		font-size: 0.6875rem;
		font-weight: 700;
		cursor: default;
	}
	.v-hero-avatar--placeholder {
		cursor: default;
		font-size: 0.75rem;
		font-weight: 700;
		color: rgba(255, 255, 255, 0.75);
		background: rgba(255, 255, 255, 0.12);
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
		/* background: shared with .v above, same gradient + fixed attachment */
		border-left: 1px solid rgba(227,206,170,0.55);
		box-shadow: -5px 0 28px rgba(0,0,0,0.05);
		overflow-y: auto;
		/* Stay under AppShell .top-actions (z-index 5) so messages / bell stay clickable */
		z-index: 1;
	}
	.v-assistant-inner {
		padding: 1.125rem 1.5rem 1.5rem;
		display: flex; flex-direction: column; gap: 1rem;
		min-height: 100%;
	}
	/*
	 * Fixed sidebar starts at viewport top; AppShell top-actions float in the same band.
	 * Mirror .main-content--floating-top .main-content-inner padding-top so the greeting
	 * never sits under messages / notifications.
	 */
	@media (min-width: 1101px) {
		.v-assistant-inner {
			/* Same floating band as main column + small buffer under icons (see theme --trip-dash-hero-offset) */
			padding-top: calc(var(--trip-dash-hero-offset, calc(0.5rem + 2.75rem + 0.35rem)) + 0.5rem);
		}
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
		margin-top: 0.75rem;
		background: linear-gradient(180deg, #fffefb 0%, #fffdf9 100%);
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
		background: rgba(255, 252, 247, 0.92);
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
		.v-hero-who {
			right: 1.25rem;
		}
	}
</style>
