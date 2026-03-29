<script lang="ts">
	interface Props {
		capacity: number;
		confirmedCount: number;
		pendingCount: number;
		declinedCount: number;
		invitedTotal: number;
		expectedTarget?: number;
	}

	let {
		capacity,
		confirmedCount,
		pendingCount,
		declinedCount,
		invitedTotal,
		expectedTarget
	}: Props = $props();

	const confirmedPct = $derived(
		capacity > 0 ? Math.min(100, (confirmedCount / capacity) * 100) : 0
	);

	// Pending starts after confirmed; clamp so it never goes past 100%
	const pendingPct = $derived(
		capacity > 0 ? Math.min(100 - confirmedPct, (pendingCount / capacity) * 100) : 0
	);

	const targetPct = $derived(
		capacity > 0 && (expectedTarget ?? 0) > 0
			? Math.min(100, ((expectedTarget as number) / capacity) * 100)
			: null
	);

	const atRisk = $derived(capacity > 0 && confirmedCount + pendingCount > capacity);
	const openSlots = $derived(capacity > 0 ? Math.max(0, capacity - confirmedCount) : null);

	// Decide whether the component is meaningful to render
	const hasCapacity = $derived(capacity > 0);
</script>

{#if hasCapacity || invitedTotal > 0}
	<div class="cs" class:cs--risk={atRisk}>
		<div class="cs-inner">
			<!-- Bar -->
			<div class="cs-bar-wrap" role="img" aria-label="{confirmedCount} confirmed, {pendingCount} pending of {capacity} max headcount (capacity limit)">
				<!-- Track (open capacity) -->
				<div class="cs-track">
					<!-- Confirmed fill -->
					<div class="cs-fill cs-fill--confirmed" style="width: {confirmedPct}%"></div>
					<!-- Pending overlay (starts right after confirmed) -->
					{#if pendingPct > 0}
						<div
							class="cs-fill cs-fill--pending"
							style="width: {pendingPct}%; left: {confirmedPct}%"
						></div>
					{/if}
					<!-- Target marker -->
					{#if targetPct !== null}
						<div class="cs-target-marker" style="left: {targetPct}%" aria-hidden="true">
							<span class="cs-target-label">min headcount</span>
						</div>
					{/if}
				</div>
			</div>

			<!-- Legend row -->
			<div class="cs-meta">
				<div class="cs-legend">
					<span class="cs-dot cs-dot--confirmed"></span>
					<span class="cs-label">{confirmedCount} confirmed</span>
					{#if pendingCount > 0}
						<span class="cs-sep" aria-hidden="true">·</span>
						<span class="cs-dot cs-dot--pending"></span>
						<span class="cs-label">{pendingCount} pending</span>
					{/if}
					{#if declinedCount > 0}
						<span class="cs-sep" aria-hidden="true">·</span>
						<span class="cs-label cs-label--muted">{declinedCount} declined</span>
					{/if}
					{#if hasCapacity}
						<span class="cs-sep" aria-hidden="true">·</span>
						<span class="cs-label cs-label--capacity">Max headcount {capacity}</span>
					{/if}
				</div>

				{#if atRisk}
					<span class="cs-risk-pill">
						<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
						Pending guests could exceed max headcount (capacity)
					</span>
				{:else if openSlots !== null && openSlots > 0}
					<span class="cs-open-pill">{openSlots} open {openSlots === 1 ? 'slot' : 'slots'}</span>
				{:else if openSlots === 0}
					<span class="cs-full-pill">Full</span>
				{/if}
			</div>
		</div>
	</div>
{/if}

<style>
	.cs {
		border-radius: 14px;
		background: var(--surfaceSolid, #fff);
		border: 1px solid var(--border-soft, #e5e7eb);
		padding: 1.125rem 1.5rem;
		transition: border-color 200ms;
	}
	.cs--risk {
		border-color: rgba(217, 119, 6, 0.4);
		background: rgba(255, 251, 235, 0.6);
	}
	.cs-inner {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	/* ── Bar ── */
	.cs-bar-wrap {
		width: 100%;
	}
	.cs-track {
		position: relative;
		height: 10px;
		border-radius: 999px;
		background: var(--surface2, #f1f5f9);
		overflow: visible;
	}
	.cs-fill {
		position: absolute;
		top: 0;
		height: 100%;
		border-radius: 999px;
		transition: width 500ms cubic-bezier(0.4, 0, 0.2, 1);
	}
	.cs-fill--confirmed {
		left: 0;
		background: linear-gradient(90deg, #22c55e, #16a34a);
		z-index: 2;
	}
	.cs-fill--pending {
		/* gentle amber stripe using repeating-linear-gradient */
		background: repeating-linear-gradient(
			90deg,
			rgba(245, 158, 11, 0.55) 0px,
			rgba(245, 158, 11, 0.55) 6px,
			rgba(245, 158, 11, 0.2) 6px,
			rgba(245, 158, 11, 0.2) 10px
		);
		border-radius: 0 999px 999px 0;
		z-index: 1;
	}
	.cs-target-marker {
		position: absolute;
		top: -4px;
		bottom: -4px;
		width: 2px;
		background: var(--muted, #94a3b8);
		border-radius: 2px;
		transform: translateX(-50%);
		z-index: 3;
	}
	.cs-target-label {
		position: absolute;
		bottom: calc(100% + 4px);
		left: 50%;
		transform: translateX(-50%);
		font-size: 0.625rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--muted, #94a3b8);
		white-space: nowrap;
	}

	/* ── Meta row ── */
	.cs-meta {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		flex-wrap: wrap;
	}
	.cs-legend {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		flex-wrap: wrap;
	}
	.cs-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		flex-shrink: 0;
	}
	.cs-dot--confirmed { background: #22c55e; }
	.cs-dot--pending   { background: rgba(245, 158, 11, 0.7); }
	.cs-label {
		font-size: 0.8125rem;
		color: var(--text, #1e293b);
		white-space: nowrap;
	}
	.cs-label--muted    { color: var(--muted, #64748b); }
	.cs-label--capacity { color: var(--muted, #64748b); font-weight: 600; }
	.cs-sep { color: var(--border, #cbd5e1); font-size: 0.875rem; }

	/* ── Status pills ── */
	.cs-risk-pill,
	.cs-open-pill,
	.cs-full-pill {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		padding: 0.2rem 0.6rem;
		border-radius: 999px;
		font-size: 0.75rem;
		font-weight: 600;
		white-space: nowrap;
		flex-shrink: 0;
	}
	.cs-risk-pill {
		background: rgba(245, 158, 11, 0.12);
		color: #b45309;
		border: 1px solid rgba(245, 158, 11, 0.3);
	}
	.cs-open-pill {
		background: rgba(34, 197, 94, 0.1);
		color: #15803d;
		border: 1px solid rgba(34, 197, 94, 0.2);
	}
	.cs-full-pill {
		background: var(--surface2, #f1f5f9);
		color: var(--muted, #64748b);
		border: 1px solid var(--border-soft, #e5e7eb);
	}
</style>
