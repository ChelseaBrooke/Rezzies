<script lang="ts">
	import RoomBedPicker from '$lib/components/wizard/RoomBedPicker.svelte';
	import AddressAutocomplete from '$lib/components/wizard/AddressAutocomplete.svelte';
	import DateRangePicker from '$lib/components/wizard/DateRangePicker.svelte';
	import SingleDatePicker from '$lib/components/wizard/SingleDatePicker.svelte';
	import type { TripDraft } from '$lib/stores/tripDraft.js';

	let {
		draft = $bindable(),
		autosave
	}: {
		draft: TripDraft;
		autosave: () => void;
		/* prevStep, handleNextStep, canProceed are still wired by the parent route's
		   sticky footer (Back / Save Draft / Next). They remain in the prop API for
		   compatibility but are not consumed inside this redesigned step body. */
		prevStep: () => void;
		handleNextStep: () => void;
		canProceed: boolean;
	} = $props();

	$effect(() => {
		draft.bedrooms = Array.isArray(draft.rooms) ? draft.rooms.length : 0;
	});

	function handleAddressSelect(address: string, details?: any) {
		draft.propertyAddress = address?.trim() || draft.destinationCity || '';
		if (details && details.address_components) {
			const components = details.address_components;
			let city = '';
			let stateCode = '';
			let country = '';
			components.forEach((component: any) => {
				if (component.types.includes('locality')) city = component.long_name;
				else if (component.types.includes('administrative_area_level_1'))
					stateCode = component.short_name;
				else if (component.types.includes('country')) country = component.long_name;
			});
			draft.locationCity = city;
			draft.destinationState = stateCode;
			draft.destinationCountry = country;
		}
		autosave();
	}

	let showMore = $state(false);

	let coverUploading = $state(false);
	let coverError = $state<string | null>(null);
	let galleryUploading = $state(false);
	let galleryError = $state<string | null>(null);

	async function uploadOne(file: File): Promise<string | null> {
		const fd = new FormData();
		fd.set('file', file);
		const res = await fetch('/api/upload-image', { method: 'POST', body: fd });
		const json = await res.json().catch(() => ({}));
		if (!res.ok || !json.url) return null;
		const origin = typeof window !== 'undefined' ? window.location.origin : '';
		return /^https?:\/\//i.test(json.url) ? json.url : `${origin}${json.url}`;
	}

	async function onCoverFileChange(ev: Event) {
		const input = ev.target as HTMLInputElement;
		const file = input.files?.[0];
		input.value = '';
		if (!file) return;
		coverUploading = true;
		coverError = null;
		try {
			const url = await uploadOne(file);
			if (!url) {
				coverError = 'Upload failed. Try a JPEG, PNG, or WebP under 10MB.';
				return;
			}
			draft.coverPhoto = url;
			autosave();
		} finally {
			coverUploading = false;
		}
	}

	async function onGalleryFileChange(ev: Event) {
		const input = ev.target as HTMLInputElement;
		const files = Array.from(input.files ?? []);
		input.value = '';
		if (files.length === 0) return;
		galleryUploading = true;
		galleryError = null;
		try {
			const urls: string[] = [];
			for (const f of files) {
				const u = await uploadOne(f);
				if (u) urls.push(u);
				else galleryError = 'Some uploads failed. Try a JPEG, PNG, or WebP under 10MB.';
			}
			if (urls.length > 0) {
				draft.galleryPhotos = [...(draft.galleryPhotos ?? []), ...urls];
				if (!draft.coverPhoto) draft.coverPhoto = urls[0];
				autosave();
			}
		} finally {
			galleryUploading = false;
		}
	}

	function removeGalleryPhoto(index: number) {
		const removed = draft.galleryPhotos[index];
		draft.galleryPhotos = draft.galleryPhotos.filter((_, i) => i !== index);
		if (removed && removed === draft.coverPhoto) {
			draft.coverPhoto = draft.galleryPhotos[0] ?? '';
		}
		autosave();
	}

	function setCoverFromGallery(url: string) {
		draft.coverPhoto = url;
		autosave();
	}
</script>

