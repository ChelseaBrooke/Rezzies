<script lang="ts">
	import { setContext } from 'svelte';
	import { page } from '$app/stores';
	import AppFrame from '$lib/components/layout/AppFrame.svelte';
	import TripSidebar from './TripSidebar.svelte';
	import TripSwitcher from './TripSwitcher.svelte';
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
		allTrips: { id: string; name: string; checkInDate: Date; checkOutDate: Date; isPublished?: boolean }[];
		user?: { id: string; name: string | null; email: string; avatarUrl?: string | null } | null;
		onInvite?: () => void;
		showToast?: (msg: string) => void;
		children?: import('svelte').Snippet;
	} = $props();

	const childrenFn = $derived(children != null && typeof children === 'function' ? children : undefined);

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

	setContext('tripQuickActions', {
		onInvite: openInvite,
		showToast: showToastLocal
	});

	const currentPath = $derived($page.url.pathname);
	const tripId = $derived(trip?.id ?? '');
	const isDashboardRoute = $derived(
		currentPath === `/trips/${tripId}` ||
		currentPath === `/trips/${tripId}/host` ||
		currentPath === `/trips/${tripId}/guest`
	);

	const tripOptions = $derived(
		allTrips.map((t) => ({
			id: t.id,
			name: t.name,
			checkInDate: t.checkInDate,
			checkOutDate: t.checkOutDate,
			isPublished: t.isPublished ?? false
		}))
	);

	const mobileTabs = [
		{ href: `/trips/${tripId}`, label: 'Dashboard', icon: '📊' },
		{ href: `/trips/${tripId}/guests`, label: 'Guests', icon: '👥' },
		{ href: `/trips/${tripId}/rooms`, label: 'Rooms', icon: '🛏️' },
		{ href: `/trips/${tripId}/activities`, label: 'Activities', icon: '🎯' },
		{ href: `/trips/${tripId}/payments`, label: 'Payments', icon: '💳' },
		{ href: `/trips/${tripId}/itinerary`, label: 'Itinerary', icon: '📋' },
		{ href: `/trips/${tripId}/polls`, label: 'Polls', icon: '🗳️' }
	];

	function isActive(href: string) {
		if (href === `/trips/${tripId}`) return currentPath === href;
		return currentPath.startsWith(href);
	}

	function initials(name: string | null | undefined, email?: string): string {
		if (name?.trim()) {
			const parts = name.trim().split(/\s+/);
			return parts.length >= 2
				? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
				: name.slice(0, 2).toUpperCase();
		}
		if (email) return email.slice(0, 2).toUpperCase();
		return '?';
	}
