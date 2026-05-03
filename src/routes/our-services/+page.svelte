<script lang="ts">
	import MarketingShell from '$lib/components/MarketingShell.svelte';
	import type { PageData } from './$types';
	import { FEATURE_TRIP_GAMES } from '$lib/config/features.js';

	let { data }: { data: PageData } = $props();

	const gamesPollsFeature = {
		icon: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>`,
		title: 'Games & polls',
		desc: 'Quick polls and group games built into the trip dashboard. For when the group needs to pick a restaurant, or just a laugh on the drive in.'
	};

	const pollsOnlyFeature = {
		icon: gamesPollsFeature.icon,
		title: 'Polls',
		desc: 'Quick polls built into the trip dashboard—pick a restaurant, settle a time, or let the group vote without another thread.'
	};

	const features = [
		{
			icon: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
			title: 'Trip setup, in minutes',
			desc: 'Add your property, rooms, and dates, then invite your group—no spreadsheets, no guesswork.'
		},
		{
			icon: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`,
			title: 'Fair cost-splitting (when you need it)',
			desc: 'Split per person, per room, or per bed. Divvi does the math. Hosting family? Turn it off. Cost-splitting is a tool, not a tax.'
		},
		{
			icon: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
			title: 'One link, one group',
			desc: 'Share a direct trip link. Guests sign in, request to join, and you approve. No email chains, no spreadsheets, no "wait, what was the code again?"'
		},
		{
			icon: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
			title: 'Itinerary & activities',
			desc: 'Build a shared itinerary with meals and activities. Guests RSVP to each one, so you know exactly who\'s in for the hike and who\'s sleeping in.'
		},
		{
			icon: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`,
			title: 'Trip chat & shared files',
			desc: 'Every trip gets its own group chat and a shared drop for photos, packing lists, and the rental\'s check-in instructions. The trip lives in one place.'
		},
		FEATURE_TRIP_GAMES ? gamesPollsFeature : pollsOnlyFeature
	];

	const steps = [
		{
			num: '01',
			title: 'Host creates a trip',
			desc: 'Add your property, rooms, and dates. Choose whether to split costs or keep it simple.'
		},
		{
			num: '02',
			title: 'Share the trip link',
			desc: 'Copy the link, send it however you usually send things. Text, email, group chat, whatever works.'
		},
		{
			num: '03',
			title: 'Guests join and RSVP',
			desc: 'Guests sign in, request to join, and pick a room. You approve, they\'re in.'
		},
		{
			num: '04',
			title: 'Show up and enjoy it',
			desc: 'RSVPs tracked, rooms assigned, itinerary set. The work is done before the trip starts, so the trip can just be the trip.'
		}
	];
</script>

<MarketingShell user={data?.user}>
	<div class="services-page">
		<article class="paper">
			<!-- Hero -->
			<section class="hero" aria-labelledby="hero-headline">
				<p class="eyebrow">
					<span class="eyebrow-text">What Divvi does</span>
					<span class="eyebrow-rule" aria-hidden="true"></span>
				</p>
				<h1 id="hero-headline" class="hero-headline">
					Everything your trip needs, <em class="hero-em">nothing</em> it doesn't.
				</h1>
				<p class="hero-sub">
					Group trips fall apart in the gap between "who's coming" and "what does it cost." Divvi closes that gap, with RSVPs, rooms, itineraries, and fair cost-splitting on one shared link.
				</p>
				<div class="hero-actions">
					<a href="/trips/new" class="btn-primary">Host a Trip</a>
					<a href="/login" class="btn-text">Sign in <span aria-hidden="true">→</span></a>
				</div>
				<!-- TODO: editorial hero image -->
				<div class="hero-rule" aria-hidden="true">
					<svg viewBox="0 0 1080 24" preserveAspectRatio="none" width="100%" height="24">
						<path d="M0 18 C 180 4, 360 22, 540 12 S 900 2, 1080 16" fill="none" stroke="currentColor" stroke-width="1" />
					</svg>
				</div>
			</section>

			<!-- Features -->
			<section class="section" aria-labelledby="features-title">
				<header class="section-head">
					<p class="section-num">
						<span class="section-num-label">01 / The Toolkit</span>
						<span class="section-num-rule" aria-hidden="true"></span>
					</p>
					<h2 id="features-title" class="section-title">What you get with every trip</h2>
					<p class="section-dek">
						Built around the actual mechanics of group travel, not bolted on as an afterthought.
					</p>
				</header>
				<ul class="feature-list">
					{#each features as f}
						<li class="feature-row">
							<div class="feature-icon" aria-hidden="true">{@html f.icon}</div>
							<div class="feature-body">
								<h3 class="feature-title">{f.title}</h3>
								<p class="feature-desc">{f.desc}</p>
							</div>
						</li>
					{/each}
				</ul>
			</section>

			<!-- How it works -->
			<section class="section" aria-labelledby="how-title">
				<header class="section-head">
					<p class="section-num">
						<span class="section-num-label">02 / How it works</span>
						<span class="section-num-rule" aria-hidden="true"></span>
					</p>
					<h2 id="how-title" class="section-title">Four steps, one trip</h2>
				</header>
				<ol class="steps-grid">
					{#each steps as s}
						<li class="step">
							<span class="step-num" aria-hidden="true">{s.num}</span>
							<h3 class="step-title">{s.title}</h3>
							<p class="step-desc">{s.desc}</p>
						</li>
					{/each}
				</ol>
			</section>

			<!-- CTA -->
			<section class="cta" aria-labelledby="cta-title">
				<p class="cta-eyebrow">03 / Get started</p>
				<h2 id="cta-title" class="cta-headline">
					Plan the trip you've been <em>threatening</em> to plan.
				</h2>
				<p class="cta-sub">Set up in minutes. Share the link. Let Divvi handle the headcount.</p>
				<a href="/trips/new" class="btn-primary btn-on-dark">Get started, it's free</a>
			</section>
		</article>
	</div>
</MarketingShell>

<style>
	/* Outer wrapper. Keeps MarketingShell dark canvas visible around the paper. */
	.services-page {
		max-width: 1080px;
		margin: 0 auto;
		padding: 1.5rem 1rem 4rem;
	}

	/* "Magazine page": light editorial surface inset on the dark MarketingShell. */
	.paper {
		background: var(--surface-paper);
		border-radius: var(--radius-3xl);
		box-shadow: var(--shadow-paper);
		color: var(--text);
		padding: 2.5rem 1.5rem 3rem;
		display: flex;
		flex-direction: column;
		gap: 4.5rem;
		font-family: 'Plus Jakarta Sans', Helvetica, Arial, sans-serif;
		overflow: hidden;
	}

	/* ----- Hero ----- */
	.hero {
		text-align: center;
		display: flex;
		flex-direction: column;
		align-items: center;
		padding-top: 1rem;
	}

	.eyebrow {
		display: inline-flex;
		align-items: center;
		gap: 0.875rem;
		margin: 0 0 1.5rem;
	}

	.eyebrow-text {
		font-family: 'Fraunces', Georgia, serif;
		font-style: italic;
		font-weight: 400;
		font-size: 0.9375rem;
		letter-spacing: 0;
		color: var(--warm);
	}

	.eyebrow-rule {
		width: 2rem;
		height: 1px;
		background: var(--warm);
		opacity: 0.55;
	}

	.hero-headline {
		font-family: 'Fraunces', Georgia, serif;
		font-weight: 600;
		font-size: clamp(2.25rem, 9vw, 3rem);
		line-height: 1.05;
		letter-spacing: -0.03em;
		color: var(--navy);
		margin: 0 0 1.5rem;
		max-width: 18ch;
	}

	.hero-em {
		font-style: italic;
		font-weight: 500;
		color: var(--slate);
	}

	.hero-sub {
		font-size: 1.0625rem;
		color: var(--text);
		opacity: 0.82;
		max-width: 32rem;
		line-height: 1.7;
		margin: 0 auto 2.25rem;
	}

	.hero-actions {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
		width: 100%;
	}

	/* ----- Buttons ----- */
	.btn-primary {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		padding: 0.95rem 1.75rem;
		font-family: inherit;
		font-size: 1rem;
		font-weight: 600;
		letter-spacing: 0;
		color: #fff;
		background: var(--warm);
		border-radius: var(--radius-2xl);
		text-decoration: none;
		box-shadow: var(--shadow-md);
		transition: background var(--transition-base), transform var(--transition-fast),
			box-shadow var(--transition-base);
		min-width: 100%;
	}

	.btn-primary:hover {
		background: var(--chocolate);
		color: #fff;
		transform: translateY(-1px);
		box-shadow: var(--shadow-lg);
	}

	.btn-primary:focus-visible {
		outline: 2px solid var(--focusRing);
		outline-offset: 3px;
	}

	.btn-on-dark {
		box-shadow: 0 12px 30px -12px rgba(206, 86, 18, 0.55);
	}

	.btn-text {
		font-family: 'Fraunces', Georgia, serif;
		font-style: italic;
		font-weight: 400;
		font-size: 1rem;
		color: var(--slate);
		text-decoration: underline;
		text-underline-offset: 4px;
		text-decoration-thickness: 1px;
		transition: color var(--transition-base);
	}

	.btn-text:hover {
		color: var(--navy);
	}

	.hero-rule {
		width: 100%;
		max-width: 520px;
		margin: 2.5rem auto 0;
		color: var(--slate);
		opacity: 0.18;
	}

	/* ----- Section opener ----- */
	.section-head {
		margin-bottom: 2.5rem;
	}

	.section-num {
		display: inline-flex;
		align-items: center;
		gap: 0.875rem;
		margin: 0 0 0.625rem;
	}

	.section-num-label {
		font-family: 'Fraunces', Georgia, serif;
		font-style: italic;
		font-weight: 400;
		font-size: 0.875rem;
		color: var(--slate);
		letter-spacing: 0;
	}

	.section-num-rule {
		width: 2rem;
		height: 1px;
		background: var(--slate);
		opacity: 0.4;
	}

	.section-title {
		font-family: 'Fraunces', Georgia, serif;
		font-weight: 600;
		font-size: var(--display-lg);
		line-height: 1.1;
		letter-spacing: -0.025em;
		color: var(--navy);
		margin: 0;
		max-width: 22ch;
	}

	.section-dek {
		font-family: 'Plus Jakarta Sans', Helvetica, Arial, sans-serif;
		font-size: 1rem;
		color: var(--text);
		opacity: 0.78;
		line-height: 1.65;
		margin: 0.875rem 0 0;
		max-width: 38rem;
	}

	/* ----- Features ----- */
	.feature-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: 1fr;
		gap: 0;
	}

	.feature-row {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 1.25rem;
		padding: 1.5rem 0;
		border-top: 1px solid var(--border-soft);
		align-items: flex-start;
	}

	.feature-row:last-child {
		border-bottom: 1px solid var(--border-soft);
	}

	.feature-icon {
		width: 40px;
		height: 40px;
		flex-shrink: 0;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		background: rgba(206, 86, 18, 0.08);
		border-radius: var(--radius-md);
		color: var(--warm);
	}

	.feature-icon :global(svg) {
		width: 22px;
		height: 22px;
	}

	.feature-body {
		min-width: 0;
	}

	.feature-title {
		font-family: 'Fraunces', Georgia, serif;
		font-weight: 600;
		font-size: 1.25rem;
		letter-spacing: -0.015em;
		color: var(--navy);
		margin: 0 0 0.375rem;
	}

	.feature-desc {
		font-size: 0.9375rem;
		color: var(--text);
		opacity: 0.78;
		line-height: 1.7;
		margin: 0;
		max-width: 38rem;
	}

	/* ----- How it works ----- */
	.steps-grid {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: 1fr;
		gap: 2.5rem;
	}

	.step {
		position: relative;
		padding-top: 0.25rem;
	}

	.step-num {
		display: block;
		font-family: 'Fraunces', Georgia, serif;
		font-style: italic;
		font-weight: 500;
		font-size: 3.25rem;
		line-height: 1;
		letter-spacing: -0.04em;
		color: var(--warm);
		opacity: 0.18;
		margin-bottom: 0.75rem;
	}

	.step-title {
		font-family: 'Plus Jakarta Sans', Helvetica, Arial, sans-serif;
		font-weight: 600;
		font-size: 1.0625rem;
		color: var(--navy);
		margin: 0 0 0.5rem;
	}

	.step-desc {
		font-size: 0.9375rem;
		color: var(--text);
		opacity: 0.78;
		line-height: 1.65;
		margin: 0;
		max-width: 32rem;
	}

	/* ----- CTA ----- */
	.cta {
		margin: 1rem -1.5rem -3rem;
		padding: 3rem 1.5rem 3.25rem;
		background: var(--navy);
		color: #fff;
		text-align: center;
		display: flex;
		flex-direction: column;
		align-items: center;
		border-bottom-left-radius: var(--radius-3xl);
		border-bottom-right-radius: var(--radius-3xl);
	}

	.cta-eyebrow {
		font-family: 'Fraunces', Georgia, serif;
		font-style: italic;
		font-weight: 400;
		font-size: 0.875rem;
		color: var(--carrot);
		margin: 0 0 0.75rem;
	}

	.cta-headline {
		font-family: 'Fraunces', Georgia, serif;
		font-weight: 600;
		font-size: var(--display-md);
		line-height: 1.15;
		letter-spacing: -0.02em;
		color: #fffbf7;
		margin: 0 0 0.875rem;
		max-width: 22ch;
	}

	.cta-headline em {
		font-style: italic;
		font-weight: 500;
		color: var(--sand);
	}

	.cta-sub {
		font-size: 1rem;
		color: rgba(255, 255, 255, 0.8);
		max-width: 30rem;
		line-height: 1.65;
		margin: 0 auto 2rem;
	}

	.cta .btn-primary {
		min-width: auto;
		padding: 1rem 2.25rem;
	}

	/* ----- Tablet ----- */
	@media (min-width: 768px) {
		.services-page {
			padding: 2.5rem 2rem 5rem;
		}

		.paper {
			padding: 3.5rem 3rem;
			gap: 5.5rem;
		}

		.hero-actions {
			flex-direction: row;
			justify-content: center;
			gap: 1.25rem;
		}

		.btn-primary {
			min-width: auto;
		}

		.feature-list {
			grid-template-columns: repeat(2, minmax(0, 1fr));
			column-gap: 3rem;
			row-gap: 0;
		}

		.feature-row {
			padding: 1.75rem 0;
		}

		.feature-row:nth-last-child(2):nth-child(odd) {
			border-bottom: 1px solid var(--border-soft);
		}

		.steps-grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
			gap: 3rem 2.5rem;
		}

		.cta {
			margin: 1.5rem -3rem -3.5rem;
			padding: 4rem 3rem;
		}
	}

	/* ----- Desktop ----- */
	@media (min-width: 1024px) {
		.services-page {
			padding: 4.5rem 3rem 6rem;
		}

		.paper {
			padding: 5rem 4.5rem;
			gap: 7rem;
		}

		.hero {
			padding-top: 1.5rem;
		}

		.hero-headline {
			font-size: clamp(3.5rem, 6vw, 5.5rem);
			letter-spacing: -0.035em;
			max-width: 16ch;
		}

		.hero-rule {
			margin-top: 3rem;
		}

		.section-head {
			margin-bottom: 3rem;
		}

		.feature-list {
			column-gap: 4rem;
		}

		.feature-row {
			padding: 2rem 0;
		}

		.steps-grid {
			grid-template-columns: repeat(4, minmax(0, 1fr));
			gap: 2.5rem;
		}

		.step-num {
			font-size: 3.75rem;
		}

		.cta {
			margin: 2rem -4.5rem -5rem;
			padding: 5rem 4.5rem 5.25rem;
			border-bottom-left-radius: var(--radius-3xl);
			border-bottom-right-radius: var(--radius-3xl);
		}

		.cta-headline {
			font-size: clamp(2rem, 3vw, 2.75rem);
		}
	}
</style>
