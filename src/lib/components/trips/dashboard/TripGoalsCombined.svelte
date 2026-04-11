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
		tripInfoFilled?: number;
		tripInfoTotal?: number;
		costSharingEnabled?: boolean;
	} = $props();

	const tripInfoPct = $derived(
		tripInfoTotal > 0 ? Math.min(100, Math.round((tripInfoFilled / tripInfoTotal) * 100)) : 0
	);

	// Four stat rings — outer to inner, each paired with a theme color
	const RING_COLORS = ['#CE5612', '#E8922C', '#2F7778', '#6FB8BA'] as const;

	const allStats = $derived([
		{
			label: 'RSVPs',
			value: rsvpTotal > 0 ? `${rsvpCurrent} / ${rsvpTotal}` : '—',
			pct: rsvpPct,
			href: guestsHref,
			color: RING_COLORS[0]
		},
		{
			label: 'Rooms',
			value: roomsTotal > 0 ? `${roomsFilled} / ${roomsTotal}` : '—',
			pct: roomsPct,
			href: roomsHref,
			color: RING_COLORS[1]
		},
		{
			label: 'Beds',
			value: bedsTotal > 0 ? `${bedsCurrent} / ${bedsTotal}` : '—',
			pct: bedsPct,
			href: roomsHref,
			color: RING_COLORS[2]
		},
		{
			label: 'Trip info',
			value: tripInfoTotal > 0 ? `${tripInfoFilled} / ${tripInfoTotal}` : '—',
			pct: tripInfoPct,
			href: '#trip-info',
			color: RING_COLORS[3]
		}
	]);

	const overallPct = $derived(
		Math.round([rsvpPct, bedsPct, roomsPct, tripInfoPct].reduce((a, b) => a + b, 0) / 4)
	);

	// ── SVG ring math ──────────────────────────────────────────────────────
	// Each ring is a 270° arc (gap at the bottom), starting at lower-left
	// and sweeping clockwise to lower-right.
	//
	// For a circle of radius r centered at (100, 100):
	//   start = (100 − r·sin45°, 100 + r·sin45°)  ← SVG 135° from 3-o'clock
	//   end   = (100 + r·sin45°, 100 + r·sin45°)  ← SVG 45°  from 3-o'clock
	//   large-arc-flag = 1 (270° > 180°), sweep-flag = 1 (clockwise)
	const S = 0.7071; // sin/cos 45°
	const RADII = [86, 70, 54, 38] as const;

	const rings = $derived(
		RADII.map((r, i) => {
			const sx = +(100 - S * r).toFixed(2);
			const sy = +(100 + S * r).toFixed(2);
			const ex = +(100 + S * r).toFixed(2);
			const arcLen = +(0.75 * 2 * Math.PI * r).toFixed(2);
			const fillLen = +((allStats[i].pct / 100) * arcLen).toFixed(2);
			return {
				d: `M ${sx},${sy} A ${r},${r} 0 1 1 ${ex},${sy}`,
				arcLen,
				fillLen,
				color: RING_COLORS[i],
				stat: allStats[i]
			};
		})
	);

	// viewBox: top of outermost arc = 100 − 86 = 14
	// Arc endpoints (45° / 135°) at y = 100 + 86·sin45 ≈ 161
	// Gap centre (6-o'clock, r=86) at y = 100 + 86 = 186
	// Expand viewBox to 200 × 200 so the gap text fits inside
</script>

