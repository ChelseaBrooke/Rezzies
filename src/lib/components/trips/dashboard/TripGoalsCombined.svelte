<script lang="ts">
	/**
	 * Trip goals: Rooms/Beds/RSVPs as horizontal progress bars; Funding as semi-circular Saving Goal chart.
	 */
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
		paymentsHref = ''
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
	} = $props();

	const TEAL = '#14b8a6';
	const ORANGE = '#f97316';
	const BLUE = '#3B719F';
	const GREEN = '#22c55e';
	const GREEN_LIGHT = 'rgba(0, 0, 0, 0.1)';

	const metrics = $derived([
		{ key: 'rooms', label: 'Rooms', value: `${roomsFilled}/${roomsTotal}`, pct: roomsPct, color: TEAL, href: roomsHref },
		{ key: 'beds', label: 'Beds', value: `${bedsCurrent}/${bedsTotal}`, pct: bedsPct, color: ORANGE, href: roomsHref },
		{ key: 'rsvp', label: 'RSVPs', value: `${rsvpCurrent}/${rsvpTotal}`, pct: rsvpPct, color: BLUE, href: guestsHref }
	]);

	// Arch opens UPWARD (rainbow). Top half of circle. Chord at bottom, arc at top.
	const r = 48;
	const cx = 50;
	const cy = 58;
	const startX = cx - r;
	const endX = cx + r;
	const semicircLen = Math.PI * r;
	// Top-half arc: left to right, sweeping upward (rainbow). Chord at y=cy, dome above.
	const pathD = `M ${startX} ${cy} A ${r} ${r} 0 0 1 ${endX} ${cy}`;
	const fundingPctClamped = fundingTotal > 0 ? Math.min(100, Math.max(0, fundingPct)) : 0;
	const fundingDash = (fundingPctClamped / 100) * semicircLen;
	// Thumb on arc: 0% = left, 100% = right. Top half (dips up): y decreases toward center
	const thumbAngle = Math.PI * (1 - fundingPctClamped / 100);
	const thumbX = cx + r * Math.cos(thumbAngle);
	const thumbY = cy - r * Math.sin(thumbAngle);
	const fundingTotalFormatted = fundingTotal > 0 ? Math.round(fundingTotal).toLocaleString() : '—';
	const fundingCurrentFormatted = Math.round(fundingCurrent).toLocaleString();
</script>

<div class="progress-card">
	<!-- Funding: Saving Goal style semi-circular chart (top) -->
	<a href={paymentsHref || '#'} class="funding-chart">
		<svg class="semicircle-svg" viewBox="0 0 100 70" preserveAspectRatio="xMidYMid meet">
			<!-- Track: light grey unfilled portion -->
			<path
				class="semicircle-track"
				d={pathD}
				fill="none"
				stroke={GREEN_LIGHT}
				stroke-width="10"
				stroke-linecap="round"
			/>
			<!-- Fill: green progress from left -->
			<path
				class="semicircle-fill"
				d={pathD}
				fill="none"
				stroke={GREEN}
				stroke-width="10"
				stroke-linecap="round"
				stroke-dasharray={semicircLen}
				stroke-dashoffset={semicircLen - fundingDash}
			/>
			<!-- Thumb: green circle with white center -->
			<circle
				class="semicircle-thumb"
				cx={thumbX}
				cy={thumbY}
				r="6"
				fill={GREEN}
			/>
			<circle
				class="semicircle-thumb-inner"
				cx={thumbX}
				cy={thumbY}
				r="2"
				fill="white"
			/>
			<!-- Text centered in dome: $X committed large, of $Y smaller below -->
			<text x="50" y="37" text-anchor="middle" class="funding-amount">${fundingCurrentFormatted} committed</text>
			<text x="50" y="45" text-anchor="middle" class="funding-of">of ${fundingTotalFormatted}</text>
		</svg>
	</a>

	<!-- Rooms, Beds, RSVPs: icon + number cards -->
	<div class="metric-cards">
		{#each metrics as m}
			<a href={m.href || '#'} class="metric-card">
				<div class="metric-card-icon" style="color: {m.color}">
					{#if m.key === 'rooms'}
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
					{:else if m.key === 'beds'}
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 4v16"/><path d="M2 8h18a2 2 0 0 1 2 2v10"/><path d="M2 17h20"/><path d="M6 8V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v4"/></svg>
					{:else}
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
					{/if}
				</div>
				<span class="metric-card-value" style="color: {m.color}">{m.value}</span>
				<span class="metric-card-label">{m.label}</span>
				<div class="metric-card-bar">
					<div class="metric-card-fill" style="width: {Math.min(100, m.pct)}%; background-color: {m.color}"></div>
				</div>
			</a>
		{/each}
	</div>
</div>

<style>
	.progress-card {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		min-width: 0;
		min-height: 0;
	}

	.metric-cards {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.metric-card {
		flex: 1;
		min-width: 70px;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.25rem;
		padding: 0.5rem 0.4rem;
		background: rgba(0, 0, 0, 0.03);
		border-radius: var(--radius-lg);
		border: 1px solid var(--border-soft);
		text-decoration: none;
		color: inherit;
		transition: background 0.2s ease, border-color 0.2s ease;
	}

	.metric-card:hover {
		background: rgba(0, 0, 0, 0.05);
		border-color: var(--muted);
	}

	.metric-card-icon {
		width: 24px;
		height: 24px;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.metric-card-icon svg {
		width: 100%;
		height: 100%;
	}

	.metric-card-value {
		font-size: 0.9375rem;
		font-weight: 700;
		line-height: 1.2;
	}

	.metric-card-label {
		font-size: 0.65rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--muted);
	}

	.metric-card-bar {
		width: 100%;
		height: 4px;
		background: rgba(0, 0, 0, 0.08);
		border-radius: 999px;
		overflow: hidden;
		margin-top: 0.15rem;
	}

	.metric-card-fill {
		height: 100%;
		border-radius: 999px;
		transition: width 0.4s ease;
	}

	/* Funding: Saving Goal semi-circular chart */
	.funding-chart {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-decoration: none;
		color: inherit;
		padding-top: 0.75rem;
		padding-bottom: 0.5rem;
		border-bottom: 1px solid var(--border-soft);
		flex-shrink: 0;
		min-height: 140px;
	}

	.funding-chart:hover .funding-amount {
		text-decoration: underline;
	}

	.semicircle-svg {
		width: 100%;
		max-width: 220px;
		height: 120px;
		flex-shrink: 0;
		overflow: visible;
	}

	.funding-amount {
		font-size: 8px;
		font-weight: 700;
		fill: var(--text);
		pointer-events: none;
	}

	.funding-of {
		font-size: 5px;
		font-weight: 500;
		fill: var(--muted);
		pointer-events: none;
	}

	.semicircle-thumb-inner {
		pointer-events: none;
	}

	.semicircle-track {
		transition: stroke 0.3s ease;
	}

	.semicircle-fill {
		transition: stroke-dashoffset 0.4s ease;
	}

	.semicircle-thumb {
		transition: cx 0.4s ease, cy 0.4s ease;
	}

	.semicircle-thumb-inner {
		transition: cx 0.4s ease, cy 0.4s ease;
	}

</style>
