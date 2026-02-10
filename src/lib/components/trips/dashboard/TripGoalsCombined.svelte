<script lang="ts">
	/**
	 * Combined trip goals view: single compact bar or summary instead of 3 separate visuals.
	 */
	let {
		rsvpCurrent = 0,
		rsvpTotal = 0,
		rsvpPct = 0,
		bedsCurrent = 0,
		bedsTotal = 0,
		bedsPct = 0,
		fundingCurrent = 0,
		fundingTotal = 0,
		fundingPct = 0,
		fundingDisplay = '',
		guestsHref = '',
		roomsHref = '',
		paymentsHref = ''
	}: {
		rsvpCurrent?: number;
		rsvpTotal?: number;
		rsvpPct?: number;
		bedsCurrent?: number;
		bedsTotal?: number;
		bedsPct?: number;
		fundingCurrent?: number;
		fundingTotal?: number;
		fundingPct?: number;
		fundingDisplay?: string;
		guestsHref?: string;
		roomsHref?: string;
		paymentsHref?: string;
	} = $props();

	const avgPct = $derived(Math.round((rsvpPct + bedsPct + fundingPct) / 3));

	const goals = $derived([
		{ key: 'rsvp', label: 'RSVPs', value: `${rsvpCurrent}/${rsvpTotal}`, pct: rsvpPct, href: guestsHref },
		{ key: 'beds', label: 'Beds', value: `${bedsCurrent}/${bedsTotal}`, pct: bedsPct, href: roomsHref },
		{ key: 'funding', label: 'Funding', value: fundingDisplay || `$${fundingCurrent.toLocaleString()}`, pct: fundingPct, href: paymentsHref }
	]);
</script>

<div class="combined-goals">
	<h2 class="viz-title">Trip goals</h2>
	<div class="combined-summary">
		<span class="overall-pct">{avgPct}% overall</span>
	</div>
	<div class="goals-list">
		{#each goals as goal}
			<a href={goal.href || '#'} class="goal-row" class:complete={goal.pct >= 100}>
				<div class="goal-bar-wrap">
					<div class="goal-bar-track">
						<div class="goal-bar-fill" style="width: {Math.min(100, goal.pct)}%"></div>
					</div>
				</div>
				<div class="goal-meta">
					<span class="goal-label">{goal.label}</span>
					<span class="goal-value">{goal.value}</span>
					<span class="goal-pct">{goal.pct}%</span>
				</div>
			</a>
		{/each}
	</div>
</div>

<style>
	.combined-goals {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		min-width: 0;
	}

	.viz-title {
		margin: 0;
		font-size: 0.9375rem;
		font-weight: 700;
		color: var(--text);
		letter-spacing: -0.01em;
	}

	.combined-summary {
		font-size: 1.25rem;
		font-weight: 700;
		color: var(--text);
	}

	.overall-pct {
		color: var(--primary);
	}

	.goals-list {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.goal-row {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		padding: 0.75rem 1rem;
		background: var(--surface2);
		border-radius: var(--radius-md);
		text-decoration: none;
		color: inherit;
		border: 1px solid transparent;
		transition: border-color 0.2s ease, box-shadow 0.2s ease;
	}

	.goal-row:hover {
		border-color: var(--border);
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
	}

	.goal-row.complete {
		opacity: 0.9;
	}

	.goal-bar-wrap {
		width: 100%;
	}

	.goal-bar-track {
		height: 6px;
		background: rgba(0, 0, 0, 0.08);
		border-radius: 999px;
		overflow: hidden;
	}

	.goal-bar-fill {
		height: 100%;
		background: var(--primary);
		border-radius: 999px;
		transition: width 0.4s ease;
	}

	.goal-row.complete .goal-bar-fill {
		background: #22c55e;
	}

	.goal-meta {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		font-size: 0.8125rem;
	}

	.goal-label {
		color: var(--muted);
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.goal-value {
		font-weight: 600;
		color: var(--text);
	}

	.goal-pct {
		font-weight: 700;
		color: var(--text);
	}
</style>
