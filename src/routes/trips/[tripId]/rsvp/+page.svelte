<script lang="ts">
	import { tick } from 'svelte';
	import { enhance, deserialize, applyAction } from '$app/forms';
	import { invalidateAll, goto } from '$app/navigation';
	import { page } from '$app/stores';
	import type { PageData } from './$types';
	import { effectiveSleepSlots } from '$lib/bed-spot-validation.js';
	import { roomTypeDisplayLabel, roomTypeCssSlug } from '$lib/room-type-display.js';

	let { data, form }: { data: PageData; form: any } = $props();

	let rsvpSuccessToast = $state(false);

	/** On successful RSVP submit: show toast, then redirect to trip dashboard */
	function enhanceRsvpSubmit() {
		return async ({
			result,
			update
		}: {
			result: import('@sveltejs/kit').ActionResult;
			update: (opts?: { reset: boolean }) => Promise<void>;
		}) => {
			if (result.type === 'success') {
				rsvpSuccessToast = true;
				setTimeout(() => {
					const tripId = data.trip?.id;
					if (tripId) goto(`/trips/${tripId}`);
				}, 1400);
			} else {
				await update();
			}
		};
	}

	let adultsCount = $state(1);
	let kidsCount = $state(0);
	let petsCount = $state(0);

	type PlusOneInfo = { name: string; dietary: string; allergies: string };
	let plusOnes = $state<PlusOneInfo[]>([]);

	// Keep plusOnes array in sync with adultsCount
	$effect(() => {
		const extra = Math.max(0, adultsCount - 1);
		if (plusOnes.length < extra) {
			while (plusOnes.length < extra) plusOnes = [...plusOnes, { name: '', dietary: '', allergies: '' }];
		} else if (plusOnes.length > extra) {
			plusOnes = plusOnes.slice(0, extra);
		}
	});
	function tripDateKey(d: Date | string | null | undefined): string {
		if (d == null) return '';
		return new Date(d).toISOString().slice(0, 10);
	}
	let noNotes = $state('');

	/** Full trip stay only — no partial dates on RSVP */
	const fullStayArrival = $derived(
		data.trip?.checkInDate != null ? tripDateKey(data.trip.checkInDate as Date | string) : ''
	);
	const fullStayDeparture = $derived(
		data.trip?.checkOutDate != null ? tripDateKey(data.trip.checkOutDate as Date | string) : ''
	);

	const partySize = $derived(adultsCount);
	const myClaimedSet = $derived(new Set(data.myClaimedBedIds ?? []));
	const claimedByOtherSet = $derived(new Set(data.claimedBedIdsByOther ?? []));
	const isPerRoomPricing = $derived(data.isPerRoomPricing ?? false);
	const wholeRoomClaimedByOtherSet = $derived(new Set(data.claimedWholeRoomIdsByOther ?? []));

	let selectedBedIds = $state<string[]>([]);
	let claimBedsFormEl = $state<HTMLFormElement | null>(null);
	function initSelectedBeds() {
		selectedBedIds = [...(data.myClaimedBedIds ?? [])];
	}
	$effect(() => {
		if (data.myClaimedBedIds) initSelectedBeds();
	});
	async function onBedChange(checked: boolean, bedId: string) {
		const nextIds = checked ? [...selectedBedIds, bedId] : selectedBedIds.filter((id) => id !== bedId);
		selectedBedIds = nextIds;
		await tick();
		// Submit with explicit FormData so we send current selection (DOM checkboxes may not have updated yet)
		const form = claimBedsFormEl;
		if (!form) return;
		const fd = new FormData(form);
		fd.delete('bedIds');
		for (const id of nextIds) fd.append('bedIds', id);
		const actionUrl = `${$page.url.pathname}?/claimBeds`;
		const res = await fetch(actionUrl, { method: 'POST', body: fd });
		const result = deserialize(await res.text());
		await applyAction(result);
		if (result.type === 'success') await invalidateAll();
	}

	let selectedRoomId = $state<number | null>(null);
	let claimRoomsFormEl = $state<HTMLFormElement | null>(null);
	$effect(() => {
		if (!data.isPerRoomPricing) return;
		const ids = data.myClaimedRoomIds ?? [];
		selectedRoomId = ids.length > 0 ? ids[0]! : null;
	});
	function roomCapacityForRoom(room: {
		maxOccupancy: number | null;
		beds?: { id: string; bedType?: string | null; capacitySlots?: number | null; capacity?: number | null }[];
	}): number {
		const fromBeds = (room.beds ?? []).reduce((s, b) => s + effectiveSleepSlots(b), 0);
      return Math.max(1, room.maxOccupancy ?? (fromBeds || 1));
	}
	async function onRoomSelect(roomId: number) {
		const prev = data.myClaimedRoomIds?.[0] ?? null;
		selectedRoomId = roomId;
		await tick();
		const form = claimRoomsFormEl;
		if (!form) return;
		const fd = new FormData(form);
		fd.set('roomIds', String(roomId));
		fd.set('partySize', String(adultsCount));
		const actionUrl = `${$page.url.pathname}?/claimRooms`;
		const res = await fetch(actionUrl, { method: 'POST', body: fd });
		const result = deserialize(await res.text());
		await applyAction(result);
		if (result.type === 'success') {
			await invalidateAll();
		} else {
			selectedRoomId = prev;
		}
	}

	const rooms = $derived(data.trip?.rooms ?? []);
	const spotsSelected = $derived.by(() => {
		let total = 0;
		for (const room of rooms) {
			for (const bed of room.beds ?? []) {
				if (selectedBedIds.includes(bed.id)) total += effectiveSleepSlots(bed);
			}
		}
		return total;
	});
	const selectedRoomCapacity = $derived.by(() => {
		if (selectedRoomId == null) return 0;
		const room = rooms.find((r) => r.id === selectedRoomId);
		if (!room) return 0;
		return roomCapacityForRoom(room);
	});
	const canSubmit = $derived(
		isPerRoomPricing
			? selectedRoomId != null && partySize <= selectedRoomCapacity
			: spotsSelected >= partySize
	);
	const spotsShortfall = $derived(
		isPerRoomPricing
			? selectedRoomId != null
				? Math.max(0, partySize - selectedRoomCapacity)
				: 0
			: Math.max(0, partySize - spotsSelected)
	);

	// Waitlist derived state
	const isWaitlisted = $derived(data.isWaitlisted ?? false);
	const waitlistPosition = $derived(data.waitlistPosition ?? null);
	// True when the guest is waitlisted but spots are currently open (FCFS — go RSVP now)
	const waitlistSpotsOpen = $derived(
		isWaitlisted &&
		data.maxCapacity != null &&
		(data.yesCount ?? 0) < data.maxCapacity
	);

	let rsvpStatus = $state('yes');
	$effect(() => {
		// Sync from server after submits
		if (data.currentRsvp?.status === 'no') rsvpStatus = 'no';
		else if (data.currentRsvp?.status === 'yes') rsvpStatus = 'yes';
		if (data.currentRsvp?.adultsCount != null) adultsCount = data.currentRsvp.adultsCount;
		if (data.currentRsvp?.kidsCount != null) kidsCount = data.currentRsvp.kidsCount;
		if (data.currentRsvp?.petsCount != null) petsCount = data.currentRsvp.petsCount;
		noNotes = data.currentRsvp?.status === 'no' ? (data.currentRsvp?.notes ?? '') : '';
	});
	const isYes = $derived(rsvpStatus === 'yes');
	// Add-on feature flags — default true so nothing breaks for existing trips
	const costSharingOn = $derived(data.trip?.costSharingEnabled ?? true);
	const mealPlanOn = $derived((data.trip?.mealPlan as { enabled: boolean } | null)?.enabled ?? false);

	const guestEstimateFromServer = $derived(data.guestEstimate ?? null);
	let liveEstimate = $state<{ lowCents: number; highCents: number; hmin: number; hmax: number } | null>(null);
	const guestEstimate = $derived(liveEstimate ?? guestEstimateFromServer);

	$effect(() => {
		if (!isYes) {
			liveEstimate = null;
			return;
		}
		const a = fullStayArrival;
		const d = fullStayDeparture;
		const adults = adultsCount;
		const beds = [...selectedBedIds];
		const roomForEstimate = selectedRoomId;
		const perRoom = data.isPerRoomPricing ?? false;
		const pathname = $page.url.pathname;
		const t = setTimeout(async () => {
			const fd = new FormData();
			if (a) fd.set('arrivalDate', a);
			if (d) fd.set('departureDate', d);
			fd.set('adultsCount', String(adults));
			if (perRoom && roomForEstimate != null) {
				fd.append('roomIds', String(roomForEstimate));
			} else {
				beds.forEach((id) => fd.append('bedIds', id));
			}
			const actionUrl = `${pathname}?/getEstimate`;
			try {
				const res = await fetch(actionUrl, { method: 'POST', body: fd });
				const text = await res.text();
				if (!res.ok || res.redirected) {
					liveEstimate = null;
					return;
				}
				const result = deserialize(text);
				if (result.type !== 'success' || !result.data) {
					liveEstimate = null;
					return;
				}
				const raw = result.data as Record<string, unknown>;
				const est = (raw?.getEstimate ?? raw) as { lowCents?: number; highCents?: number; hmin?: number; hmax?: number } | undefined;
				if (est && typeof est.lowCents === 'number' && typeof est.highCents === 'number') {
					liveEstimate = {
						lowCents: est.lowCents,
						highCents: est.highCents,
						hmin: typeof est.hmin === 'number' ? est.hmin : 0,
						hmax: typeof est.hmax === 'number' ? est.hmax : 0
					};
				} else {
					liveEstimate = null;
				}
			} catch {
				liveEstimate = null;
			}
		}, 400);
		return () => clearTimeout(t);
	});

	const needsReconfirm = $derived(
		data.currentRsvp?.status === 'yes' && data.currentRsvp?.yesSubstatus === 'reconfirm_required'
	);
	const reconfirmDeadlineAt = $derived(data.currentRsvp?.reconfirmDeadlineAt ?? null);

	function formatCents(cents: number): string {
		return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(cents / 100);
	}
	function formatRange(lowCents: number, highCents: number): string {
		if (lowCents === highCents) return formatCents(lowCents);
		return `${formatCents(lowCents)}–${formatCents(highCents)}`;
	}

	let costCommitmentChecked = $state(false);
	const canSubmitYes = $derived(
		(isYes || needsReconfirm) && (costSharingOn ? costCommitmentChecked : true)
	);

	const tripNights = $derived(data.roomPricing?.totalNights ?? 0);
	const pricingByRoomId = $derived.by(() => {
		const map = new Map<number, { slotPricePerNight: number; roomPricePerNight: number; roomPriceFullStay: number }>();
		for (const r of data.roomPricing?.roomPricing ?? []) {
			map.set(r.roomId, {
				slotPricePerNight: r.slotPricePerNight,
				roomPricePerNight: r.roomPricePerNight,
				roomPriceFullStay: r.roomPriceFullStay
			});
		}
		return map;
	});
	function formatDollars(dollars: number): string {
		return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(dollars);
	}
	/** Per-night or total $ display: single amount when endpoints round to the same cent. */
	function formatDollarRange(low: number, high: number): string {
		if (Math.round(low * 100) === Math.round(high * 100)) return formatDollars(low);
		return `${formatDollars(low)}–${formatDollars(high)}`;
	}
	function bedPricePerNight(roomId: number, slots: number): number {
		const p = pricingByRoomId.get(roomId);
		if (!p) return 0;
		return p.slotPricePerNight * slots;
	}
	function bedTotal(roomId: number, slots: number): number {
		return bedPricePerNight(roomId, slots) * tripNights;
	}
	function roomPricePerNight(roomId: number): number {
		return pricingByRoomId.get(roomId)?.roomPricePerNight ?? 0;
	}
	const tripTotalCost = $derived(data.trip?.totalCost ?? 0);

	const tripDateRange = $derived.by(() => {
		const t = data.trip;
		if (!t?.checkInDate || !t?.checkOutDate) return '';
		const start = new Date(t.checkInDate as Date | string);
		const end = new Date(t.checkOutDate as Date | string);
		return start.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' }) + ' – ' + end.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
	});
	const tripDestination = $derived((data.trip?.locationCity ?? data.trip?.location ?? '') || null);
