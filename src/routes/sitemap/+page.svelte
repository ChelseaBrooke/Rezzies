<script lang="ts">
	import type { PageData } from './$types';
	import MarketingShell from '$lib/components/MarketingShell.svelte';

	let { data }: { data: PageData } = $props();

	// Journey steps: single box or branch (or). path is optional (for display).
	type StepSingle = { label: string; path?: string };
	type StepBranch = { label: string; options: StepSingle[] };
	type Step = StepSingle | StepBranch;
	type StepHub = { label: string; path?: string; fromHere: string[] };

	function isBranch(s: Step): s is StepBranch {
		return 'options' in s && Array.isArray((s as StepBranch).options);
	}
	function isHub(s: Step): s is StepHub {
		return 'fromHere' in s && Array.isArray((s as StepHub).fromHere);
	}

	const hostJourney: (Step | StepHub)[] = [
		{ label: 'Home', path: '/' },
		{ label: 'Sign up or Log in', options: [{ label: 'Sign up', path: '/signup' }, { label: 'Log in', path: '/login' }] },
		{ label: 'My Trips', path: '/trips' },
		{ label: 'Host a trip', path: '/trips/new' },
		{ label: 'New trip wizard (steps 1–6)', path: '/trips/new/step/[n]' },
		{
			label: 'Trip dashboard',
			path: '/trips/[tripId]',
			fromHere: ['Guests', 'Rooms', 'Payments', 'Invoice', 'Itinerary', 'Meals', 'Polls', 'Files', 'RSVP', 'Settings'],
		},
	];

	const guestJourney: (Step | StepHub)[] = [
		{
			label: 'Land on invite',
			options: [
				{ label: 'Invite link', path: '/invite/[token]' },
				{ label: 'Trip by code', path: '/trip/[inviteCode]' },
			],
		},
		{ label: 'Accept invite / View trip' },
		{
			label: 'Trip dashboard (guest)',
			path: '/trips/[tripId]',
			fromHere: ['RSVP', 'Itinerary', 'Meals', 'Activities', 'Files', 'Polls'],
		},
	];

	const otherPages: StepSingle[] = [
		{ label: 'Confirmation', path: '/confirmation/[id]' },
		{ label: 'Reservation', path: '/reservation/[id]' },
		{ label: 'Account settings', path: '/settings' },
	];
</script>

<svelte:head>
	<title>Site map — How the site works</title>
</svelte:head>

