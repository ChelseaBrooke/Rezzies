<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import AddressAutocomplete from '$lib/components/wizard/AddressAutocomplete.svelte';

	let {
		isHost = false,
		tripId = '',
		description = null,
		checkInTime = null,
		checkOutTime = null,
		fullAddress = null,
		parkingNotes = null,
		houseRules = null,
		extraCostRules = [],
		itineraryHref = '',
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
			if (!res.ok) { showToast?.(data.error || 'Failed to save'); return; }
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

	function startEdit() { editing = true; }
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

<div class="tic">
	<!-- Header band — negative margin matches DashboardCard padding (0.5rem / 0.625rem) -->
	<div class="tic-header">
		<span class="tic-header-icon" aria-hidden="true">
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
				<circle cx="12" cy="12" r="10"/>
				<line x1="12" y1="8" x2="12" y2="12"/>
				<line x1="12" y1="16" x2="12.01" y2="16"/>
			</svg>
		</span>
		<h2 class="tic-title">Trip Info</h2>
		{#if isHost}
			<button type="button" class="tic-edit-btn" onclick={startEdit} aria-label="Edit trip info">
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
					<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
				</svg>
				Edit
			</button>
		{/if}
	</div>

	{#if isHost && editing}
		<!-- ── Edit form ── -->
		<form class="tic-form" onsubmit={(e) => { e.preventDefault(); save(); }}>
			<div class="tic-field">
				<label for="tic-description">Trip description</label>
				<textarea id="tic-description" bind:value={form.description} rows="3" placeholder="Describe your trip for guests"></textarea>
			</div>
			<div class="tic-form-grid">
				<div class="tic-field">
					<label for="tic-checkin">Check-in time</label>
					<select id="tic-checkin" bind:value={form.checkInTime}>
						<option value="">Select time</option>
						{#each timeOptions as opt}<option value={opt}>{opt}</option>{/each}
					</select>
				</div>
				<div class="tic-field">
					<label for="tic-checkout">Check-out time</label>
					<select id="tic-checkout" bind:value={form.checkOutTime}>
						<option value="">Select time</option>
						{#each timeOptions as opt}<option value={opt}>{opt}</option>{/each}
					</select>
				</div>
			</div>
			<div class="tic-form-grid">
				<div class="tic-field address-autocomplete-wrap">
					<label for="tic-address">Full address</label>
					<AddressAutocomplete bind:value={form.fullAddress} placeholder="Street address, city, state, ZIP" />
				</div>
				<div class="tic-field">
					<label for="tic-parking">Parking / transportation</label>
					<textarea id="tic-parking" bind:value={form.parkingNotes} rows="2" placeholder="Where to park, shuttle info, etc."></textarea>
				</div>
			</div>
			<div class="tic-field">
				<label for="tic-rules">House rules</label>
				<textarea id="tic-rules" bind:value={form.houseRules} rows="2" placeholder="No pets, no loud noise after 10pm…"></textarea>
			</div>
			<div class="tic-form-actions">
				<button type="button" class="btn-cancel" onclick={cancelEdit} disabled={saving}>Cancel</button>
				<button type="submit" class="btn-save" disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button>
			</div>
		</form>
	{:else}
		<!-- ── Read view: description full-width, then 2-col grid ── -->
		<div class="tic-body">

			{#if form.description?.trim()}
				<div class="tic-desc-row">
					<span class="tic-field-label">About this trip</span>
					<p class="tic-field-value">{form.description}</p>
				</div>
			{/if}

			<div class="tic-grid">
				<!-- Check-in / Check-out -->
				<div class="tic-cell">
					<div class="tic-cell-label-row">
						<span class="tic-cell-icon" aria-hidden="true">
							<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<rect x="3" y="4" width="18" height="18" rx="2"/>
								<line x1="16" y1="2" x2="16" y2="6"/>
								<line x1="8" y1="2" x2="8" y2="6"/>
								<line x1="3" y1="10" x2="21" y2="10"/>
							</svg>
						</span>
						<span class="tic-field-label">Check-in & out</span>
					</div>
					<div class="tic-time-chips">
						<span class="tic-time-chip">
							<span class="tic-time-dot in"></span>
							<span class="tic-time-dir">In</span>
							{form.checkInTime?.trim() || '—'}
						</span>
						<span class="tic-time-chip">
							<span class="tic-time-dot out"></span>
							<span class="tic-time-dir">Out</span>
							{form.checkOutTime?.trim() || '—'}
						</span>
					</div>
				</div>

				<!-- Address -->
				<div class="tic-cell">
					<div class="tic-cell-label-row">
						<span class="tic-cell-icon" aria-hidden="true">
							<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
								<circle cx="12" cy="10" r="3"/>
							</svg>
						</span>
						<span class="tic-field-label">Address</span>
					</div>
					{#if form.fullAddress?.trim() && mapsUrl}
						<a href={mapsUrl} target="_blank" rel="noopener noreferrer" class="tic-address-link">
							{form.fullAddress}
							<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="tic-external-icon">
								<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
								<polyline points="15 3 21 3 21 9"/>
								<line x1="10" y1="14" x2="21" y2="3"/>
							</svg>
						</a>
					{:else}
						<span class="tic-field-value {!form.fullAddress?.trim() ? 'empty' : ''}">{form.fullAddress?.trim() || '—'}</span>
					{/if}
				</div>

				<!-- Parking -->
				<div class="tic-cell">
					<div class="tic-cell-label-row">
						<span class="tic-cell-icon" aria-hidden="true">
							<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<rect x="1" y="3" width="15" height="13" rx="2"/>
								<path d="M16 8h4l3 5v4h-7V8z"/>
								<circle cx="5.5" cy="18.5" r="2.5"/>
								<circle cx="18.5" cy="18.5" r="2.5"/>
							</svg>
						</span>
						<span class="tic-field-label">Parking</span>
					</div>
					<span class="tic-field-value {!form.parkingNotes?.trim() ? 'empty' : ''}">{form.parkingNotes?.trim() || '—'}</span>
				</div>

				<!-- Rules -->
				<div class="tic-cell">
					<div class="tic-cell-label-row">
						<span class="tic-cell-icon" aria-hidden="true">
							<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<path d="M9 11l3 3L22 4"/>
								<path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
							</svg>
						</span>
						<span class="tic-field-label">Rules</span>
					</div>
					<span class="tic-field-value {!form.houseRules?.trim() ? 'empty' : ''}">{form.houseRules?.trim() || '—'}</span>
				</div>
			</div>

			{#if extraCostRules && extraCostRules.length > 0}
				<div class="tic-costs">
					<span class="tic-field-label">Extra costs</span>
					<ul class="tic-cost-list">
						{#each extraCostRules as rule}
							<li class="tic-cost-item">
								<span class="tic-cost-label">{rule.label}</span>
								<span class="tic-cost-amount">${rule.amount.toLocaleString()}</span>
								{#if rule.type === 'per_night'}<span class="tic-cost-type">/ night</span>{:else if rule.type === 'per_pet'}<span class="tic-cost-type">/ pet</span>{/if}
							</li>
						{/each}
					</ul>
				</div>
			{/if}
		</div>
	{/if}
</div>

<style>
	.tic {
		display: flex;
		flex-direction: column;
		min-width: 0;
		flex: 1;
		min-height: 0;
		overflow: hidden;
	}

	/* ── Header: matches DashboardCard .card-header exactly, no background ── */
	.tic-header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 0.75rem;
	}

	.tic-header-icon {
		width: 15px;
		height: 15px;
		flex-shrink: 0;
		color: var(--copper, #BF4E30);
		opacity: 0.8;
		display: flex;
		align-items: center;
	}

	.tic-header-icon svg {
		width: 100%;
		height: 100%;
	}

	.tic-title {
		margin: 0;
		font-size: 0.9375rem;
		font-weight: 600;
		color: var(--text);
		letter-spacing: -0.01em;
		flex: 1;
	}

	.tic-edit-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		padding: 0.2rem 0.55rem;
		font-size: 0.6875rem;
		font-weight: 600;
		color: var(--muted);
		background: transparent;
		border: 1px solid var(--border-soft);
		border-radius: 999px;
		cursor: pointer;
		white-space: nowrap;
		flex-shrink: 0;
		transition: color 0.15s ease, border-color 0.15s ease, background 0.15s ease;
	}

	.tic-edit-btn:hover {
		color: var(--copper, #BF4E30);
		border-color: var(--copper, #BF4E30);
		background: rgba(191, 78, 48, 0.05);
	}

	.tic-edit-btn svg {
		width: 10px;
		height: 10px;
	}

	/* ── Read body — fills card height, distributes sections evenly ── */
	.tic-body {
		display: flex;
		flex-direction: column;
		gap: 0;
		flex: 1;
		min-height: 0;
		overflow: hidden;
		justify-content: space-between;
	}

	/* Description full-width row */
	.tic-desc-row {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		padding-bottom: 1rem;
		margin-bottom: 0.25rem;
		border-bottom: 1px solid var(--border-soft, rgba(0,0,0,0.06));
	}

	/* 2-column grid for the 4 info fields */
	.tic-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.75rem 1.25rem;
		flex: 1;
		min-height: 0;
		overflow: hidden;
		align-content: space-evenly;
	}

	.tic-cell {
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
		min-width: 0;
	}

	.tic-cell-label-row {
		display: flex;
		align-items: center;
		gap: 0.3rem;
	}

	.tic-cell-icon {
		width: 13px;
		height: 13px;
		flex-shrink: 0;
		color: var(--copper, #BF4E30);
		opacity: 0.7;
		display: flex;
		align-items: center;
	}

	.tic-cell-icon svg {
		width: 100%;
		height: 100%;
	}

	/* Shared label style */
	.tic-field-label {
		font-size: 0.625rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--muted, #6b7280);
	}

	.tic-field-value {
		font-size: 0.8125rem;
		color: var(--text, #111827);
		line-height: 1.5;
		overflow-wrap: break-word;
		overflow: hidden;
		display: -webkit-box;
		-webkit-line-clamp: 3;
		-webkit-box-orient: vertical;
	}

	/* Description capped tighter so it doesn't balloon the card */
	.tic-desc-row .tic-field-value {
		-webkit-line-clamp: 2;
	}

	.tic-field-value.empty {
		color: var(--muted, #9ca3af);
		font-style: italic;
	}

	/* ── Check-in/out chips ── */
	.tic-time-chips {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.tic-time-chip {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		font-size: 0.75rem;
		font-weight: 500;
		color: var(--text, #111827);
		background: #f8fafc;
		border: 1px solid #e2e8f0;
		border-radius: 6px;
		padding: 0.25rem 0.625rem;
		width: fit-content;
	}

	.tic-time-dot {
		width: 5px;
		height: 5px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.tic-time-dot.in  { background: #22c55e; }
	.tic-time-dot.out { background: #f97316; }

	.tic-time-dir {
		font-size: 0.5625rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--muted, #6b7280);
	}

	/* ── Address link ── */
	.tic-address-link {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		display: block;
		max-width: 100%;
		display: inline-flex;
		align-items: flex-start;
		gap: 0.25rem;
		font-size: 0.8125rem;
		color: var(--copper, #BF4E30);
		text-decoration: none;
		line-height: 1.45;
		word-break: break-word;
		transition: opacity 0.15s;
	}

	.tic-address-link:hover {
		text-decoration: underline;
		opacity: 0.85;
	}

	.tic-external-icon {
		width: 10px;
		height: 10px;
		flex-shrink: 0;
		margin-top: 0.2rem;
	}

	/* ── Extra costs ── */
	.tic-costs {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		padding-top: 0.25rem;
		border-top: 1px solid var(--border-soft);
	}

	.tic-cost-list {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.tic-cost-item {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.3rem 0;
		font-size: 0.8125rem;
		color: var(--text);
		border-bottom: 1px solid var(--border-soft);
	}

	.tic-cost-item:last-child { border-bottom: none; }
	.tic-cost-label { flex: 1; }
	.tic-cost-amount { font-weight: 600; }
	.tic-cost-type { font-size: 0.75rem; color: var(--muted); }

	/* ── Edit form ── */
	.tic-form {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.tic-form-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.75rem;
	}

	.tic-field {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.tic-field label {
		font-size: 0.6875rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--muted);
	}

	.address-autocomplete-wrap :global(.address-input) {
		border-radius: var(--radius-sm);
	}

	.tic-field input,
	.tic-field textarea,
	.tic-field select {
		padding: 0.375rem 0.5rem;
		border: 1px solid var(--border, #e5e7eb);
		border-radius: var(--radius-sm, 6px);
		font-size: 0.8125rem;
		font-family: inherit;
		color: var(--text);
		background: white;
		transition: border-color 0.15s;
	}

	.tic-field select { cursor: pointer; }

	.tic-field input:focus,
	.tic-field textarea:focus,
	.tic-field select:focus {
		outline: none;
		border-color: var(--copper, #BF4E30);
		box-shadow: 0 0 0 2px rgba(191, 78, 48, 0.12);
	}

	.tic-form-actions {
		display: flex;
		gap: 0.5rem;
		padding-top: 0.25rem;
	}

	.btn-cancel,
	.btn-save {
		padding: 0.4rem 0.875rem;
		font-size: 0.8125rem;
		font-weight: 600;
		border-radius: var(--radius-md, 8px);
		cursor: pointer;
		border: none;
		transition: opacity 0.15s, background 0.15s;
	}

	.btn-cancel {
		background: var(--surface2, #f1f5f9);
		color: var(--text);
	}

	.btn-cancel:hover:not(:disabled) { background: #e2e8f0; }

	.btn-save {
		background: var(--copper, #BF4E30);
		color: white;
	}

	.btn-save:hover:not(:disabled) { opacity: 0.88; }

	.btn-cancel:disabled,
	.btn-save:disabled {
		opacity: 0.55;
		cursor: not-allowed;
	}

	@media (max-width: 480px) {
		.tic-form-grid,
		.tic-grid { grid-template-columns: 1fr; }
	}
</style>
