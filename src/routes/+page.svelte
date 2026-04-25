<script lang="ts">
	import RezziesLogo from '$lib/components/RezziesLogo.svelte';
	import NotificationTray from '$lib/components/NotificationTray.svelte';
	import AvatarMenu from '$lib/components/AvatarMenu.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

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
			<RezziesLogo href="/" class="logo-link" />
		</div>
		
		<div class="header-right">
			{#if data?.user}
				<a href="/trips" class="header-btn">My Trips</a>
				<div class="header-bell-wrap">
					<NotificationTray />
				</div>
				<AvatarMenu user={data.user} class="header-avatar" />
			{:else}
				<a href="/login" class="header-btn">Log in</a>
				<a href="/signup" class="header-btn header-btn-primary">Sign up</a>
			{/if}
		</div>
	</header>

	<!-- Main Content: anchored bottom-left so the landscape stays visible -->
	<main class="home-main">
		<div class="hero-block">
			<div class="hero-text">
				<h1 class="hero-headline">Trips that actually get organized</h1>
				<p class="hero-subheader">when <em class="hero-em">price</em> depends on <em class="hero-em">headcount</em>, but <em class="hero-em">headcount</em> depends on <em class="hero-em">price</em>, you can depend on <span class="hero-divvi">divvi</span></p>
			</div>
			<div class="main-actions">
				<a href="/trips/new" class="action-btn primary">Host a Trip</a>
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

	/* Fallback gradient - navy tint behind image */
	.background-image::before {
		content: '';
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: linear-gradient(135deg, #1d4d4e 0%, #2F7778 50%, #1d4d4e 100%);
		z-index: -1;
	}

	.background-overlay {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		/* Bottom-heavy gradient so the landscape stays visible; text sits in the dark band */
		background: linear-gradient(
			to top,
			rgba(10, 18, 22, 0.88) 0%,
			rgba(10, 18, 22, 0.38) 32%,
			rgba(10, 18, 22, 0.05) 58%,
			transparent 100%
		);
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
		background: rgba(10, 18, 22, 0.22);
		backdrop-filter: blur(10px);
	}

	.header-left {
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	.logo-link {
		color: white;
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

	.header-btn-primary {
		background: var(--warm);
		color: white;
	}
	.header-btn-primary:hover {
		background: var(--chocolate);
	}

	.header-bell-wrap {
		display: inline-flex;
	}
	.header-bell-wrap :global(.tray-trigger) {
		color: white;
	}

	.header-avatar :global(.avatar-trigger) {
		border-color: rgba(255, 255, 255, 0.3);
	}

	/* Main Content: centered blurry box, shifted down 40% */
	.home-main {
		position: relative;
		z-index: 5;
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: calc(100vh - 80px);
		padding: 2rem;
		padding-top: 46vh;
	}

	.hero-block {
		text-align: center;
		max-width: 1280px;
		padding: 1.5rem 2.5rem;
		background: rgba(10, 18, 22, 0.1);
		backdrop-filter: blur(10px);
		-webkit-backdrop-filter: blur(10px);
		border-radius: 12px;
	}

	.hero-text {
		max-width: 760px;
		margin: 0 auto;
	}

	.hero-headline {
		margin: 0 0 0.75rem 0;
		padding-bottom: 0.75rem;
		border-bottom: 1px solid rgba(255, 255, 255, 0.35);
		font-family: 'Fraunces', Georgia, serif;
		font-size: clamp(1.875rem, 4.5vw, 2.875rem);
		font-weight: 600;
		line-height: 1.25;
		letter-spacing: -0.02em;
		color: #FFFBF7;
		text-shadow: 0 1px 8px rgba(10, 18, 22, 0.45);
	}

	.hero-subheader .hero-divvi {
		color: var(--carrot);
		font-weight: 800;
	}

	.hero-subheader .hero-em {
		font-style: italic;
		font-weight: inherit;
	}

	.hero-subheader {
		margin: 0 0 1.75rem 0;
		font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
		font-size: 0.9375rem;
		font-weight: 300;
		line-height: 1.55;
		letter-spacing: 0.02em;
		color: rgba(255, 255, 255, 0.88);
		text-shadow: 0 1px 4px rgba(10, 18, 22, 0.3);
	}

	.main-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 1rem;
		justify-content: center;
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
		background: var(--slate);
		color: white;
		box-shadow: var(--shadow-md);
	}

	.action-btn.primary:hover {
		background: var(--primaryHover);
		transform: translateY(-2px);
		box-shadow: var(--shadow-lg);
	}

	.action-btn.secondary {
		background: rgba(47, 119, 120, 0.2);
		color: white;
		backdrop-filter: blur(10px);
		border: 1px solid rgba(255, 255, 255, 0.25);
	}

	.action-btn.secondary:hover {
		background: rgba(47, 119, 120, 0.35);
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

		.header-right {
			gap: 0.5rem;
		}

		.header-btn span:not(.globe-icon):not(.bell-icon) {
			display: none;
		}

		.main-actions {
			flex-direction: column;
		}

		.action-btn {
			width: 100%;
		}
	}
</style>
