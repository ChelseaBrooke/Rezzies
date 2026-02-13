<script lang="ts">
	import MarketingShell from '$lib/components/MarketingShell.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<MarketingShell user={data?.user}>
	<div class="marketing-container">
		<section class="marketing-card services-hero-card">
			<h1 class="marketing-page-title">Our Services</h1>
			<p class="marketing-page-subtitle">Everything you need to plan and manage group trips</p>
			<p class="hero-tagline">When price depends on headcount, but headcount depends on price, you can depend on divvi.</p>
		</section>

		<section class="marketing-card">
			<h2 class="section-heading">What we offer</h2>
			<div class="services-grid">
				<div class="service-item">
					<div class="service-icon">🏠</div>
					<h3>Trip Management</h3>
					<p>Create and manage group trips with ease. Import property details from VRBO or Airbnb, set pricing models, and track reservations all in one place.</p>
				</div>
				<div class="service-item">
					<div class="service-icon">💰</div>
					<h3>Fair Cost Splitting</h3>
					<p>Choose from multiple pricing models: per room, per person, per bed, or per person per night. Our system automatically calculates what each guest owes.</p>
				</div>
				<div class="service-item">
					<div class="service-icon">📅</div>
					<h3>Flexible Stays</h3>
					<p>Support for partial stays allows guests to join for part of the trip. The system automatically prorates costs based on stay duration.</p>
				</div>
				<div class="service-item">
					<div class="service-icon">🔗</div>
					<h3>Easy Sharing</h3>
					<p>Generate unique invite codes for each trip. Guests simply enter the code to access their room selection page—no account required.</p>
				</div>
				<div class="service-item">
					<div class="service-icon">📊</div>
					<h3>Dashboard & Reports</h3>
					<p>Hosts get a comprehensive dashboard to view all reservations, track payments, and export detailed ledgers for accounting.</p>
				</div>
				<div class="service-item">
					<div class="service-icon">✨</div>
					<h3>Automatic Import</h3>
					<p>Paste your VRBO or Airbnb listing URL to automatically import property details, photos, pricing, and availability—no manual data entry needed.</p>
				</div>
			</div>
		</section>

		<section class="marketing-card cta-card">
			<h2 class="section-heading">Ready to get started?</h2>
			<p class="cta-text">Start planning your next group trip today.</p>
			<a href="/trips/new" class="cta-btn">Host a Trip</a>
		</section>
	</div>
</MarketingShell>

<style>
	.hero-tagline {
		margin-top: 1rem;
		font-size: 1.0625rem;
		font-style: italic;
		color: rgba(255, 255, 255, 0.85);
		max-width: 32rem;
		line-height: 1.6;
	}

	.section-heading {
		font-family: 'Fraunces', Georgia, serif;
		font-size: 1.5rem;
		font-weight: 600;
		color: #fffbf7;
		margin: 0 0 1.5rem 0;
		text-align: center;
	}

	.services-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
		gap: 1.5rem;
	}

	.service-item {
		text-align: center;
		padding: 0.5rem 0;
	}

	.service-icon {
		font-size: 2.5rem;
		margin-bottom: 0.75rem;
	}

	.service-item h3 {
		font-size: 1.125rem;
		font-weight: 600;
		color: #fffbf7;
		margin: 0 0 0.5rem 0;
	}

	.service-item p {
		font-size: 0.9375rem;
		color: rgba(255, 255, 255, 0.85);
		line-height: 1.6;
		margin: 0;
	}

	.cta-card {
		text-align: center;
	}

	.cta-text {
		font-size: 1.125rem;
		margin-bottom: 1.5rem;
		color: rgba(255, 255, 255, 0.9);
	}

	.cta-btn {
		display: inline-block;
		padding: 0.875rem 2rem;
		font-size: 1rem;
		font-weight: 600;
		color: white;
		background: var(--copper, #bf4e30);
		border-radius: 8px;
		text-decoration: none;
		transition: background 0.2s;
	}

	.cta-btn:hover {
		background: var(--primaryHover, #a03d24);
	}

	@media (max-width: 768px) {
		.services-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
