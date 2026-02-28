<script lang="ts">
	import { tick } from 'svelte';
	import { enhance, deserialize, applyAction } from '$app/forms';
	import { invalidateAll, goto } from '$app/navigation';
	import { page } from '$app/stores';
	import DateRangePicker from '$lib/components/wizard/DateRangePicker.svelte';
	import type { PageData } from './$types';

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

	let adultsCount = $state(data.currentRsvp?.adultsCount ?? 1);
	let kidsCount = $state(data.currentRsvp?.kidsCount ?? 0);
	let petsCount = $state(data.currentRsvp?.petsCount ?? 0);

	// ── Dietary info ────────────────────────────────────────────────────────
	let myDietary = $state(data.currentProfile?.dietaryRestrictions ?? '');
	let myAllergies = $state(data.currentProfile?.allergies ?? '');

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
	const defaultArrival = tripDateKey(data.trip?.checkInDate);
	const defaultDeparture = tripDateKey(data.trip?.checkOutDate);
	let arrivalDate = $state(
		data.currentRsvp?.arrivalDatetime ? new Date(data.currentRsvp.arrivalDatetime).toISOString().slice(0, 10) : defaultArrival
	);
	let departureDate = $state(
		data.currentRsvp?.departureDatetime ? new Date(data.currentRsvp.departureDatetime).toISOString().slice(0, 10) : defaultDeparture
	);
	let noNotes = $state(data.currentRsvp?.status === 'no' ? (data.currentRsvp?.notes ?? '') : '');

	const partySize = $derived(adultsCount);
	const myClaimedSet = $derived(new Set(data.myClaimedBedIds ?? []));
	const claimedByOtherSet = $derived(new Set(data.claimedBedIdsByOther ?? []));

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

	const rooms = $derived(data.trip?.rooms ?? []);
	const spotsSelected = $derived.by(() => {
		let total = 0;
		for (const room of rooms) {
			for (const bed of room.beds ?? []) {
				if (selectedBedIds.includes(bed.id)) total += bed.capacitySlots ?? bed.capacity ?? 1;
			}
		}
		return total;
	});
	const canSubmit = $derived(spotsSelected >= partySize);
	const spotsShortfall = $derived(Math.max(0, partySize - spotsSelected));

	let rsvpStatus = $state(data.currentRsvp?.status === 'no' ? 'no' : 'yes');
	$effect(() => {
		// Sync from server after submits
		if (data.currentRsvp?.status === 'no') rsvpStatus = 'no';
		else if (data.currentRsvp?.status === 'yes') rsvpStatus = 'yes';
		if (data.currentRsvp?.adultsCount != null) adultsCount = data.currentRsvp.adultsCount;
		if (data.currentRsvp?.kidsCount != null) kidsCount = data.currentRsvp.kidsCount;
		if (data.currentRsvp?.petsCount != null) petsCount = data.currentRsvp.petsCount;
		arrivalDate = data.currentRsvp?.arrivalDatetime ? new Date(data.currentRsvp.arrivalDatetime).toISOString().slice(0, 10) : tripDateKey(data.trip?.checkInDate);
		departureDate = data.currentRsvp?.departureDatetime ? new Date(data.currentRsvp.departureDatetime).toISOString().slice(0, 10) : tripDateKey(data.trip?.checkOutDate);
		noNotes = data.currentRsvp?.status === 'no' ? (data.currentRsvp?.notes ?? '') : '';
	});
	const isYes = $derived(rsvpStatus === 'yes');
	const guestEstimateFromServer = $derived(data.guestEstimate ?? null);
	let liveEstimate = $state<{ lowCents: number; highCents: number; hmin: number; hmax: number } | null>(null);
	const guestEstimate = $derived(liveEstimate ?? guestEstimateFromServer);

	$effect(() => {
		if (!isYes) {
			liveEstimate = null;
			return;
		}
		const a = arrivalDate;
		const d = departureDate;
		const adults = adultsCount;
		const beds = [...selectedBedIds];
		const pathname = $page.url.pathname;
		const t = setTimeout(async () => {
			const fd = new FormData();
			if (a) fd.set('arrivalDate', a);
			if (d) fd.set('departureDate', d);
			fd.set('adultsCount', String(adults));
			beds.forEach((id) => fd.append('bedIds', id));
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
	const canSubmitYes = $derived((isYes || needsReconfirm) && costCommitmentChecked);

	function toDateKey(d: Date | string): string {
		const date = typeof d === 'string' ? new Date(d) : d;
		const y = date.getFullYear();
		const m = String(date.getMonth() + 1).padStart(2, '0');
		const day = String(date.getDate()).padStart(2, '0');
		return `${y}-${m}-${day}`;
	}
	const tripMinDate = $derived(
		data.trip?.checkInDate != null ? toDateKey(data.trip.checkInDate as Date | string) : undefined
	);
	const tripMaxDate = $derived(
		data.trip?.checkOutDate != null ? toDateKey(data.trip.checkOutDate as Date | string) : undefined
	);

	const tripNights = $derived(data.roomPricing?.totalNights ?? 0);
	const pricingByRoomId = $derived.by(() => {
		const map = new Map<number, { slotPricePerNight: number; roomPricePerNight: number }>();
		for (const r of data.roomPricing?.roomPricing ?? []) {
			map.set(r.roomId, { slotPricePerNight: r.slotPricePerNight, roomPricePerNight: r.roomPricePerNight });
		}
		return map;
	});
	function formatDollars(dollars: number): string {
		return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(dollars);
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
				<div class="rsvp-yes-no-row">
					<h2 class="section-title">Will you join us?</h2>
					<select id="status" name="status" required bind:value={rsvpStatus} class="yes-no-select" form="rsvp-form">
						<option value="yes">Yes</option>
						<option value="no">No</option>
					</select>
				</div>
				{#if data.currentRsvp?.status === 'yes' && data.currentRsvp?.yesSubstatus === 'reconfirm_required'}
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
				<form id="rsvp-form" method="POST" action="?/updateRsvp" use:enhance={enhanceRsvpSubmit}>
					{#if isYes}
					<div class="form-row form-row-single-line">
						<div class="form-group date-range-form-group">
							<label class="form-label">Arrival – Departure</label>
							<DateRangePicker
								checkInDate={arrivalDate}
								checkOutDate={departureDate}
								placeholder="Select your dates"
								minDate={tripMinDate}
								maxDate={tripMaxDate}
								onRangeChange={(checkIn, checkOut) => {
									arrivalDate = checkIn;
									departureDate = checkOut;
								}}
							/>
							<input type="hidden" name="arrivalDate" value={arrivalDate} />
							<input type="hidden" name="departureDate" value={departureDate} />
						</div>
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
			</section>

		{#if isYes}
		<section class="card-section dietary-section">
			<h2 class="section-title">Dietary info</h2>
			<p class="dietary-intro">This helps us plan meals for everyone. Any info you share is visible to the host.</p>
			<form method="POST" action="?/updateDietary" use:enhance>
				<div class="dietary-self">
					<p class="dietary-person-label">Your info</p>
					<div class="dietary-row">
						<div class="form-group">
							<label class="form-label" for="myDietary">Dietary restrictions</label>
							<input id="myDietary" type="text" name="dietaryRestrictions" bind:value={myDietary} placeholder="e.g. vegetarian, vegan, halal…" />
						</div>
						<div class="form-group">
							<label class="form-label" for="myAllergies">Allergies</label>
							<input id="myAllergies" type="text" name="allergies" bind:value={myAllergies} placeholder="e.g. peanuts, shellfish, dairy…" />
						</div>
					</div>
				</div>
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
				<button type="submit" class="btn btn-secondary dietary-save">Save dietary info</button>
			</form>
		</section>

		<section class="card-section room-section">
			<h2 class="section-title">Choose your room</h2>
					{#if form?.claimBedsError && !form.claimBedsError.includes('You need at least')}
						<div class="error-message" class:conflict={form?.bedClaimConflict}>
							{form.claimBedsError}
						</div>
					{/if}
					{#if data.trip.rooms.length === 0}
						<p class="no-rooms">No rooms available yet. The host will add rooms soon.</p>
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
												<div class="hotel-room-photo-placeholder">
													<span>{room.name}</span>
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
													{@const spots = bed.capacitySlots ?? bed.capacity ?? 1}
													{@const isClaimedByOther = claimedByOtherSet.has(bed.id)}
													{@const bp = data.bedPricing?.[bed.id]}
													{@const perNight = bp ? bp.perNight : bedPricePerNight(room.id, spots)}
													{@const total = bp ? bp.total : bedTotal(room.id, spots)}
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
														{#if perNight > 0 && tripNights > 0}
															<span class="bed-price">{formatDollars(perNight)}/night · {formatDollars(total)} total</span>
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
						{#if tripNights > 0 && data.roomPricing && tripTotalCost > 0}
							<p class="trip-total-line"><strong>Total Trip Cost:</strong> {formatDollars(tripTotalCost)} <span class="trip-total-note">(per-bed totals above are based on current {data.yesRsvpHeadcount ?? 0} guest{data.yesRsvpHeadcount === 1 ? '' : 's'})</span></p>
						{/if}
						{#if isYes || needsReconfirm}
							<div id="cost-commitment" class="cost-commitment-module">
								{#if guestEstimate}
									<div class="estimate-lines">
										<p class="estimate-range"><strong>My estimated share: {guestEstimate.displayCents != null ? formatCents(guestEstimate.displayCents) : formatRange(guestEstimate.lowCents, guestEstimate.highCents)}</strong></p>
										<p class="estimate-secondary">
											{#if guestEstimate.displayCents != null}
												Range {formatRange(guestEstimate.lowCents, guestEstimate.highCents)} depending on final headcount.
											{:else}
												Least if {guestEstimate.hmax} guests attend (max capacity); most if {guestEstimate.hmin} attend (host's min expected). Final amount depends on the number of attendees.
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
										<input type="hidden" name="arrivalDate" value={arrivalDate} />
										<input type="hidden" name="departureDate" value={departureDate} />
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
										<p class="helper-text">For per-bed trips, you’ll see your estimate after you pick your bed(s) above.</p>
									{/if}
								{/if}
							</div>
						{/if}
					{/if}
				</section>
			{/if}
		</div>
	</div>
</div>

<style>
	@import url('https://fonts.googleapis.com/css2?family=Great+Vibes&family=Plus+Jakarta+Sans:wght@400;700&display=swap');

	.rsvp-page {
		min-height: calc(100vh - 80px);
		padding: var(--spacing-xl) var(--spacing-md);
		background: linear-gradient(160deg, #fdf8f3 0%, #f5ebe0 50%, #efe6dc 100%);
	}

	.rsvp-toast {
		position: fixed;
		bottom: 1.5rem;
		left: 50%;
		transform: translateX(-50%);
		z-index: 100;
		background: #166534;
		color: white;
		padding: 0.75rem 1.25rem;
		border-radius: var(--radius-md, 8px);
		font-size: 0.9375rem;
		font-weight: 500;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
		animation: rsvp-toast-in 0.25s ease-out;
	}
	@keyframes rsvp-toast-in {
		from {
			opacity: 0;
			transform: translateX(-50%) translateY(0.5rem);
		}
		to {
			opacity: 1;
			transform: translateX(-50%) translateY(0);
		}
	}

	.container {
		max-width: 960px;
		margin: 0 auto;
	}

	.rsvp-card {
		background: #fefdfb;
		padding: 2.5rem 2rem;
		border-radius: 12px;
		box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08), 0 0 0 1px rgba(0, 0, 0, 0.04);
		border: 1px solid rgba(180, 160, 140, 0.25);
	}

	.card-invite {
		position: relative;
		text-align: center;
		margin: -2.5rem -2rem 1.25rem -2rem;
		padding: 2.5rem 2rem 1.5rem;
		min-height: 220px;
		border-radius: 12px 12px 0 0;
		overflow: hidden;
	}
	/* Photo layer only – no gradient */
	.card-invite-photo {
		position: absolute;
		inset: 0;
		background-image: var(--trip-photo, none);
		background-size: cover;
		background-position: center;
		background-repeat: no-repeat;
		background-color: #e8e0d8;
	}
	/* Gradient overlay – extends past bottom so no seam */
	.card-invite-gradient {
		position: absolute;
		left: 0;
		right: 0;
		top: 0;
		bottom: -8px;
		background: linear-gradient(
			to bottom,
			rgba(254, 253, 251, 0.08) 0%,
			rgba(254, 253, 251, 0.12) 30%,
			rgba(254, 253, 251, 0.18) 55%,
			rgba(254, 253, 251, 0.32) 72%,
			rgba(254, 253, 251, 0.55) 85%,
			rgba(254, 253, 251, 0.82) 95%,
			#fefdfb 100%
		);
		pointer-events: none;
	}
	.card-invite-content {
		position: relative;
		z-index: 1;
	}
	.invite-line {
		font-family: 'Great Vibes', cursive;
		font-size: 2.25rem;
		letter-spacing: 0.08em;
		color: #2c2419;
		font-weight: 400;
		margin: 0 0 0.5rem 0;
		/* Soft glow so cursive reads on both light and dark parts of the photo */
		text-shadow:
			0 0 20px rgba(254, 253, 251, 0.9),
			0 0 40px rgba(254, 253, 251, 0.6),
			0 1px 2px rgba(0, 0, 0, 0.15);
	}
	.invite-divider {
		width: 48px;
		height: 1px;
		background: linear-gradient(90deg, transparent, rgba(180, 160, 140, 0.5) 20%, rgba(180, 160, 140, 0.5) 80%, transparent);
		margin: 0 auto 1.5rem;
	}
	.trip-title {
		font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;
		font-size: clamp(2rem, 5vw, 2.75rem);
		font-weight: 700;
		color: #2c2419;
		margin: 0;
		letter-spacing: 0.02em;
		line-height: 1.25;
	}
	.invite-meta {
		margin-top: 0.35rem;
		font-size: 0.95rem;
		color: #5c5248;
		font-style: italic;
		letter-spacing: 0.02em;
	}
	.invite-meta-sep {
		margin: 0 0.5rem;
		opacity: 0.7;
	}
	.trip-dates,
	.trip-destination {
		margin: 0;
	}
	.trip-destination {
		font-style: italic;
	}

	.card-section {
		margin-bottom: 2rem;
	}
	.rsvp-section.card-section {
		margin-bottom: 0.75rem;
	}
	.card-section:last-of-type {
		margin-bottom: 0;
	}
	.section-title {
		font-family: Georgia, 'Times New Roman', serif;
		font-size: 1.25rem;
		font-weight: 400;
		color: #2c2419;
		margin: 0;
	}

	.rsvp-yes-no-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--spacing-md);
		margin-bottom: var(--spacing-lg);
		flex-wrap: nowrap;
	}
	.rsvp-yes-no-row .section-title {
		flex: 0 1 auto;
		margin: 0;
		white-space: nowrap;
	}
	.yes-no-select {
		flex: 0 0 auto;
		width: 15rem;
		min-width: unset;
		padding: var(--spacing-sm) 0.5rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		font-size: 1rem;
		background: white;
		color: var(--color-text);
	}

	.rsvp-section h2 {
		margin: 0 0 var(--spacing-lg) 0;
	}

	.form-group {
		margin-bottom: var(--spacing-md);
	}

	.form-group label {
		display: block;
		margin-bottom: var(--spacing-xs);
		font-weight: 500;
	}

	.form-group input,
	.form-group select,
	.form-group textarea {
		width: 100%;
		padding: var(--spacing-sm);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		font-size: 1rem;
	}

	.date-range-form-group :global(.date-range-picker) {
		width: 100%;
	}
	.date-range-form-group :global(.date-range-picker .trigger-input) {
		width: 100%;
		padding: var(--spacing-sm);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		font-size: 1rem;
		color: var(--color-text);
		background: white;
	}
	.date-range-form-group :global(.date-range-picker .trigger-input:hover) {
		border-color: var(--color-border);
	}
	.date-range-form-group :global(.date-range-picker .trigger-input:focus) {
		outline: none;
		border-color: var(--color-primary);
		box-shadow: 0 0 0 2px rgba(102, 126, 234, 0.2);
	}
	.date-range-form-group :global(.date-range-picker .trigger-text.placeholder) {
		color: var(--color-text-light);
	}
	.date-range-form-group :global(.date-range-picker .trigger-icon) {
		color: var(--color-text-light);
	}
	.form-hint {
		display: block;
		margin-top: 0.25rem;
		font-size: 0.85rem;
		color: var(--color-text-light);
	}

	.form-row {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
		gap: var(--spacing-md);
	}
	.form-row-single-line {
		grid-template-columns: 1.5fr 80px 80px 80px;
		align-items: end;
	}
	.rsvp-section .form-row-single-line .form-group {
		margin-bottom: var(--spacing-xs);
	}
	@media (max-width: 700px) {
		.form-row-single-line {
			grid-template-columns: 1fr 1fr;
		}
	}
	.rooms-grid,
	.activities-list,
	.extras-list {
		display: grid;
		gap: var(--spacing-md);
	}

	.room-card,
	.activity-card,
	.extra-card {
		padding: var(--spacing-md);
		border: 2px solid var(--color-border);
		border-radius: var(--radius-sm);
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: var(--spacing-md);
	}

	.room-card.selected,
	.activity-card.participating {
		border-color: var(--color-primary);
		background: rgba(102, 126, 234, 0.05);
	}

	.beds-list {
		display: flex;
		gap: var(--spacing-xs);
		flex-wrap: wrap;
		margin: var(--spacing-sm) 0;
	}

	.bed-badge {
		background: var(--color-bg-light);
		padding: 0.25rem 0.5rem;
		border-radius: var(--radius-sm);
		font-size: 0.875rem;
	}

	.activity-info,
	.extra-info {
		flex: 1;
	}

	.quantity-input {
		width: 80px;
		margin-right: var(--spacing-sm);
	}

	.success-message {
		background: rgba(34, 197, 94, 0.1);
		color: #16a34a;
		padding: var(--spacing-sm);
		border-radius: var(--radius-sm);
		margin-bottom: var(--spacing-md);
		border-left: 3px solid #16a34a;
	}

	.error-message {
		background: rgba(239, 68, 68, 0.1);
		color: #b91c1c;
		padding: var(--spacing-sm);
		border-radius: var(--radius-sm);
		margin-bottom: var(--spacing-md);
		border-left: 3px solid #b91c1c;
	}
	.error-message.conflict { font-weight: 600; }

	.spots-counter {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--spacing-md);
		margin-bottom: var(--spacing-sm);
		font-size: 1rem;
	}
	.spots-warn { color: var(--color-warning, #b45309); }
	.helper-text {
		color: var(--color-text-light);
		font-size: 0.9rem;
		margin-bottom: var(--spacing-md);
	}
	.trip-total-line {
		margin: var(--spacing-md) 0 0;
		font-size: 1rem;
		color: var(--color-text);
	}
	.trip-total-note {
		font-weight: normal;
		color: var(--color-text-light);
		font-size: 0.9rem;
	}
	.beds-claim .room-card { flex-direction: column; align-items: stretch; }
	.beds-checkboxes { display: flex; flex-direction: column; gap: 0.5rem; }
	.bed-option {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		cursor: pointer;
	}
	.bed-option.disabled { opacity: 0.6; cursor: not-allowed; }
	.bed-option input { margin: 0; }
	.claimed-badge {
		font-size: 0.75rem;
		background: var(--color-bg-light);
		padding: 0.15rem 0.4rem;
		border-radius: var(--radius-sm);
		margin-left: auto;
	}
	.beds-form-actions {
		display: flex;
		align-items: center;
		gap: var(--spacing-md);
		flex-wrap: wrap;
		margin-top: var(--spacing-lg);
	}
	.validation-hint { color: var(--color-text-light); font-size: 0.9rem; }
	.summary-hint { margin-top: var(--spacing-sm); font-size: 0.9rem; color: var(--color-text-light); }

	.btn-sm {
		padding: var(--spacing-xs) var(--spacing-md);
		font-size: 0.875rem;
	}
	.date-range {
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		align-items: center;
		gap: var(--spacing-sm);
	}
	.date-range-sep { color: var(--color-text-light); }

	.reconfirm-banner {
		background: #fef3c7;
		border: 1px solid #f59e0b;
		border-radius: var(--radius-md);
		padding: var(--spacing-md);
		margin-bottom: var(--spacing-md);
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--spacing-sm);
	}
	.reconfirm-deadline { font-size: 0.9rem; color: #92400e; }
	.reconfirm-hint { display: block; margin-top: 0.5rem; font-size: 0.9rem; }
	.dietary-section { margin-top: var(--spacing-xl); padding-top: var(--spacing-lg); border-top: 1px solid rgba(180, 160, 140, 0.3); }
	.dietary-intro { font-size: .875rem; color: #78716c; margin: 0 0 1rem; }
	.dietary-self, .dietary-plusone { margin-bottom: 1.25rem; }
	.dietary-person-label { font-size: .8rem; font-weight: 700; color: #57534e; text-transform: uppercase; letter-spacing: .04em; margin: 0 0 .5rem; }
	.dietary-row { display: grid; grid-template-columns: 1fr 1fr; gap: .75rem; }
	.dietary-row-3 { grid-template-columns: 1fr 1fr 1fr; }
	@media (max-width: 600px) { .dietary-row, .dietary-row-3 { grid-template-columns: 1fr; } }
	.label-opt { font-weight: 400; color: #a8a29e; }
	.dietary-save { margin-top: .5rem; }
	.room-section { margin-top: var(--spacing-xl); padding-top: var(--spacing-lg); border-top: 1px solid rgba(180, 160, 140, 0.3); }
	.room-section-footer { margin-top: var(--spacing-lg); }

	.no-rooms { color: #5c5248; margin: 0; }
	.hotel-rooms {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 1.5rem;
		align-items: stretch;
	}
	@media (max-width: 700px) {
		.hotel-rooms { grid-template-columns: 1fr; }
	}
	.hotel-room-card {
		display: grid;
		grid-template-columns: 1fr;
		grid-template-rows: 180px auto;
		gap: 0;
		background: #fff;
		border-radius: 10px;
		overflow: hidden;
		box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
		border: 1px solid rgba(180, 160, 140, 0.2);
	}
	.hotel-room-photo {
		background: #e8e0d8;
		overflow: hidden;
		height: 180px;
		display: flex;
	}
	.hotel-room-photo img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
		flex: 1;
		min-height: 0;
	}
	.hotel-room-photo-placeholder {
		width: 100%;
		height: 100%;
		min-height: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 0.85rem;
		color: #8a7f75;
		text-align: center;
		padding: 0.5rem;
	}
	.hotel-room-body {
		padding: 0.75rem 1rem;
		display: flex;
		flex-direction: column;
		min-width: 0;
		min-height: 0;
	}
	.hotel-room-name {
		font-size: 1.1rem;
		font-weight: 600;
		color: #2c2419;
		margin: 0 0 0.35rem 0;
	}
	.hotel-room-desc {
		font-size: 0.9rem;
		color: #5c5248;
		margin: 0 0 0.5rem 0;
		line-height: 1.4;
	}
	.hotel-bed {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.35rem 0.75rem;
		padding: 0.6rem 0.75rem;
		border-radius: 8px;
		border: 2px solid rgba(180, 160, 140, 0.25);
		transition: border-color 0.2s, background 0.2s;
	}
	.hotel-bed.selected {
		border-color: var(--color-primary);
		background: rgba(102, 126, 234, 0.06);
	}
	.hotel-bed .bed-type { font-weight: 500; text-transform: capitalize; }
	.hotel-bed .bed-price { margin-left: auto; font-size: 0.85rem; color: #5c5248; }

	.cost-commitment-module {
		margin: var(--spacing-lg) 0;
		padding: 1.25rem;
		background: rgba(255, 255, 255, 0.7);
		border-radius: 10px;
		border: 1px solid rgba(180, 160, 140, 0.25);
	}
	.estimate-lines {
		text-align: center;
		margin-bottom: 0.5rem;
	}
	.estimate-lines .estimate-range { margin: 0 0 0.15rem 0; }
	.estimate-lines .estimate-secondary { margin: 0; font-size: 0.9rem; color: var(--color-text-light); }
	.estimate-range { margin: 0 0 0.25rem 0; }
	.estimate-headcount { margin: 0; font-size: 0.9rem; color: var(--color-text-light); }
	.estimate-microcopy { margin: 0 0 0.5rem 0; font-size: 0.85rem; color: var(--color-text-light); }
	.submit-form { margin-top: 1.25rem; }
	.submit-row { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 0.5rem; }
	.estimate-warning { margin: 0.25rem 0 0 0; font-size: 0.85rem; color: var(--color-warning, #b45309); }
	.commitment-checkbox { margin-top: 1rem; margin-bottom: 0; }
	.commitment-checkbox.form-group { margin-bottom: 0; }
	.commitment-label { display: flex; flex-direction: column; align-items: flex-start; gap: 0.5rem; cursor: pointer; font-weight: normal; }
	.commitment-line-one {
		display: flex;
		flex-direction: row;
		flex-wrap: nowrap;
		align-items: center;
		gap: 0.5rem;
		width: fit-content;
	}
	.commitment-line-one > span { white-space: nowrap; }
	.commitment-label .commitment-checkbox-input {
		flex-shrink: 0;
		margin: 0;
		vertical-align: middle;
		width: 1rem;
		height: 1rem;
		min-width: 1rem;
		min-height: 1rem;
	}
	.commitment-rest {
		display: block;
		font-size: 0.9rem;
		line-height: 1.45;
		color: var(--color-text-light);
		margin: 0;
	}
	.commitment-text { font-size: 0.9rem; line-height: 1.45; }
	.validation-hint { display: inline-block; margin-left: 0.5rem; font-size: 0.85rem; color: var(--color-text-light); }
</style>
