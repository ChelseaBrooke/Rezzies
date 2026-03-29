<script lang="ts">
	import RoomBedPicker from '$lib/components/wizard/RoomBedPicker.svelte';
	import AddressAutocomplete from '$lib/components/wizard/AddressAutocomplete.svelte';
	import DateRangePicker from '$lib/components/wizard/DateRangePicker.svelte';
	import SingleDatePicker from '$lib/components/wizard/SingleDatePicker.svelte';
	import type { TripDraft } from '$lib/stores/tripDraft.js';

	let {
		draft = $bindable(),
		autosave,
		prevStep,
		handleNextStep,
		canProceed
	}: {
		draft: TripDraft;
		autosave: () => void;
		prevStep: () => void;
		handleNextStep: () => void;
		canProceed: boolean;
	} = $props();

	$effect(() => {
		if (draft.rooms && Array.isArray(draft.rooms)) {
			draft.bedrooms = draft.rooms.length;
		} else {
			draft.bedrooms = 0;
		}
	});

	function handleAddressSelect(address: string, details?: any) {
		draft.propertyAddress = address?.trim() || draft.destinationCity || '';
		if (details && details.address_components) {
			const components = details.address_components;
			let city = '';
			let state = '';
			let country = '';
			components.forEach((component: any) => {
				if (component.types.includes('locality')) {
					city = component.long_name;
				} else if (component.types.includes('administrative_area_level_1')) {
					state = component.short_name;
				} else if (component.types.includes('country')) {
					country = component.long_name;
				}
			});
			draft.locationCity = city;
			draft.destinationState = state;
			draft.destinationCountry = country;
		}
		autosave();
	}
</script>

<div class="step-layout">
	<!-- ── Left: Trip Basics ──────────────────────────────── -->
	<div class="panel panel--basics">
		<div class="panel-header">
			<span class="panel-icon">
				<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
					<path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
				</svg>
			</span>
			<h3 class="panel-title">Trip Basics</h3>
		</div>

		<div class="form-stack">
			<!-- Name + Destination -->
			<div class="field-row">
				<div class="field">
					<label for="name" class="field-label">Trip name <span class="req">*</span></label>
					<input
						type="text"
						id="name"
						class="field-input"
						bind:value={draft.name}
						oninput={autosave}
						placeholder="e.g. Pinecone Cabin Weekend"
					/>
				</div>
				<div class="field">
					<label for="address-autocomplete-input" class="field-label">Destination</label>
					<AddressAutocomplete
						bind:value={draft.destinationCity}
						onSelect={handleAddressSelect}
						placeholder="City, address or place"
					/>
				</div>
			</div>

			<!-- Description -->
			<div class="field">
				<label for="description" class="field-label">Description / notes</label>
				<textarea
					id="description"
					class="field-input field-textarea"
					bind:value={draft.description}
					oninput={autosave}
					rows="6"
					placeholder="Anything guests should know before RSVPing…"
				></textarea>
			</div>

			<!-- Trip dates + RSVP-by (one section) -->
			<div class="dates-section">
				<div class="field-row field-row--dates-rsvp">
					<div class="field field--picker-pair">
						<label class="field-label">Trip dates <span class="req">*</span></label>
						<p class="field-hint" id="trip-dates-hint">
							Check-in and check-out for the trip.
						</p>
						<div class="date-picker-trigger-wrap">
							<DateRangePicker
								checkInDate={draft.checkInDate ?? ''}
								checkOutDate={draft.checkOutDate ?? ''}
								onRangeChange={(checkIn, checkOut) => {
									draft.checkInDate = checkIn;
									draft.checkOutDate = checkOut;
									autosave();
								}}
								placeholder="Select check-in and check-out"
							/>
						</div>
					</div>
					<div class="field field--picker-pair">
						<label class="field-label">RSVP-by date</label>
						<p class="field-hint" id="rsvp-by-hint">Deadline for guests to respond.</p>
						<div class="date-picker-trigger-wrap">
							<SingleDatePicker
								value={draft.rsvpByDate ?? ''}
								onDateChange={(date) => {
									draft.rsvpByDate = date;
									autosave();
								}}
								placeholder="Optional"
							/>
						</div>
					</div>
				</div>
			</div>

			<!-- Headcount bounds (draft fields: expectedGuestCount, maxOccupancy) -->
			<div class="field-row field-row--guests">
				<div class="field field--hint-below-label">
					<label for="expectedGuestCount" class="field-label field-label--stacked">
						<span class="field-label-line">Minimum Headcount <span class="req">*</span></span>
						<span class="field-label-sub">(Realistic Low)</span>
					</label>
					<p class="field-hint" id="expectedGuestCount-hint">
						Your conservative estimate. The fewest people you realistically expect will attend.
					</p>
					<input
						type="number"
						id="expectedGuestCount"
						class="field-input"
						bind:value={draft.expectedGuestCount}
						oninput={autosave}
						min="1"
						required
						placeholder="e.g. 8"
						aria-describedby="expectedGuestCount-hint"
					/>
				</div>
				<div class="field field--hint-below-label">
					<label for="maxOccupancy" class="field-label field-label--stacked">
						<span class="field-label-line">Maximum Headcount</span>
						<span class="field-label-sub">(Capacity Limit)</span>
					</label>
					<p class="field-hint" id="maxOccupancy-hint">
						The most the trip can accommodate (based on beds, rules, or the property listing).
					</p>
					<input
						type="number"
						id="maxOccupancy"
						class="field-input"
						bind:value={draft.maxOccupancy}
						oninput={autosave}
						min="0"
						placeholder="Optional"
						aria-describedby="maxOccupancy-hint"
					/>
				</div>
			</div>
		</div>
	</div>

	<!-- ── Right: Rooms & Beds ────────────────────────────── -->
	<div class="panel panel--rooms">
		<div class="panel-header">
			<span class="panel-icon">
				<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
					<path d="M2 20v-8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v8"/><path d="M2 20h20"/><path d="M2 12V6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v6"/>
				</svg>
			</span>
			<h3 class="panel-title">Rooms &amp; Beds</h3>
		</div>
		<div class="rooms-inner">
			<RoomBedPicker bind:draft {autosave} />
		</div>
	</div>
