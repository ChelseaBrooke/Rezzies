<script lang="ts">
	import type { TripDraft } from '$lib/stores/tripDraft.js';
	import { effectiveMaxForDraft } from '$lib/stores/tripDraft.js';
	import { perBedSpotShortfallDetails } from '$lib/trip/per-bed-pricing-guard.js';
	import { computePerBedRangeByBedId } from '$lib/pricing/per-bed-selection.js';
	import FocusShell from '$lib/components/wizard/FocusShell.svelte';

	let {
		draft = $bindable(),
		autosave,
		prevStep,
		openPublishModal,
		handleSaveDraft
	}: {
		draft: TripDraft;
		autosave: () => void;
		prevStep: () => void;
		openPublishModal: () => void;
		handleSaveDraft: (opts: { splitCost: boolean }) => Promise<void>;
	} = $props();

	/* ── Toggle helpers ─────────────────────────────────────────── */
	function toggleCostSharing() {
		draft.costSharingEnabled = !draft.costSharingEnabled;
		autosave();
	}

	function selectModel(model: TripDraft['pricingModel']) {
		draft.pricingModel = model;
		autosave();
	}

	function roundUsd(n: number): number {
		return Math.round(Number.isFinite(n) ? n : 0);
	}

	/* ── Pricing calculations (preserved from AddOnsStep) ──────────── */
	const BED_WEIGHTS: Record<string, number> = {
		twin: 1.0, single: 1.0, bunk: 0.9, full: 1.1, double: 1.1,
		queen: 1.2, king: 1.3, sofa: 0.85, sofa_bed: 0.85,
		air_mattress: 0.75, other: 1.0
	};
	const BED_SPOT_COUNTS: Record<string, number> = {
		twin: 1, single: 1, bunk: 2, full: 2, double: 2,
		queen: 2, king: 2, sofa: 2, sofa_bed: 2,
		air_mattress: 2, other: 1
	};

	function bedWeight(type: string): number {
		return BED_WEIGHTS[type.toLowerCase().replace(/\s+/g, '_')] ?? 1.0;
	}
	function bedSpotCount(type: string): number {
		return BED_SPOT_COUNTS[type.toLowerCase().replace(/\s+/g, '_')] ?? 1;
	}
	function privacyFactor(room: { beds?: Array<{ count?: number }> }): number {
		const bedCount = (room.beds ?? []).reduce((s, b) => s + (b.count || 1), 0);
		return Math.max(1.0, Math.min(1.25, 1.25 - (bedCount - 1) * 0.125));
	}

	const costEnabled = $derived(draft.costSharingEnabled);
	const expected    = $derived(Math.max(1, Number(draft.expectedGuestCount) || 1));
	const maxG        = $derived(effectiveMaxForDraft(draft));
	const total       = $derived(parseFloat(String(draft.totalTripCost)) || 0);
	const rooms       = $derived(draft.rooms ?? []);
	const totalRooms  = $derived(rooms.length);

	const perBedSpotShortfall = $derived(perBedSpotShortfallDetails(draft));
	const ppExpected  = $derived(expected > 0 ? total / expected : 0);
	const ppMax       = $derived(maxG > 0 ? total / maxG : 0);
	const perRoomShare = $derived(totalRooms > 0 && total > 0 ? total / totalRooms : 0);

	const perBedSelection = $derived.by(() => {
		type U = { bedId: string; bedType: string; weight: number; spotCount: number };
		const units: U[] = [];
		rooms.forEach((room, ri) => {
			const p = privacyFactor(room);
			room.beds.forEach((bed, bi) => {
				const w = bedWeight(bed.bedType) * p;
				const sc = bedSpotCount(bed.bedType);
				const count = Math.max(1, bed.count || 1);
				for (let i = 0; i < count; i++) {
					units.push({ bedId: `w-${ri}-${bi}-${i}`, bedType: bed.bedType.toLowerCase(), weight: w, spotCount: sc });
				}
			});
		});
		const empty = { bedCount: 0 };
		if (units.length === 0 || total <= 0) return empty;
		const totalSpots = units.reduce((s, u) => s + u.spotCount, 0);
		const sim = Math.min(expected, totalSpots);
		computePerBedRangeByBedId(total, sim, units);
		return { bedCount: units.length };
	});

	const perBedBedCount = $derived(perBedSelection.bedCount);

	/* ── Publish disabled state ─────────────────────────────────── */
	const publishDisabled = $derived(
		draft.rooms.length === 0 ||
		(costEnabled && !draft.pricingModel)
	);

	let isSavingDraft = $state(false);

	async function onSaveDraft() {
		isSavingDraft = true;
		try {
			await handleSaveDraft({ splitCost: costEnabled });
		} finally {
			isSavingDraft = false;
		}
	}
