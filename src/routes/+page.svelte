<script lang="ts">
	import { goto } from '$app/navigation';
	import templogo1 from '$lib/assets/images/templogo1.png';
</script>

<div class="home-page">
	<!-- Background Image -->
	<div class="background-image">
		<img src="/images/homepage-bg.jpg" alt="Background" class="bg-img" />
		<div class="background-overlay"></div>
	</div>

	<!-- Header -->
	<header class="home-header">
		<div class="header-left">
			<a href="/" class="logo-link">
				<span class="logo-text">rezzies</span>
				<img src={templogo1} alt="" class="logo-img" />
			</a>
			<span class="tagline">for the host that does the most</span>
		</div>
		
		<div class="header-right">
			<button class="header-btn">
				<span class="globe-icon">🌐</span>
				<span>US</span>
			</button>
			<a href="/our-services" class="header-btn">About Us</a>
			<a href="/trips" class="header-btn">My Trips</a>
			<button class="header-btn">
				<span class="bell-icon">🔔</span>
				<span>Notifications</span>
			</button>
			<button class="avatar-btn">
				<div class="avatar-circle"></div>
			</button>
		</div>
	</header>

	<!-- Main Content -->
	<main class="home-main">
		<div class="main-content">
			<div class="main-actions">
				<a href="/trips/new" class="action-btn primary">Host a Trip</a>
				<a href="/trips" class="action-btn secondary">Find a Trip</a>
				<a href="/our-services" class="action-btn secondary">Learn More</a>
			</div>
		</div>
	</main>
</div>

<style>
	.home-page {
		position: relative;
		min-height: 100vh;
		width: 100%;
		overflow: hidden;
		color: white;
		margin: 0;
		padding: 0;
	}

	.background-image {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		z-index: 0;
		overflow: hidden;
	}

	.bg-img {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
		object-position: center;
		z-index: 0;
	}

	/* Fallback gradient - shows behind image */
	.background-image::before {
		content: '';
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
		z-index: -1;
	}

	.background-overlay {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.3);
		z-index: 1;
	}

	/* Header */
	.home-header {
		position: relative;
		z-index: 10;
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1.5rem 2rem;
		background: rgba(0, 0, 0, 0.2);
		backdrop-filter: blur(10px);
	}

	.header-left {
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	.logo-link {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		text-decoration: none;
		color: white;
		font-size: 1.5rem;
		font-weight: 600;
	}

	.logo-img {
		display: block;
		height: 2rem;
		width: auto;
		max-width: 4rem;
		object-fit: contain;
		flex-shrink: 0;
	}

	.logo-text {
		text-transform: lowercase;
		letter-spacing: -0.5px;
	}

	.tagline {
		font-size: 0.875rem;
		color: rgba(255, 255, 255, 0.8);
		font-weight: 300;
		margin-left: 0.5rem;
	}

	.header-right {
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	.header-btn {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		background: transparent;
		border: none;
		color: white;
		font-size: 0.9rem;
		padding: 0.5rem 1rem;
		border-radius: 6px;
		cursor: pointer;
		transition: background 0.2s;
		text-decoration: none;
		font-family: inherit;
	}

	.header-btn:hover {
		background: rgba(255, 255, 255, 0.1);
	}

	.globe-icon,
	.bell-icon {
		font-size: 1rem;
	}

	.avatar-btn {
		background: transparent;
		border: none;
		cursor: pointer;
		padding: 0;
	}

	.avatar-circle {
		width: 40px;
		height: 40px;
		border-radius: 50%;
		background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
		border: 2px solid rgba(255, 255, 255, 0.3);
	}

	/* Main Content */
	.home-main {
		position: relative;
		z-index: 5;
		display: flex;
		align-items: flex-end;
		justify-content: center;
		min-height: calc(100vh - 80px);
		padding: 2rem;
		padding-bottom: 20vh; /* Move content down 20% */
	}

	.main-content {
		text-align: center;
		max-width: 800px;
	}

	.main-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 1.5rem;
		justify-content: center;
		margin-top: 2rem;
	}

	.action-btn {
		padding: 0.875rem 2rem;
		border-radius: 8px;
		font-size: 1rem;
		font-weight: 600;
		text-decoration: none;
		transition: all 0.2s;
		border: none;
		cursor: pointer;
		display: inline-flex;
		align-items: center;
		justify-content: center;
	}

	.action-btn.primary {
		background: white;
		color: #1a1a2e;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
	}

	.action-btn.primary:hover {
		transform: translateY(-2px);
		box-shadow: 0 6px 16px rgba(0, 0, 0, 0.4);
	}

	.action-btn.secondary {
		background: rgba(255, 255, 255, 0.15);
		color: white;
		backdrop-filter: blur(10px);
		border: 1px solid rgba(255, 255, 255, 0.2);
	}

	.action-btn.secondary:hover {
		background: rgba(255, 255, 255, 0.25);
		transform: translateY(-2px);
	}

	@media (max-width: 768px) {
		.home-header {
			padding: 1rem;
			flex-wrap: wrap;
		}

		.header-left {
			flex-wrap: wrap;
		}

		.tagline {
			font-size: 0.75rem;
			margin-left: 0;
		}

		.header-right {
			gap: 0.5rem;
		}

		.header-btn span:not(.globe-icon):not(.bell-icon) {
			display: none;
		}

		.main-title {
			font-size: 2.5rem;
		}

		.main-address {
			font-size: 1rem;
		}

		.main-actions {
			flex-direction: column;
		}

		.action-btn {
			width: 100%;
		}
	}
</style>
