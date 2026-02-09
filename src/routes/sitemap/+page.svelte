<script lang="ts">
	import type { PageData } from './$types';
	import MarketingShell from '$lib/components/MarketingShell.svelte';

	let { data }: { data: PageData } = $props();

	// Node id -> { label, path }
	type NodeRecord = { label: string; path: string };
	const nodes: Record<string, NodeRecord> = {
		home: { label: 'Home', path: '/' },
		'find-vacation': { label: 'Find Vacation', path: '/find-vacation' },
		'our-services': { label: 'Our Services', path: '/our-services' },
		login: { label: 'Login', path: '/login' },
		signup: { label: 'Sign up', path: '/signup' },
		trips: { label: 'My Trips', path: '/trips' },
		'trips-new': { label: 'New trip', path: '/trips/new' },
		'trips-new-step': { label: 'New trip wizard', path: '/trips/new/step/[step]' },
		'trip-dashboard': { label: 'Trip dashboard (host)', path: '/trips/[tripId]' },
		'trip-dashboard-guest': { label: 'Trip dashboard (guest)', path: '/trips/[tripId]' },
		'invite-token': { label: 'Accept invite', path: '/invite/[token]' },
		'trip-invite': { label: 'Trip by invite code', path: '/trip/[inviteCode]' },
		settings: { label: 'Account settings', path: '/settings' },
		'confirmation': { label: 'Confirmation', path: '/confirmation/[id]' },
		reservation: { label: 'Reservation', path: '/reservation/[id]' },
		// Trip dashboard sub-pages (host)
		activities: { label: 'Activities', path: '/trips/[tripId]/activities' },
		files: { label: 'Files', path: '/trips/[tripId]/files' },
		guests: { label: 'Guests', path: '/trips/[tripId]/guests' },
		invoice: { label: 'Invoice', path: '/trips/[tripId]/invoice' },
		itinerary: { label: 'Itinerary', path: '/trips/[tripId]/itinerary' },
		meals: { label: 'Meals', path: '/trips/[tripId]/meals' },
		payments: { label: 'Payments', path: '/trips/[tripId]/payments' },
		polls: { label: 'Polls', path: '/trips/[tripId]/polls' },
		rooms: { label: 'Rooms', path: '/trips/[tripId]/rooms' },
		'rooms-edit': { label: 'Rooms edit', path: '/trips/[tripId]/rooms/edit' },
		rsvp: { label: 'RSVP', path: '/trips/[tripId]/rsvp' },
		tripSettings: { label: 'Trip settings', path: '/trips/[tripId]/settings' },
		'settings-step': { label: 'Settings wizard', path: '/trips/[tripId]/settings/step/[step]' },
	};

	// From node id -> to node ids (where you can go from here)
	const edges: Record<string, string[]> = {
		home: ['find-vacation', 'our-services', 'login', 'signup', 'trips'],
		'find-vacation': ['home', 'trips'],
		'our-services': ['home', 'find-vacation'],
		login: ['trips', 'signup', 'home'],
		signup: ['login', 'trips', 'home'],
		trips: ['trips-new', 'trip-dashboard', 'trip-dashboard-guest', 'invite-token', 'home'],
		'trips-new': ['trips-new-step', 'trips'],
		'trips-new-step': ['trips-new', 'trip-dashboard', 'trips'],
		'trip-dashboard': [
			'activities',
			'files',
			'guests',
			'invoice',
			'itinerary',
			'meals',
			'payments',
			'polls',
			'rooms',
			'rsvp',
			'tripSettings',
			'trips',
		],
		'trip-dashboard-guest': ['activities', 'files', 'itinerary', 'meals', 'polls', 'rsvp', 'trips'],
		'invite-token': ['trip-dashboard-guest', 'trips'],
		'trip-invite': ['trip-dashboard-guest', 'trips'],
		settings: ['trips', 'home'],
		confirmation: ['trips', 'home'],
		reservation: ['trips', 'home'],
		activities: ['trip-dashboard', 'files', 'guests', 'itinerary', 'meals', 'payments', 'polls', 'rooms', 'rsvp', 'tripSettings'],
		files: ['trip-dashboard', 'activities', 'guests', 'itinerary', 'meals', 'payments', 'polls', 'rooms', 'rsvp', 'tripSettings'],
		guests: ['trip-dashboard', 'activities', 'files', 'itinerary', 'meals', 'payments', 'polls', 'rooms', 'rsvp', 'tripSettings'],
		invoice: ['trip-dashboard', 'payments', 'trips'],
		itinerary: ['trip-dashboard', 'activities', 'files', 'meals', 'polls', 'rsvp'],
		meals: ['trip-dashboard', 'activities', 'itinerary', 'polls', 'rsvp'],
		payments: ['trip-dashboard', 'invoice', 'trips'],
		polls: ['trip-dashboard', 'activities', 'itinerary', 'meals', 'rsvp'],
		rooms: ['trip-dashboard', 'rooms-edit', 'guests', 'rsvp'],
		'rooms-edit': ['rooms', 'trip-dashboard'],
		rsvp: ['trip-dashboard', 'itinerary', 'rooms'],
		tripSettings: ['trip-dashboard', 'settings-step', 'trips'],
		'settings-step': ['tripSettings', 'trip-dashboard'],
	};

	const allPageIds = $derived(Object.keys(nodes));
	let selectedId = $state<string>('home');
	const selected = $derived(nodes[selectedId]);
	const nextIds = $derived(edges[selectedId] ?? []);
	let pathStack = $state<string[]>(['home']);

	function selectFromList(id: string) {
		selectedId = id;
		pathStack = [id];
	}

	function selectFromFlow(id: string) {
		selectedId = id;
		if (pathStack[pathStack.length - 1] !== id) pathStack = [...pathStack, id];
	}

	function goBack() {
		if (pathStack.length > 1) {
			pathStack = pathStack.slice(0, -1);
			selectedId = pathStack[pathStack.length - 1];
		}
	}

	// --- Webbed diagram: radial layout + edge list ---
	const nodeIds = Object.keys(nodes);
	const edgeList = $derived(
		(function () {
			const list: [string, string][] = [];
			const seen = new Set<string>();
			for (const fromId of Object.keys(edges)) {
				for (const toId of edges[fromId] ?? []) {
					const key = fromId < toId ? `${fromId}-${toId}` : `${toId}-${fromId}`;
					if (!seen.has(key)) {
						seen.add(key);
						list.push([fromId, toId]);
					}
				}
			}
			return list;
		})()
	);

	// BFS from home to get tier (distance); unreachable get max tier
	function getTiers(): Record<string, number> {
		const tier: Record<string, number> = {};
		const q: string[] = ['home'];
		tier['home'] = 0;
		while (q.length > 0) {
			const id = q.shift()!;
			const d = tier[id] ?? 0;
			for (const toId of edges[id] ?? []) {
				if (tier[toId] == null) {
					tier[toId] = d + 1;
					q.push(toId);
				}
			}
		}
		let maxTier = 0;
		for (const id of nodeIds) {
			if (tier[id] == null) tier[id] = 99;
			maxTier = Math.max(maxTier, tier[id] < 99 ? tier[id] : 0);
		}
		for (const id of nodeIds) {
			if (tier[id] === 99) tier[id] = maxTier + 1;
		}
		return tier;
	}

	const tiers = getTiers();
	const tierGroups = $derived(
		(function () {
			const g: Record<number, string[]> = {};
			for (const id of nodeIds) {
				const t = tiers[id] ?? 0;
				if (!g[t]) g[t] = [];
				g[t].push(id);
			}
			return Object.keys(g)
				.map(Number)
				.sort((a, b) => a - b)
				.map((t) => ({ tier: t, ids: g[t]! }));
		})()
	);

	const CX = 450;
	const CY = 300;
	const R0 = 0;
	const R_PER_TIER = 72;

	const nodePositions = $derived(
		(function () {
			const pos: Record<string, { x: number; y: number }> = {};
			for (const { tier, ids } of tierGroups) {
				const r = tier === 0 ? 0 : R0 + tier * R_PER_TIER;
				ids.forEach((id, i) => {
					const angle = (2 * Math.PI * i) / ids.length - Math.PI / 2;
					pos[id] = {
						x: CX + r * Math.cos(angle),
						y: CY + r * Math.sin(angle),
					};
				});
			}
			return pos;
		})()
	);

	const outgoingIds = $derived(edges[selectedId] ?? []);
