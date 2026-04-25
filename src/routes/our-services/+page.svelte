<script lang="ts">
	import MarketingShell from '$lib/components/MarketingShell.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const features = [
		{
			icon: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
			title: 'Trip Management',
			desc: 'Create a trip, add rooms and beds, set your dates, and invite your group, all in minutes. Import property details from Airbnb or VRBO automatically.'
		},
		{
			icon: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`,
			title: 'Optional Cost Sharing',
			desc: 'When cost matters, divvi splits it fairly, per person, per room, or per bed. Or turn cost-sharing off entirely for family trips where it doesn\'t apply.'
		},
		{
			icon: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
			title: 'Join by Link',
			desc: 'Share a direct trip link with your guests. They sign in, request to join, and once you approve, it stays simple and secure, with no codes to manage.'
		},
		{
			icon: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
			title: 'Itinerary & Activities',
			desc: 'Build a shared itinerary with meals and activities. Guests RSVP to individual events, and you see who\'s in for what, all in one place.'
		},
		{
			icon: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>`,
			title: 'Games & Polls',
			desc: 'Keep things fun during the trip with Caption This, quick polls, and group games, built right into your trip dashboard.'
		},
		{
			icon: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`,
			title: 'Group Chat & Files',
			desc: 'A dedicated group chat and file storage for every trip, so you can share packing lists, house rules, and photos without leaving the app.'
		}
	];

	const steps = [
		{ num: '01', title: 'Host creates a trip', desc: 'Add your property, rooms, and dates. Choose whether to split costs or keep it simple.' },
		{ num: '02', title: 'Share the trip link', desc: 'Copy and share the direct link with your group. No codes, no friction.' },
		{ num: '03', title: 'Guests join and RSVP', desc: 'Guests sign in and request to join. You approve and they\'re in, ready to RSVP and pick their room.' },
		{ num: '04', title: 'Trip, done right', desc: 'Track RSVPs, manage rooms, see the itinerary, and enjoy the trip with your whole group on the same page.' }
	];
</script>

<MarketingShell user={data?.user}>
	<div class="services-page">

		<!-- Hero -->
		<section class="hero-section">
			<div class="hero-eyebrow">Group travel, simplified</div>
			<h1 class="hero-headline">Everything your trip needs,<br/>nothing it doesn't.</h1>
			<p class="hero-sub">
				Divvi is the planning layer for group trips, RSVPs, rooms, itineraries, and optional cost-splitting, all tied to one shared link.
			</p>
			<div class="hero-actions">
				<a href="/trips/new" class="btn-primary">Host a Trip</a>
				<a href="/login" class="btn-ghost">Sign in</a>
			</div>
		</section>

		<!-- Features grid -->
		<section class="features-section">
			<h2 class="section-label">What's included</h2>
			<div class="features-grid">
				{#each features as f}
					<div class="feature-card">
						<div class="feature-icon">{@html f.icon}</div>
						<h3 class="feature-title">{f.title}</h3>
						<p class="feature-desc">{f.desc}</p>
					</div>
				{/each}
			</div>
		</section>

		<!-- How it works -->
		<section class="how-section">
			<h2 class="section-label">How it works</h2>
			<div class="steps-row">
				{#each steps as s, i}
					<div class="step-item">
						<div class="step-num">{s.num}</div>
						<h3 class="step-title">{s.title}</h3>
						<p class="step-desc">{s.desc}</p>
					</div>
					{#if i < steps.length - 1}
						<div class="step-arrow" aria-hidden="true">
							<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
						</div>
					{/if}
				{/each}
			</div>
		</section>

		<!-- CTA -->
		<section class="cta-section">
			<h2 class="cta-headline">Ready to plan your next trip?</h2>
			<p class="cta-sub">Set up a trip in minutes, share the link, and let divvi handle the rest.</p>
			<a href="/trips/new" class="btn-primary btn-large">Get started, it's free</a>
		</section>
	</div>
</MarketingShell>

<style>
	.services-page {
		max-width: 1060px;
		margin: 0 auto;
		padding: 0 1.5rem 4rem;
		display: flex;
		flex-direction: column;
		gap: 5rem;
	}

	/* Hero */
	.hero-section {
		padding: 4rem 0 1rem;
		text-align: center;
	}

	.hero-eyebrow {
		display: inline-block;
		font-size: 0.8125rem;
		font-weight: 700;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: rgba(255, 255, 255, 0.6);
		margin-bottom: 1.25rem;
	}

	.hero-headline {
		font-family: 'Fraunces', Georgia, serif;
		font-size: clamp(2.25rem, 5vw, 3.5rem);
		font-weight: 700;
		color: #fffbf7;
		line-height: 1.1;
		letter-spacing: -0.03em;
		margin-bottom: 1.25rem;
	}

	.hero-sub {
		font-size: 1.125rem;
		color: rgba(255, 255, 255, 0.78);
		max-width: 36rem;
		margin: 0 auto 2.5rem;
		line-height: 1.65;
	}

	.hero-actions {
		display: flex;
		gap: 0.875rem;
		justify-content: center;
		flex-wrap: wrap;
	}

	.btn-primary {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.875rem 1.75rem;
		font-size: 1rem;
		font-weight: 600;
		color: #fff;
		background: var(--copper, #bf4e30);
		border-radius: 100px;
		text-decoration: none;
		transition: background 0.18s, transform 0.12s;
	}

	.btn-primary:hover {
		background: #a03d24;
		transform: translateY(-1px);
		color: #fff;
	}

	.btn-primary.btn-large {
		padding: 1rem 2.25rem;
		font-size: 1.0625rem;
	}

	.btn-ghost {
		display: inline-flex;
		align-items: center;
		padding: 0.875rem 1.75rem;
		font-size: 1rem;
		font-weight: 500;
		color: rgba(255, 255, 255, 0.85);
		border: 1px solid rgba(255, 255, 255, 0.25);
		border-radius: 100px;
		text-decoration: none;
		transition: border-color 0.18s, color 0.18s;
	}

	.btn-ghost:hover {
		border-color: rgba(255, 255, 255, 0.6);
		color: #fff;
	}

	/* Section labels */
	.section-label {
		font-size: 0.75rem;
		font-weight: 700;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: rgba(255, 255, 255, 0.5);
		margin-bottom: 2rem;
		text-align: center;
	}

	/* Features */
	.features-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
		gap: 1.25rem;
	}

	.feature-card {
		background: rgba(255, 255, 255, 0.07);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 16px;
		padding: 1.75rem;
		transition: background 0.18s;
	}

	.feature-card:hover {
		background: rgba(255, 255, 255, 0.1);
	}

	.feature-icon {
		width: 52px;
		height: 52px;
		background: rgba(191, 78, 48, 0.15);
		border-radius: 14px;
		display: flex;
		align-items: center;
		justify-content: center;
		color: #e8825e;
		margin-bottom: 1.125rem;
	}

	.feature-title {
		font-size: 1.0625rem;
		font-weight: 600;
		color: #fffbf7;
		margin-bottom: 0.5rem;
	}

	.feature-desc {
		font-size: 0.9375rem;
		color: rgba(255, 255, 255, 0.72);
		line-height: 1.6;
		margin: 0;
	}

	/* How it works */
	.steps-row {
		display: flex;
		align-items: flex-start;
		gap: 0.5rem;
		flex-wrap: wrap;
		justify-content: center;
	}

	.step-item {
		flex: 1;
		min-width: 180px;
		max-width: 220px;
		text-align: center;
	}

	.step-num {
		font-family: 'Fraunces', Georgia, serif;
		font-size: 2.5rem;
		font-weight: 700;
		color: rgba(191, 78, 48, 0.4);
		line-height: 1;
		margin-bottom: 0.75rem;
		letter-spacing: -0.03em;
	}

	.step-title {
		font-size: 1rem;
		font-weight: 600;
		color: #fffbf7;
		margin-bottom: 0.5rem;
	}

	.step-desc {
		font-size: 0.875rem;
		color: rgba(255, 255, 255, 0.65);
		line-height: 1.55;
		margin: 0;
	}

	.step-arrow {
		flex-shrink: 0;
		color: rgba(255, 255, 255, 0.2);
		margin-top: 1rem;
		align-self: flex-start;
	}

	/* CTA */
	.cta-section {
		background: rgba(191, 78, 48, 0.12);
		border: 1px solid rgba(191, 78, 48, 0.25);
		border-radius: 20px;
		padding: 3.5rem 2rem;
		text-align: center;
	}

	.cta-headline {
		font-family: 'Fraunces', Georgia, serif;
		font-size: clamp(1.75rem, 4vw, 2.5rem);
		font-weight: 700;
		color: #fffbf7;
		margin-bottom: 0.875rem;
		letter-spacing: -0.025em;
	}

	.cta-sub {
		font-size: 1.0625rem;
		color: rgba(255, 255, 255, 0.75);
		max-width: 28rem;
		margin: 0 auto 2rem;
		line-height: 1.6;
	}

	@media (max-width: 640px) {
		.services-page { gap: 3.5rem; }
		.step-arrow { display: none; }
		.step-item { max-width: 100%; }
		.hero-section { padding: 2rem 0 0; }
	}
</style>
