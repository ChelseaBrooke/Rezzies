<script lang="ts">
	/**
	 * Concentric circle goal display for RSVPs, Beds, and Funding.
	 * Uses dark blue, light blue, and sage per ring; center shows aggregate.
	 */
	const COLORS = {
		rsvp: '#1e3a5f',   // dark blue
		beds: '#63b3ed',   // light blue
		funding: '#87ae7a' // sage
	} as const;

	const TRACK = '#e8ecf0'; // neutral track for unfilled portion

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

	const size = 140;
	const cx = size / 2;
	const cy = size / 2;
	const strokeWidth = 10;
	const r1 = 28;  // innermost (RSVPs)
	const r2 = 42;  // middle (Beds)
	const r3 = 56;  // outermost (Funding)

	function circumference(r: number) {
		return 2 * Math.PI * r;
	}

	function dashArray(r: number, pct: number) {
		const c = circumference(r);
		const filled = (pct / 100) * c;
		return `${filled} ${c}`;
	}

	// Start arc from top (12 o'clock): offset by quarter circumference
	function dashOffset(r: number) {
		return circumference(r) / 4;
	}

	const items = $derived([
		{
			key: 'rsvp',
			label: 'RSVPs',
			display: `${rsvpCurrent}/${rsvpTotal}`,
			pct: rsvpPct,
			color: COLORS.rsvp,
			href: guestsHref
		},
		{
			key: 'beds',
			label: 'Beds',
			display: `${bedsCurrent}/${bedsTotal}`,
			pct: bedsPct,
			color: COLORS.beds,
			href: roomsHref
		},
		{
			key: 'funding',
			label: 'Funding',
			display: fundingDisplay || `${fundingCurrent}/${fundingTotal}`,
			pct: fundingPct,
			color: COLORS.funding,
			href: paymentsHref
		}
	]);
</script>

<div class="goal-card">
	<div class="goal-top">
		<h2 class="goal-title">Trip goals</h2>
		<div class="goal-stats">
			<span class="goal-stat">{avgPct}% overall</span>
			<span class="goal-stat">{rsvpCurrent}/{rsvpTotal} RSVPs</span>
		</div>
	</div>
	<div class="goal-body">
		<div class="circle-wrap" aria-hidden="true">
		<svg class="circle-svg" width={size} height={size} viewBox="0 0 {size} {size}">
			<!-- RSVPs - innermost ring (dark blue) -->
			<circle
				class="ring track"
				cx={cx} cy={cy} r={r1}
				fill="none"
				stroke={TRACK}
				stroke-width={strokeWidth}
			/>
			<circle
				class="ring fill"
				cx={cx} cy={cy} r={r1}
				fill="none"
				stroke={COLORS.rsvp}
				stroke-width={strokeWidth}
				stroke-dasharray={dashArray(r1, rsvpPct)}
				stroke-dashoffset={dashOffset(r1)}
				stroke-linecap="round"
			/>
			<!-- Beds - middle ring (light blue) -->
			<circle
				class="ring track"
				cx={cx} cy={cy} r={r2}
				fill="none"
				stroke={TRACK}
				stroke-width={strokeWidth}
			/>
			<circle
				class="ring fill"
				cx={cx} cy={cy} r={r2}
				fill="none"
				stroke={COLORS.beds}
				stroke-width={strokeWidth}
				stroke-dasharray={dashArray(r2, bedsPct)}
				stroke-dashoffset={dashOffset(r2)}
				stroke-linecap="round"
			/>
			<!-- Funding - outermost ring (sage) -->
			<circle
				class="ring track"
				cx={cx} cy={cy} r={r3}
				fill="none"
				stroke={TRACK}
				stroke-width={strokeWidth}
			/>
			<circle
				class="ring fill"
				cx={cx} cy={cy} r={r3}
				fill="none"
				stroke={COLORS.funding}
				stroke-width={strokeWidth}
				stroke-dasharray={dashArray(r3, fundingPct)}
				stroke-dashoffset={dashOffset(r3)}
				stroke-linecap="round"
			/>
		</svg>
		<div class="circle-center">
			<span class="center-value">{avgPct}%</span>
			<span class="center-label">Total</span>
		</div>
	</div>
		<ul class="goal-list">
			{#each items as item}
				<li class="goal-list-item">
					<a href={item.href || '#'} class="goal-list-link">
						<span class="goal-dot" style="background-color: {item.color}"></span>
						<span class="goal-list-label">{item.label}</span>
						<span class="goal-list-value">{item.display}</span>
						<span class="goal-list-pct">{item.pct}%</span>
					</a>
				</li>
			{/each}
		</ul>
	</div>
	<div class="goal-actions">
		<a href={guestsHref} class="btn-view-details">View details</a>
	</div>
</div>

<style>
	.goal-card {
		background: white;
		border-radius: var(--radius-xl);
		padding: 0.75rem 1rem;
		box-shadow: 0 1px 2px rgba(0, 27, 46, 0.06);
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.goal-top {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.goal-title {
		margin: 0;
		font-size: 0.875rem;
		font-weight: 700;
		color: var(--text);
	}

	.goal-stats {
		display: flex;
		gap: 0.75rem;
		font-size: 0.75rem;
		color: var(--muted);
		font-weight: 500;
	}

	.goal-stat {
		white-space: nowrap;
	}

	.goal-body {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		min-width: 0;
	}

	.circle-wrap {
		position: relative;
		width: 140px;
		height: 140px;
		flex-shrink: 0;
	}

	.circle-svg {
		display: block;
		transform: rotate(-90deg); /* 0% at top */
	}

	.circle-svg .ring {
		transition: stroke-dasharray 0.4s ease;
	}

	.circle-center {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		pointer-events: none;
	}

	.center-value {
		font-size: 1.125rem;
		font-weight: 700;
		color: var(--text);
		line-height: 1.2;
	}

	.center-label {
		font-size: 0.625rem;
		font-weight: 600;
		color: var(--muted);
	}

	.goal-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		flex: 1;
		min-width: 0;
	}

	.goal-list-item {
		margin: 0;
	}

	.goal-list-link {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		text-decoration: none;
		color: var(--text);
		font-size: 0.75rem;
		padding: 0.15rem 0;
		border-radius: var(--radius-sm);
		transition: background var(--transition-fast);
	}

	.goal-list-link:hover {
		background: var(--surface2);
	}

	.goal-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.goal-list-label {
		flex: 1;
		font-weight: 500;
		min-width: 0;
	}

	.goal-list-value {
		font-weight: 600;
		color: var(--text);
		font-size: 0.6875rem;
	}

	.goal-list-pct {
		font-size: 0.6875rem;
		color: var(--muted);
		min-width: 2rem;
		text-align: right;
	}

	.goal-actions {
		display: flex;
		justify-content: center;
		padding-top: 0;
	}

	.btn-view-details {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0.35rem 0.75rem;
		font-size: 0.6875rem;
		font-weight: 600;
		color: var(--text);
		background: white;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		text-decoration: none;
		transition: background var(--transition-fast), border-color var(--transition-fast);
	}

	.btn-view-details:hover {
		background: var(--surface2);
		border-color: var(--muted);
	}
</style>