</script>

<FocusShell progressPercent={95} stepLabel="3 of 3" onBack={prevStep}>
	<div class="cs">
		<!-- ── Page header ── -->
		<div class="cs-accent" style="background: var(--sand)"></div>
		<p class="cs-eyebrow" style="color: var(--muted)">Cost sharing</p>
		<h1 class="cs-heading">How much is the trip?</h1>

		<!-- ── Total cost input ── -->
		<div class="cs-cost-row">
			<span class="cs-dollar" aria-hidden="true">$</span>
			<input
				type="number"
				class="cs-cost-input"
				id="totalTripCost"
				bind:value={draft.totalTripCost}
				oninput={autosave}
				placeholder="0"
				step="0.01"
				min="0"
				autofocus
				aria-label="Total rental cost"
			/>
		</div>
		<p class="cs-cost-caption">Total rental cost. We split this across your group.</p>

		<!-- ── Cost sharing toggle ── -->
		<label class="cs-toggle-row">
			<input
				type="checkbox"
				checked={costEnabled}
				onchange={toggleCostSharing}
				aria-label="Split costs between guests"
			/>
			<span class="cs-toggle-track"><span class="cs-toggle-thumb"></span></span>
			<span class="cs-toggle-label">Split costs between guests</span>
		</label>

		<!-- ── Section heading ── -->
		<div class="cs-models-head">
			<h2 class="cs-models-title">How should everyone pay?</h2>
			<span class="cs-models-hint">You can change this later.</span>
		</div>

		<!-- ── Pricing model cards ── -->
		<div class="cs-cards" class:cs-cards--disabled={!costEnabled} role="radiogroup" aria-label="Pricing model">
			<!-- Per person -->
			<button
				type="button"
				class="cs-card"
				class:cs-card--selected={draft.pricingModel === 'per-person'}
				onclick={() => selectModel('per-person')}
				role="radio"
				aria-checked={draft.pricingModel === 'per-person'}
			>
				<span class="cs-radio" class:cs-radio--on={draft.pricingModel === 'per-person'} aria-hidden="true"></span>
				<span class="cs-card-body">
					<span class="cs-card-name">Per person</span>
					<span class="cs-card-desc">Equal split across everyone. Simple and fair.</span>
				</span>
				<span class="cs-card-price">
					{#if total > 0}
						${roundUsd(ppMax)} to ${roundUsd(ppExpected)} / person
					{:else}
						Enter a total above
					{/if}
				</span>
			</button>

			<!-- Per room -->
			<button
				type="button"
				class="cs-card"
				class:cs-card--selected={draft.pricingModel === 'per-room'}
				onclick={() => selectModel('per-room')}
				role="radio"
				aria-checked={draft.pricingModel === 'per-room'}
			>
				<span class="cs-radio" class:cs-radio--on={draft.pricingModel === 'per-room'} aria-hidden="true"></span>
				<span class="cs-card-body">
					<span class="cs-card-name">Per room</span>
					<span class="cs-card-desc">Each room splits their share. Couples and singles pay differently.</span>
				</span>
				<span class="cs-card-price">
					{#if totalRooms > 0 && total > 0}
						${roundUsd(perRoomShare)} / room
					{:else}
						Enter a total above
					{/if}
				</span>
			</button>

			<!-- Per bed -->
			<button
				type="button"
				class="cs-card"
				class:cs-card--selected={draft.pricingModel === 'per-bed'}
				onclick={() => selectModel('per-bed')}
				role="radio"
				aria-checked={draft.pricingModel === 'per-bed'}
			>
				<span class="cs-radio" class:cs-radio--on={draft.pricingModel === 'per-bed'} aria-hidden="true"></span>
				<span class="cs-card-body">
					<span class="cs-card-name">Per bed</span>
					<span class="cs-card-desc">Master suite pays more than bunk room. The fairest split.</span>
				</span>
				<span class="cs-card-price">
					{#if perBedBedCount > 0}
						Varies by bed
					{:else}
						Add rooms first
					{/if}
				</span>
			</button>
		</div>

		{#if perBedSpotShortfall}
			<p class="cs-shortfall">
				You need {perBedSpotShortfall.shortfall} more bed {perBedSpotShortfall.shortfall === 1 ? 'spot' : 'spots'} before enabling per-bed pricing.
			</p>
		{/if}

		<!-- ── Footer ── -->
		<footer class="cs-footer">
			<button type="button" class="cs-btn-back" onclick={prevStep}>Back</button>
			<div class="cs-footer-right">
				<button
					type="button"
					class="cs-btn-draft"
					onclick={onSaveDraft}
					disabled={isSavingDraft}
				>
					{isSavingDraft ? 'Saving...' : 'Save draft'}
				</button>
				<button
					type="button"
					class="cs-btn-publish"
					onclick={openPublishModal}
					disabled={publishDisabled}
				>
					Publish trip
				</button>
			</div>
		</footer>
	</div>
</FocusShell>

<style>
	/* ── Page container ───────────────────────────────────── */
	.cs {
		display: flex;
		flex-direction: column;
		width: 100%;
		max-width: 480px;
		margin: 0 auto;
		padding-bottom: 6rem;
	}

	/* ── Accent line ──────────────────────────────────────── */
	.cs-accent {
		width: 36px;
		height: 3px;
		border-radius: 2px;
		margin-bottom: 14px;
		flex-shrink: 0;
	}

	/* ── Eyebrow ──────────────────────────────────────────── */
	.cs-eyebrow {
		font-size: 0.625rem;
		font-weight: 700;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		margin: 0 0 10px;
	}

	/* ── Heading ──────────────────────────────────────────── */
	.cs-heading {
		font-family: 'Fraunces', Georgia, serif;
		font-size: clamp(1.375rem, 4vw, 1.75rem);
		font-weight: 600;
		line-height: 1.2;
		color: var(--text);
		margin: 0 0 24px;
		letter-spacing: -0.02em;
	}

	/* ── Cost input row ───────────────────────────────────── */
	.cs-cost-row {
		display: flex;
		align-items: center;
		gap: 6px;
		margin-bottom: 6px;
	}

	.cs-dollar {
		font-family: 'Fraunces', Georgia, serif;
		font-size: 1.5rem;
		font-weight: 600;
		color: var(--muted);
		flex-shrink: 0;
		line-height: 1;
	}

	.cs-cost-input {
		flex: 1;
		height: 56px;
		padding: 0 14px;
		font-family: 'Fraunces', Georgia, serif;
		font-size: 1.75rem;
		font-weight: 600;
		color: var(--text);
		background: white;
		border: 1.5px solid var(--navy);
		border-radius: 10px;
		outline: none;
		box-shadow: 0 0 0 4px var(--focusRing);
		transition: border-color 150ms ease, box-shadow 150ms ease;
		-moz-appearance: textfield;
		appearance: textfield;
	}

	.cs-cost-input::-webkit-outer-spin-button,
	.cs-cost-input::-webkit-inner-spin-button {
		-webkit-appearance: none;
		margin: 0;
	}

	.cs-cost-input::placeholder {
		color: var(--border);
	}

	.cs-cost-caption {
		font-size: 0.6875rem;
		color: var(--muted);
		margin: 0 0 20px;
	}

	/* ── Toggle row ───────────────────────────────────────── */
	.cs-toggle-row {
		display: flex;
		align-items: center;
		gap: 10px;
		margin-bottom: 24px;
		cursor: pointer;
		min-height: 32px;
	}

	.cs-toggle-row input {
		position: absolute;
		opacity: 0;
		width: 0;
		height: 0;
	}

	.cs-toggle-track {
		position: relative;
		display: inline-block;
		width: 36px;
		height: 20px;
		border-radius: 10px;
		background: var(--border-paper);
		transition: background 200ms;
		flex-shrink: 0;
	}

	.cs-toggle-row input:checked + .cs-toggle-track {
		background: var(--navy);
	}

	.cs-toggle-thumb {
		position: absolute;
		top: 2px;
		left: 2px;
		width: 16px;
		height: 16px;
		border-radius: 50%;
		background: white;
		transition: transform 200ms;
	}

	.cs-toggle-row input:checked + .cs-toggle-track .cs-toggle-thumb {
		transform: translateX(16px);
	}

	.cs-toggle-label {
		font-size: 0.8125rem;
		font-weight: 500;
		color: var(--text);
	}

	/* ── Models section ───────────────────────────────────── */
	.cs-models-head {
		display: flex;
		align-items: baseline;
		gap: 10px;
		margin-bottom: 12px;
		flex-wrap: wrap;
	}

	.cs-models-title {
		font-family: 'Fraunces', Georgia, serif;
		font-size: 1.25rem;
		font-weight: 600;
		color: var(--text);
		margin: 0;
		letter-spacing: -0.01em;
	}

	.cs-models-hint {
		font-size: 0.75rem;
		color: var(--muted);
	}

	.cs-cards {
		display: flex;
		flex-direction: column;
		gap: 8px;
		transition: opacity 150ms;
	}

	.cs-cards--disabled {
		opacity: 0.4;
		pointer-events: none;
	}

	/* ── Individual card ──────────────────────────────────── */
	.cs-card {
		display: flex;
		align-items: flex-start;
		gap: 10px;
		padding: 14px 16px;
		border-radius: 12px;
		border: 1.5px solid var(--border-paper);
		background: white;
		cursor: pointer;
		text-align: left;
		font-family: inherit;
		transition: border-color 150ms, background 150ms;
		width: 100%;
	}

	.cs-card:hover {
		border-color: var(--navy);
	}

	.cs-card--selected {
		border-color: var(--navy);
		background: rgba(29, 77, 78, 0.04);
	}

	/* Radio dot */
	.cs-radio {
		width: 16px;
		height: 16px;
		border-radius: 50%;
		border: 1.5px solid var(--border-paper);
		background: white;
		flex-shrink: 0;
		margin-top: 1px;
		position: relative;
		transition: border-color 150ms, background 150ms;
	}

	.cs-radio--on {
		border-color: var(--navy);
		background: var(--navy);
	}

	.cs-radio--on::after {
		content: '';
		position: absolute;
		inset: 3px;
		border-radius: 50%;
		background: white;
	}

	.cs-card-body {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 3px;
		min-width: 0;
	}

	.cs-card-name {
		font-size: 0.8125rem;
		font-weight: 600;
		color: var(--text);
	}

	.cs-card-desc {
		font-size: 0.625rem;
		color: var(--muted);
		line-height: 1.5;
	}

	.cs-card-price {
		font-family: 'Fraunces', Georgia, serif;
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--navy);
		white-space: nowrap;
		flex-shrink: 0;
		margin-top: 1px;
	}

	/* ── Per-bed shortfall warning ────────────────────────── */
	.cs-shortfall {
		font-size: 0.6875rem;
		color: var(--warm);
		margin: 8px 0 0;
		line-height: 1.5;
	}

	/* ── Footer ───────────────────────────────────────────── */
	.cs-footer {
		position: fixed;
		bottom: 0;
		left: 0;
		right: 0;
		z-index: 50;
		background: white;
		border-top: 1px solid var(--border);
		padding: 14px 24px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
	}

	.cs-btn-back {
		background: none;
		border: none;
		font-family: inherit;
		font-size: 0.875rem;
		color: var(--muted);
		cursor: pointer;
		padding: 0 8px;
	}

	.cs-btn-back:hover {
		color: var(--text);
	}

	.cs-footer-right {
		display: flex;
		align-items: center;
		gap: 10px;
	}

	.cs-btn-draft {
		height: 44px;
		padding: 0 20px;
		border-radius: 10px;
		font-family: inherit;
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--text);
		background: white;
		border: 1px solid var(--border);
		cursor: pointer;
		transition: background 150ms;
	}

	.cs-btn-draft:hover:not(:disabled) {
		background: var(--surface-faint);
	}

	.cs-btn-draft:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.cs-btn-publish {
		height: 44px;
		padding: 0 24px;
		border-radius: 10px;
		font-family: inherit;
		font-size: 0.875rem;
		font-weight: 600;
		color: white;
		background: var(--warm);
		border: none;
		cursor: pointer;
		transition: opacity 150ms ease, transform 100ms ease;
	}

	.cs-btn-publish:hover:not(:disabled) {
		opacity: 0.92;
		transform: translateY(-1px);
	}

	.cs-btn-publish:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	/* ── Mobile ───────────────────────────────────────────── */
	@media (max-width: 480px) {
		.cs-footer {
			padding: 12px 16px;
		}

		.cs-btn-draft,
		.cs-btn-publish {
			font-size: 0.8125rem;
			padding: 0 16px;
		}
	}
</style>