<div class="step1">
	<!-- ─────────────────── Section 1: Hero ─────────────────── -->
	<section class="s1-hero" aria-labelledby="s1-hero-title">
		<h1 id="s1-hero-title" class="s1-display">What are you calling this trip?</h1>

		<label class="s1-field s1-field--name">
			<span class="s1-label-sr">Trip name</span>
			<input
				type="text"
				class="s1-input s1-input--xl"
				bind:value={draft.name}
				oninput={autosave}
				placeholder="Beach Week 2026"
				aria-label="Trip name"
			/>
		</label>
	</section>

	<!-- ─────────────────── Section 2: Cover photo (required) ─────────────────── -->
	<section class="s1-section" aria-labelledby="s1-cover-title">
		<div class="s1-section-head">
			<h2 id="s1-cover-title" class="s1-section-title">Your cover photo</h2>
			<span class="s1-required-pill" aria-hidden="true">Required</span>
		</div>
		<p class="s1-section-sub">
			One photo that sets the tone. Guests see this as the trip's hero image.
		</p>

		{#if draft.coverPhoto}
			<div class="s1-cover">
				<img src={draft.coverPhoto} alt="Trip cover" />
				<div class="s1-cover-actions">
					<label class="s1-cover-replace" class:s1-cover-replace--busy={coverUploading}>
						<input type="file" accept="image/*" onchange={onCoverFileChange} />
						<span>{coverUploading ? 'Uploading...' : 'Replace'}</span>
					</label>
					<button
						type="button"
						class="s1-cover-remove"
						onclick={() => {
							draft.coverPhoto = '';
							autosave();
						}}
					>
						Remove
					</button>
				</div>
			</div>
		{:else}
			<label class="s1-cover-drop" class:s1-cover-drop--busy={coverUploading}>
				<input type="file" accept="image/*" onchange={onCoverFileChange} />
				<span class="s1-cover-icon" aria-hidden="true">
					<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
						<rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
						<circle cx="8.5" cy="8.5" r="1.5"></circle>
						<polyline points="21 15 16 10 5 21"></polyline>
					</svg>
				</span>
				<span class="s1-cover-drop-title">
					{coverUploading ? 'Uploading...' : 'Upload your cover photo'}
				</span>
				<span class="s1-cover-drop-hint">JPEG, PNG, or WebP, up to 10MB</span>
			</label>
		{/if}
		{#if coverError}
			<p class="s1-error" role="alert">{coverError}</p>
		{/if}
	</section>

	<!-- ─────────────────── Section 3: The basics ─────────────────── -->
	<section class="s1-section" aria-labelledby="s1-basics-title">
		<h2 id="s1-basics-title" class="s1-section-title">The basics</h2>

		<div class="s1-stack">
			<label class="s1-field">
				<span class="s1-field-label">Where is it?</span>
				<AddressAutocomplete
					bind:value={draft.destinationCity}
					onSelect={handleAddressSelect}
					placeholder="City, address, or place"
				/>
			</label>

			<div class="s1-field">
				<span class="s1-field-label">When are you going?</span>
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

			<div class="s1-field">
				<span class="s1-field-label">How many people are coming?</span>
				<div class="s1-headcount">
					<label class="s1-field s1-field--inline">
						<span class="s1-sublabel">Minimum</span>
						<input
							type="number"
							class="s1-input"
							bind:value={draft.expectedGuestCount}
							oninput={autosave}
							min="1"
							max={Number(draft.maxOccupancy) >= 1 ? draft.maxOccupancy : undefined}
							placeholder="8"
							aria-label="Minimum headcount"
						/>
					</label>
					<label class="s1-field s1-field--inline">
						<span class="s1-sublabel">Maximum</span>
						<input
							type="number"
							class="s1-input"
							bind:value={draft.maxOccupancy}
							oninput={autosave}
							min={Number(draft.expectedGuestCount) >= 1 ? draft.expectedGuestCount : 1}
							placeholder="12"
							aria-label="Maximum headcount"
						/>
					</label>
				</div>
				<p class="s1-helper">
					We use these to show your group a price range. The actual number locks in as people RSVP.
				</p>
			</div>

			<div class="s1-field">
				<span class="s1-field-label">When do RSVPs need to be in by?</span>
				<SingleDatePicker
					value={draft.rsvpByDate ?? ''}
					onDateChange={(date) => {
						draft.rsvpByDate = date;
						autosave();
					}}
					placeholder="Optional"
				/>
				{#if draft.rsvpByDate}
					<button
						type="button"
						class="s1-textlink s1-textlink--small"
						onclick={() => {
							draft.rsvpByDate = '';
							autosave();
						}}
					>
						Skip
					</button>
				{/if}
			</div>
		</div>
	</section>

	<!-- ─────────────────── Section 4: Your rooms ─────────────────── -->
	<section class="s1-section" aria-labelledby="s1-rooms-title">
		<h2 id="s1-rooms-title" class="s1-section-title">Your rooms</h2>
		<p class="s1-section-sub">
			Add a card for each bedroom your guests can claim. Drop in a few photos so they know what
			they're signing up for.
		</p>

		<RoomBedPicker bind:draft {autosave} />
	</section>

	<!-- ─────────────────── More options expander ─────────────────── -->
	<section class="s1-more" aria-labelledby="s1-more-title">
		<button
			type="button"
			class="s1-more-toggle"
			aria-expanded={showMore}
			aria-controls="s1-more-panel"
			onclick={() => (showMore = !showMore)}
		>
			<span class="s1-more-icon" aria-hidden="true">{showMore ? '−' : '+'}</span>
			<span id="s1-more-title">More options (gallery, description, visibility)</span>
		</button>

		{#if showMore}
			<div id="s1-more-panel" class="s1-more-panel s1-fadein">
				<div class="s1-field">
					<span class="s1-field-label">Trip gallery photos</span>
					<p class="s1-helper">
						Extra photos for the trip page (in addition to the cover and room cards above).
					</p>
					{#if draft.galleryPhotos && draft.galleryPhotos.length > 0}
						<div class="s1-gallery">
							{#each draft.galleryPhotos as photo, gi (photo + gi)}
								<div
									class="s1-gallery-item"
									class:s1-gallery-item--cover={draft.coverPhoto === photo}
								>
									<img src={photo} alt={`Trip photo ${gi + 1}`} />
									<button
										type="button"
										class="s1-gallery-cover"
										aria-label={draft.coverPhoto === photo
											? 'Cover photo'
											: 'Set as cover'}
										title={draft.coverPhoto === photo
											? 'Cover photo'
											: 'Set as cover photo'}
										onclick={() => setCoverFromGallery(photo)}
									>
										{draft.coverPhoto === photo ? '★' : '☆'}
									</button>
									<button
										type="button"
										class="s1-gallery-remove"
										aria-label="Remove photo"
										onclick={() => removeGalleryPhoto(gi)}
									>
										×
									</button>
								</div>
							{/each}
						</div>
					{/if}
					<label class="s1-upload">
						<input type="file" accept="image/*" multiple onchange={onGalleryFileChange} />
						<span>{galleryUploading ? 'Uploading...' : 'Upload gallery photos'}</span>
					</label>
					{#if galleryError}
						<p class="s1-error" role="alert">{galleryError}</p>
					{/if}
				</div>

				<label class="s1-field">
					<span class="s1-field-label">Trip notes / description</span>
					<p class="s1-helper">Anything guests should know before they RSVP.</p>
					<textarea
						class="s1-input s1-textarea"
						rows="4"
						bind:value={draft.description}
						oninput={autosave}
						placeholder="Quiet little cabin, dogs welcome, bring layers..."
					></textarea>
				</label>

				<div class="s1-field">
					<span class="s1-field-label">Visibility</span>
					<div class="s1-radio-group" role="radiogroup" aria-label="Trip visibility">
						<label class="s1-radio">
							<input
								type="radio"
								name="visibility"
								value="invite-only"
								checked={draft.visibility === 'invite-only'}
								onchange={() => {
									draft.visibility = 'invite-only';
									autosave();
								}}
							/>
							<span>
								<strong>Invite only</strong>
								<small>Only people you invite can see this trip.</small>
							</span>
						</label>
						<label class="s1-radio">
							<input
								type="radio"
								name="visibility"
								value="private"
								checked={draft.visibility === 'private'}
								onchange={() => {
									draft.visibility = 'private';
									autosave();
								}}
							/>
							<span>
								<strong>Private</strong>
								<small>Hidden from search and listings.</small>
							</span>
						</label>
					</div>
				</div>
			</div>
		{/if}
	</section>
</div>

<style>
	/* ── Page surface and layout ───────────────────────────── */
	.step1 {
		--s1-col: 720px;
		--s1-gap: 5rem;
		background: var(--surface-paper);
		color: var(--text);
		padding: 3.5rem 2rem 4rem;
		display: flex;
		flex-direction: column;
		gap: var(--s1-gap);
		font-family: 'Plus Jakarta Sans', Helvetica, Arial, sans-serif;
		flex: 1;
		min-height: 0;
		/* Bleed to the edges of the parent .card-content (default padding 1rem 2rem 1.5rem),
		   so the warm editorial surface fills the visible card area edge-to-edge. */
		margin: -1rem -2rem -1.5rem;
		box-sizing: border-box;
	}

	.step1 > * {
		width: 100%;
		max-width: var(--s1-col);
		margin-left: auto;
		margin-right: auto;
	}

	.s1-fadein {
		animation: s1FadeIn 280ms ease both;
	}

	@keyframes s1FadeIn {
		from {
			opacity: 0;
			transform: translateY(4px);
		}
		to {
			opacity: 1;
			transform: none;
		}
	}

	/* ── Section 1: Hero ───────────────────────────────────── */
	.s1-hero {
		display: flex;
		flex-direction: column;
		gap: 1.75rem;
	}

	.s1-display {
		font-family: 'Fraunces', Georgia, serif;
		font-weight: 500;
		font-size: clamp(2.5rem, 4vw, 3.25rem);
		line-height: 1.1;
		letter-spacing: -0.02em;
		color: var(--text);
		margin: 0;
	}

	.s1-label-sr {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}

	.s1-textlink {
		align-self: flex-start;
		background: none;
		border: none;
		padding: 0.25rem 0;
		font: inherit;
		font-size: 0.95rem;
		color: var(--primary);
		cursor: pointer;
		text-decoration: underline;
		text-decoration-color: transparent;
		text-underline-offset: 4px;
		transition: text-decoration-color var(--transition-fast);
	}

	.s1-textlink:hover {
		text-decoration-color: currentColor;
	}

	.s1-textlink--small {
		font-size: 0.85rem;
		margin-top: 0.4rem;
	}

	/* ── Section structure ─────────────────────────────────── */
	.s1-section {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.s1-section-head {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		flex-wrap: wrap;
	}

	.s1-section-title {
		font-family: 'Fraunces', Georgia, serif;
		font-weight: 500;
		font-size: var(--display-md);
		line-height: 1.15;
		letter-spacing: -0.01em;
		color: var(--text);
		margin: 0;
	}

	.s1-section-sub {
		margin: -0.75rem 0 0;
		color: var(--muted);
		font-size: 0.95rem;
		line-height: 1.5;
	}

	.s1-required-pill {
		display: inline-flex;
		align-items: center;
		font-size: 0.7rem;
		font-weight: 600;
		letter-spacing: 0.04em;
		color: var(--warm);
		background: rgba(206, 86, 18, 0.08);
		padding: 0.15rem 0.55rem;
		border-radius: 999px;
	}

	.s1-stack {
		display: flex;
		flex-direction: column;
		gap: 2rem;
	}

	/* ── Fields and inputs ─────────────────────────────────── */
	.s1-field {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.s1-field--inline {
		flex: 1;
		min-width: 0;
		gap: 0.4rem;
	}

	.s1-field-label {
		font-size: 0.95rem;
		font-weight: 500;
		color: var(--text);
		letter-spacing: 0;
	}

	.s1-sublabel {
		font-size: 0.85rem;
		font-weight: 500;
		color: var(--muted);
	}

	.s1-helper {
		margin: 0;
		font-size: 0.85rem;
		line-height: 1.5;
		color: var(--muted);
	}

	.s1-input {
		width: 100%;
		min-height: 52px;
		padding: 0.95rem 1rem;
		font: inherit;
		font-size: 1rem;
		font-family: 'Plus Jakarta Sans', Helvetica, Arial, sans-serif;
		color: var(--text);
		background: var(--surfaceSolid);
		border: 1px solid var(--border-soft);
		border-radius: var(--radius-lg);
		transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
		outline: none;
		box-sizing: border-box;
	}

	.s1-input:hover {
		border-color: var(--border);
	}

	.s1-input:focus {
		border-color: var(--primary);
		box-shadow: 0 0 0 3px var(--focusRing);
	}

	.s1-input::placeholder {
		color: var(--muted);
		opacity: 0.65;
	}

	.s1-input--xl {
		min-height: 60px;
		padding: 1rem 1.15rem;
		font-size: 1.05rem;
	}

	.s1-textarea {
		min-height: 7rem;
		resize: vertical;
		line-height: 1.5;
	}

	/* AddressAutocomplete and DateRangePicker render their own inputs;
	   match the editorial input style by overriding their classes here. */
	.s1-section :global(.address-input),
	.s1-section :global(.date-range-picker .trigger-input) {
		box-sizing: border-box;
		width: 100%;
		min-height: 52px;
		padding: 0.95rem 1rem;
		font-family: 'Plus Jakarta Sans', Helvetica, Arial, sans-serif;
		font-size: 1rem;
		color: var(--text);
		background: var(--surfaceSolid);
		border: 1px solid var(--border-soft);
		border-radius: var(--radius-lg);
		transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
	}

	.s1-section :global(.address-input:hover),
	.s1-section :global(.date-range-picker .trigger-input:hover) {
		border-color: var(--border);
	}

	.s1-section :global(.address-input:focus),
	.s1-section :global(.date-range-picker .trigger-input:focus) {
		border-color: var(--primary);
		box-shadow: 0 0 0 3px var(--focusRing);
		outline: none;
	}

	.s1-section :global(.address-input::placeholder) {
		color: var(--muted);
		opacity: 0.65;
	}

	/* Headcount: side-by-side on desktop, stacked on mobile */
	.s1-headcount {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1.5rem;
	}

	/* ── Cover photo ───────────────────────────────────────── */
	.s1-cover-drop {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		min-height: 14rem;
		padding: 2.5rem 1.5rem;
		background: var(--surfaceSolid);
		border: 1.5px dashed var(--border);
		border-radius: var(--radius-2xl);
		color: var(--text);
		cursor: pointer;
		transition: border-color var(--transition-fast), background var(--transition-fast);
		text-align: center;
	}

	.s1-cover-drop:hover {
		border-color: var(--primary);
		background: rgba(47, 119, 120, 0.04);
	}

	.s1-cover-drop--busy {
		cursor: progress;
	}

	.s1-cover-drop input[type='file'] {
		position: absolute;
		inset: 0;
		opacity: 0;
		cursor: inherit;
	}

	.s1-cover-icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		color: var(--primary);
		opacity: 0.9;
	}

	.s1-cover-drop-title {
		font-size: 1rem;
		font-weight: 500;
		color: var(--text);
	}

	.s1-cover-drop-hint {
		font-size: 0.85rem;
		color: var(--muted);
	}

	.s1-cover {
		position: relative;
		border-radius: var(--radius-2xl);
		overflow: hidden;
		border: 1px solid var(--border-soft);
		background: var(--surfaceSolid);
	}

	.s1-cover img {
		display: block;
		width: 100%;
		height: auto;
		max-height: 28rem;
		object-fit: cover;
	}

	.s1-cover-actions {
		position: absolute;
		bottom: 0.75rem;
		right: 0.75rem;
		display: inline-flex;
		gap: 0.5rem;
	}

	.s1-cover-replace,
	.s1-cover-remove {
		position: relative;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0.5rem 0.85rem;
		font: inherit;
		font-size: 0.875rem;
		color: white;
		background: rgba(17, 24, 39, 0.7);
		border: none;
		border-radius: var(--radius-md);
		cursor: pointer;
		transition: background var(--transition-fast);
	}

	.s1-cover-replace input[type='file'] {
		position: absolute;
		inset: 0;
		opacity: 0;
		cursor: inherit;
	}

	.s1-cover-replace:hover,
	.s1-cover-remove:hover {
		background: rgba(17, 24, 39, 0.85);
	}

	.s1-cover-replace--busy {
		cursor: progress;
	}

	/* ── More options expander ─────────────────────────────── */
	.s1-more {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
		padding-top: 1.5rem;
		border-top: 1px solid var(--border-soft);
	}

	.s1-more-toggle {
		min-height: 48px;
		display: inline-flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.5rem 0;
		background: none;
		border: none;
		color: var(--text);
		font: inherit;
		font-size: 1rem;
		font-weight: 500;
		cursor: pointer;
		text-align: left;
	}

	.s1-more-icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1.5rem;
		height: 1.5rem;
		font-size: 1.25rem;
		font-weight: 400;
		color: var(--muted);
		line-height: 1;
	}

	.s1-more-toggle:hover {
		color: var(--primary);
	}

	.s1-more-toggle:hover .s1-more-icon {
		color: var(--primary);
	}

	.s1-more-panel {
		display: flex;
		flex-direction: column;
		gap: 2rem;
	}

	/* ── Gallery + upload buttons ──────────────────────────── */
	.s1-upload {
		position: relative;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-height: 48px;
		padding: 0.85rem 1.25rem;
		background: var(--surfaceSolid);
		border: 1px dashed var(--border);
		border-radius: var(--radius-lg);
		color: var(--text);
		font-size: 0.95rem;
		cursor: pointer;
		transition: border-color var(--transition-fast), background var(--transition-fast);
		align-self: flex-start;
	}

	.s1-upload:hover {
		border-color: var(--primary);
		background: rgba(47, 119, 120, 0.04);
	}

	.s1-upload input[type='file'] {
		position: absolute;
		inset: 0;
		opacity: 0;
		cursor: inherit;
	}

	.s1-gallery {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 0.65rem;
	}

	.s1-gallery-item {
		position: relative;
		aspect-ratio: 4 / 3;
		border-radius: var(--radius-lg);
		overflow: hidden;
		border: 1px solid var(--border-soft);
	}

	.s1-gallery-item--cover {
		border-color: var(--carrot);
		box-shadow: 0 0 0 2px rgba(247, 170, 41, 0.35);
	}

	.s1-gallery-item img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}

	.s1-gallery-cover,
	.s1-gallery-remove {
		position: absolute;
		top: 0.4rem;
		width: 1.5rem;
		height: 1.5rem;
		border-radius: 50%;
		border: none;
		font-size: 0.95rem;
		line-height: 1;
		cursor: pointer;
		opacity: 0;
		transition: opacity var(--transition-fast);
	}

	.s1-gallery-cover {
		left: 0.4rem;
		background: rgba(17, 24, 39, 0.65);
		color: var(--carrot);
	}

	.s1-gallery-item--cover .s1-gallery-cover,
	.s1-gallery-item:hover .s1-gallery-cover,
	.s1-gallery-item:focus-within .s1-gallery-cover {
		opacity: 1;
	}

	.s1-gallery-remove {
		right: 0.4rem;
		background: rgba(17, 24, 39, 0.65);
		color: white;
	}

	.s1-gallery-item:hover .s1-gallery-remove,
	.s1-gallery-item:focus-within .s1-gallery-remove {
		opacity: 1;
	}

	.s1-error {
		margin: 0.5rem 0 0;
		font-size: 0.85rem;
		color: var(--danger);
	}

	/* Visibility radio group */
	.s1-radio-group {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}

	.s1-radio {
		display: flex;
		align-items: flex-start;
		gap: 0.75rem;
		padding: 0.85rem 1rem;
		border: 1px solid var(--border-soft);
		border-radius: var(--radius-lg);
		cursor: pointer;
		transition: border-color var(--transition-fast), background var(--transition-fast);
	}

	.s1-radio:hover {
		border-color: var(--border);
	}

	.s1-radio input[type='radio'] {
		margin-top: 0.25rem;
		accent-color: var(--primary);
	}

	.s1-radio span {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
	}

	.s1-radio strong {
		font-weight: 600;
		color: var(--text);
	}

	.s1-radio small {
		font-size: 0.85rem;
		color: var(--muted);
	}

	/* Tablet (matches CreateTripShell .card-content padding 1.5rem 2rem 2rem) */
	@media (max-width: 1024px) {
		.step1 {
			margin: -1.5rem -2rem -2rem;
		}
	}

	/* Mobile (matches CreateTripShell .card-content padding 1rem 1.5rem) */
	@media (max-width: 768px) {
		.step1 {
			--s1-gap: 3rem;
			padding: 2.5rem 1.25rem 3rem;
			margin: -1rem -1.5rem -1rem;
		}

		.s1-display {
			font-size: clamp(2rem, 7vw, 2.5rem);
		}

		.s1-headcount {
			grid-template-columns: 1fr;
			gap: 1.25rem;
		}

		.s1-gallery {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}

		.s1-cover-drop {
			min-height: 11rem;
			padding: 2rem 1rem;
		}

		.s1-cover img {
			max-height: 18rem;
		}
	}
</style>
