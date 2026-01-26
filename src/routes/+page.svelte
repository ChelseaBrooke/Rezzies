<script lang="ts">
	import { goto } from '$app/navigation';
</script>

<div class="home-page">
	<!-- Hero Section -->
	<section class="hero">
		<div class="hero-background">
			<div class="hero-overlay"></div>
		</div>
		<div class="hero-content">
			<div class="container">
				<h1 class="hero-title">Split Your Vacation Costs Fairly</h1>
				<p class="hero-subtitle">
					No more spreadsheets or group chat confusion. Rezzies makes it easy to fairly divide vacation rental costs among your group.
				</p>
				<div class="hero-actions">
					<a href="/host-vacation" class="btn btn-primary btn-large">Host a Vacation</a>
					<a href="/find-vacation" class="btn btn-secondary btn-large">Find a Vacation</a>
				</div>
			</div>
		</div>
	</section>

	<!-- Features Section -->
	<section class="features">
		<div class="container">
			<h2 class="section-title">How It Works</h2>
			<div class="features-grid">
				<div class="feature-card card">
					<div class="feature-icon">🏠</div>
					<h3>Host Sets Up Trip</h3>
					<p>Import your VRBO or Airbnb listing, set dates, and choose how costs are split (per room, per person, per bed, or per person per night).</p>
				</div>
				<div class="feature-card card">
					<div class="feature-icon">👥</div>
					<h3>Guests Reserve Rooms</h3>
					<p>Guests use a simple invite link to view available rooms and beds, then reserve their preferred accommodations.</p>
				</div>
				<div class="feature-card card">
					<div class="feature-icon">💰</div>
					<h3>Automatic Cost Calculation</h3>
					<p>Rezzies automatically calculates what each guest owes based on their room choice, stay duration, and your pricing model.</p>
				</div>
				<div class="feature-card card">
					<div class="feature-icon">📊</div>
					<h3>Track Everything</h3>
					<p>Hosts get a complete dashboard to view reservations, track payments, and export a detailed ledger.</p>
				</div>
			</div>
		</div>
	</section>

	<!-- CTA Section -->
	<section class="cta">
		<div class="container">
			<div class="cta-content">
				<h2>Ready to Plan Your Next Group Vacation?</h2>
				<p>Join hosts who are making group travel planning stress-free and fair.</p>
				<a href="/host-vacation" class="btn btn-primary btn-large">Get Started</a>
			</div>
		</div>
	</section>
</div>

<style>
	.home-page {
		width: 100%;
	}

	/* Hero Section */
	.hero {
		position: relative;
		min-height: 600px;
		display: flex;
		align-items: center;
		justify-content: center;
		overflow: hidden;
	}

	.hero-background {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
		background-image: url('https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1920&q=80');
		background-size: cover;
		background-position: center;
	}

	.hero-overlay {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: linear-gradient(135deg, rgba(37, 99, 235, 0.8) 0%, rgba(29, 78, 216, 0.9) 100%);
	}

	.hero-content {
		position: relative;
		z-index: 1;
		width: 100%;
		padding: var(--spacing-2xl) var(--spacing-md);
		text-align: center;
	}

	.hero-title {
		font-size: 3.5rem;
		font-weight: 700;
		color: white;
		margin-bottom: var(--spacing-md);
		text-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
	}

	.hero-subtitle {
		font-size: 1.25rem;
		color: rgba(255, 255, 255, 0.95);
		max-width: 700px;
		margin: 0 auto var(--spacing-xl);
		line-height: 1.8;
	}

	.hero-actions {
		display: flex;
		gap: var(--spacing-md);
		justify-content: center;
		flex-wrap: wrap;
	}

	/* Features Section */
	.features {
		padding: var(--spacing-2xl) 0;
		background: white;
	}

	.section-title {
		text-align: center;
		margin-bottom: var(--spacing-xl);
		color: var(--color-text);
	}

	.features-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
		gap: var(--spacing-lg);
		margin-top: var(--spacing-xl);
	}

	.feature-card {
		text-align: center;
		padding: var(--spacing-xl);
	}

	.feature-icon {
		font-size: 3rem;
		margin-bottom: var(--spacing-md);
	}

	.feature-card h3 {
		margin-bottom: var(--spacing-sm);
		color: var(--color-text);
	}

	.feature-card p {
		color: var(--color-text-light);
		line-height: 1.7;
	}

	/* CTA Section */
	.cta {
		padding: var(--spacing-2xl) 0;
		background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-dark) 100%);
		color: white;
	}

	.cta-content {
		text-align: center;
		max-width: 600px;
		margin: 0 auto;
	}

	.cta-content h2 {
		color: white;
		margin-bottom: var(--spacing-md);
	}

	.cta-content p {
		font-size: 1.125rem;
		margin-bottom: var(--spacing-xl);
		opacity: 0.95;
	}

	@media (max-width: 768px) {
		.hero-title {
			font-size: 2.5rem;
		}

		.hero-subtitle {
			font-size: 1.125rem;
		}

		.features-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
