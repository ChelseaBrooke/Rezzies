<script lang="ts">
	import { page } from '$app/stores';
	import AppFrame from '$lib/components/layout/AppFrame.svelte';
	import TripSidebar from './TripSidebar.svelte';
	import type { TripForSidebar } from '$lib/trips/types.js';

	let {
		trip,
		allTrips,
		user = null,
		onInvite,
		showToast,
		children
	}: {
		trip: TripForSidebar & { inviteCode?: string };
		allTrips: { id: string; name: string; checkInDate: Date; checkOutDate: Date }[];
		user?: { id: string; name: string | null; email: string } | null;
		onInvite?: () => void;
		showToast?: (msg: string) => void;
		children: import('svelte').Snippet;
	} = $props();

	let sidebarOpen = $state(false);
	let toastMessage = $state<string | null>(null);

	function openInvite() {
		sidebarOpen = false;
		onInvite?.();
	}

	function showToastLocal(msg: string) {
		toastMessage = msg;
		showToast?.(msg);
		setTimeout(() => (toastMessage = null), 3000);
	}

	const currentPath = $derived($page.url.pathname);
	const tripId = $derived(trip?.id ?? '');

	const mobileTabs = [
		{ href: `/trips/${tripId}`, label: 'Overview', icon: '📊' },
		{ href: `/trips/${tripId}/guests`, label: 'Guests', icon: '👥' },
		{ href: `/trips/${tripId}/rooms`, label: 'Rooms', icon: '🛏️' },
		{ href: `/trips/${tripId}/payments`, label: 'Payments', icon: '💳' },
		{ href: `/trips/${tripId}/itinerary`, label: 'Itinerary', icon: '📋' }
	];

	function isActive(href: string) {
		if (href === `/trips/${tripId}`) return currentPath === href;
		return currentPath.startsWith(href);
	}
</script>

