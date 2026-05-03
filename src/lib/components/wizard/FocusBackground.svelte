<script lang="ts">
	/**
	 * Purely decorative icon-grid background for the focus-mode wizard.
	 * Static SVG, no JS animation, pointer-events: none, does not affect layout.
	 *
	 * Icons: 10 Lucide outline shapes (24x24 viewbox) at 22px screen size.
	 * Colors: three brand tones at low opacity so the grid is a whisper, not a distraction.
	 * Fade: CSS mask-image dissolves the grid toward the bottom of the viewport.
	 */

	// Grid dimensions (big enough to fill a 1600x1000 viewport)
	const COL_GAP = 48;
	const ROW_GAP = 52;
	const COLS = 34;
	const ROWS = 20;
	const ICON_SIZE = 22;

	// Deterministic offset arrays (cycling). No Math.random() to avoid hydration mismatch.
	const XO = [3, -2, 4, -3, 0, 2, -4, 1, -1, 3, -2, 0, 4, -3, 2, -1, 3, 0, -4, 2];
	const YO = [-2, 3, 0, -4, 2, -1, 3, -3, 1, 4, -2, 0, -3, 2, 1, -4, 0, 3, -1, 2];

	// Brand palette: [color-var, opacity]
	const PALETTE: [string, number][] = [
		['var(--warm)',   0.16], // copper
		['var(--slate)',  0.14], // teal
		['var(--carrot)', 0.15]  // carrot
	];

	// Icon symbol IDs
	const ICON_IDS = [
		'fbg-home', 'fbg-bed', 'fbg-calendar', 'fbg-pin',
		'fbg-users', 'fbg-dollar', 'fbg-sun', 'fbg-plane',
		'fbg-clock', 'fbg-star'
	];

	interface GridItem {
		x: number;
		y: number;
		iconId: string;
		color: string;
		opacity: number;
	}

	const items: GridItem[] = [];
	let n = 0;
	for (let r = 0; r < ROWS; r++) {
		for (let c = 0; c < COLS; c++) {
			const x = 14 + c * COL_GAP + XO[n % XO.length];
			const y = 24 + r * ROW_GAP + YO[n % YO.length];
			const [color, opacity] = PALETTE[(c * 3 + r * 7 + n) % 3];
			const iconId = ICON_IDS[(c * 5 + r * 11 + n * 3) % 10];
			items.push({ x, y, iconId, color, opacity });
			n++;
		}
	}
</script>

<div class="fbg" aria-hidden="true">
	<svg
		class="fbg-svg"
		xmlns="http://www.w3.org/2000/svg"
		width="100%"
		height="100%"
		preserveAspectRatio="xMidYMid slice"
		role="presentation"
	>
		<defs>
			<!-- Home -->
			<symbol id="fbg-home" viewBox="0 0 24 24">
				<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
				<polyline points="9 22 9 12 15 12 15 22"/>
			</symbol>

			<!-- Bed -->
			<symbol id="fbg-bed" viewBox="0 0 24 24">
				<path d="M2 4v16"/>
				<path d="M2 8h18a2 2 0 0 1 2 2v10"/>
				<path d="M2 17h20"/>
				<path d="M6 8v-2a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v2"/>
			</symbol>

			<!-- Calendar -->
			<symbol id="fbg-calendar" viewBox="0 0 24 24">
				<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
				<line x1="16" y1="2" x2="16" y2="6"/>
				<line x1="8" y1="2" x2="8" y2="6"/>
				<line x1="3" y1="10" x2="21" y2="10"/>
			</symbol>

			<!-- MapPin -->
			<symbol id="fbg-pin" viewBox="0 0 24 24">
				<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
				<circle cx="12" cy="10" r="3"/>
			</symbol>

			<!-- Users -->
			<symbol id="fbg-users" viewBox="0 0 24 24">
				<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
				<circle cx="9" cy="7" r="4"/>
				<path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
				<path d="M16 3.13a4 4 0 0 1 0 7.75"/>
			</symbol>

			<!-- DollarSign -->
			<symbol id="fbg-dollar" viewBox="0 0 24 24">
				<line x1="12" y1="1" x2="12" y2="23"/>
				<path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
			</symbol>

			<!-- Sun -->
			<symbol id="fbg-sun" viewBox="0 0 24 24">
				<circle cx="12" cy="12" r="5"/>
				<line x1="12" y1="1" x2="12" y2="3"/>
				<line x1="12" y1="21" x2="12" y2="23"/>
				<line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
				<line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
				<line x1="1" y1="12" x2="3" y2="12"/>
				<line x1="21" y1="12" x2="23" y2="12"/>
				<line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
				<line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
			</symbol>

			<!-- Plane -->
			<symbol id="fbg-plane" viewBox="0 0 24 24">
				<path d="M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.2-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.3-.2.6-.6.5-1.1z"/>
			</symbol>

			<!-- Clock -->
			<symbol id="fbg-clock" viewBox="0 0 24 24">
				<circle cx="12" cy="12" r="10"/>
				<polyline points="12 6 12 12 16 14"/>
			</symbol>

			<!-- Star -->
			<symbol id="fbg-star" viewBox="0 0 24 24">
				<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
			</symbol>
		</defs>

		<!-- Icon grid -->
		{#each items as { x, y, iconId, color, opacity } (x + ',' + y)}
			<use
				href="#{iconId}"
				x={x - ICON_SIZE / 2}
				y={y - ICON_SIZE / 2}
				width={ICON_SIZE}
				height={ICON_SIZE}
				fill="none"
				stroke={color}
				stroke-width="1.5"
				stroke-linecap="round"
				stroke-linejoin="round"
				opacity={opacity}
			/>
		{/each}
	</svg>
</div>

<style>
	.fbg {
		position: absolute;
		inset: 0;
		z-index: 0;
		pointer-events: none;
		overflow: hidden;

		/* Dissolve toward bottom */
		-webkit-mask-image: linear-gradient(
			to bottom,
			black 55%,
			rgba(0, 0, 0, 0.5) 72%,
			rgba(0, 0, 0, 0.18) 84%,
			transparent 94%
		);
		mask-image: linear-gradient(
			to bottom,
			black 55%,
			rgba(0, 0, 0, 0.5) 72%,
			rgba(0, 0, 0, 0.18) 84%,
			transparent 94%
		);
	}

	.fbg-svg {
		display: block;
		width: 100%;
		height: 100%;
	}

	/* Mobile: reduce opacity across the board and thin out density */
	@media (max-width: 640px) {
		.fbg {
			opacity: 0.55; /* 0.16 * 0.55 ~ 0.09 per icon */
		}
	}
</style>
