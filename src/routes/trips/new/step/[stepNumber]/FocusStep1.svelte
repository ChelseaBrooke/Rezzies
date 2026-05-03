<script lang="ts">
	import FocusShell from '$lib/components/wizard/FocusShell.svelte';
	import AddressAutocomplete from '$lib/components/wizard/AddressAutocomplete.svelte';
	import DateRangePicker from '$lib/components/wizard/DateRangePicker.svelte';
	import type { TripDraft } from '$lib/stores/tripDraft.js';

	let {
		draft = $bindable(),
		autosave,
		handleNextStep
	}: {
		draft: TripDraft;
		autosave: () => void;
		handleNextStep: () => void;
	} = $props();

	let subStep = $state(1);

	const TOTAL_SUB = 3;
	const progressBySubStep: Record<number, number> = { 1: 15, 2: 30, 3: 45 };
	const stepLabelBySubStep: Record<number, string> = {
		1: `1 of ${TOTAL_SUB}`,
		2: `2 of ${TOTAL_SUB}`,
		3: `3 of ${TOTAL_SUB}`
	};

	function advance() {
		if (subStep < 3) subStep++;
		else handleNextStep();
	}

	function goBack() {
		if (subStep > 1) subStep--;
		else history.back();
	}

	/* ── Sub-screen 1 ── Trip name ── */
	let nameInputEl = $state<HTMLInputElement | null>(null);
	const canAdvance1 = $derived(draft.name.trim().length > 0);

	/* ── Sub-screen 2 ── Property ── */
	type ListingStatus = 'idle' | 'loading' | 'success' | 'failed';
	let listingUrl = $state('');
	let listingStatus = $state<ListingStatus>('idle');
	let listingRoomCount = $state(0);

	function handleAddressSelect(address: string, details?: any) {
		draft.propertyAddress = address?.trim() || draft.destinationCity || '';
		if (details && details.address_components) {
			const parts = details.address_components;
			let city = '';
			let stateCode = '';
			let country = '';
			parts.forEach((c: any) => {
				if (c.types.includes('locality')) city = c.long_name;
				else if (c.types.includes('administrative_area_level_1')) stateCode = c.short_name;
				else if (c.types.includes('country')) country = c.long_name;
			});
			draft.locationCity = city;
			draft.destinationState = stateCode;
			draft.destinationCountry = country;
		}
		autosave();
	}

	function isListingUrl(raw: string): boolean {
		try {
			const u = new URL(raw.trim());
			return /(?:airbnb|vrbo|homeaway)\./.test(u.hostname);
		} catch {
			return false;
		}
	}

	function applyListingPayload(data: any) {
		if (!data || typeof data !== 'object') return;
		if (typeof data.name === 'string' && !draft.name) draft.name = data.name;
		if (typeof data.address === 'string' && !draft.destinationCity) {
			draft.destinationCity = data.address;
			draft.propertyAddress = data.address;
		}
		if (typeof data.locationCity === 'string') draft.locationCity = data.locationCity;
		if (typeof data.checkInDate === 'string') draft.checkInDate = data.checkInDate;
		if (typeof data.checkOutDate === 'string') draft.checkOutDate = data.checkOutDate;
		if (typeof data.maxOccupancy === 'number') draft.maxOccupancy = data.maxOccupancy;
		if (Array.isArray(data.galleryPhotos)) draft.galleryPhotos = [...data.galleryPhotos];
		if (typeof data.coverPhoto === 'string') draft.coverPhoto = data.coverPhoto;
		if (Array.isArray(data.rooms) && draft.rooms.length === 0) draft.rooms = data.rooms;
		listingRoomCount = Array.isArray(data.rooms) ? data.rooms.length : 0;
		autosave();
	}

	async function tryAutofill(url: string) {
		if (!isListingUrl(url)) {
			listingStatus = url.trim() ? 'failed' : 'idle';
			return;
		}
		listingStatus = 'loading';
		try {
			const res = await fetch('/api/listing-import', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ url: url.trim() })
			});
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			applyListingPayload(await res.json());
			listingStatus = 'success';
		} catch {
			listingStatus = 'failed';
		}
	}

	function onUrlBlur() {
		if (listingUrl.trim()) tryAutofill(listingUrl);
	}

	function onUrlPaste() {
		setTimeout(() => { if (listingUrl.trim()) tryAutofill(listingUrl); }, 0);
	}

	const listingDomain = $derived.by(() => {
		try { return new URL(listingUrl).hostname.replace(/^www\./, ''); } catch { return ''; }
	});

	const canAdvance2 = $derived(
		(!!draft.destinationCity || !!draft.propertyAddress) &&
		!!draft.checkInDate &&
		!!draft.checkOutDate
	);

	/* ── Sub-screen 3 ── Headcount ── */
	let skipped3 = $state(false);

	const canAdvance3 = $derived(
		skipped3 ||
		(Number(draft.expectedGuestCount) >= 1 && Number(draft.maxOccupancy) >= 1)
	);

	function skipHeadcount() {
		draft.expectedGuestCount = 0;
		draft.maxOccupancy = 0;
		skipped3 = true;
		autosave();
		advance();
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key !== 'Enter') return;
		const target = e.target as HTMLElement;
		if (target.tagName === 'TEXTAREA') return;
		e.preventDefault();
		if (subStep === 1 && canAdvance1) advance();
		else if (subStep === 2 && canAdvance2) advance();
		else if (subStep === 3 && canAdvance3) advance();
	}