</script>

<div class="rsvp-page">
	{#if rsvpSuccessToast}
		<div class="rsvp-toast" role="status" aria-live="polite">RSVP saved! Taking you to the dashboard…</div>
	{/if}
	<div class="container">
		<div class="rsvp-card">
			<div
				class="card-invite"
				style:--trip-photo={data.trip?.listingCoverPhoto ? `url(${data.trip.listingCoverPhoto})` : 'none'}
			>
				<div class="card-invite-photo" aria-hidden="true"></div>
				<div class="card-invite-gradient" aria-hidden="true"></div>
				<div class="card-invite-content">
					<p class="invite-line">r.s.v.p.</p>
					<div class="invite-divider" aria-hidden="true"></div>
					<h1 class="trip-title">{data.trip?.name ?? 'Trip'}</h1>
					{#if tripDateRange || tripDestination}
						<div class="invite-meta">
							{#if tripDateRange}
								<span class="trip-dates">{tripDateRange}</span>
							{/if}
							{#if tripDateRange && tripDestination}
								<span class="invite-meta-sep">·</span>
							{/if}
							{#if tripDestination}
								<span class="trip-destination">{tripDestination}</span>
							{/if}
						</div>
					{/if}
				</div>
			</div>

			<section class="card-section rsvp-section">
			{#if isWaitlisted}
				<!-- ── Waitlisted banner ───────────────────────────────────────── -->
			{#if waitlistSpotsOpen}
				<!-- ── Spots open banner (FCFS) ───────────────────────────────── -->
				<div class="waitlist-banner waitlist-banner--claim" role="alert">
					<div class="waitlist-banner-icon" aria-hidden="true">🎉</div>
					<div class="waitlist-banner-body">
						<p class="waitlist-banner-title">
							{data.maxCapacity != null && (data.yesCount ?? 0) < data.maxCapacity
								? `${data.maxCapacity - (data.yesCount ?? 0)} spot${data.maxCapacity - (data.yesCount ?? 0) === 1 ? '' : 's'} just opened!`
								: 'Spots just opened!'}
						</p>
						<p class="waitlist-banner-sub">It's first come, first served — RSVP yes below to claim your spot now.</p>
					</div>
				</div>
			{:else}
				<div class="waitlist-banner waitlist-banner--waiting" role="status">
					<div class="waitlist-banner-icon" aria-hidden="true">⏳</div>
					<div class="waitlist-banner-body">
						<p class="waitlist-banner-title">You're on the waitlist</p>
						{#if waitlistPosition != null}
							<p class="waitlist-banner-sub">Position <strong>#{waitlistPosition}</strong> — we'll email and notify you the moment a spot opens.</p>
						{:else}
							<p class="waitlist-banner-sub">We'll email and notify you the moment a spot opens.</p>
						{/if}
					</div>
				</div>
			{/if}
		{:else}
				<div class="rsvp-yes-no-row">
					<h2 class="section-title">Will you join us?</h2>
					<div class="rsvp-choice-btns" role="group" aria-label="RSVP response">
						<button
							type="button"
							class="rsvp-choice-btn"
							class:selected={rsvpStatus === 'yes'}
							aria-pressed={rsvpStatus === 'yes'}
							onclick={() => (rsvpStatus = 'yes')}
						>
							Going
						</button>
						<button
							type="button"
							class="rsvp-choice-btn rsvp-choice-btn-decline"
							class:selected={rsvpStatus === 'no'}
							aria-pressed={rsvpStatus === 'no'}
							onclick={() => (rsvpStatus = 'no')}
						>
							Can't make it
						</button>
					</div>
				</div>
			{/if}
			{#if costSharingOn && data.currentRsvp?.status === 'yes' && data.currentRsvp?.yesSubstatus === 'reconfirm_required'}
				<div class="reconfirm-banner" role="alert">
						<strong>Your cost estimate changed.</strong> Please review and confirm to keep your YES RSVP.
						{#if data.currentRsvp?.reconfirmDeadlineAt}
							<span class="reconfirm-deadline">Please confirm by {new Date(data.currentRsvp.reconfirmDeadlineAt).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}.</span>
						{/if}
						<span class="reconfirm-hint">Scroll down to review your estimate and confirm.</span>
					</div>
				{/if}
				{#if form?.success}
					<div class="success-message">RSVP updated!</div>
				{/if}
				{#if form?.error}
					<div class="error-message" role="alert">{form.error}</div>
				{/if}
				{#if !isWaitlisted || waitlistSpotsOpen}
				<form id="rsvp-form" method="POST" action="?/updateRsvp" use:enhance={enhanceRsvpSubmit}>
					<input type="hidden" name="status" value={rsvpStatus} />
					{#if isYes}
					<input type="hidden" name="arrivalDate" value={fullStayArrival} />
					<input type="hidden" name="departureDate" value={fullStayDeparture} />
					<div class="form-row form-row-single-line">
						<div class="form-group">
							<label for="adultsCount">Adults</label>
							<input type="number" id="adultsCount" name="adultsCount" bind:value={adultsCount} min="1" max="99" required title="Adults (you + plus-ones). Kids don’t count toward sleeping spots." />
						</div>
						<div class="form-group">
							<label for="kidsCount">Kids</label>
							<input type="number" id="kidsCount" name="kidsCount" bind:value={kidsCount} min="0" />
						</div>
						<div class="form-group">
							<label for="petsCount">Pets</label>
							<input type="number" id="petsCount" name="petsCount" bind:value={petsCount} min="0" />
						</div>
					</div>
					{:else}
					<input type="hidden" name="arrivalDate" value="" />
					<input type="hidden" name="departureDate" value="" />
					<input type="hidden" name="adultsCount" value="1" />
					<input type="hidden" name="kidsCount" value="0" />
					<input type="hidden" name="petsCount" value="0" />
					{/if}
					{#if rsvpStatus === 'no'}
						<div class="form-group">
							<label for="notes">Notes (optional)</label>
							<textarea id="notes" name="notes" bind:value={noNotes}></textarea>
						</div>
					{/if}
					{#if !isYes}
						<button type="submit" class="btn btn-primary">Submit</button>
					{/if}
				</form>
				{/if}
			</section>

	{#if isYes && mealPlanOn}
		<section class="card-section dietary-section">
			<h2 class="section-title">Meals & dietary</h2>
			<p class="dietary-intro">
				Your dietary preferences and allergies are saved in
				<a href="/settings">Account settings → Basics</a>. When your RSVP is “yes”, they are shown to anyone adding meals for this trip.
			</p>
			{#if plusOnes.length > 0}
				<p class="dietary-plusone-intro">
					For guests in your party who do not have an account, you can note name, dietary needs, and allergies below (optional).
				</p>
				<form method="POST" action="?/updateDietary" use:enhance>
					{#each plusOnes as po, i}
						<div class="dietary-plusone">
							<p class="dietary-person-label">Guest {i + 1}</p>
							<div class="dietary-row dietary-row-3">
								<div class="form-group">
									<label class="form-label">Name <span class="label-opt">(optional)</span></label>
									<input type="text" name="plusOneName_{i}" bind:value={po.name} placeholder="e.g. Alex" />
								</div>
								<div class="form-group">
									<label class="form-label">Dietary restrictions</label>
									<input type="text" name="plusOneDietary_{i}" bind:value={po.dietary} placeholder="e.g. vegan" />
								</div>
								<div class="form-group">
									<label class="form-label">Allergies</label>
									<input type="text" name="plusOneAllergies_{i}" bind:value={po.allergies} placeholder="e.g. nuts" />
								</div>
							</div>
						</div>
					{/each}
					<input type="hidden" name="plusOneCount" value={plusOnes.length} />
					<button type="submit" class="btn btn-secondary dietary-save">Save plus-one notes</button>
				</form>
			{/if}
		</section>
	{/if}

	{#if isYes}
		<section class="card-section room-section">
			<h2 class="section-title">Choose your room</h2>
					{#if form?.claimBedsError && !form.claimBedsError.includes('You need at least')}
						<div class="error-message" class:conflict={form?.bedClaimConflict}>
							{form.claimBedsError}
						</div>
					{/if}
					{#if data.trip.rooms.length === 0}
						<p class="no-rooms">No rooms available yet. The host will add rooms soon.</p>
					{:else if data.isPerRoomPricing}
						<p class="room-pricing-intro helper-text">
							This trip splits the total evenly by room. Reserve one whole room for your party (one reservation per room).
						</p>
						<div class="spots-counter">
							<span>Party size: <strong>{partySize}</strong></span>
							{#if selectedRoomId != null}
								<span>Room capacity: <strong>{selectedRoomCapacity}</strong></span>
							{/if}
							{#if spotsShortfall > 0}
								<span class="spots-warn">Your party needs more capacity than this room allows—pick another room or reduce adults.</span>
							{/if}
						</div>
						<form bind:this={claimRoomsFormEl} method="POST" action="?/claimRooms" use:enhance>
							<input type="hidden" name="partySize" value={adultsCount} />
							<div class="rooms-grid hotel-rooms">
								{#each rooms as room}
									{@const cap = roomCapacityForRoom(room)}
									{@const taken = wholeRoomClaimedByOtherSet.has(room.id)}
									{@const rp = pricingByRoomId.get(room.id)}
									{@const wholeTotal = rp?.roomPriceFullStay ?? roomPricePerNight(room.id) * tripNights}
									{@const wholePerNight = rp?.roomPricePerNight ?? roomPricePerNight(room.id)}
									<div class="hotel-room-card" class:room-unavailable={taken}>
										<div class="hotel-room-photo">
											{#if room.photoUrls?.length > 0}
												<img src={room.photoUrls[0]} alt="" />
											{:else}
												{@const rtpLabel = roomTypeDisplayLabel(room)}
												{@const rtpSlug = roomTypeCssSlug(room.roomType)}
												<div
													class="hotel-room-photo-placeholder hotel-room-photo-placeholder--{rtpSlug}"
													role="img"
													aria-label="{rtpLabel} — {room.name}, no photo"
												>
													<div class="room-placeholder-grid" aria-hidden="true"></div>
													<div class="room-placeholder-inner">
														<span class="room-placeholder-type">{rtpLabel}</span>
														<span class="room-placeholder-name">{room.name}</span>
														<span class="room-placeholder-hint">No photo yet</span>
													</div>
												</div>
											{/if}
										</div>
										<div class="hotel-room-body">
											<h3 class="hotel-room-name">{room.name}</h3>
											<p class="hotel-room-capacity">Up to {cap} guest{cap === 1 ? '' : 's'}</p>
											{#if room.description}
												<p class="hotel-room-desc">{room.description}</p>
											{/if}
											<label class="bed-option hotel-bed whole-room-option" class:disabled={taken} class:selected={selectedRoomId === room.id}>
												<input
													type="radio"
													name="roomIds"
													value={String(room.id)}
													checked={selectedRoomId === room.id}
													disabled={taken}
													onchange={() => onRoomSelect(room.id)}
												/>
												<span class="bed-type">Reserve this room</span>
												{#if costSharingOn && wholePerNight > 0 && tripNights > 0}
													<span class="bed-price"
														>{formatDollars(wholePerNight)}/night · {formatDollars(wholeTotal)} for full stay (your share of trip total)</span
													>
												{/if}
												{#if taken}
													<span class="claimed-badge">Claimed</span>
												{/if}
											</label>
										</div>
									</div>
								{/each}
							</div>
							{#if !canSubmit && selectedRoomId != null}
								<p class="helper-text">Choose a room that fits at least {partySize} guest{partySize === 1 ? '' : 's'}, or lower your party size.</p>
							{:else if !canSubmit && selectedRoomId == null}
								<p class="helper-text">Select a room for your party.</p>
							{/if}
						</form>
					{:else}
						<div class="spots-counter">
							<span>Spots needed: <strong>{partySize}</strong></span>
							<span>Spots selected: <strong>{spotsSelected}</strong></span>
							{#if spotsShortfall > 0}
								<span class="spots-warn">Add {spotsShortfall} more spot(s) to cover your party.</span>
							{/if}
						</div>
						<form bind:this={claimBedsFormEl} method="POST" action="?/claimBeds" use:enhance>
							<input type="hidden" name="partySize" value={adultsCount} />
							<div class="rooms-grid hotel-rooms">
								{#each rooms as room}
									<div class="hotel-room-card">
										<div class="hotel-room-photo">
											{#if room.photoUrls?.length > 0}
												<img src={room.photoUrls[0]} alt="" />
											{:else}
												{@const rtpLabel = roomTypeDisplayLabel(room)}
												{@const rtpSlug = roomTypeCssSlug(room.roomType)}
												<div
													class="hotel-room-photo-placeholder hotel-room-photo-placeholder--{rtpSlug}"
													role="img"
													aria-label="{rtpLabel} — {room.name}, no photo"
												>
													<div class="room-placeholder-grid" aria-hidden="true"></div>
													<div class="room-placeholder-inner">
														<span class="room-placeholder-type">{rtpLabel}</span>
														<span class="room-placeholder-name">{room.name}</span>
														<span class="room-placeholder-hint">No photo yet</span>
													</div>
												</div>
											{/if}
										</div>
										<div class="hotel-room-body">
											<h3 class="hotel-room-name">{room.name}</h3>
											{#if room.description}
												<p class="hotel-room-desc">{room.description}</p>
											{/if}
											<div class="beds-list beds-checkboxes">
												{#each (room.beds ?? []) as bed}
													{@const spots = effectiveSleepSlots(bed)}
													{@const isClaimedByOther = claimedByOtherSet.has(bed.id)}
													{@const bp = data.bedPricing?.[bed.id]}
													{@const perNightLow = bp ? bp.perNightLow : bedPricePerNight(room.id, spots)}
													{@const perNightHigh = bp ? bp.perNightHigh : perNightLow}
													{@const totalLow = bp ? bp.low : bedTotal(room.id, spots)}
													{@const totalHigh = bp ? bp.high : totalLow}
													<label class="bed-option hotel-bed" class:disabled={isClaimedByOther} class:selected={selectedBedIds.includes(bed.id)}>
														<input
															type="checkbox"
															name="bedIds"
															value={bed.id}
															checked={selectedBedIds.includes(bed.id)}
															disabled={isClaimedByOther}
															onchange={(e) => onBedChange((e.currentTarget as HTMLInputElement).checked, bed.id)}
														/>
														<span class="bed-type">{bed.bedType}</span>
						{#if costSharingOn && perNightLow > 0 && tripNights > 0}
								<span class="bed-price"
									>{formatDollarRange(perNightLow, perNightHigh)}/night · {formatDollarRange(totalLow, totalHigh)} est.</span
								>
							{/if}
														{#if isClaimedByOther}
															<span class="claimed-badge">Claimed</span>
														{/if}
													</label>
												{/each}
											</div>
										</div>
									</div>
								{/each}
							</div>
							{#if !canSubmit && spotsSelected > 0}
								<p class="helper-text">Select enough beds to cover {partySize} spot(s).</p>
							{/if}
						</form>
					{/if}
					{#if costSharingOn && tripNights > 0 && data.roomPricing && tripTotalCost > 0}
						<p class="trip-total-line">
							<strong>Total Trip Cost:</strong> {formatDollars(tripTotalCost)}
							<span class="trip-total-note">
								{#if data.isPerRoomPricing}
									(each room pays an equal share of this total; your dates prorate the amount)
								{:else}
									(per-bed totals above are based on current {data.yesRsvpHeadcount ?? 0} guest{data.yesRsvpHeadcount === 1 ? '' : 's'})
								{/if}
							</span>
						</p>
					{/if}
					{#if costSharingOn && (isYes || needsReconfirm)}
						<div id="cost-commitment" class="cost-commitment-module">
								{#if guestEstimate}
									<div class="estimate-lines">
										<p class="estimate-range"><strong>My estimated share: {guestEstimate.displayCents != null ? formatCents(guestEstimate.displayCents) : formatRange(guestEstimate.lowCents, guestEstimate.highCents)}</strong></p>
										<p class="estimate-secondary">
											{#if data.isPerRoomPricing}
												Each room pays an equal share of the trip total; your dates prorate that amount.
											{:else if guestEstimate.displayCents != null}
												{#if guestEstimate.lowCents === guestEstimate.highCents}
													{formatRange(guestEstimate.lowCents, guestEstimate.highCents)} for your selection at the modeled headcount range (no low–high spread).
												{:else}
													Range {formatRange(guestEstimate.lowCents, guestEstimate.highCents)} depending on final headcount.
												{/if}
											{:else}
												Least if {guestEstimate.hmax} people attend (max headcount, capacity limit); most if {guestEstimate.hmin} attend (min headcount, realistic low). Final amount depends on the number of attendees.
											{/if}
										</p>
									</div>
									<div class="form-group commitment-checkbox">
										<label class="commitment-label">
											<span class="commitment-line-one">
												<input type="checkbox" bind:checked={costCommitmentChecked} name="costCommitmentAccepted" value="true" form="yes-confirm-form" class="commitment-checkbox-input" />
												<span>I agree to share the trip costs.</span>
											</span>
											<span class="commitment-rest">I understand the final amount depends on the number of attendees. If the estimate changes outside your accepted range, you’ll be asked to review and confirm.</span>
										</label>
									</div>

									<form id="yes-confirm-form" method="POST" action="?/updateRsvp" use:enhance={enhanceRsvpSubmit} class="submit-form">
										<input type="hidden" name="status" value="yes" />
										<input type="hidden" name="arrivalDate" value={fullStayArrival} />
										<input type="hidden" name="departureDate" value={fullStayDeparture} />
										<input type="hidden" name="adultsCount" value={adultsCount} />
										<input type="hidden" name="kidsCount" value={kidsCount} />
										<input type="hidden" name="petsCount" value={petsCount} />
										<div class="submit-row">
											<button type="submit" class="btn btn-primary" disabled={!canSubmitYes}>
												Submit
											</button>
											{#if !costCommitmentChecked}
												<span class="validation-hint">Check the box above to confirm your estimate and submit.</span>
											{/if}
										</div>
									</form>
								{:else}
									{#if data.guestEstimateError}
										<p class="helper-text">
											{#if data.guestEstimateError.includes('not selected a bed')}
												For per-bed trips, you'll see your estimate after you pick your bed(s) above.
											{:else}
												Estimate unavailable: {data.guestEstimateError}. Check that the trip has rooms and beds set up.
											{/if}
										</p>
									{:else}
										<p class="helper-text">
											{#if data.isPerRoomPricing}
												Select a room above to confirm your share of the trip total.
											{:else}
												For per-bed trips, you’ll see your estimate after you pick your bed(s) above.
											{/if}
										</p>
									{/if}
								{/if}
							</div>
						{/if}
					{#if !costSharingOn && isYes}
						<form method="POST" action="?/updateRsvp" use:enhance={enhanceRsvpSubmit} class="submit-form">
							<input type="hidden" name="status" value="yes" />
							<input type="hidden" name="arrivalDate" value={fullStayArrival} />
							<input type="hidden" name="departureDate" value={fullStayDeparture} />
							<input type="hidden" name="adultsCount" value={adultsCount} />
							<input type="hidden" name="kidsCount" value={kidsCount} />
							<input type="hidden" name="petsCount" value={petsCount} />
							<div class="submit-row">
								<button type="submit" class="btn btn-primary" disabled={!canSubmit}>
									Submit
								</button>
								{#if !canSubmit}
									<span class="validation-hint">
										{#if data.isPerRoomPricing}
											Select a room that fits your party before submitting.
										{:else}
											Select bed(s) to cover your party before submitting.
										{/if}
									</span>
								{/if}
							</div>
						</form>
					{/if}
			</section>
			{/if}
		</div>
	</div>
</div>

<style>
	@import url('https://fonts.googleapis.com/css2?family=Great+Vibes&family=Plus+Jakarta+Sans:wght@400;600;700&display=swap');

	.rsvp-page {
		min-height: calc(100vh - 80px);
		padding: 2rem 1rem 3rem;
		background: var(--bg, #f6f4f1);
	}

	.rsvp-toast {
		position: fixed;
		bottom: 1.5rem;
		left: 50%;
		transform: translateX(-50%);
		z-index: 100;
		background: #166534;
		color: white;
		padding: 0.7rem 1.25rem;
		border-radius: 99px;
		font-size: 0.9rem;
		font-weight: 500;
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.18);
		animation: rsvp-toast-in 0.25s ease-out;
	}
	@keyframes rsvp-toast-in {
		from { opacity: 0; transform: translateX(-50%) translateY(0.5rem); }
		to   { opacity: 1; transform: translateX(-50%) translateY(0); }
	}

	.container {
		max-width: 580px;
		margin: 0 auto;
		padding: 0;
	}

	/* ── Card chrome ──────────────────────────────────────────────── */
	.rsvp-card {
		background: #fff;
		border-radius: 18px;
		border: 1px solid rgba(0,0,0,0.07);
		box-shadow: 0 8px 40px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04);
		overflow: hidden;
	}

	/* ── Invite header ────────────────────────────────────────────── */
	.card-invite {
		position: relative;
		text-align: center;
		margin: 0;
		padding: 1.75rem 1.5rem 1.25rem;
		min-height: 160px;
		border-radius: 0;
		overflow: hidden;
		box-shadow: none;
	}
	.card-invite-photo {
		position: absolute;
		inset: 0;
		background-image: var(--trip-photo, none);
		background-size: cover;
		background-position: center;
		background-color: #ede8e0;
	}
	.card-invite-gradient {
		position: absolute;
		inset: 0;
		bottom: -2px;
		background: linear-gradient(
			to bottom,
			rgba(255,255,255,0.04) 0%,
			rgba(255,255,255,0.18) 40%,
			rgba(255,255,255,0.65) 72%,
			rgba(255,255,255,0.96) 94%,
			#fff 100%
		);
		pointer-events: none;
	}
	.card-invite-content {
		position: relative;
		z-index: 1;
	}
	.invite-line {
		font-family: 'Great Vibes', cursive;
		font-size: 1.85rem;
		letter-spacing: 0.06em;
		color: #2c2419;
		font-weight: 400;
		margin: 0 0 0.3rem;
		text-shadow:
			0 0 18px rgba(255,255,255,0.9),
			0 0 36px rgba(255,255,255,0.5),
			0 1px 2px rgba(0,0,0,0.12);
	}
	.invite-divider {
		width: 36px;
		height: 1px;
		background: linear-gradient(90deg, transparent, rgba(15,23,42,0.15) 20%, rgba(15,23,42,0.15) 80%, transparent);
		margin: 0 auto 0.9rem;
	}
	.trip-title {
		font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
		font-size: clamp(1.5rem, 5vw, 2.1rem);
		font-weight: 700;
		color: #1e1a15;
		margin: 0;
		letter-spacing: 0.01em;
		line-height: 1.2;
	}
	.invite-meta {
		margin-top: 0.3rem;
		font-size: 0.85rem;
		color: #5c5248;
		font-style: italic;
		letter-spacing: 0.01em;
	}
	.invite-meta-sep { margin: 0 0.4rem; opacity: 0.6; }
	.trip-dates, .trip-destination { margin: 0; }
	.trip-destination { font-style: italic; }

	/* ── Sections ─────────────────────────────────────────────────── */
	.card-section {
		padding: 1.1rem 1.5rem;
		margin-bottom: 0;
	}
	.card-section + .card-section {
		border-top: 1px solid #f0ece7;
	}
	.rsvp-section.card-section {
		padding-top: 1.25rem;
		padding-bottom: 1.25rem;
	}

	.section-title {
		font-family: Georgia, 'Times New Roman', serif;
		font-size: 1.05rem;
		font-weight: 400;
		color: #2c2419;
		margin: 0;
	}

	/* ── Yes / No pill toggle ─────────────────────────────────────── */
	.rsvp-yes-no-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		margin-bottom: 1rem;
		flex-wrap: nowrap;
	}
	.rsvp-yes-no-row .section-title {
		flex: 0 1 auto;
		white-space: nowrap;
	}
	.rsvp-choice-btns {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-shrink: 0;
	}
	.rsvp-choice-btn {
		appearance: none;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		margin: 0;
		padding: 0.5rem 1rem;
		font-family: inherit;
		font-size: 0.875rem;
		font-weight: 600;
		line-height: 1.2;
		color: #5c534c;
		background: #fff;
		border: 1.5px solid #ddd9d2;
		border-radius: 10px;
		cursor: pointer;
		transition: border-color 0.15s, background 0.15s, color 0.15s, box-shadow 0.15s;
		white-space: nowrap;
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
	}
	.rsvp-choice-btn:hover:not(.selected) {
		border-color: #c4bcb3;
		background: #faf9f7;
	}
	.rsvp-choice-btn:focus-visible {
		outline: 2px solid #8b7355;
		outline-offset: 2px;
	}
	.rsvp-choice-btn.selected {
		background: #1e1a15;
		border-color: #1e1a15;
		color: #fff;
		box-shadow: 0 2px 8px rgba(30, 26, 21, 0.2);
	}
	.rsvp-choice-btn-decline.selected {
		background: #4a4540;
		border-color: #4a4540;
		box-shadow: 0 2px 8px rgba(74, 69, 64, 0.22);
	}
	@media (max-width: 420px) {
		.rsvp-yes-no-row {
			flex-wrap: wrap;
		}
		.rsvp-choice-btns {
			width: 100%;
			justify-content: stretch;
		}
		.rsvp-choice-btn {
			flex: 1;
			justify-content: center;
		}
	}

	/* ── Form elements ────────────────────────────────────────────── */
	.form-group {
		margin-bottom: 0.75rem;
	}
	.form-group label {
		display: block;
		margin-bottom: 0.25rem;
		font-weight: 500;
		font-size: 0.875rem;
		color: #3d3631;
	}
	.form-group input,
	.form-group select,
	.form-group textarea {
		width: 100%;
		padding: 0.45rem 0.6rem;
		border: 1.5px solid #ddd9d2;
		border-radius: 8px;
		font-size: 0.9375rem;
		background: #faf9f7;
		color: var(--color-text);
		transition: border-color 0.15s;
	}
	.form-group input:focus,
	.form-group select:focus,
	.form-group textarea:focus {
		outline: none;
		border-color: #8b7355;
		background: #fff;
	}
	.form-hint {
		display: block;
		margin-top: 0.2rem;
		font-size: 0.8rem;
		color: var(--color-text-light);
	}
	.form-row {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
		gap: 0.75rem;
	}
	.form-row-single-line {
		grid-template-columns: repeat(3, minmax(0, 1fr));
		align-items: end;
	}
	.rsvp-section .form-row-single-line .form-group { margin-bottom: 0; }
	@media (max-width: 480px) {
		.form-row-single-line { grid-template-columns: 1fr 1fr; }
	}

	/* ── Messages ─────────────────────────────────────────────────── */
	.success-message {
		background: rgba(34,197,94,0.08);
		color: #16a34a;
		padding: 0.6rem 0.75rem;
		border-radius: 8px;
		margin-bottom: 0.75rem;
		border-left: 3px solid #16a34a;
		font-size: 0.9rem;
	}
	.error-message {
		background: rgba(239,68,68,0.08);
		color: #b91c1c;
		padding: 0.6rem 0.75rem;
		border-radius: 8px;
		margin-bottom: 0.75rem;
		border-left: 3px solid #b91c1c;
		font-size: 0.9rem;
	}
	.error-message.conflict { font-weight: 600; }

	/* ── Spots counter ────────────────────────────────────────────── */
	.spots-counter {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.75rem;
		margin-bottom: 0.6rem;
		font-size: 0.9rem;
	}
	.spots-warn { color: var(--color-warning, #b45309); font-size: 0.875rem; }
	.helper-text { color: var(--color-text-light); font-size: 0.85rem; margin-bottom: 0.75rem; }
	.trip-total-line { margin: 0.75rem 0 0; font-size: 0.9rem; color: var(--color-text); }
	.trip-total-note { font-weight: normal; color: var(--color-text-light); font-size: 0.85rem; }
	.no-rooms { color: var(--muted, #64748b); margin: 0; font-size: 0.9rem; }

	/* ── Room grid ────────────────────────────────────────────────── */
	.rooms-grid { display: grid; gap: 0.875rem; }
	.hotel-rooms {
		grid-template-columns: repeat(2, 1fr);
	}
	@media (max-width: 500px) {
		.hotel-rooms { grid-template-columns: 1fr; }
	}
	.hotel-room-card {
		display: grid;
		grid-template-columns: 1fr;
		grid-template-rows: 120px auto;
		background: #fff;
		border-radius: 10px;
		overflow: hidden;
		border: 1.5px solid #e8e4df;
		transition: box-shadow 0.15s;
	}
	.hotel-room-card:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.08); }
	.hotel-room-card.room-unavailable { opacity: 0.65; }
	.hotel-room-photo {
		background: #ede8e0;
		overflow: hidden;
		height: 120px;
		display: flex;
	}
	.hotel-room-photo img {
		width: 100%; height: 100%; object-fit: cover; display: block; flex: 1; min-height: 0;
	}
	.hotel-room-photo-placeholder {
		--rtp-tint: 212, 196, 176;
		position: relative;
		width: 100%;
		height: 100%;
		min-height: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		text-align: center;
		padding: 0.5rem 0.65rem;
		overflow: hidden;
		background: linear-gradient(
			145deg,
			rgba(var(--rtp-tint), 0.55) 0%,
			rgba(var(--rtp-tint), 0.28) 42%,
			rgba(255, 255, 255, 0.35) 100%
		);
	}
	.hotel-room-photo-placeholder--bedroom,
	.hotel-room-photo-placeholder--master-bedroom,
	.hotel-room-photo-placeholder--guest-room {
		--rtp-tint: 196, 175, 155;
	}
	.hotel-room-photo-placeholder--living-room {
		--rtp-tint: 168, 182, 198;
	}
	.hotel-room-photo-placeholder--kitchen {
		--rtp-tint: 200, 188, 160;
	}
	.hotel-room-photo-placeholder--bathroom {
		--rtp-tint: 175, 198, 208;
	}
	.hotel-room-photo-placeholder--dining-room {
		--rtp-tint: 188, 168, 148;
	}
	.hotel-room-photo-placeholder--office {
		--rtp-tint: 178, 172, 198;
	}
	.hotel-room-photo-placeholder--other,
	.hotel-room-photo-placeholder--unknown {
		--rtp-tint: 190, 184, 176;
	}
	.room-placeholder-grid {
		position: absolute;
		inset: 0;
		opacity: 0.22;
		background-image:
			linear-gradient(rgba(255, 255, 255, 0.5) 1px, transparent 1px),
			linear-gradient(90deg, rgba(255, 255, 255, 0.5) 1px, transparent 1px);
		background-size: 14px 14px;
	}
	.room-placeholder-inner {
		position: relative;
		z-index: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.28rem;
		max-width: 100%;
	}
	.room-placeholder-type {
		display: inline-block;
		font-size: 0.62rem;
		font-weight: 700;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: #3d3631;
		padding: 0.2rem 0.55rem;
		border-radius: 99px;
		background: rgba(255, 255, 255, 0.72);
		border: 1px solid rgba(0, 0, 0, 0.06);
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
	}
	.room-placeholder-name {
		font-size: 0.82rem;
		font-weight: 600;
		color: #2a2520;
		line-height: 1.25;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
	.room-placeholder-hint {
		font-size: 0.68rem;
		font-weight: 500;
		color: rgba(45, 40, 35, 0.45);
		letter-spacing: 0.02em;
	}
	.hotel-room-body {
		padding: 0.65rem 0.85rem;
		display: flex; flex-direction: column; min-width: 0;
	}
	.hotel-room-name { font-size: 0.95rem; font-weight: 600; color: #1e1a15; margin: 0 0 0.2rem; }
	.hotel-room-capacity { font-size: 0.8rem; color: #7a6f65; margin: 0 0 0.4rem; }
	.hotel-room-desc { font-size: 0.82rem; color: #7a6f65; margin: 0 0 0.4rem; line-height: 1.4; }

	/* ── Bed options ─────────────────────────────────────────────── */
	.beds-checkboxes { display: flex; flex-direction: column; gap: 0.4rem; }
	.bed-option {
		display: flex; align-items: center; gap: 0.35rem; cursor: pointer;
	}
	.bed-option.disabled { opacity: 0.55; cursor: not-allowed; }
	.bed-option input { margin: 0; }
	.hotel-bed {
		display: flex; align-items: center; flex-wrap: wrap;
		gap: 0.3rem 0.6rem;
		padding: 0.5rem 0.65rem;
		border-radius: 7px;
		border: 1.5px solid #e8e4df;
		transition: border-color 0.18s, background 0.18s;
	}
	.hotel-bed.selected {
		border-color: #8b7355;
		background: rgba(139,115,85,0.06);
	}
	.hotel-bed .bed-type { font-weight: 500; text-transform: capitalize; font-size: 0.9rem; }
	.hotel-bed .bed-price { margin-left: auto; font-size: 0.8rem; color: #7a6f65; }
	.claimed-badge {
		font-size: 0.72rem; background: #f0ece7;
		padding: 0.12rem 0.4rem; border-radius: 99px; margin-left: auto; color: #7a6f65;
	}

	/* ── Cost commitment ─────────────────────────────────────────── */
	.cost-commitment-module {
		margin: 0.875rem 0;
		padding: 1rem 1.1rem;
		background: #faf9f7;
		border-radius: 10px;
		border: 1.5px solid #e8e4df;
	}
	.estimate-lines { text-align: center; margin-bottom: 0.5rem; }
	.estimate-lines .estimate-range { margin: 0 0 0.1rem; font-size: 0.975rem; }
	.estimate-lines .estimate-secondary { margin: 0; font-size: 0.82rem; color: var(--color-text-light); }
	.estimate-range { margin: 0 0 0.2rem; }
	.estimate-headcount { margin: 0; font-size: 0.85rem; color: var(--color-text-light); }
	.estimate-microcopy { margin: 0 0 0.4rem; font-size: 0.82rem; color: var(--color-text-light); }
	.submit-form { margin-top: 1rem; }
	.submit-row { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 0.5rem; }
	.estimate-warning { margin: 0.2rem 0 0; font-size: 0.82rem; color: var(--color-warning, #b45309); }
	.commitment-checkbox { margin-top: 0.75rem; margin-bottom: 0; }
	.commitment-checkbox.form-group { margin-bottom: 0; }
	.commitment-label { display: flex; flex-direction: column; align-items: flex-start; gap: 0.4rem; cursor: pointer; font-weight: normal; }
	.commitment-line-one {
		display: flex; flex-direction: row; flex-wrap: nowrap; align-items: center; gap: 0.45rem; width: fit-content;
	}
	.commitment-line-one > span { white-space: nowrap; font-size: 0.9rem; }
	.commitment-label .commitment-checkbox-input {
		flex-shrink: 0; margin: 0; vertical-align: middle;
		width: 1rem; height: 1rem; min-width: 1rem; min-height: 1rem;
	}
	.commitment-rest {
		display: block; font-size: 0.82rem; line-height: 1.45;
		color: var(--color-text-light); margin: 0;
	}
	.commitment-text { font-size: 0.875rem; line-height: 1.45; }
	.validation-hint { display: inline-block; margin-left: 0.5rem; font-size: 0.82rem; color: var(--color-text-light); }

	/* ── Reconfirm banner ────────────────────────────────────────── */
	.reconfirm-banner {
		background: #fef3c7; border: 1px solid #f59e0b;
		border-radius: 8px; padding: 0.75rem 1rem;
		margin-bottom: 0.75rem;
		display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem;
		font-size: 0.875rem;
	}
	.reconfirm-deadline { font-size: 0.85rem; color: #92400e; }
	.reconfirm-hint { display: block; margin-top: 0.25rem; font-size: 0.85rem; }

	/* ── Waitlist banners ────────────────────────────────────────── */
	.waitlist-banner {
		display: flex; align-items: flex-start; gap: 0.875rem;
		border-radius: 12px; padding: 1rem 1.125rem;
		margin-bottom: 1.25rem;
		border: 1.5px solid;
	}
	.waitlist-banner--waiting {
		background: #f0f4ff; border-color: #bfcfee;
	}
	.waitlist-banner--claim {
		background: #f0fbf5; border-color: #a8d8b8;
		animation: pulse-claim 2s ease-in-out infinite;
	}
	.waitlist-banner--expired {
		background: #fff8f0; border-color: #f0cfa0;
	}
	@keyframes pulse-claim {
		0%, 100% { box-shadow: 0 0 0 0 rgba(26, 74, 46, 0.0); }
		50% { box-shadow: 0 0 0 4px rgba(26, 74, 46, 0.08); }
	}
	.waitlist-banner-icon { font-size: 1.5rem; line-height: 1; flex-shrink: 0; margin-top: 0.05rem; }
	.waitlist-banner-body { flex: 1; min-width: 0; }
	.waitlist-banner-title {
		font-size: 0.95rem; font-weight: 700; margin: 0 0 0.25rem;
		color: #1e1a15;
	}
	.waitlist-banner-sub {
		font-size: 0.825rem; color: #57534e; margin: 0 0 0.2rem; line-height: 1.5;
	}
	.waitlist-banner-expires { font-size: 0.78rem; color: #78716c; margin: 0; }
	.claim-countdown {
		display: inline-block; background: #1a4a2e; color: #fff;
		font-size: 0.75rem; font-weight: 700; padding: 1px 7px; border-radius: 99px;
		margin-left: 0.4rem; letter-spacing: 0.02em;
	}

	/* ── Dietary section ─────────────────────────────────────────── */
	.dietary-section { border-top: 1px solid #f0ece7; }
	.dietary-intro { font-size: 0.825rem; color: #78716c; margin: 0 0 0.75rem; }
	.dietary-intro a { font-weight: 600; color: var(--slate, #2f7778); }
	.dietary-plusone-intro {
		font-size: 0.8rem;
		color: #57534e;
		margin: 0 0 0.75rem;
		line-height: 1.45;
	}
	.dietary-plusone { margin-bottom: 1rem; }
	.dietary-person-label { font-size: 0.75rem; font-weight: 700; color: #57534e; text-transform: uppercase; letter-spacing: .05em; margin: 0 0 0.4rem; }
	.dietary-row { display: grid; grid-template-columns: 1fr 1fr; gap: 0.6rem; }
	.dietary-row-3 { grid-template-columns: 1fr 1fr 1fr; }
	@media (max-width: 480px) { .dietary-row, .dietary-row-3 { grid-template-columns: 1fr; } }
	.label-opt { font-weight: 400; color: #a8a29e; }
	.dietary-save { margin-top: 0.4rem; }

	/* ── Room section ────────────────────────────────────────────── */
	.room-section { border-top: 1px solid #f0ece7; }
	.room-section-footer { margin-top: 1rem; }
	.room-pricing-intro { font-size: 0.85rem; }

	/* ── Misc ────────────────────────────────────────────────────── */
	.beds-claim .room-card { flex-direction: column; align-items: stretch; }
	.beds-form-actions {
		display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; margin-top: 1rem;
	}
	.btn-sm { padding: 0.3rem 0.75rem; font-size: 0.875rem; }
	.summary-hint { margin-top: 0.5rem; font-size: 0.85rem; color: var(--color-text-light); }
	.room-card, .activity-card, .extra-card {
		padding: 0.75rem; border: 1.5px solid #e8e4df; border-radius: 8px;
		display: flex; justify-content: space-between; align-items: center; gap: 0.75rem;
	}
	.room-card.selected, .activity-card.participating {
		border-color: #8b7355; background: rgba(139,115,85,0.05);
	}
	.activities-list, .extras-list { display: grid; gap: 0.75rem; }
	.bed-badge { background: #f5f2ef; padding: 0.2rem 0.45rem; border-radius: 6px; font-size: 0.8rem; }
	.activity-info, .extra-info { flex: 1; }
	.quantity-input { width: 75px; margin-right: 0.5rem; }
	.beds-list { display: flex; gap: 0.4rem; flex-wrap: wrap; margin: 0.5rem 0; }
</style>
