<script lang="ts">
	let {
		rsvpCurrent = 0,
		rsvpTotal = 0,
		rsvpPct = 0,
		bedsCurrent = 0,
		bedsTotal = 0,
		bedsPct = 0,
		roomsFilled = 0,
		roomsTotal = 0,
		roomsPct = 0,
		fundingCurrent = 0,
		fundingTotal = 0,
		fundingPct = 0,
		fundingDisplay = '',
		guestsHref = '',
		roomsHref = '',
		paymentsHref = '',
		tripCheckInDate = '',
		tripInfoFilled = 0,
		tripInfoTotal = 3
	}: {
		rsvpCurrent?: number;
		rsvpTotal?: number;
		rsvpPct?: number;
		bedsCurrent?: number;
		bedsTotal?: number;
		bedsPct?: number;
		roomsFilled?: number;
		roomsTotal?: number;
		roomsPct?: number;
		fundingCurrent?: number;
		fundingTotal?: number;
		fundingPct?: number;
		fundingDisplay?: string;
		guestsHref?: string;
		roomsHref?: string;
		paymentsHref?: string;
		tripCheckInDate?: string;
		tripInfoFilled?: number;
		tripInfoTotal?: number;
	} = $props();

	const daysUntil = $derived.by(() => {
		if (!tripCheckInDate) return null;
		const now = new Date();
		now.setHours(0, 0, 0, 0);
		const checkIn = new Date(tripCheckInDate);
		checkIn.setHours(0, 0, 0, 0);
		const diff = Math.round((checkIn.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
		return diff > 0 ? diff : null;
	});

	const fundingPctClamped = $derived(fundingTotal > 0 ? Math.min(100, Math.max(0, fundingPct)) : 0);
	const fundingValueLabel = $derived(
		fundingTotal > 0
			? `$${Math.round(fundingCurrent).toLocaleString()} / $${Math.round(fundingTotal).toLocaleString()}`
			: fundingDisplay || 'Not set'
	);

	const tripInfoPct = $derived(tripInfoTotal > 0 ? Math.min(100, Math.round((tripInfoFilled / tripInfoTotal) * 100)) : 0);

	const stats = $derived([
		{
			key: 'funding',
			label: 'Funding',
			value: fundingValueLabel,
			pct: fundingPctClamped,
			href: paymentsHref
		},
		{
			key: 'rsvps',
			label: 'RSVPs confirmed',
			value: rsvpTotal > 0 ? `${rsvpCurrent} / ${rsvpTotal}` : '—',
			pct: rsvpPct,
			href: guestsHref
		},
		{
			key: 'rooms',
			label: 'Rooms filled',
			value: roomsTotal > 0 ? `${roomsFilled} / ${roomsTotal}` : '—',
			pct: roomsPct,
			href: roomsHref
		},
		{
			key: 'beds',
			label: 'Beds claimed',
			value: bedsTotal > 0 ? `${bedsCurrent} / ${bedsTotal}` : '—',
			pct: bedsPct,
			href: roomsHref
		},
		{
			key: 'tripinfo',
			label: 'Trip info',
			value: tripInfoTotal > 0 ? `${tripInfoFilled} / ${tripInfoTotal}` : '—',
			pct: tripInfoPct,
			href: '#trip-info'
		}
	]);

	const overallPct = $derived(
		Math.round(
			([rsvpPct, bedsPct, roomsPct, fundingPctClamped, tripInfoPct].reduce((a, b) => a + b, 0)) / 5
		)
	);
</script>

<div class="readiness">
	<div class="overall-bar-row">
		<span class="overall-label">Trip readiness</span>
		<span class="overall-pct" class:complete={overallPct >= 100}>{overallPct}%</span>
	</div>
	<div class="overall-track">
		<div class="overall-fill" class:complete={overallPct >= 100} style="width: {overallPct}%"></div>
	</div>

	<div class="stat-list">
		{#each stats as stat}
			<a href={stat.href || '#'} class="stat-row" class:complete={stat.pct >= 100}>
				<div class="stat-head">
					<span class="stat-icon" aria-hidden="true">
						{#if stat.key === 'funding'}
							<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<circle cx="12" cy="12" r="10"/>
								<path d="M12 6v2m0 8v2m-4-7h2a2 2 0 0 1 0 4H8m8-4h-2a2 2 0 0 0 0 4h2"/>
							</svg>
						{:else if stat.key === 'rsvps'}
							<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
								<circle cx="9" cy="7" r="4"/>
								<path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
								<path d="M16 3.13a4 4 0 0 1 0 7.75"/>
							</svg>
						{:else if stat.key === 'rooms'}
							<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
								<polyline points="9 22 9 12 15 12 15 22"/>
							</svg>
						{:else if stat.key === 'tripinfo'}
							<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<circle cx="12" cy="12" r="10"/>
								<line x1="12" y1="8" x2="12" y2="12"/>
								<line x1="12" y1="16" x2="12.01" y2="16"/>
							</svg>
						{:else}
							<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<path d="M2 4v16"/>
								<path d="M2 8h18a2 2 0 0 1 2 2v10"/>
								<path d="M2 17h20"/>
								<path d="M6 8V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v4"/>
							</svg>
						{/if}
					</span>
					<span class="stat-label">{stat.label}</span>
					{#if stat.pct >= 100}
						<span class="stat-check" aria-label="Complete">
							<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
								<polyline points="20 6 9 17 4 12"/>
							</svg>
						</span>
					{/if}
					<span class="stat-value" class:done={stat.pct >= 100}>{stat.value}</span>
				</div>
				<div class="bar-track">
					<div
						class="bar-fill"
						class:done={stat.pct >= 100}
						style="width: {Math.min(100, stat.pct)}%"
					></div>
				</div>
			</a>
		{/each}
	</div>
</div>

<style>
	.readiness {
		display: flex;
		flex-direction: column;
		gap: 0;
		min-width: 0;
	}

	/* ── Overall readiness bar ── */
	.overall-bar-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 0.35rem;
	}

	.overall-label {
		font-size: 0.6875rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--muted);
	}

	.overall-pct {
		font-size: 0.75rem;
		font-weight: 700;
		color: var(--muted);
	}

	.overall-pct.complete {
		color: var(--copper, #BF4E30);
	}

	.overall-track {
		height: 4px;
		background: var(--border-soft, rgba(0,0,0,0.07));
		border-radius: 999px;
		overflow: hidden;
		margin-bottom: 1rem;
	}

	.overall-fill {
		height: 100%;
		background: var(--copper, #BF4E30);
		border-radius: 999px;
		transition: width 0.5s ease;
		opacity: 0.55;
	}

	.overall-fill.complete {
		opacity: 1;
	}

	/* ── Stat list ── */
	.stat-list {
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
	}

	.stat-row {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		padding: 0.6rem 0.5rem;
		border-radius: var(--radius-md);
		text-decoration: none;
		color: inherit;
		transition: background 0.15s ease;
	}

	.stat-row:hover {
		background: rgba(191, 78, 48, 0.04);
	}

	.stat-head {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		min-width: 0;
	}

	.stat-icon {
		width: 15px;
		height: 15px;
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--copper, #BF4E30);
		opacity: 0.65;
	}

	.stat-icon svg {
		width: 100%;
		height: 100%;
	}

	.stat-label {
		font-size: 0.8125rem;
		color: var(--text);
		flex: 1;
		min-width: 0;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.stat-check {
		width: 14px;
		height: 14px;
		flex-shrink: 0;
		color: var(--copper, #BF4E30);
		display: flex;
		align-items: center;
	}

	.stat-check svg {
		width: 100%;
		height: 100%;
	}

	.stat-value {
		font-size: 0.8125rem;
		font-weight: 600;
		color: var(--text);
		white-space: nowrap;
		flex-shrink: 0;
	}

	.stat-value.done {
		color: var(--copper, #BF4E30);
	}

	.bar-track {
		width: 100%;
		height: 3px;
		background: var(--border-soft, rgba(0,0,0,0.07));
		border-radius: 999px;
		overflow: hidden;
	}

	.bar-fill {
		height: 100%;
		background: var(--copper, #BF4E30);
		border-radius: 999px;
		transition: width 0.4s ease;
		min-width: 3px;
		opacity: 0.55;
	}

	.bar-fill.done {
		opacity: 1;
	}
</style>