</script>

<svelte:window onkeydown={onKeydown} />

<FocusShell
	progressPercent={progressBySubStep[subStep]}
	stepLabel={stepLabelBySubStep[subStep]}
	onBack={goBack}
>
	{#key subStep}
		<div class="fs1-screen">
			{#if subStep === 1}
				<!-- ── Screen 1: Trip name ── -->
				<div class="fs1-accent" style="background: var(--warm)"></div>
				<p class="fs1-eyebrow" style="color: var(--warm)">Let's get started</p>
				<h1 class="fs1-question">
					What are you calling <em>this</em> trip?
				</h1>

				<div class="fs1-field">
					<input
						type="text"
						class="fs1-input"
						bind:value={draft.name}
						oninput={autosave}
						placeholder="e.g. Beach Week 2026"
						bind:this={nameInputEl}
						autofocus
						autocomplete="off"
						spellcheck="false"
					/>
				</div>

				<p class="fs1-hint">A name your crew will recognize in the group chat</p>

				<button
					type="button"
					class="fs1-cta fs1-cta--warm"
					onclick={advance}
					disabled={!canAdvance1}
				>
					Continue →
				</button>
				<p class="fs1-enter-hint">or press Enter</p>
				<button type="button" class="fs1-back-link" onclick={goBack}>Back</button>

			{:else if subStep === 2}
				<!-- ── Screen 2: Property ── -->
				<div class="fs1-accent" style="background: var(--slate)"></div>
				<p class="fs1-eyebrow" style="color: var(--slate)">The property</p>
				<h1 class="fs1-question">Where is the property?</h1>

				<!-- Listing URL -->
				<div class="fs1-field">
					<label class="fs1-field-label" for="listing-url">Airbnb or VRBO link</label>
					<input
						id="listing-url"
						type="url"
						class="fs1-input"
						bind:value={listingUrl}
						onblur={onUrlBlur}
						onpaste={onUrlPaste}
						placeholder="https://www.airbnb.com/rooms/..."
						inputmode="url"
						autocomplete="url"
						spellcheck="false"
					/>
				</div>

				<!-- URL status row -->
				{#if listingStatus === 'loading'}
					<div class="fs1-status fs1-status--loading" aria-live="polite">
						<span class="fs1-spinner" aria-hidden="true"></span>
						Pulling listing details...
					</div>
				{:else if listingStatus === 'success'}
					<div class="fs1-status fs1-status--success" role="status" aria-live="polite">
						<span class="fs1-dot" aria-hidden="true"></span>
						{listingDomain}{listingRoomCount > 0 ? ` (${listingRoomCount} room${listingRoomCount !== 1 ? 's' : ''} imported)` : ' listing loaded'}
					</div>
				{:else if listingStatus === 'failed'}
					<p class="fs1-status fs1-status--failed" role="alert">
						We couldn't find that listing. Fill in manually below.
					</p>
				{/if}

				<!-- Divider -->
				<div class="fs1-divider" aria-hidden="true">
					<span>or fill in manually</span>
				</div>

				<!-- Manual fields -->
				<div class="fs1-field">
					<p class="fs1-field-label">Address</p>
					<AddressAutocomplete
						bind:value={draft.destinationCity}
						onSelect={handleAddressSelect}
						placeholder="City, address, or place"
					/>
				</div>

				<div class="fs1-field">
					<p class="fs1-field-label">Dates</p>
					<DateRangePicker
						checkInDate={draft.checkInDate ?? ''}
						checkOutDate={draft.checkOutDate ?? ''}
						onRangeChange={(ci, co) => {
							draft.checkInDate = ci;
							draft.checkOutDate = co;
							autosave();
						}}
						placeholder="Check-in and check-out"
					/>
				</div>

				<p class="fs1-hint">Paste a link for the fastest setup, or fill in manually.</p>

				<button
					type="button"
					class="fs1-cta fs1-cta--navy"
					onclick={advance}
					disabled={!canAdvance2}
				>
					Continue →
				</button>
				<button type="button" class="fs1-back-link" onclick={goBack}>Back</button>

			{:else}
				<!-- ── Screen 3: Headcount ── -->
				<div class="fs1-accent" style="background: var(--carrot)"></div>
				<p class="fs1-eyebrow" style="color: var(--muted)">Headcount</p>
				<h1 class="fs1-question">How many people might come?</h1>

				<div class="fs1-headcount">
					<label class="fs1-num-field">
						<span class="fs1-num-label">Minimum</span>
						<input
							type="number"
							class="fs1-num-input"
							bind:value={draft.expectedGuestCount}
							oninput={autosave}
							min="1"
							placeholder="8"
							aria-label="Minimum headcount"
						/>
					</label>
					<label class="fs1-num-field">
						<span class="fs1-num-label">Maximum</span>
						<input
							type="number"
							class="fs1-num-input"
							bind:value={draft.maxOccupancy}
							oninput={autosave}
							min="1"
							placeholder="14"
							aria-label="Maximum headcount"
						/>
					</label>
				</div>

				<p class="fs1-hint">
					We show your group a price range between these two numbers. Locks in as people RSVP.
				</p>

				<button type="button" class="fs1-skip" onclick={skipHeadcount}>
					Skip for now
				</button>

				<button
					type="button"
					class="fs1-cta fs1-cta--navy"
					onclick={advance}
					disabled={!canAdvance3}
				>
					Continue →
				</button>
				<p class="fs1-enter-hint">or press Enter</p>
				<button type="button" class="fs1-back-link" onclick={goBack}>Back</button>
			{/if}
		</div>
	{/key}
</FocusShell>

<style>
	/* ── Screen container ─────────────────────────────────── */
	.fs1-screen {
		display: flex;
		flex-direction: column;
		animation: fs1SlideIn 200ms ease both;
	}

	@keyframes fs1SlideIn {
		from {
			opacity: 0;
			transform: translateX(24px);
		}
		to {
			opacity: 1;
			transform: none;
		}
	}

	/* ── Accent line ──────────────────────────────────────── */
	.fs1-accent {
		width: 36px;
		height: 3px;
		border-radius: 2px;
		margin-bottom: 14px;
		flex-shrink: 0;
	}

	/* ── Eyebrow ──────────────────────────────────────────── */
	.fs1-eyebrow {
		font-size: 0.625rem;
		font-weight: 700;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		margin: 0 0 10px;
	}

	/* ── Question ─────────────────────────────────────────── */
	.fs1-question {
		font-family: 'Fraunces', Georgia, serif;
		font-size: clamp(1.375rem, 4vw, 1.75rem);
		font-weight: 600;
		line-height: 1.2;
		color: var(--text);
		margin: 0 0 20px;
		letter-spacing: -0.02em;
	}

	.fs1-question em {
		font-style: italic;
		font-weight: inherit;
	}

	/* ── Field wrapper ────────────────────────────────────── */
	.fs1-field {
		display: flex;
		flex-direction: column;
		gap: 6px;
		margin-bottom: 12px;
	}

	.fs1-field-label {
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--muted);
		letter-spacing: 0.02em;
	}

	/* ── Base input ───────────────────────────────────────── */
	.fs1-input {
		width: 100%;
		height: 48px;
		padding: 0 14px;
		font-size: 1rem;
		font-family: 'Plus Jakarta Sans', Helvetica, Arial, sans-serif;
		color: var(--text);
		background: white;
		border: 1.5px solid var(--border);
		border-radius: 10px;
		outline: none;
		transition: border-color 150ms ease, box-shadow 150ms ease;
		box-sizing: border-box;
	}

	.fs1-input:hover {
		border-color: rgba(47, 119, 120, 0.4);
	}

	.fs1-input:focus {
		border-color: var(--navy);
		box-shadow: 0 0 0 4px var(--focusRing);
	}

	.fs1-input::placeholder {
		color: var(--muted);
		font-weight: 400;
	}

	/* Match AddressAutocomplete + DateRangePicker inputs to fs1-input */
	.fs1-field :global(.address-input),
	.fs1-field :global(.date-range-picker .trigger-input) {
		box-sizing: border-box;
		width: 100%;
		height: 48px;
		padding: 0 14px;
		font-family: 'Plus Jakarta Sans', Helvetica, Arial, sans-serif;
		font-size: 1rem;
		color: var(--text);
		background: white;
		border: 1.5px solid var(--border);
		border-radius: 10px;
		outline: none;
		transition: border-color 150ms ease, box-shadow 150ms ease;
	}

	.fs1-field :global(.address-input:hover),
	.fs1-field :global(.date-range-picker .trigger-input:hover) {
		border-color: rgba(47, 119, 120, 0.4);
	}

	.fs1-field :global(.address-input:focus),
	.fs1-field :global(.date-range-picker .trigger-input:focus) {
		border-color: var(--navy);
		box-shadow: 0 0 0 4px var(--focusRing);
		outline: none;
	}

	.fs1-field :global(.address-input::placeholder) {
		color: var(--muted);
		font-weight: 400;
	}

	/* ── Listing status ───────────────────────────────────── */
	.fs1-status {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 0.75rem;
		line-height: 1.5;
		margin-bottom: 12px;
		padding: 6px 10px;
		border-radius: 6px;
	}

	.fs1-status--loading {
		color: var(--muted);
		background: var(--surface-faint);
	}

	.fs1-status--success {
		color: var(--success-text);
		background: var(--success-bg);
		border: 1px solid var(--success-border);
	}

	.fs1-status--failed {
		color: var(--warm);
		background: transparent;
		padding: 0;
		margin-bottom: 8px;
	}

	/* Spinner */
	.fs1-spinner {
		display: inline-block;
		width: 12px;
		height: 12px;
		border: 1.5px solid var(--border);
		border-top-color: var(--slate);
		border-radius: 50%;
		animation: fs1Spin 600ms linear infinite;
		flex-shrink: 0;
	}

	@keyframes fs1Spin {
		to { transform: rotate(360deg); }
	}

	/* Success dot */
	.fs1-dot {
		display: inline-block;
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: var(--success-text);
		flex-shrink: 0;
	}

	/* ── Divider ──────────────────────────────────────────── */
	.fs1-divider {
		display: flex;
		align-items: center;
		gap: 10px;
		margin: 8px 0 14px;
		font-size: 0.625rem;
		color: var(--muted);
		text-transform: lowercase;
		letter-spacing: 0.04em;
	}

	.fs1-divider::before,
	.fs1-divider::after {
		content: '';
		flex: 1;
		height: 1px;
		background: var(--border-paper);
	}

	/* ── Hint ─────────────────────────────────────────────── */
	.fs1-hint {
		font-size: 0.6875rem;
		color: var(--muted);
		line-height: 1.55;
		margin: 0 0 20px;
	}

	/* ── CTA button ───────────────────────────────────────── */
	.fs1-cta {
		width: 100%;
		height: 48px;
		border-radius: 10px;
		font-size: 0.875rem;
		font-weight: 600;
		font-family: 'Plus Jakarta Sans', Helvetica, Arial, sans-serif;
		color: white;
		border: none;
		cursor: pointer;
		transition: opacity 150ms ease, transform 100ms ease;
		letter-spacing: 0.01em;
	}

	.fs1-cta:hover:not(:disabled) {
		opacity: 0.92;
		transform: translateY(-1px);
	}

	.fs1-cta:disabled {
		opacity: 0.4;
		cursor: not-allowed;
		transform: none;
	}

	.fs1-cta--warm { background: var(--warm); }
	.fs1-cta--navy { background: var(--navy); }

	/* ── "or press Enter" hint ────────────────────────────── */
	.fs1-enter-hint {
		font-size: 0.625rem;
		color: var(--border);
		text-align: center;
		margin: 6px 0 0;
	}

	/* ── Back link ────────────────────────────────────────── */
	.fs1-back-link {
		background: none;
		border: none;
		font: inherit;
		font-size: 0.6875rem;
		color: var(--muted);
		cursor: pointer;
		text-align: center;
		text-decoration: underline;
		text-underline-offset: 3px;
		margin: 8px auto 0;
		display: block;
		padding: 4px 0;
	}

	.fs1-back-link:hover {
		color: var(--text);
	}

	/* ── Skip link ────────────────────────────────────────── */
	.fs1-skip {
		background: none;
		border: none;
		font: inherit;
		font-size: 0.75rem;
		color: var(--muted);
		cursor: pointer;
		text-decoration: underline;
		text-underline-offset: 3px;
		text-align: center;
		display: block;
		margin: 0 auto 16px;
		padding: 4px 0;
	}

	.fs1-skip:hover {
		color: var(--text);
	}

	/* ── Headcount inputs ─────────────────────────────────── */
	.fs1-headcount {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 12px;
		margin-bottom: 16px;
	}

	.fs1-num-field {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.fs1-num-label {
		font-size: 0.5625rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.07em;
		color: var(--muted);
	}

	.fs1-num-input {
		width: 100%;
		height: 60px;
		padding: 0 12px;
		font-family: 'Fraunces', Georgia, serif;
		font-size: 1.75rem;
		font-weight: 600;
		color: var(--text);
		text-align: center;
		background: white;
		border: 1.5px solid var(--border);
		border-radius: 10px;
		outline: none;
		transition: border-color 150ms ease, box-shadow 150ms ease;
		box-sizing: border-box;
		-moz-appearance: textfield;
		appearance: textfield;
	}

	.fs1-num-input::-webkit-outer-spin-button,
	.fs1-num-input::-webkit-inner-spin-button {
		-webkit-appearance: none;
		margin: 0;
	}

	.fs1-num-input:hover {
		border-color: rgba(47, 119, 120, 0.4);
	}

	.fs1-num-input:focus {
		border-color: var(--navy);
		box-shadow: 0 0 0 4px var(--focusRing);
	}

	.fs1-num-input::placeholder {
		color: var(--border);
		font-weight: 400;
	}

	/* ── Mobile ───────────────────────────────────────────── */
	@media (max-width: 480px) {
		.fs1-headcount {
			grid-template-columns: 1fr;
		}
	}
</style>
