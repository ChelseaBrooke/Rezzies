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
	tripInfoTotal = 3,
	costSharingEnabled = true
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
	costSharingEnabled?: boolean;
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

	const allStats = $derived([
		...(costSharingEnabled ? [{
			key: 'funding',
			label: 'Funding',
			value: fundingValueLabel,
			pct: fundingPctClamped,
			href: paymentsHref
		}] : []),
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

	const pending = $derived(allStats.filter(s => s.pct < 100));
	const done = $derived(allStats.filter(s => s.pct >= 100));

	const overallPct = $derived.by(() => {
		const parts = [rsvpPct, bedsPct, roomsPct, tripInfoPct];
		if (costSharingEnabled) parts.push(fundingPctClamped);
		return Math.round(parts.reduce((a, b) => a + b, 0) / parts.length);
	});
</script>

<div class="readiness">

	<!-- Hero: big % + bar -->
	<div class="hero">
		<div class="hero-top">
			<span class="hero-label">Trip readiness</span>
			{#if daysUntil != null}
				<span class="days-pill">{daysUntil} days away</span>
			{/if}
		</div>
		<div class="hero-pct-row">
			<span class="hero-pct" class:complete={overallPct >= 100}>{overallPct}<span class="hero-pct-sym">%</span></span>
			{#if overallPct >= 100}
				<span class="hero-complete-badge">All done!</span>
			{:else}
				<span class="hero-remaining">{pending.length} item{pending.length === 1 ? '' : 's'} left</span>
			{/if}
		</div>
		<div class="overall-track">
			<div class="overall-fill" class:complete={overallPct >= 100} style="width: {overallPct}%"></div>
		</div>
	</div>

	<!-- Pending items: grow to fill available space -->
	{#if pending.length > 0}
		<div class="pending-section">
			<div class="section-label">
				<span>Still needed</span>
				<span class="section-count">{pending.length}</span>
			</div>
			<div class="pending-list">
				{#each pending as stat}
					<a href={stat.href || '#'} class="stat-row">
						<span class="pct-ring" aria-hidden="true">
							<svg viewBox="0 0 36 36" class="ring-svg">
								<circle cx="18" cy="18" r="14" class="ring-track"/>
								<circle
									cx="18" cy="18" r="14"
									class="ring-fill"
									style="stroke-dasharray: {Math.round((stat.pct / 100) * 87.96)} 87.96"
								/>
							</svg>
						</span>
						<span class="stat-label">{stat.label}</span>
						<span class="stat-badge">{stat.value}</span>
						<span class="stat-arrow" aria-hidden="true">›</span>
					</a>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Done items: compact chips pinned to bottom -->
	{#if done.length > 0}
		<div class="done-section">
			{#each done as stat}
				<a href={stat.href || '#'} class="done-chip">
					<svg class="done-icon" viewBox="0 0 14 14" fill="none">
						<circle cx="7" cy="7" r="6" fill="currentColor" opacity="0.15"/>
						<polyline points="4,7.5 6,9.5 10,5.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
					</svg>
					{stat.label}
				</a>
			{/each}
		</div>
	{/if}

</div>

<style>
	.readiness {
		display: flex;
		flex-direction: column;
		gap: 0;
		min-width: 0;
		height: 100%;
	}

	/* ── Hero ── */
	.hero {
		margin-bottom: 1.5rem;
	}

	.hero-top {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 0.6rem;
	}

	.hero-label {
		font-size: 0.6875rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--muted);
	}

	.days-pill {
		font-size: 0.6875rem;
		font-weight: 600;
		color: var(--muted);
		background: var(--border-soft);
		border: 1px solid var(--border);
		border-radius: 999px;
		padding: 0.15rem 0.55rem;
	}

	.hero-pct-row {
		display: flex;
		align-items: baseline;
		gap: 0.6rem;
		margin-bottom: 0.75rem;
	}

	.hero-pct {
		font-size: 3rem;
		font-weight: 900;
		line-height: 1;
		letter-spacing: -0.04em;
		color: var(--text);
	}

	.hero-pct.complete {
		color: #2a7a4a;
	}

	.hero-pct-sym {
		font-size: 1.5rem;
		font-weight: 700;
		letter-spacing: -0.02em;
		opacity: 0.6;
	}

	.hero-remaining {
		font-size: 0.8125rem;
		color: var(--muted);
		font-weight: 500;
		align-self: center;
	}

	.hero-complete-badge {
		font-size: 0.8rem;
		font-weight: 700;
		color: #2a7a4a;
		background: rgba(42, 122, 74, 0.1);
		border-radius: 999px;
		padding: 0.2rem 0.6rem;
		align-self: center;
	}

	.overall-track {
		height: 6px;
		background: var(--border-soft);
		border-radius: 999px;
		overflow: hidden;
	}

	.overall-fill {
		height: 100%;
		background: var(--navy, #1d4d4e);
		border-radius: 999px;
		transition: width 0.5s ease;
	}

	.overall-fill.complete {
		background: #2a7a4a;
	}

	/* ── Pending section ── */
	.pending-section {
		flex: 1;
		display: flex;
		flex-direction: column;
		min-height: 0;
	}

	.section-label {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.6875rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--muted);
		margin-bottom: 0.375rem;
		padding: 0 0.25rem;
	}

	.section-count {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 1.1rem;
		height: 1.1rem;
		padding: 0 0.3rem;
		border-radius: 999px;
		background: var(--navy, #1d4d4e);
		color: #fff;
		font-size: 0.625rem;
		font-weight: 700;
		line-height: 1;
	}

	.pending-list {
		display: flex;
		flex-direction: column;
		justify-content: space-around;
		flex: 1;
	}

	/* ── Stat rows ── */
	.stat-row {
		display: flex;
		align-items: center;
		gap: 0.625rem;
		padding: 0.6rem 0.5rem;
		border-radius: var(--radius-md);
		text-decoration: none;
		color: inherit;
		transition: background 0.13s ease;
	}

	.stat-row:hover {
		background: var(--border-soft);
	}

	/* ── Ring ── */
	.pct-ring {
		flex-shrink: 0;
		width: 28px;
		height: 28px;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.ring-svg {
		width: 100%;
		height: 100%;
		transform: rotate(-90deg);
	}

	.ring-track {
		fill: none;
		stroke: var(--border-soft);
		stroke-width: 5;
	}

	.ring-fill {
		fill: none;
		stroke: var(--navy, #1d4d4e);
		stroke-width: 5;
		stroke-linecap: round;
		transition: stroke-dasharray 0.4s ease;
	}

	/* ── Label & badge ── */
	.stat-label {
		font-size: 0.875rem;
		color: var(--text);
		flex: 1;
		min-width: 0;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		font-weight: 500;
	}

	.stat-badge {
		flex-shrink: 0;
		font-size: 0.75rem;
		font-weight: 700;
		color: var(--navy, #1d4d4e);
		background: rgba(29, 77, 78, 0.09);
		border-radius: 6px;
		padding: 0.2rem 0.5rem;
		white-space: nowrap;
	}

	.stat-arrow {
		flex-shrink: 0;
		font-size: 1.1rem;
		color: var(--muted);
		opacity: 0.4;
		line-height: 1;
	}

	/* ── Done chips (bottom) ── */
	.done-section {
		display: flex;
		flex-wrap: wrap;
		gap: 0.375rem;
		padding-top: 0.875rem;
		border-top: 1px solid var(--border-soft);
		margin-top: 0.75rem;
	}

	.done-chip {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		font-size: 0.75rem;
		font-weight: 500;
		color: var(--muted);
		background: var(--border-soft);
		border-radius: 999px;
		padding: 0.25rem 0.6rem 0.25rem 0.4rem;
		text-decoration: none;
		transition: opacity 0.15s;
		opacity: 0.7;
	}

	.done-chip:hover {
		opacity: 1;
	}

	.done-icon {
		width: 14px;
		height: 14px;
		flex-shrink: 0;
		color: #2a7a4a;
	}
</style>
