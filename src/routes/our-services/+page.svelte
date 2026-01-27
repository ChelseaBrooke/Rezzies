<div class="services-page">
	<!-- Hero Section -->
	<section class="services-hero">
		<div class="container">
			<h1>Our Services</h1>
			<p class="hero-subtitle">Everything you need to plan and manage group vacations</p>
		</div>
	</section>

	<!-- Services Grid -->
	<section class="services-content">
		<div class="container">
			<div class="services-grid">
				<div class="service-card card">
					<div class="service-icon">🏠</div>
					<h3>Trip Management</h3>
					<p>Create and manage group vacation trips with ease. Import property details from VRBO or Airbnb, set pricing models, and track reservations all in one place.</p>
				</div>

				<div class="service-card card">
					<div class="service-icon">💰</div>
					<h3>Fair Cost Splitting</h3>
					<p>Choose from multiple pricing models: per room, per person, per bed, or per person per night. Our system automatically calculates what each guest owes.</p>
				</div>

				<div class="service-card card">
					<div class="service-icon">📅</div>
					<h3>Flexible Stays</h3>
					<p>Support for partial stays allows guests to join for part of the trip. The system automatically prorates costs based on stay duration.</p>
				</div>

				<div class="service-card card">
					<div class="service-icon">🔗</div>
					<h3>Easy Sharing</h3>
					<p>Generate unique invite codes for each trip. Guests simply enter the code to access their room selection page - no account required.</p>
				</div>

				<div class="service-card card">
					<div class="service-icon">📊</div>
					<h3>Dashboard & Reports</h3>
					<p>Hosts get a comprehensive dashboard to view all reservations, track payments, and export detailed ledgers for accounting.</p>
				</div>

				<div class="service-card card">
					<div class="service-icon">✨</div>
					<h3>Automatic Import</h3>
					<p>Paste your VRBO or Airbnb listing URL to automatically import property details, photos, pricing, and availability - no manual data entry needed.</p>
				</div>
			</div>
		</div>
	</section>

	<!-- Pricing Models Section -->
	<section class="pricing-models">
		<div class="container">
			<h2 class="section-title">Pricing Models</h2>
			<div class="models-grid">
				<div class="model-card card">
					<h4>Per Room</h4>
					<p>Equal or weighted split per room. Perfect when rooms are similar in size and quality.</p>
				</div>
				<div class="model-card card">
					<h4>Per Person</h4>
					<p>Simple equal split among all guests. Great for groups where everyone stays the full duration.</p>
				</div>
				<div class="model-card card">
					<h4>Per Bed</h4>
					<p>Weighted by bed type (king, queen, twin). Larger beds cost more, ensuring fairness.</p>
				</div>
				<div class="model-card card">
					<h4>Per Person Per Night</h4>
					<p>Most flexible option. Accounts for room quality, bed type, and stay duration. Recommended for most trips.</p>
				</div>
			</div>
		</div>
	</section>

	<!-- CTA Section -->
	<section class="cta">
		<div class="container">
			<div class="cta-content">
				<h2>Ready to Get Started?</h2>
				<p>Start planning your next group vacation today.</p>
				<a href="/trips/new" class="btn btn-primary btn-large">Host a Trip</a>
			</div>
		</div>
	</section>
</div>

<style>
	.services-page {
		width: 100%;
	}

	.services-hero {
		background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-dark) 100%);
		background-image: url('https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=1920&q=80');
		background-size: cover;
		background-position: center;
		position: relative;
		padding: var(--spacing-2xl) 0;
		text-align: center;
		color: white;
	}

	.services-hero::before {
		content: '';
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(37, 99, 235, 0.85);
	}

	.services-hero .container {
		position: relative;
		z-index: 1;
	}

	.services-hero h1 {
		color: white;
		margin-bottom: var(--spacing-md);
	}

	.hero-subtitle {
		font-size: 1.25rem;
		opacity: 0.95;
	}

	.services-content {
		padding: var(--spacing-2xl) 0;
		background: white;
	}

	.services-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
		gap: var(--spacing-lg);
	}

	.service-card {
		text-align: center;
		padding: var(--spacing-xl);
	}

	.service-icon {
		font-size: 3.5rem;
		margin-bottom: var(--spacing-md);
	}

	.service-card h3 {
		margin-bottom: var(--spacing-sm);
		color: var(--color-text);
	}

	.service-card p {
		color: var(--color-text-light);
		line-height: 1.7;
	}

	.pricing-models {
		padding: var(--spacing-2xl) 0;
		background: var(--color-bg-light);
	}

	.section-title {
		text-align: center;
		margin-bottom: var(--spacing-xl);
	}

	.models-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
		gap: var(--spacing-lg);
	}

	.model-card {
		padding: var(--spacing-lg);
		text-align: center;
	}

	.model-card h4 {
		margin-bottom: var(--spacing-sm);
		color: var(--color-primary);
	}

	.model-card p {
		color: var(--color-text-light);
		line-height: 1.7;
		margin: 0;
	}

	.cta {
		padding: var(--spacing-2xl) 0;
		background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-dark) 100%);
		color: white;
	}

	.cta-content {
		text-align: center;
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
		.services-grid,
		.models-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
