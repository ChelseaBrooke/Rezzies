<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import AddressAutocomplete from '$lib/components/wizard/AddressAutocomplete.svelte';

	/**
	 * Trip info / house rules: editable by host, read-only for guests.
	 */
	let {
		isHost = false,
		tripId = '',
		// Editable fields
		description = null,
		checkInTime = null,
		checkOutTime = null,
		fullAddress = null,
		parkingNotes = null,
		houseRules = null,
		// Legacy (kept for extra cost rules)
		extraCostRules = [],
		itineraryHref = '',
		// Handlers
		onSave,
		showToast
	}: {
		isHost?: boolean;
		tripId?: string;
		description?: string | null;
		checkInTime?: string | null;
		checkOutTime?: string | null;
		fullAddress?: string | null;
		parkingNotes?: string | null;
		houseRules?: string | null;
		extraCostRules?: Array<{ label: string; amount: number; type: string }>;
		itineraryHref?: string;
		onSave?: () => void;
		showToast?: (msg: string) => void;
	} = $props();

	let editing = $state(false);
	let saving = $state(false);
	let form = $state({
		description: description ?? '',
		checkInTime: checkInTime ?? '',
		checkOutTime: checkOutTime ?? '',
		fullAddress: fullAddress ?? '',
		parkingNotes: parkingNotes ?? '',
		houseRules: houseRules ?? ''
	});

	$effect(() => {
		form = {
			description: description ?? '',
			checkInTime: checkInTime ?? '',
			checkOutTime: checkOutTime ?? '',
			fullAddress: fullAddress ?? '',
			parkingNotes: parkingNotes ?? '',
			houseRules: houseRules ?? ''
		};
	});

	const mapsUrl = $derived(
		form.fullAddress?.trim()
			? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(form.fullAddress)}`
			: null
	);

	async function save() {
		if (!tripId || !isHost) return;
		saving = true;
		try {
			const res = await fetch(`/api/trips/${tripId}/trip-info`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					description: form.description.trim() || null,
					checkInTime: form.checkInTime.trim() || null,
					checkOutTime: form.checkOutTime.trim() || null,
					fullAddress: form.fullAddress.trim() || null,
					parkingNotes: form.parkingNotes.trim() || null,
					houseRules: form.houseRules.trim() || null
				})
			});
			const data = await res.json().catch(() => ({}));
			if (!res.ok) {
				showToast?.(data.error || 'Failed to save');
				return;
			}
			editing = false;
			onSave?.();
			showToast?.('Trip info saved');
			await invalidateAll();
		} catch (e) {
			showToast?.(e instanceof Error ? e.message : 'Failed to save');
		} finally {
			saving = false;
		}
	}

	function startEdit() {
		editing = true;
	}

	function cancelEdit() {
		form = {
			description: description ?? '',
			checkInTime: checkInTime ?? '',
			checkOutTime: checkOutTime ?? '',
			fullAddress: fullAddress ?? '',
			parkingNotes: parkingNotes ?? '',
			houseRules: houseRules ?? ''
		};
		editing = false;
	}

	// Time options: 6 AM to 11 PM, 30-min increments
	const timeOptions = $derived.by(() => {
		const opts: string[] = [];
		for (let h = 6; h <= 23; h++) {
			for (const m of [0, 30]) {
				if (h === 23 && m === 30) break;
				const hour = h > 12 ? h - 12 : h === 0 ? 12 : h;
				const ampm = h < 12 ? 'AM' : 'PM';
				const min = m === 0 ? '00' : '30';
				opts.push(`${hour}:${min} ${ampm}`);
			}
		}
		return opts;
	});
</script>

<div class="trip-info-card">
	<div class="info-header">
		<h2 class="info-title">Trip info</h2>
		{#if isHost}
			<button type="button" class="btn-pencil" onclick={startEdit} aria-label="Edit trip info">
				<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
					<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
				</svg>
			</button>
		{/if}
	</div>

	{#if isHost && editing}
		<form class="info-form" onsubmit={(e) => { e.preventDefault(); save(); }}>
			<div class="info-field">
				<label for="description">Trip description</label>
				<textarea id="description" bind:value={form.description} rows="3" placeholder="Describe your trip for guests"></textarea>
			</div>
			<div class="info-grid">
				<div class="info-field">
					<label for="checkInTime">Check-in time</label>
					<select id="checkInTime" bind:value={form.checkInTime}>
						<option value="">Select time</option>
						{#each timeOptions as opt}
							<option value={opt}>{opt}</option>
						{/each}
					</select>
				</div>
				<div class="info-field">
					<label for="checkOutTime">Check-out time</label>
					<select id="checkOutTime" bind:value={form.checkOutTime}>
						<option value="">Select time</option>
						{#each timeOptions as opt}
							<option value={opt}>{opt}</option>
						{/each}
					</select>
				</div>
			</div>
			<div class="info-grid">
				<div class="info-field address-autocomplete-wrap">
					<label for="fullAddress">Full address</label>
					<AddressAutocomplete
						bind:value={form.fullAddress}
						placeholder="Street address, city, state, ZIP"
					/>
				</div>
				<div class="info-field">
					<label for="parkingNotes">Parking / transportation</label>
					<textarea id="parkingNotes" bind:value={form.parkingNotes} rows="2" placeholder="Where to park, shuttle info, etc."></textarea>
				</div>
			</div>
			<div class="info-field">
				<label for="houseRules">Rules</label>
				<textarea id="houseRules" bind:value={form.houseRules} rows="2" placeholder="No Pets, No Kids, No loud noise after 10...."></textarea>
			</div>
			<div class="info-actions">
				<button type="button" class="btn-cancel" onclick={cancelEdit} disabled={saving}>Cancel</button>
				<button type="submit" class="btn-save" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
			</div>
		</form>
	{:else}
		<div class="info-body">
			<section class="info-section">
				<h3 class="info-section-title">Trip description</h3>
				<p class="info-text {!form.description?.trim() ? 'empty' : ''}">{form.description?.trim() || '—'}</p>
			</section>
			<div class="info-body-grid">
				<section class="info-section">
					<h3 class="info-section-title">Check-in / Check-out</h3>
					<div class="info-row">
						<span class="info-badge">Check-in: {form.checkInTime?.trim() || '—'}</span>
						<span class="info-badge">Check-out: {form.checkOutTime?.trim() || '—'}</span>
					</div>
				</section>
				<section class="info-section">
					<h3 class="info-section-title">Full address</h3>
					{#if form.fullAddress?.trim()}
						{#if mapsUrl}
							<a href={mapsUrl} target="_blank" rel="noopener noreferrer" class="info-address-link" title="Open in Google Maps">
								<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
									<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
									<circle cx="12" cy="10" r="3"></circle>
								</svg>
								<span>{form.fullAddress}</span>
							</a>
						{:else}
							<p class="info-text">{form.fullAddress}</p>
						{/if}
					{:else}
						<p class="info-text empty">—</p>
					{/if}
				</section>
				<section class="info-section">
					<h3 class="info-section-title">Parking / transportation</h3>
					<p class="info-text {!form.parkingNotes?.trim() ? 'empty' : ''}">{form.parkingNotes?.trim() || '—'}</p>
				</section>
				<section class="info-section">
					<h3 class="info-section-title">Rules</h3>
					<p class="info-text {!form.houseRules?.trim() ? 'empty' : ''}">{form.houseRules?.trim() || '—'}</p>
				</section>
			</div>
			{#if extraCostRules && extraCostRules.length > 0}
				<section class="info-section">
					<h3 class="info-section-title">Rules & extra costs</h3>
					<ul class="rules-list">
						{#each extraCostRules as rule}
							<li class="rule-item">
								<span class="rule-label">{rule.label}</span>
								<span class="rule-amount">${rule.amount.toLocaleString()}</span>
								{#if rule.type === 'per_night'}
									<span class="rule-type">per night</span>
								{:else if rule.type === 'per_pet'}
									<span class="rule-type">per pet</span>
								{/if}
							</li>
						{/each}
					</ul>
				</section>
			{/if}
		</div>
	{/if}
</div>

<style>
	.trip-info-card {
		min-width: 0;
	}

	.info-header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 0.75rem;
	}

	.info-title {
		margin: 0;
		font-size: 0.9375rem;
		font-weight: 700;
		color: var(--text);
		letter-spacing: -0.01em;
	}

	.btn-pencil {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0.25rem;
		border: none;
		background: transparent;
		color: var(--muted);
		border-radius: var(--radius-sm);
		cursor: pointer;
		transition: color var(--transition-fast), background var(--transition-fast);
	}

	.btn-pencil:hover {
		color: var(--primary);
		background: var(--surface2);
	}

	.info-body {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.info-body-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1rem;
	}

	.info-section {
		margin: 0;
	}

	.info-section-title {
		margin: 0 0 0.35rem 0;
		font-size: 0.6875rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--muted);
	}

	.info-text {
		margin: 0;
		font-size: 0.8125rem;
		line-height: 1.5;
		color: var(--text);
		white-space: pre-wrap;
	}

	.info-text.empty {
		color: var(--muted);
		font-style: italic;
	}

	.info-row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.info-badge {
		font-size: 0.8125rem;
		color: var(--text);
		background: var(--surface2);
		padding: 0.25rem 0.5rem;
		border-radius: var(--radius-sm);
	}

	.info-address-link {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		font-size: 0.8125rem;
		color: var(--primary);
		text-decoration: none;
		transition: opacity var(--transition-fast);
	}

	.info-address-link:hover {
		text-decoration: underline;
		opacity: 0.9;
	}

	.info-address-link svg {
		flex-shrink: 0;
		opacity: 0.8;
	}

	.rules-list {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.rule-item {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.35rem 0;
		font-size: 0.8125rem;
		color: var(--text);
		border-bottom: 1px solid var(--border-soft);
	}

	.rule-item:last-child {
		border-bottom: none;
	}

	.rule-label { flex: 1; }
	.rule-amount { font-weight: 600; }
	.rule-type { font-size: 0.75rem; color: var(--muted); }

	.info-cta { margin: 0.5rem 0 0; }

	.info-link {
		color: var(--primary);
		text-decoration: none;
		font-weight: 500;
	}
	.info-link:hover { text-decoration: underline; }

	/* Edit form */
	.info-form {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.info-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.75rem;
	}

	.info-field {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.info-field label {
		font-size: 0.6875rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--muted);
	}

	.address-autocomplete-wrap :global(.address-input) {
		border-radius: var(--radius-sm);
	}

	.info-field input,
	.info-field textarea,
	.info-field select {
		padding: 0.375rem 0.5rem;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		font-size: 0.8125rem;
		font-family: inherit;
		color: var(--text);
		background: white;
	}

	.info-field select {
		cursor: pointer;
	}

	.info-field input:focus,
	.info-field textarea:focus,
	.info-field select:focus {
		outline: none;
		border-color: var(--primary);
		box-shadow: 0 0 0 2px rgba(30, 58, 138, 0.15);
	}

	.info-actions {
		display: flex;
		gap: 0.5rem;
		margin-top: 0.25rem;
	}

	.btn-cancel,
	.btn-save {
		padding: 0.375rem 0.75rem;
		font-size: 0.75rem;
		font-weight: 600;
		border-radius: var(--radius-md);
		cursor: pointer;
		border: none;
		transition: opacity var(--transition-fast);
	}

	.btn-cancel {
		background: var(--surface2);
		color: var(--text);
	}
	.btn-cancel:hover:not(:disabled) {
		background: var(--border-soft);
	}

	.btn-save {
		background: var(--primary);
		color: white;
	}
	.btn-save:hover:not(:disabled) {
		opacity: 0.9;
	}

	.btn-cancel:disabled,
	.btn-save:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	@media (max-width: 480px) {
		.info-grid,
		.info-body-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