</div>

<style>
	/* ── Layout ───────────────────────────────────────────── */
	.step-layout {
		--step-panels-height: min(72vh, calc(100dvh - 12.75rem));
		display: grid;
		grid-template-columns: 38% 62%;
		grid-template-rows: minmax(0, 1fr);
		gap: 1.25rem;
		/* Don't grow to fill the whole card — keeps panels visibly shorter */
		flex: 0 1 auto;
		align-items: stretch;
		align-self: start;
		width: 100%;
		min-height: 0;
		height: var(--step-panels-height);
		max-height: var(--step-panels-height);
	}

	@media (max-width: 1024px) {
		.step-layout {
			grid-template-columns: 1fr;
			grid-template-rows: auto;
			align-items: stretch;
			height: auto;
			max-height: none;
			--step-panels-height: auto;
		}

		.panel {
			max-height: min(52vh, calc(100dvh - 11rem));
			height: auto;
		}
	}

	/* ── Panels ───────────────────────────────────────────── */
	.panel {
		background: #f8f9fb;
		border: 1.5px solid rgba(15, 23, 42, 0.08);
		border-radius: 1rem;
		overflow: hidden;
		display: flex;
		flex-direction: column;
		min-height: 0;
		height: 100%;
		max-height: 100%;
	}

	.panel-header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.85rem 1.1rem 0.8rem;
		border-bottom: 1px solid rgba(15, 23, 42, 0.07);
		background: white;
	}

	.panel-icon {
		width: 26px;
		height: 26px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 0.45rem;
		background: rgba(47, 119, 120, 0.1);
		color: var(--primary);
		flex-shrink: 0;
	}

	.panel-title {
		margin: 0;
		font-size: 0.875rem;
		font-weight: 700;
		color: var(--text);
		letter-spacing: -0.01em;
	}

	/* ── Form inside basics panel ─────────────────────────── */
	.form-stack {
		display: flex;
		flex-direction: column;
		gap: 0;
		padding: 0;
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		-webkit-overflow-scrolling: touch;
	}

	.field,
	.field-row {
		padding: 0.75rem 1.1rem;
		border-bottom: 1px solid rgba(15, 23, 42, 0.055);
	}

	/* No divider under trip name + destination */
	.form-stack > .field-row:first-child,
	.form-stack > .field-row:first-child > .field {
		border-bottom: none;
	}

	.field-row {
		padding: 0.75rem 1.1rem;
	}

	/* Last item: no bottom border */
	.form-stack > :last-child {
		border-bottom: none;
		flex: 1;
		align-items: flex-start;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 0.28rem;
	}

	.field-label {
		font-size: 0.7rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.07em;
		color: var(--muted);
	}

	.field-label--stacked {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 0.12rem;
		line-height: 1.25;
	}

	.field-label--stacked .field-label-sub {
		text-transform: none;
		letter-spacing: 0.02em;
		font-weight: 600;
		font-size: 0.68rem;
		color: var(--muted);
		opacity: 0.92;
	}

	.req {
		color: var(--danger);
		font-weight: 700;
	}

	.field-input {
		padding: 0.46rem 0.6rem;
		border: 1.5px solid rgba(15, 23, 42, 0.12);
		border-radius: 0.5rem;
		font-size: 0.875rem;
		font-family: inherit;
		color: var(--text);
		background: white;
		width: 100%;
		transition: border-color 0.15s ease, box-shadow 0.15s ease;
		outline: none;
	}

	.field-input:focus {
		border-color: var(--primary);
		box-shadow: 0 0 0 3px var(--focusRing);
	}

	.field-input::placeholder {
		color: #94a3b8;
		font-weight: 400;
	}

	/* Match AddressAutocomplete to other basics inputs (component uses .address-input) */
	.panel--basics :global(.address-input) {
		box-sizing: border-box;
		padding: 0.46rem 0.6rem;
		border: 1.5px solid rgba(15, 23, 42, 0.12);
		border-radius: 0.5rem;
		font-size: 0.875rem;
		line-height: 1.35;
	}

	.panel--basics :global(.address-input:hover) {
		border-color: rgba(15, 23, 42, 0.2);
	}

	.panel--basics :global(.address-input:focus) {
		border-color: var(--primary);
		box-shadow: 0 0 0 3px var(--focusRing);
	}

	.panel--basics :global(.address-input::placeholder) {
		color: #94a3b8;
		font-weight: 400;
	}

	.field-textarea {
		resize: vertical;
		min-height: 9.5rem;
		line-height: 1.55;
	}

	.field-row {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.75rem;
	}

	/* One visual row: trip dates + RSVP-by */
	.dates-section {
		padding: 0.75rem 1.1rem;
		border-bottom: 1px solid rgba(15, 23, 42, 0.055);
	}

	.dates-section .field-row--dates-rsvp {
		padding: 0;
		border-bottom: none;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		gap: 1rem;
		align-items: start;
	}

	.dates-section .field-row--dates-rsvp .field {
		padding: 0;
		border-bottom: none;
	}

	/* Hint directly under label (dates, headcount): consistent spacing vs default .field-hint */
	.field--picker-pair .field-hint,
	.field--hint-below-label .field-hint {
		margin: 0 0 0.35rem;
	}

	/* Full column width; same footprint for range + single pickers */
	.date-picker-trigger-wrap {
		width: 100%;
		min-width: 0;
	}

	/* Unify trigger appearance (both components use .date-range-picker .trigger-input) */
	.dates-section :global(.date-range-picker) {
		display: block;
		width: 100%;
	}

	.dates-section :global(.date-range-picker .trigger-input) {
		width: 100%;
		box-sizing: border-box;
		min-height: 2.5rem;
		border-radius: 0.5rem;
		border-width: 1.5px;
		border-color: rgba(15, 23, 42, 0.12);
		border-style: solid;
		padding: 0.46rem 0.6rem;
		padding-right: 2.25rem;
		font-size: 0.875rem;
		line-height: 1.35;
	}

	.dates-section :global(.date-range-picker .trigger-input:hover) {
		border-color: rgba(15, 23, 42, 0.2);
	}

	.dates-section :global(.date-range-picker .trigger-input:focus) {
		border-color: var(--primary);
		box-shadow: 0 0 0 3px var(--focusRing);
		outline: none;
	}

	.field--picker-pair {
		display: flex;
		flex-direction: column;
		gap: 0.28rem;
	}

	.field-hint {
		margin: -0.05rem 0 0.2rem;
		font-size: 0.72rem;
		line-height: 1.45;
		color: var(--muted);
	}

	/* ── Rooms panel ──────────────────────────────────────── */
	.rooms-inner {
		flex: 1;
		padding: 0.75rem;
		overflow-y: auto;
		min-height: 0;
	}

	@media (max-width: 768px) {
		.field-row {
			grid-template-columns: 1fr;
		}

	}
</style>