<MarketingShell user={data?.user}>
	<div class="wrap marketing-container">
		<div class="card">
			<header class="header">
				<h1 class="marketing-page-title">How the site works</h1>
				<p class="subtitle">Two main journeys: hosting a trip vs joining as a guest.</p>
			</header>

			<div class="journeys">
				<!-- Host journey -->
				<section class="journey-section host">
					<h2 class="journey-title">Host journey</h2>
					<div class="flow">
						{#each hostJourney as step, i}
							{#if i > 0}
								<div class="arrow" aria-hidden="true">↓</div>
							{/if}
							{#if isHub(step)}
								<div class="step hub">
									<div class="step-main">
										<span class="step-label">{step.label}</span>
										{#if step.path}<span class="step-path">{step.path}</span>{/if}
									</div>
									<div class="from-here">
										<span class="from-here-label">From here:</span>
										<div class="chips">
											{#each step.fromHere as chip}
												<span class="chip">{chip}</span>
											{/each}
										</div>
									</div>
								</div>
							{:else if isBranch(step)}
								<div class="step branch">
									<span class="step-label">{step.label}</span>
									<div class="branch-options">
										{#each step.options as opt}
											<a class="step-box opt" href={opt.path}>{opt.label}</a>
										{/each}
									</div>
								</div>
							{:else}
								{#if step.path}
									<a class="step step-box" href={step.path}>
										<span class="step-label">{step.label}</span>
										<span class="step-path">{step.path}</span>
									</a>
								{:else}
									<div class="step step-box">
										<span class="step-label">{step.label}</span>
									</div>
								{/if}
							{/if}
						{/each}
					</div>
				</section>

				<!-- Guest journey -->
				<section class="journey-section guest">
					<h2 class="journey-title">Guest journey</h2>
					<div class="flow">
						{#each guestJourney as step, i}
							{#if i > 0}
								<div class="arrow" aria-hidden="true">↓</div>
							{/if}
							{#if isHub(step)}
								<div class="step hub">
									<div class="step-main">
										<span class="step-label">{step.label}</span>
										{#if step.path}<span class="step-path">{step.path}</span>{/if}
									</div>
									<div class="from-here">
										<span class="from-here-label">From here:</span>
										<div class="chips">
											{#each step.fromHere as chip}
												<span class="chip">{chip}</span>
											{/each}
										</div>
									</div>
								</div>
							{:else if isBranch(step)}
								<div class="step branch">
									<span class="step-label">{step.label}</span>
									<div class="branch-options">
										{#each step.options as opt}
											<a class="step-box opt" href={opt.path}>{opt.label}</a>
										{/each}
									</div>
								</div>
							{:else}
								{#if step.path}
									<a class="step step-box" href={step.path}>
										<span class="step-label">{step.label}</span>
										<span class="step-path">{step.path}</span>
									</a>
								{:else}
									<div class="step step-box">
										<span class="step-label">{step.label}</span>
									</div>
								{/if}
							{/if}
						{/each}
					</div>
				</section>
			</div>

			<section class="section other">
				<h2 class="section-title">Other pages</h2>
				<div class="other-list">
					{#each otherPages as p}
						<a class="step-box small" href={p.path}>{p.label}</a>
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
		font-size: 1rem;
		opacity: 0.9;
		color: rgba(255, 255, 255, 0.85);
	}

	.journeys {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 2rem;
		align-items: start;
	}

	@media (max-width: 700px) {
		.journeys {
			grid-template-columns: 1fr;
		}
	}

	.journey-section {
		background: rgba(0, 0, 0, 0.2);
		border-radius: 12px;
		border: 1px solid rgba(255, 255, 255, 0.1);
		padding: 1.25rem;
	}

	.journey-section.host {
		border-color: rgba(159, 200, 140, 0.35);
		background: rgba(159, 200, 140, 0.06);
	}

	.journey-section.guest {
		border-color: rgba(200, 160, 255, 0.35);
		background: rgba(200, 160, 255, 0.06);
	}

	.journey-title {
		font-size: 1rem;
		font-weight: 600;
		margin: 0 0 1rem 0;
		text-align: center;
	}

	.journey-section.host .journey-title {
		color: #a8e6a0;
	}

	.journey-section.guest .journey-title {
		color: #d4b8ff;
	}

	.flow {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0;
	}

	.arrow {
		color: rgba(255, 255, 255, 0.4);
		font-size: 1.25rem;
		margin: 0.2rem 0;
	}

	.step {
		width: 100%;
		max-width: 280px;
	}

	.step-box {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		padding: 0.75rem 1rem;
		background: rgba(255, 255, 255, 0.1);
		border: 1px solid rgba(255, 255, 255, 0.25);
		border-radius: 10px;
		color: #fffbf7;
		text-decoration: none;
		transition: background 0.2s, border-color 0.2s;
	}

	.step-box:hover {
		background: rgba(255, 255, 255, 0.18);
		border-color: rgba(255, 255, 255, 0.4);
	}

	.step-box.small {
		padding: 0.5rem 0.75rem;
		font-size: 0.9rem;
	}

	.step-label {
		font-weight: 500;
		font-size: 0.95rem;
	}

	.step-path {
		font-size: 0.7rem;
		font-family: ui-monospace, monospace;
		opacity: 0.7;
		margin-top: 0.25rem;
	}

	.step.branch {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.5rem;
	}

	.step.branch > .step-label {
		font-size: 0.85rem;
		opacity: 0.9;
	}

	.branch-options {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 0.5rem;
		width: 100%;
	}

	.step-box.opt {
		flex: 1;
		min-width: 0;
	}

	.step.hub {
		padding: 0.75rem 1rem;
		background: rgba(255, 255, 255, 0.08);
		border: 1px solid rgba(255, 255, 255, 0.2);
		border-radius: 10px;
		width: 100%;
	}

	.step-main {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		margin-bottom: 0.5rem;
	}

	.from-here {
		border-top: 1px solid rgba(255, 255, 255, 0.12);
		padding-top: 0.5rem;
	}

	.from-here-label {
		display: block;
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		opacity: 0.8;
		margin-bottom: 0.35rem;
	}

	.chips {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 0.35rem;
	}

	.chip {
		font-size: 0.75rem;
		padding: 0.2rem 0.5rem;
		background: rgba(255, 255, 255, 0.1);
		border-radius: 6px;
		border: 1px solid rgba(255, 255, 255, 0.15);
	}

	.section.other {
		margin-top: 2rem;
	}

	.section-title {
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: #7dcfff;
		margin: 0 0 0.75rem 0;
	}

	.other-list {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.other-list .step-box {
		max-width: none;
	}
</style>