<div class="shell">
	<!-- Desktop: AppFrame wraps sidebar + main (single rounded container) -->
	<div class="desktop-wrap">
		<AppFrame>
			{#snippet sidebar()}
				{#if trip}
					<TripSidebar
						{trip}
						{allTrips}
						{user}
						onInvite={openInvite}
						showToast={showToastLocal}
					/>
				{/if}
			{/snippet}
			{#snippet children()}
				<div class="main-inner">
					{@render children()}
				</div>
			{/snippet}
		</AppFrame>
	</div>

	<!-- Mobile: hamburger + drawer (no AppFrame) -->
	<div class="sidebar-mobile" class:open={sidebarOpen}>
		<div class="drawer-backdrop" onclick={() => (sidebarOpen = false)} role="presentation"></div>
		<div class="drawer-panel">
			{#if trip}
				<TripSidebar
					{trip}
					{allTrips}
					{user}
					onInvite={openInvite}
					showToast={showToastLocal}
				/>
			{/if}
		</div>
	</div>

	<!-- Mobile: main content full width -->
	<main class="main main-mobile">
		<header class="mobile-header">
			<button
				type="button"
				class="hamburger"
				onclick={() => (sidebarOpen = true)}
				aria-label="Open menu"
			>
				<span>☰</span>
			</button>
			<span class="mobile-title">{trip?.name ?? 'Trip'}</span>
		</header>

		<div class="content">
			{@render children()}
		</div>

		<nav class="bottom-nav" aria-label="Primary">
			{#each mobileTabs as tab}
				<a
					href={tab.href}
					class="bottom-nav-item"
					class:active={isActive(tab.href)}
				>
					<span class="bottom-nav-icon">{tab.icon}</span>
					<span class="bottom-nav-label">{tab.label}</span>
				</a>
			{/each}
		</nav>
	</main>

	{#if toastMessage}
		<div class="toast" role="status">{toastMessage}</div>
	{/if}
</div>

<style>
	.shell {
		min-height: 100vh;
		background: #e9f1fb;
		position: relative;
		padding: 0;
	}

	.desktop-wrap {
		display: block;
		width: 100%;
	}

	.main-inner {
		padding: 1.5rem;
		flex: 1;
		min-height: 0;
		overflow-y: auto;
	}

	.sidebar-mobile {
		display: none;
	}

	.main {
		display: none;
		flex: 1;
		flex-direction: column;
		min-width: 0;
		padding-bottom: 4rem;
	}

	.mobile-header {
		display: none;
	}

	.content {
		flex: 1;
		min-width: 0;
		padding: 0;
		width: 100%;
	}

	.bottom-nav {
		display: none;
	}

	.toast {
		position: fixed;
		bottom: 5rem;
		left: 50%;
		transform: translateX(-50%);
		background: var(--text);
		color: white;
		padding: 0.5rem 1rem;
		border-radius: var(--radius-md, 0.5rem);
		font-size: 0.875rem;
		box-shadow: var(--shadow-lg, 0 10px 15px -3px rgba(0,0,0,0.1));
		z-index: 100;
		animation: fadeIn 0.2s ease;
	}

	@keyframes fadeIn {
		from {
			opacity: 0;
			transform: translateX(-50%) translateY(0.5rem);
		}
		to {
			opacity: 1;
			transform: translateX(-50%) translateY(0);
		}
	}

	@media (max-width: 1024px) {
		.desktop-wrap {
			display: none;
		}

		.main {
			display: flex;
		}

		.sidebar-mobile {
			display: block;
			position: fixed;
			inset: 0;
			z-index: 50;
			pointer-events: none;
		}

		.sidebar-mobile.open {
			pointer-events: auto;
		}

		.drawer-backdrop {
			position: absolute;
			inset: 0;
			background: rgba(0, 0, 0, 0.3);
			opacity: 0;
			transition: opacity 0.2s;
		}

		.sidebar-mobile.open .drawer-backdrop {
			opacity: 1;
		}

		.drawer-panel {
			position: absolute;
			left: 0;
			top: 0;
			bottom: 0;
			width: 280px;
			max-width: 85vw;
			background: linear-gradient(to bottom, #cfe4ff 0%, #bbd9ff 100%);
			box-shadow: 4px 0 12px rgba(0, 0, 0, 0.1);
			transform: translateX(-100%);
			transition: transform 0.25s ease;
			overflow-y: auto;
			pointer-events: auto;
		}

		.sidebar-mobile.open .drawer-panel {
			transform: translateX(0);
		}

		.mobile-header {
			display: flex;
			align-items: center;
			gap: 0.75rem;
			padding: 0.75rem 1rem;
			background: white;
			border-bottom: 1px solid var(--border);
			flex-shrink: 0;
		}

		.hamburger {
			width: 2.5rem;
			height: 2.5rem;
			display: flex;
			align-items: center;
			justify-content: center;
			border: none;
			background: transparent;
			border-radius: var(--radius-sm, 0.5rem);
			cursor: pointer;
			font-size: 1.25rem;
			color: var(--text);
		}

		.hamburger:hover {
			background: var(--bg);
		}

		.mobile-title {
			font-size: 1rem;
			font-weight: 600;
			color: var(--text);
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		}

		.bottom-nav {
			display: flex;
			justify-content: space-around;
			align-items: center;
			position: fixed;
			bottom: 0;
			left: 0;
			right: 0;
			height: 3.5rem;
			background: white;
			border-top: 1px solid var(--border);
			z-index: 40;
			padding: 0 0.25rem;
		}

		.bottom-nav-item {
			display: flex;
			flex-direction: column;
			align-items: center;
			justify-content: center;
			gap: 0.125rem;
			padding: 0.375rem 0.5rem;
			text-decoration: none;
			color: var(--muted);
			font-size: 0.625rem;
			font-weight: 500;
			border-radius: var(--radius-sm, 0.5rem);
			min-width: 3rem;
		}

		.bottom-nav-item:hover {
			color: var(--text);
		}

		.bottom-nav-item.active {
			color: var(--primary);
			background: rgba(30, 58, 138, 0.08);
		}

		.bottom-nav-icon {
			font-size: 1.25rem;
			line-height: 1;
		}

		.bottom-nav-label {
			line-height: 1;
		}
	}
</style>