</script>

	<div class="shell" class:dashboard-mode={isDashboardRoute}>
	<!-- Desktop: AppFrame wraps sidebar + main (single rounded container) -->
	<div class="desktop-wrap" class:dashboard-mode={isDashboardRoute}>
		{#if isDashboardRoute}
			<!-- Dashboard: Full-width, no container -->
			<div class="dashboard-full-width">
				{#if childrenFn}
					{@render childrenFn()}
				{/if}
			</div>
		{:else}
			<!-- Other routes: Use AppFrame container -->
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
					<div class="trip-main-wrap">
						<header class="content-pane-top" aria-label="Trip and actions">
							<div class="trip-top-switcher">
								{#if trip}
									<TripSwitcher
										currentTripId={trip.id}
										currentTripName={trip.name}
										trips={tripOptions}
										tripsListHref="/trips"
									/>
								{/if}
							</div>
							<div class="trip-top-bar" aria-label="Trip actions">
								<a href="/trips/{tripId}/notifications" class="trip-notification-bell" aria-label="Notifications" title="Notifications">
									<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
								</a>
								<a href="/profile" class="trip-top-avatar" aria-label="Go to my profile" title="My profile">
									{#if user?.avatarUrl}
										<img src={user.avatarUrl} alt="" class="trip-top-avatar-img" />
									{:else}
										<span class="trip-top-avatar-inner">{user ? initials(user.name, user.email) : '?'}</span>
									{/if}
								</a>
							</div>
						</header>
						<div class="main-inner">
							{#if childrenFn}
								{@render childrenFn()}
							{/if}
						</div>
					</div>
				{/snippet}
			</AppFrame>
		{/if}
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
			<a href="/trips/{tripId}/notifications" class="mobile-notification-bell" aria-label="Notifications" title="Notifications">
				<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
			</a>
			<a href="/profile" class="mobile-top-avatar" aria-label="My profile" title="My profile">
				{#if user?.avatarUrl}
					<img src={user.avatarUrl} alt="" class="trip-top-avatar-img" />
				{:else}
					<span class="trip-top-avatar-inner">{user ? initials(user.name, user.email) : '?'}</span>
				{/if}
			</a>
		</header>

		<div class="content">
			{#if childrenFn}
				{@render childrenFn()}
			{/if}
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
		background:
			radial-gradient(ellipse 120% 80% at 70% 20%, rgba(255, 255, 255, 0.08) 0%, transparent 50%),
			radial-gradient(ellipse 100% 60% at 20% 90%, rgba(0, 0, 0, 0.12) 0%, transparent 55%),
			linear-gradient(165deg, #8B351E 0%, #A03D24 18%, var(--primary) 45%, rgba(191, 78, 48, 0.95) 75%, rgba(191, 78, 48, 0.88) 100%);
		position: relative;
		padding: 0;
	}

	.shell.dashboard-mode {
		background: var(--bg);
	}

	.desktop-wrap.dashboard-mode {
		background: var(--bg);
	}

	.dashboard-full-width {
		width: 100%;
		height: 100vh;
		overflow-y: auto;
		background: var(--bg);
	}

	.desktop-wrap {
		display: block;
		width: 100%;
	}

	.trip-main-wrap {
		display: flex;
		flex-direction: column;
		flex: 1;
		min-height: 0;
		min-width: 0;
	}

	.content-pane-top {
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		min-height: 0;
		padding: 0.35rem 1rem;
		border-bottom: 1px solid var(--border);
	}

	.trip-top-switcher {
		display: flex;
		align-items: center;
		min-width: 0;
	}
	.trip-top-switcher :global(.switcher) {
		min-width: 10rem;
		max-width: 16rem;
	}
	.trip-top-switcher :global(.switcher-trigger) {
		padding: 0.35rem 0.6rem;
		font-size: 0.8125rem;
	}

	.trip-top-bar {
		flex-shrink: 0;
		display: flex;
		align-items: center;
		gap: 0.25rem;
		min-height: 2.25rem;
		min-width: 0;
	}

	.trip-notification-bell {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 2.5rem;
		height: 2.5rem;
		border-radius: var(--radius-md);
		color: var(--text);
		transition: background var(--transition-fast), color var(--transition-fast);
	}
	.trip-notification-bell:hover {
		background: var(--surface2);
		color: var(--primary);
	}

	.trip-top-avatar {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 2.5rem;
		height: 2.5rem;
		border-radius: 50%;
		background: var(--surface2);
		color: var(--text);
		font-size: 0.8125rem;
		font-weight: 600;
		text-decoration: none;
		border: 1px solid var(--border);
		transition: background var(--transition-fast), color var(--transition-fast);
	}
	.trip-top-avatar:hover {
		background: var(--focusRing);
		color: var(--primary);
	}
	.trip-top-avatar-inner {
		display: block;
		line-height: 1;
	}
	.trip-top-avatar-img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		border-radius: inherit;
		display: block;
	}

	.main-inner {
		padding: 0.75rem 1.5rem 1.5rem;
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
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
		background: white;
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
		border-radius: var(--radius-md);
		font-size: 0.875rem;
		box-shadow: var(--shadow-lg);
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
			width: 240px;
			max-width: 85vw;
			background: var(--surface);
			border-right: 1px solid var(--border);
			box-shadow: var(--shadow-lg);
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
			background: var(--surface2);
		}

		.mobile-title {
			font-size: 1rem;
			font-weight: 600;
			color: var(--text);
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		}
		.mobile-header .mobile-title {
			flex: 1;
		}

		.mobile-notification-bell {
			display: inline-flex;
			align-items: center;
			justify-content: center;
			width: 2.5rem;
			height: 2.5rem;
			border-radius: var(--radius-md);
			color: var(--text);
		}
		.mobile-notification-bell:hover {
			background: var(--surface2);
			color: var(--primary);
		}

		.mobile-top-avatar {
			display: inline-flex;
			align-items: center;
			justify-content: center;
			width: 2.5rem;
			height: 2.5rem;
			border-radius: 50%;
			background: var(--surface2);
			color: var(--text);
			font-size: 0.8125rem;
			font-weight: 600;
			text-decoration: none;
			border: 1px solid var(--border);
		}
		.mobile-top-avatar:hover {
			background: var(--focusRing);
			color: var(--primary);
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
			background: var(--surface2);
			border-bottom: 2px solid var(--primary);
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