</script>

<svelte:head>
	<title>Site map — Page navigation</title>
</svelte:head>

<MarketingShell user={data?.user}>
	<div class="wrap marketing-container">
		<div class="card">
			<header class="header">
				<h1 class="marketing-page-title">Page navigation</h1>
				<p class="subtitle">Web diagram: click a node to select it. Lines show where you can navigate.</p>
			</header>

			<!-- Webbed diagram -->
			<section class="section diagram-section">
				<div class="diagram-wrap">
					<svg
						class="web-svg"
						viewBox="0 0 900 600"
						aria-label="Page navigation web"
					>
						<!-- edges -->
						<g class="edges">
							{#each edgeList as [fromId, toId]}
								{#if nodePositions[fromId] && nodePositions[toId]}
									<line
										x1={nodePositions[fromId].x}
										y1={nodePositions[fromId].y}
										x2={nodePositions[toId].x}
										y2={nodePositions[toId].y}
										class="edge"
										class:edge-highlight={(selectedId === fromId && outgoingIds.includes(toId)) || (selectedId === toId && outgoingIds.includes(fromId))}
									/>
								{/if}
							{/each}
						</g>
						<!-- nodes -->
						<g class="nodes">
							{#each nodeIds as id}
								{#if nodePositions[id]}
									<g
										class="node-g"
										class:selected={selectedId === id}
										class:neighbor={outgoingIds.includes(id)}
										onclick={() => selectFromFlow(id)}
										onkeydown={(e) => e.key === 'Enter' && selectFromFlow(id)}
										role="button"
										tabindex="0"
									>
										<circle
											cx={nodePositions[id].x}
											cy={nodePositions[id].y}
											r={selectedId === id ? 22 : 16}
											class="node-circle"
										/>
										<text
											x={nodePositions[id].x}
											y={nodePositions[id].y + 4}
											text-anchor="middle"
											class="node-label"
										>
											{nodes[id].label.length > 14 ? nodes[id].label.slice(0, 12) + '…' : nodes[id].label}
										</text>
									</g>
								{/if}
							{/each}
						</g>
					</svg>
				</div>
			</section>

			<!-- Selected node + next options -->
			<section class="section flow-section">
				<h2 class="section-title">Selected</h2>
				<div class="flow-box">
					{#if pathStack.length > 1}
						<button type="button" class="back-btn" onclick={goBack}>← Back</button>
					{/if}
					<div class="current-node">
						<span class="current-label">You are here</span>
						<div class="current-name">{selected?.label}</div>
						<div class="current-path">{selected?.path}</div>
					</div>
					<div class="next-row">
						<span class="next-label">From here you can go to:</span>
						<div class="next-options">
							{#each nextIds as nextId}
								<button
									type="button"
									class="next-btn"
									onclick={() => selectFromFlow(nextId)}
								>
									{nodes[nextId]?.label ?? nextId}
								</button>
							{/each}
						</div>
					</div>
					{#if pathStack.length > 1}
						<div class="breadcrumb">
							{#each pathStack as id, i}
								{#if i > 0}<span class="breadcrumb-sep">→</span>{/if}
								<button
									type="button"
									class="breadcrumb-item"
									onclick={() => {
										pathStack = pathStack.slice(0, i + 1);
										selectedId = pathStack[i] ?? 'home';
									}}
								>
									{nodes[id]?.label ?? id}
								</button>
							{/each}
						</div>
					{/if}
				</div>
			</section>

			<!-- All pages list (compact) -->
			<section class="section">
				<h2 class="section-title">All pages</h2>
				<div class="page-list">
					{#each allPageIds as id}
						<button
							type="button"
							class="page-pill"
							class:selected={selectedId === id}
							onclick={() => selectFromList(id)}
						>
							{nodes[id].label}
						</button>
					{/each}
				</div>
			</section>
		</div>
	</div>
</MarketingShell>

<style>
	.wrap {
		color: rgba(255, 255, 255, 0.95);
		padding: 0 0 2rem 0;
		font-family: 'Segoe UI', system-ui, sans-serif;
	}

	.card {
		background: rgba(0, 27, 46, 0.85);
		backdrop-filter: blur(12px);
		-webkit-backdrop-filter: blur(12px);
		border-radius: 16px;
		border: 1px solid rgba(255, 255, 255, 0.12);
		padding: 2rem;
		max-width: 56rem;
		margin: 0 auto;
	}

	.header {
		text-align: center;
		margin-bottom: 2rem;
	}

	.header :global(.marketing-page-title) {
		margin: 0 0 0.25rem 0;
	}

	.subtitle {
		margin: 0;
		font-size: 0.95rem;
		opacity: 0.9;
		color: rgba(255, 255, 255, 0.85);
	}

	.section {
		margin-bottom: 2rem;
	}

	.section:last-child {
		margin-bottom: 0;
	}

	.section-title {
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: #7dcfff;
		margin: 0 0 0.75rem 0;
	}

	/* Webbed diagram */
	.diagram-section {
		margin-bottom: 1.5rem;
	}

	.diagram-wrap {
		background: rgba(0, 0, 0, 0.2);
		border-radius: 12px;
		border: 1px solid rgba(255, 255, 255, 0.1);
		overflow: hidden;
		width: 100%;
		aspect-ratio: 900 / 600;
		max-height: 520px;
	}

	.web-svg {
		width: 100%;
		height: 100%;
		display: block;
	}

	.web-svg .edge {
		stroke: rgba(255, 255, 255, 0.2);
		stroke-width: 1;
		transition: stroke 0.2s, stroke-width 0.2s;
	}

	.web-svg .edge-highlight {
		stroke: rgba(125, 207, 255, 0.6);
		stroke-width: 2;
	}

	.web-svg .node-g {
		cursor: pointer;
		outline: none;
	}

	.web-svg .node-g:focus-visible .node-circle {
		stroke: #7dcfff;
		stroke-width: 2;
	}

	.web-svg .node-circle {
		fill: rgba(255, 255, 255, 0.15);
		stroke: rgba(255, 255, 255, 0.35);
		stroke-width: 1;
		transition: fill 0.2s, stroke 0.2s, r 0.2s;
	}

	.web-svg .node-g:hover .node-circle {
		fill: rgba(255, 255, 255, 0.25);
		stroke: rgba(255, 255, 255, 0.5);
	}

	.web-svg .node-g.selected .node-circle {
		fill: rgba(125, 207, 255, 0.35);
		stroke: #7dcfff;
		stroke-width: 2;
	}

	.web-svg .node-g.neighbor .node-circle {
		fill: rgba(159, 200, 140, 0.25);
		stroke: rgba(159, 200, 140, 0.6);
	}

	.web-svg .node-label {
		font-size: 10px;
		fill: rgba(255, 255, 255, 0.9);
		pointer-events: none;
		user-select: none;
	}

	.web-svg .node-g.selected .node-label {
		fill: #fff;
		font-weight: 600;
	}

	.page-list {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.page-pill {
		padding: 0.4rem 0.75rem;
		border-radius: 999px;
		border: 1px solid rgba(255, 255, 255, 0.25);
		background: rgba(255, 255, 255, 0.06);
		color: rgba(255, 255, 255, 0.9);
		font-size: 0.85rem;
		cursor: pointer;
		transition: background 0.2s, border-color 0.2s;
	}

	.page-pill:hover {
		background: rgba(255, 255, 255, 0.12);
		border-color: rgba(255, 255, 255, 0.4);
	}

	.page-pill.selected {
		background: rgba(125, 207, 255, 0.2);
		border-color: #7dcfff;
		color: #fff;
	}

	/* Flow */
	.flow-section .section-title {
		margin-bottom: 0.5rem;
	}

	.flow-box {
		background: rgba(0, 0, 0, 0.25);
		border: 1px solid rgba(255, 255, 255, 0.15);
		border-radius: 12px;
		padding: 1.5rem;
		position: relative;
	}

	.back-btn {
		position: absolute;
		top: 1rem;
		right: 1rem;
		padding: 0.35rem 0.6rem;
		font-size: 0.8rem;
		border-radius: 6px;
		border: 1px solid rgba(255, 255, 255, 0.3);
		background: rgba(255, 255, 255, 0.08);
		color: rgba(255, 255, 255, 0.9);
		cursor: pointer;
		transition: background 0.2s;
	}

	.back-btn:hover {
		background: rgba(255, 255, 255, 0.15);
	}

	.current-node {
		margin-bottom: 1.25rem;
		padding-bottom: 1rem;
		border-bottom: 1px solid rgba(255, 255, 255, 0.15);
	}

	.current-label {
		display: block;
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: #7dcfff;
		margin-bottom: 0.25rem;
	}

	.current-name {
		font-size: 1.25rem;
		font-weight: 600;
		color: #fffbf7;
	}

	.current-path {
		font-size: 0.8rem;
		font-family: ui-monospace, monospace;
		opacity: 0.75;
		margin-top: 0.2rem;
	}

	.next-label {
		display: block;
		font-size: 0.8rem;
		color: rgba(255, 255, 255, 0.8);
		margin-bottom: 0.6rem;
	}

	.next-options {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.next-btn {
		padding: 0.5rem 0.9rem;
		border-radius: 8px;
		border: 1px solid rgba(255, 255, 255, 0.25);
		background: rgba(255, 255, 255, 0.1);
		color: #fffbf7;
		font-size: 0.9rem;
		cursor: pointer;
		transition: background 0.2s, border-color 0.2s, transform 0.1s;
	}

	.next-btn:hover {
		background: rgba(255, 255, 255, 0.18);
		border-color: rgba(255, 255, 255, 0.4);
		transform: translateY(-1px);
	}

	.breadcrumb {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.25rem;
		margin-top: 1rem;
		padding-top: 1rem;
		border-top: 1px solid rgba(255, 255, 255, 0.1);
		font-size: 0.8rem;
	}

	.breadcrumb-sep {
		opacity: 0.5;
		margin: 0 0.15rem;
	}

	.breadcrumb-item {
		padding: 0.2rem 0.4rem;
		border-radius: 4px;
		border: none;
		background: transparent;
		color: rgba(255, 255, 255, 0.75);
		cursor: pointer;
		transition: background 0.2s, color 0.2s;
	}

	.breadcrumb-item:hover {
		background: rgba(255, 255, 255, 0.1);
		color: #fff;
	}
</style>