<div class="readiness">

	<!-- ── Header ── -->
	<div class="rdy-header">
		<span class="rdy-title">Trip readiness</span>
	</div>

	<!-- ── Multi-ring gauge (dark section) ── -->
	<div class="rdy-gauge-section">
	<div class="rdy-gauge-wrap">
		<svg class="rdy-rings" viewBox="0 0 200 200" aria-hidden="true">
			{#each rings as ring}
				<!-- Track (full 270° arc, very subtle) -->
				<path
					d={ring.d}
					fill="none"
					stroke="rgba(47,119,120,0.18)"
					stroke-width="9"
					stroke-linecap="round"
				/>
				<!-- Fill (partial arc, colored) -->
				{#if ring.stat.pct > 1}
					<path
						d={ring.d}
						fill="none"
						stroke={ring.color}
						stroke-width="9"
						stroke-linecap="round"
						stroke-dasharray="{ring.fillLen} {ring.arcLen}"
					/>
				{/if}
			{/each}

			<!-- % and label anchored in the bottom gap -->
			<text
				x="100" y="176"
				text-anchor="middle" dominant-baseline="auto"
				font-size="32" font-weight="900" letter-spacing="-1.5"
				fill="#1d4d4e"
			>{overallPct}%</text>
			<text
				x="100" y="190"
				text-anchor="middle" dominant-baseline="auto"
				font-size="9" font-weight="700" letter-spacing="2.5"
				fill="rgba(29,77,78,0.5)"
			>{overallPct >= 100 ? 'ALL SET' : 'READY'}</text>
		</svg>
	</div>

	</div><!-- /rdy-gauge-section -->

	<!-- ── Stat legend rows ── -->
	<div class="rdy-stats">
		{#each allStats as stat}
			<a href={stat.href || '#'} class="rdy-row">
				<span class="rdy-dot" style="background: {stat.color}"></span>
				<span class="rdy-row-label">{stat.label}</span>
				<div class="rdy-row-bar">
					<div class="rdy-row-fill" style="width: {stat.pct}%; background: {stat.color}"></div>
				</div>
				{#if stat.pct >= 100}
					<span class="rdy-row-val rdy-row-val--done">✓</span>
				{:else}
					<span class="rdy-row-val">{stat.value}</span>
				{/if}
			</a>
		{/each}
	</div>

</div>

<style>
	.readiness {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		height: 100%;
		min-width: 0;
	}

	/* ── Header ── */
	.rdy-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
	}

	.rdy-title {
		font-size: 0.6rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.12em;
		color: var(--slate, #2f7778);
		opacity: 0.6;
	}

	/* ── Gauge section: solid teal, matches chat tab ── */
	.rdy-gauge-section {
		flex: 1;
		min-height: 0;
		border-radius: 14px;
		background: rgb(0, 0, 0, 0.2);
		display: flex;
		flex-direction: column;
		padding: 0.25rem 0.25rem 0.5rem;
	}

	/* ── Ring gauge ── */
	.rdy-gauge-wrap {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 0;
	}

	.rdy-rings {
		width: 100%;
		height: 100%;
		max-width: 200px;
		max-height: 200px;
		overflow: visible;
	}

	/* ── Stat rows (on white) ── */
	.rdy-stats {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		padding-top: 0.4rem;
	}

	.rdy-row {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		padding: 0.28rem 0.25rem;
		border-radius: 7px;
		text-decoration: none;
		transition: background 0.12s;
		min-width: 0;
	}

	.rdy-row:hover {
		background: rgba(29, 77, 78, 0.05);
	}

	.rdy-dot {
		flex-shrink: 0;
		width: 7px;
		height: 7px;
		border-radius: 50%;
	}

	.rdy-row-label {
		font-size: 0.7rem;
		font-weight: 500;
		color: var(--slate, #2f7778);
		white-space: nowrap;
		min-width: 3.5rem;
	}

	.rdy-row-bar {
		flex: 1;
		height: 3px;
		background: rgba(29, 77, 78, 0.1);
		border-radius: 999px;
		overflow: hidden;
	}

	.rdy-row-fill {
		height: 100%;
		border-radius: 999px;
		transition: width 0.5s cubic-bezier(0.4, 0, 0.2, 1);
	}

	.rdy-row-val {
		flex-shrink: 0;
		font-size: 0.68rem;
		font-weight: 700;
		color: var(--navy, #1d4d4e);
		opacity: 0.6;
		font-variant-numeric: tabular-nums;
		min-width: 2.5rem;
		text-align: right;
	}

	.rdy-row-val--done {
		color: var(--warm, #ce5612);
		opacity: 1;
	}
</style>
