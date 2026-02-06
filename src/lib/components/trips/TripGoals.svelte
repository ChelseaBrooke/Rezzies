<script lang="ts">
	/**
	 * Trip goals as a data-style viz: mini arc gauges, clear metrics, actionable links.
	 */
	const COLORS = {
		rsvp: { fill: '#1e3a5f', track: 'rgba(30, 58, 95, 0.15)', glow: 'rgba(30, 58, 95, 0.25)' },
		beds: { fill: '#63b3ed', track: 'rgba(99, 179, 237, 0.2)', glow: 'rgba(99, 179, 237, 0.3)' },
		funding: { fill: '#87ae7a', track: 'rgba(135, 174, 122, 0.2)', glow: 'rgba(135, 174, 122, 0.3)' }
	} as const;

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

	const avgPct = $derived(
		Math.round((rsvpPct + bedsPct + fundingPct) / 3)
	);

	const goals = $derived([
		{
			key: 'rsvp',
			label: 'RSVPs',
			current: rsvpCurrent,
			total: rsvpTotal,
			pct: rsvpPct,
			colors: COLORS.rsvp,
			href: guestsHref,
			actionLabel: rsvpCurrent < rsvpTotal ? `Invite ${rsvpTotal - rsvpCurrent} more` : 'View guests',
			value: `${rsvpCurrent}/${rsvpTotal}`
		},
		{
			key: 'beds',
			label: 'Beds',
			current: bedsCurrent,
			total: bedsTotal,
			pct: bedsPct,
			colors: COLORS.beds,
			href: roomsHref,
			actionLabel: bedsCurrent < bedsTotal ? `Assign ${bedsTotal - bedsCurrent} more` : 'Manage rooms',
			value: `${bedsCurrent}/${bedsTotal}`
		},
		{
			key: 'funding',
			label: 'Funding',
			current: fundingCurrent,
			total: fundingTotal,
			pct: fundingPct,
			colors: COLORS.funding,
			href: paymentsHref,
			actionLabel: fundingCurrent < fundingTotal ? `Need $${(fundingTotal - fundingCurrent).toLocaleString()}` : 'View payments',
			value: fundingDisplay || `$${fundingCurrent.toLocaleString()}`
		}
	]);

	// Arc gauge: semicircle along bottom; stroke-dasharray for progress
	const R = 32;
	const strokeWidth = 8;
	const arcLength = Math.PI * R; // half circle

	function dashArray(pct: number) {
		const filled = Math.min(100, pct) / 100 * arcLength;
		return `${filled} ${arcLength}`;
	}
</script>

<div class="viz">
	<h2 class="viz-title">Trip goals</h2>
	<div class="viz-grid">
		{#each goals as goal}
			<a href={goal.href || '#'} class="viz-card" class:complete={goal.pct >= 100}>
				<div class="card-gauge">
					<svg class="gauge-svg" viewBox="0 0 64 40" aria-hidden="true">
						<!-- track (semicircle) -->
						<path
							class="gauge-track"
							d="M 0 40 A 32 32 0 0 1 64 40"
							fill="none"
							stroke={goal.colors.track}
							stroke-width={strokeWidth}
							stroke-linecap="round"
						/>
						<!-- fill -->
						<path
							class="gauge-fill"
							d="M 0 40 A 32 32 0 0 1 64 40"
							fill="none"
							stroke={goal.colors.fill}
							stroke-width={strokeWidth}
							stroke-linecap="round"
							stroke-dasharray={dashArray(goal.pct)}
							stroke-dashoffset={0}
						/>
					</svg>
					<span class="gauge-value">{goal.pct}%</span>
				</div>
				<div class="card-content">
					<span class="card-label">{goal.label}</span>
					<span class="card-metric">{goal.value}</span>
					{#if goal.pct < 100}
						<span class="card-cta">{goal.actionLabel} →</span>
					{:else}
						<span class="card-done">✓ Complete</span>
					{/if}
				</div>
			</a>
		{/each}
	</div>
</div>

<style>
	.viz {
		--viz-radius: 12px;
		min-width: 0;
	}

	.viz-title {
		margin: 0 0 0.5rem 0;
		font-size: 0.9375rem;
		font-weight: 700;
		color: var(--text);
		letter-spacing: -0.01em;
	}

	.viz-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 1rem;
	}

	.viz-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		padding: 1.25rem 1rem;
		border-radius: var(--viz-radius);
		text-decoration: none;
		color: inherit;
		background: var(--surface2);
		border: 1px solid transparent;
		transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
		min-width: 0;
	}

	.viz-card:hover {
		transform: translateY(-2px);
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.06);
		border-color: var(--border);
	}

	.viz-card.complete {
		opacity: 0.9;
	}

	.card-gauge {
		position: relative;
		width: 64px;
		height: 40px;
		margin-bottom: 0.75rem;
		flex-shrink: 0;
	}

	.gauge-svg {
		width: 100%;
		height: 100%;
		overflow: visible;
	}

	.gauge-track {
		transition: stroke 0.2s ease;
	}

	.gauge-fill {
		transition: stroke-dasharray 0.6s cubic-bezier(0.4, 0, 0.2, 1);
	}

	.gauge-value {
		position: absolute;
		bottom: -2px;
		left: 50%;
		transform: translateX(-50%);
		font-size: 0.75rem;
		font-weight: 700;
		color: var(--text);
		opacity: 0.9;
	}

	.card-content {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		min-width: 0;
	}

	.card-label {
		font-size: 0.6875rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--muted);
	}

	.card-metric {
		font-size: 1rem;
		font-weight: 700;
		color: var(--text);
		letter-spacing: -0.02em;
	}

	.card-cta {
		font-size: 0.6875rem;
		font-weight: 600;
		color: var(--muted);
		margin-top: 0.25rem;
		transition: color 0.2s ease;
	}

	.viz-card:hover .card-cta {
		color: var(--text);
	}

	.card-done {
		font-size: 0.6875rem;
		font-weight: 600;
		color: var(--muted);
		margin-top: 0.25rem;
	}

	@media (max-width: 640px) {
		.viz-grid {
			grid-template-columns: 1fr;
		}

		.viz-card {
			flex-direction: row;
			text-align: left;
			padding: 1rem 1.25rem;
		}

		.card-gauge {
			margin-bottom: 0;
			margin-right: 1rem;
		}
	}
</style>