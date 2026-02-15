<script lang="ts">
	import type { Snippet } from 'svelte';
	import RezziesLogo from '$lib/components/RezziesLogo.svelte';
	import NotificationTray from '$lib/components/NotificationTray.svelte';
	import AvatarMenu from '$lib/components/AvatarMenu.svelte';

	let { user, children }: { user?: { id?: string; name?: string | null; email?: string; avatarUrl?: string | null } | null; children?: Snippet } = $props();
</script>

<div class="marketing-shell">
	<div class="marketing-bg">
		<img src="/images/homepage-bg.jpg" alt="" class="marketing-bg-img" />
		<div class="marketing-bg-overlay"></div>
	</div>

	<header class="marketing-header">
		<div class="marketing-header-left">
			<RezziesLogo href="/" class="marketing-logo" />
		</div>
		<div class="marketing-header-right">
			{#if user}
				<a href="/trips" class="marketing-header-btn">My Trips</a>
				<div class="marketing-msg-bell">
					<a href="/messages" class="marketing-icon-btn" title="Messages" aria-label="Messages">
						<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719"/></svg>
					</a>
					<div class="marketing-bell-wrap">
						<NotificationTray />
					</div>
				</div>
				<AvatarMenu user={user} class="marketing-avatar" />
			{:else}
				<a href="/login" class="marketing-header-btn">Log in</a>
				<a href="/signup" class="marketing-header-btn marketing-header-btn-primary">Sign up</a>
			{/if}
		</div>
	</header>

	<main class="marketing-main">
		{#if children != null && typeof children === 'function'}
			{@render children()}
		{/if}
	</main>
</div>

<style>
	.marketing-shell {
		position: relative;
		min-height: 100vh;
		width: 100%;
		overflow-x: hidden;
		color: white;
	}

	.marketing-bg {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		z-index: 0;
		overflow: hidden;
	}
	.marketing-bg-img {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
		object-position: center;
	}
	.marketing-bg::before {
		content: '';
		position: absolute;
		inset: 0;
		background: linear-gradient(135deg, #001b2e 0%, #294c60 50%, #001b2e 100%);
		z-index: -1;
	}
	.marketing-bg-overlay {
		position: absolute;
		inset: 0;
		background: linear-gradient(
			to top,
			rgba(0, 27, 46, 0.92) 0%,
			rgba(0, 27, 46, 0.5) 35%,
			rgba(0, 27, 46, 0.15) 60%,
			transparent 100%
		);
		z-index: 1;
	}

	.marketing-header {
		position: relative;
		z-index: 10;
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1.5rem 2rem;
		background: rgba(0, 27, 46, 0.25);
		backdrop-filter: blur(10px);
	}
	.marketing-header-left,
	.marketing-header-right {
		display: flex;
		align-items: center;
		gap: 1rem;
	}
	.marketing-logo {
		color: white;
	}
	.marketing-header-btn {
		padding: 0.5rem 1rem;
		border-radius: 6px;
		font-size: 0.9rem;
		font-weight: 500;
		text-decoration: none;
		color: white;
		background: transparent;
		transition: background 0.2s;
	}
	.marketing-header-btn:hover {
		background: rgba(255, 255, 255, 0.1);
	}
	.marketing-header-btn-primary {
		background: var(--copper, #bf4e30);
	}
	.marketing-header-btn-primary:hover {
		background: var(--primaryHover, #a03d24);
	}
	.marketing-icon-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 40px;
		height: 40px;
		border-radius: 6px;
		color: white;
		text-decoration: none;
		transition: background 0.2s;
	}
	.marketing-icon-btn:hover {
		background: rgba(255, 255, 255, 0.1);
	}
	.marketing-msg-bell {
		display: flex;
		align-items: center;
		gap: 0.125rem;
	}
	.marketing-bell-wrap {
		display: inline-flex;
	}
	.marketing-bell-wrap :global(.tray-trigger) {
		color: white;
	}
	.marketing-avatar :global(.avatar-trigger) {
		border-color: rgba(255, 255, 255, 0.3);
	}

	.marketing-main {
		position: relative;
		z-index: 5;
		min-height: calc(100vh - 80px);
		padding: 2rem;
		overflow-y: auto;
	}

	/* Shared content styles for marketing pages (used by our-services, trips, find-vacation) */
	.marketing-main :global(.marketing-container) {
		max-width: 1200px;
		margin: 0 auto;
	}
	.marketing-main :global(.marketing-card) {
		background: rgba(0, 27, 46, 0.2);
		backdrop-filter: blur(12px);
		-webkit-backdrop-filter: blur(12px);
		border-radius: 12px;
		border: 1px solid rgba(255, 255, 255, 0.1);
		padding: 2rem;
		margin-bottom: 1.5rem;
	}
	.marketing-main :global(.marketing-card h1),
	.marketing-main :global(.marketing-card h2),
	.marketing-main :global(.marketing-card h3),
	.marketing-main :global(.marketing-card h4) {
		color: #fffbf7;
	}
	.marketing-main :global(.marketing-card p),
	.marketing-main :global(.marketing-card label) {
		color: rgba(255, 255, 255, 0.9);
	}
	.marketing-main :global(.marketing-page-title) {
		font-family: 'Fraunces', Georgia, serif;
		font-size: clamp(1.75rem, 4vw, 2.5rem);
		font-weight: 600;
		color: #fffbf7;
		margin: 0 0 0.5rem 0;
	}
	.marketing-main :global(.marketing-page-subtitle) {
		font-size: 1.125rem;
		color: rgba(255, 255, 255, 0.85);
		margin: 0 0 2rem 0;
	}
</style>
