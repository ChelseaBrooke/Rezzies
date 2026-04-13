<script lang="ts">
	import type { Snippet } from 'svelte';
	import { setContext } from 'svelte';
	import { page } from '$app/stores';
	import { afterNavigate } from '$app/navigation';
	import { browser } from '$app/environment';
	import divviLogo from '$lib/assets/images/divvi logo.png';
	import NotificationTray from '$lib/components/NotificationTray.svelte';
	import AvatarMenu from '$lib/components/AvatarMenu.svelte';
	import DashboardModeSelector from '$lib/components/trips/dashboard/DashboardModeSelector.svelte';
	import OnboardingTooltip from '$lib/components/ui/OnboardingTooltip.svelte';
	import { getTooltip } from '$lib/config/onboardingTooltips.js';
	import { dashboardModeByTripId } from '$lib/stores/dashboardMode.js';
	import type { DashboardMode } from '$lib/stores/dashboardMode.js';

	interface Props {
		tripId: string;
		user?: { id: string; name: string | null; email: string; avatarUrl?: string | null } | null;
		children?: Snippet;
		onInvite?: () => void;
		showToast?: (msg: string) => void;
		showGuestsTab?: boolean;
		pollsBadgeCount?: number;
		tripLockedForRecap?: boolean;
		/** Trip dates for dashboard mode pill (Planning/Vacation/Recap) */
		checkInDate?: Date | string | null;
		checkOutDate?: Date | string | null;
		/** Add-on flags — when false the corresponding nav item is hidden */
		activitiesEnabled?: boolean;
		gamesEnabled?: boolean;
		isHost?: boolean;
		/** Invite email: anonymous limited preview on trip dashboard */
		invitePreviewMode?: boolean;
		inviteToken?: string | null;
	}

	let {
		tripId,
		user,
		children,
		onInvite,
		showToast,
		showGuestsTab = true,
		pollsBadgeCount = 0,
		tripLockedForRecap = false,
		checkInDate = null,
		checkOutDate = null,
		activitiesEnabled = true,
		gamesEnabled = true,
		isHost = false,
		invitePreviewMode = false,
		inviteToken = null
	}: Props = $props();

	const modeSelectorTip = $derived(getTooltip(isHost ? 'host_mode_selector' : 'guest_mode_selector'));

	const modeFromDate = $derived.by((): DashboardMode => {
		const checkIn = checkInDate ? new Date(checkInDate) : null;
		const checkOut = checkOutDate ? new Date(checkOutDate) : null;
		if (!checkIn || !checkOut) return 'planning';
		const today = new Date();
		today.setHours(0, 0, 0, 0);
		const start = new Date(checkIn);
		start.setHours(0, 0, 0, 0);
		const end = new Date(checkOut);
		end.setHours(23, 59, 59, 999);
		if (today < start) return 'planning';
		if (today >= start && today <= end) return 'vacation';
		return 'recap';
	});

	$effect(() => {
		if (!tripId || !checkInDate || !checkOutDate) return;
		const m = modeFromDate;
		dashboardModeByTripId.update((byId) => {
			if (byId[tripId] !== undefined) return byId;
			return { ...byId, [tripId]: m };
		});
	});

	const headerMode = $derived(($dashboardModeByTripId)[tripId] ?? modeFromDate);

	function setHeaderMode(mode: DashboardMode) {
		dashboardModeByTripId.update((m) => ({ ...m, [tripId]: mode }));
	}

	function openInvite() {
		onInvite?.();
	}

	function showToastLocal(msg: string) {
		showToast?.(msg);
	}

	setContext('tripQuickActions', {
		onInvite: openInvite,
		showToast: showToastLocal
	});

	const currentPath = $derived($page.url.pathname);
	/** Hide global messages + notifications while editing trip settings or on publish/pay */
	const hideMessagesAndNotifications = $derived(
		invitePreviewMode ||
			currentPath.includes(`/trips/${tripId}/settings`) ||
			currentPath.includes(`/trips/${tripId}/publish`)
	);
	const isDashboardPage = $derived(
		currentPath === `/trips/${tripId}` || currentPath.replace(/\/$/, '') === `/trips/${tripId}`
	);
	const showModePillOnDashboard = $derived(
		!!(checkInDate && checkOutDate && isDashboardPage && !invitePreviewMode)
	);

	function navHref(itemHref: string): string {
		if (invitePreviewMode && inviteToken && itemHref === `/trips/${tripId}`) {
			return `${itemHref}?invite=${encodeURIComponent(inviteToken)}`;
		}
		return itemHref;
	}

	function isActive(href: string): boolean {
		if (href === `/trips/${tripId}`) return currentPath === href;
		return currentPath.startsWith(href);
	}

	const baseNavItems = [
		{ href: `/trips/${tripId}`, label: 'Dashboard', icon: 'dashboard' },
		{ href: `/trips/${tripId}/guests`, label: 'Guests', icon: 'guests' },
		{ href: `/trips/${tripId}/rooms`, label: 'Rooms', icon: 'rooms' },
		{ href: `/trips/${tripId}/itinerary`, label: 'Itinerary', icon: 'itinerary' },
		{ href: `/trips/${tripId}/activities`, label: 'Activities', icon: 'activities' },
		{ href: `/trips/${tripId}/polls`, label: 'Polls', icon: 'polls' },
		{ href: `/trips/${tripId}/games`, label: 'Games', icon: 'games' },
		{ href: `/trips/${tripId}/files`, label: 'Files', icon: 'files' }
	];
	const navItems = $derived(
		baseNavItems.filter((item) => {
			if (item.icon === 'guests' && !showGuestsTab) return false;
			if (item.icon === 'activities' && !activitiesEnabled) return false;
			if (item.icon === 'games' && !gamesEnabled) return false;
			return true;
		})
	);

	let mainContentEl = $state<HTMLElement | null>(null);

	let collapsed = $state(
		browser ? localStorage.getItem('sidebar-collapsed') === 'true' : false
	);

	/** Slide-out trip nav on small viewports (see @media max-width 640px). */
	let mobileDrawerOpen = $state(false);

	function toggleCollapsed() {
		collapsed = !collapsed;
		if (browser) localStorage.setItem('sidebar-collapsed', String(collapsed));
	}

	function closeMobileDrawer() {
		mobileDrawerOpen = false;
	}

	function toggleMobileDrawer() {
		mobileDrawerOpen = !mobileDrawerOpen;
	}

	// Reset the custom scroll container to the top on every client-side navigation.
	// SvelteKit's built-in scroll restoration only handles window scroll, not this div.
	afterNavigate(() => {
		mainContentEl?.scrollTo({ top: 0, behavior: 'instant' });
		mobileDrawerOpen = false;
	});

	$effect(() => {
		if (!browser) return;
		const mq = window.matchMedia('(min-width: 641px)');
		const onChange = () => {
			if (mq.matches) mobileDrawerOpen = false;
		};
		mq.addEventListener('change', onChange);
		return () => mq.removeEventListener('change', onChange);
	});

	$effect(() => {
		if (!browser || !mobileDrawerOpen) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') closeMobileDrawer();
		};
		document.addEventListener('keydown', onKey);
		return () => document.removeEventListener('keydown', onKey);
	});
</script>

<div class="app-shell" class:collapsed class:drawer-open={mobileDrawerOpen}>
	<button
		type="button"
		class="mobile-nav-backdrop"
		aria-label="Close trip menu"
		onclick={closeMobileDrawer}
	></button>
	<aside class="left-rail" id="trip-portal-sidebar">
		<a href="/trips" class="logo-button" aria-label="Divvi">
			<img src={divviLogo} alt="Divvi" class="logo-img" />
		</a>
		<div class="rail-nav-wrap">
			<nav class="rail-nav" aria-label="Primary navigation">
				{#each navItems as item}
					{@const locked = invitePreviewMode && item.href !== `/trips/${tripId}`}
					{@const itemHref = navHref(item.href)}
					<svelte:element
						this={locked ? 'span' : 'a'}
						class="rail-nav-item"
						class:active={!locked && isActive(item.href)}
						class:rail-nav-item--locked={locked}
						{...(locked
							? {
									'aria-disabled': true,
									'aria-label': `${item.label} (locked until you join)`,
									title: 'Join the trip from the preview to unlock',
									role: 'presentation'
								}
							: {
									href: itemHref,
									'aria-label': item.label,
									title: collapsed ? item.label : undefined
								})}
					>
					<span class="rail-icon-wrap">
					{#if item.icon === 'dashboard'}
						<svg class="rail-icon-svg" xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/></svg>
					{:else if item.icon === 'guests'}
						<svg class="rail-icon-svg" xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
					{:else if item.icon === 'rooms'}
						<svg class="rail-icon-svg" xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 4v16"/><path d="M2 8h20a2 2 0 0 1 2 2v10"/><path d="M6 8V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v4"/><rect width="8" height="4" x="6" y="12"/></svg>
					{:else if item.icon === 'itinerary'}
						<svg class="rail-icon-svg" xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/><path d="M8 14h.01"/><path d="M12 14h.01"/><path d="M16 14h.01"/><path d="M8 18h.01"/><path d="M12 18h.01"/><path d="M16 18h.01"/></svg>
					{:else if item.icon === 'meals'}
						<svg class="rail-icon-svg" xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21c-5.5 0-10-3.5-10-8V9a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v4c0 4.5-4.5 8-10 8z"/><path d="M9 5v1M12 4v2M15 5v1"/></svg>
					{:else if item.icon === 'activities'}
						<svg class="rail-icon-svg" xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/><path d="M13 5v2"/><path d="M13 17v2"/><path d="M13 11v2"/></svg>
					{:else if item.icon === 'polls'}
						<svg class="rail-icon-svg" xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
					{:else if item.icon === 'games'}
						<svg class="rail-icon-svg" xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="2"/><circle cx="8" cy="8" r="1.2" fill="currentColor"/><circle cx="16" cy="8" r="1.2" fill="currentColor"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/><circle cx="8" cy="16" r="1.2" fill="currentColor"/><circle cx="16" cy="16" r="1.2" fill="currentColor"/></svg>
					{:else if item.icon === 'files'}
						<svg class="rail-icon-svg" xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/><path d="M2 10h20"/></svg>
					{/if}
					{#if item.icon === 'polls' && pollsBadgeCount > 0 && !isActive(item.href)}
						<span class="rail-nav-badge" aria-label="{pollsBadgeCount} new poll(s) since last visit">{pollsBadgeCount > 9 ? '9+' : pollsBadgeCount}</span>
					{/if}
					</span>
					<span class="rail-item-label">{item.label}</span>
					</svelte:element>
				{/each}
			</nav>
		</div>
		<div class="rail-bottom">
			{#if user}
				<div class="rail-user-row">
					<AvatarMenu user={user} class="user-avatar-wrap" placement="above" />
					<span class="rail-item-label rail-user-name">{user.name || user.email || ''}</span>
				</div>
			{/if}
			{#if !invitePreviewMode}
			<a href="/trips/{tripId}/settings" class="rail-util" aria-label="Settings" title={collapsed ? 'Settings' : undefined}>
				<span class="rail-icon-wrap">
					<svg class="rail-icon-svg" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
				</span>
				<span class="rail-item-label">Settings</span>
			</a>
			{/if}
			<button
				type="button"
				class="rail-collapse-btn"
				onclick={toggleCollapsed}
				aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
				title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
			>
				{#if collapsed}
					<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
				{:else}
					<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
				{/if}
				<span class="rail-item-label">Collapse</span>
			</button>
		</div>
	</aside>
	<main class="main-content" bind:this={mainContentEl}>
		<div
			class="trip-sticky-header"
			class:trip-sticky-header--with-bar={showModePillOnDashboard || !hideMessagesAndNotifications}
		>
			<button
				type="button"
				class="mobile-drawer-trigger"
				onclick={toggleMobileDrawer}
				aria-expanded={mobileDrawerOpen}
				aria-controls="trip-portal-sidebar"
				aria-label={mobileDrawerOpen ? 'Close trip menu' : 'Open trip menu'}
			>
				{#if mobileDrawerOpen}
					<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
				{:else}
					<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h16"/></svg>
				{/if}
			</button>
			{#if showModePillOnDashboard || !hideMessagesAndNotifications}
			<div class="top-actions" class:top-actions--no-pill={!showModePillOnDashboard}>
				{#if showModePillOnDashboard}
					<div class="top-actions-spacer" aria-hidden="true"></div>
					<div class="top-actions-pill" style="position:relative;">
						<DashboardModeSelector
							{checkInDate}
							{checkOutDate}
							selectedMode={headerMode}
							onModeChange={setHeaderMode}
						/>
						{#if modeSelectorTip}
							<OnboardingTooltip
								key={modeSelectorTip.key}
								title={modeSelectorTip.title}
								body={modeSelectorTip.body}
								position={modeSelectorTip.position}
								align={modeSelectorTip.align}
							/>
						{/if}
					</div>
				{/if}
				{#if !hideMessagesAndNotifications}
					<div class="top-actions-right">
						<a href="/messages" class="top-action-btn" title="Messages" aria-label="Messages">
							<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719"/></svg>
						</a>
						<span class="top-bell">
							<NotificationTray />
						</span>
					</div>
				{/if}
			</div>
			{/if}
		</div>
		{#if children != null && typeof children === 'function'}
			<div class="main-content-inner">
				{@render children()}
			</div>
		{/if}
	</main>
</div>

<style>
	/* ── Layout shell ── */
	.app-shell {
		--sidebar-w: 210px;
		display: block;
		height: 100vh;
		overflow: hidden;
		background: var(--bg);
		padding: 12px 0 12px 12px;
		box-sizing: border-box;
	}
	.app-shell.collapsed {
		--sidebar-w: 72px;
	}

	/* Full-screen dim when mobile drawer open (visible only ≤640px via media block below) */
	.mobile-nav-backdrop {
		display: none;
		position: fixed;
		inset: 0;
		z-index: 150;
		margin: 0;
		padding: 0;
		border: none;
		background: rgba(15, 23, 42, 0.48);
		cursor: pointer;
		-webkit-tap-highlight-color: transparent;
	}

	.trip-sticky-header {
		position: relative;
		z-index: 5;
		flex-shrink: 0;
		min-height: 0;
	}

	.mobile-drawer-trigger {
		display: none;
		align-items: center;
		justify-content: center;
		width: 44px;
		height: 44px;
		border-radius: 10px;
		border: 1px solid var(--border-soft);
		background: var(--surfaceSolid);
		color: var(--text);
		cursor: pointer;
		box-shadow: var(--shadow-sm);
		flex-shrink: 0;
		-webkit-tap-highlight-color: transparent;
	}
	.mobile-drawer-trigger:hover {
		background: var(--surface2);
		color: var(--primary);
		border-color: rgba(47, 119, 120, 0.25);
	}

	@media (min-width: 641px) {
		.trip-sticky-header {
			display: contents;
		}
	}

	/* ── Left rail ── */
	.left-rail {
		position: fixed;
		left: 12px;
		top: 12px;
		bottom: 12px;
		width: var(--sidebar-w);
		background: #fcfcfc;
		border-radius: 12px;
		display: flex;
		flex-direction: column;
		align-items: stretch;
		padding: 1rem 0;
		gap: 0;
		box-shadow: 4px 0 24px rgba(17, 24, 39, 0.06);
		z-index: 10;
		overflow: hidden;
		transition: width 220ms cubic-bezier(0.4, 0, 0.2, 1);
	}

	/* Logo: fixed left indent that also centers in collapsed width */
	/* collapsed: (72 - 48) / 2 = 12px — margin-left:12px is already perfect */
	.logo-button {
		width: 48px;
		height: 48px;
		border-radius: 12px;
		background: var(--warm);
		display: flex;
		align-items: center;
		justify-content: center;
		text-decoration: none;
		transition: transform var(--transition-fast), background var(--transition-fast);
		flex-shrink: 0;
		overflow: hidden;
		padding: 4px;
		box-sizing: border-box;
		margin-left: 12px;
	}

	.logo-button:hover {
		transform: scale(1.05);
		background: #b8480e;
	}

	.logo-img {
		width: 100%;
		height: 100%;
		object-fit: contain;
		display: block;
		filter: brightness(0) invert(1);
	}

	/* ── Nav wrap & nav ── */
	.rail-nav-wrap {
		flex: 1;
		display: flex;
		align-items: center;
		width: 100%;
		padding: 0;
		box-sizing: border-box;
		overflow-y: auto;
		overflow-x: hidden;
	}

	.rail-nav {
		background: rgba(47, 119, 120, 0.1);
		border-radius: 10px;
		padding: 6px;
		display: flex;
		flex-direction: column;
		gap: 2px;
		width: 100%;
		box-sizing: border-box;
		margin: 0 8px;
		/* margin transitions so the gray pill resizes with the rail */
		transition: margin 220ms cubic-bezier(0.4, 0, 0.2, 1),
		            padding 220ms cubic-bezier(0.4, 0, 0.2, 1);
	}
	.app-shell.collapsed .rail-nav {
		margin: 0 6px;
		padding: 6px 4px;
	}

	/* ── Nav items ──
	   padding-left:13px keeps the icon's center at ~24px from item left.
	   In collapsed mode: item width ≈ 60px  → icon center at 24px ≈ centered.
	   gap animates to 0 so labels slide away without snapping.              */
	.rail-nav-item {
		height: 40px;
		border-radius: 8px;
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 0 10px 0 13px;
		text-decoration: none;
		color: #374151;
		transition:
			background var(--transition-fast),
			color var(--transition-fast),
			gap 220ms cubic-bezier(0.4, 0, 0.2, 1),
			padding 220ms cubic-bezier(0.4, 0, 0.2, 1);
		white-space: nowrap;
		width: 100%;
		box-sizing: border-box;
	}
	.app-shell.collapsed .rail-nav-item {
		gap: 0;
		padding: 0 0 0 13px;
	}

	.rail-nav-item:hover {
		background: rgba(47, 119, 120, 0.12);
		color: var(--navy);
	}

	.rail-nav-item--locked {
		opacity: 0.45;
		cursor: not-allowed;
		pointer-events: none;
	}

	.rail-nav-item--locked:hover {
		background: transparent;
		color: #374151;
	}

	.rail-nav-item.active {
		background: rgba(47, 119, 120, 0.2);
		color: var(--navy);
		font-weight: 500;
	}

	/* ── Icon wrap (holds svg + badge) ── */
	.rail-icon-wrap {
		position: relative;
		width: 22px;
		height: 22px;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.rail-nav-badge {
		position: absolute;
		top: -4px;
		right: -6px;
		min-width: 16px;
		height: 16px;
		padding: 0 4px;
		border-radius: 8px;
		background: #dc2626;
		color: white;
		font-size: 0.65rem;
		font-weight: 700;
		display: flex;
		align-items: center;
		justify-content: center;
		line-height: 1;
		box-sizing: border-box;
	}

	.rail-icon-svg {
		display: block;
		flex-shrink: 0;
		color: inherit;
	}

	/* ── Expandable label ── */
	.rail-item-label {
		font-size: 0.875rem;
		font-weight: 500;
		color: inherit;
		overflow: hidden;
		white-space: nowrap;
		opacity: 1;
		max-width: 120px;
		transition: opacity 180ms ease, max-width 220ms ease;
	}
	.app-shell.collapsed .rail-item-label {
		opacity: 0;
		max-width: 0;
		pointer-events: none;
	}

	/* ── Bottom rail ── */
	.rail-bottom {
		display: flex;
		flex-direction: column;
		align-items: stretch;
		gap: 2px;
		width: 100%;
		padding: 0.75rem 14px 0;
		margin-top: auto;
		flex-shrink: 0;
		border-top: 1px solid rgba(17, 24, 39, 0.08);
		box-sizing: border-box;
		transition: padding 220ms cubic-bezier(0.4, 0, 0.2, 1);
	}
	.app-shell.collapsed .rail-bottom {
		padding: 0.75rem 10px 0;
	}

	/* ── User row ── */
	.rail-user-row {
		display: flex;
		align-items: center;
		gap: 10px;
		width: 100%;
		min-width: 0;
		padding: 4px 0;
		transition: gap 220ms cubic-bezier(0.4, 0, 0.2, 1);
	}
	.app-shell.collapsed .rail-user-row {
		gap: 0;
	}

	.rail-user-name {
		font-size: 0.8125rem;
		font-weight: 500;
		color: #374151;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		min-width: 0;
		flex: 1;
	}

	.user-avatar-wrap {
		display: inline-flex;
		flex-shrink: 0;
	}
	.user-avatar-wrap :global(.avatar-trigger) {
		width: 36px;
		height: 36px;
		border-radius: 10px;
		background: var(--surface2);
		border: 1px solid var(--border-soft);
	}
	.user-avatar-wrap :global(.avatar-trigger:hover) {
		background: rgba(17, 24, 39, 0.06);
	}
	.user-avatar-wrap :global(.avatar-trigger .avatar-inner) {
		border-radius: 8px;
	}
	.user-avatar-wrap :global(.avatar-trigger .avatar-img) {
		border-radius: 8px;
	}

	/* ── Settings link (bottom) ── */
	.rail-util {
		height: 40px;
		border-radius: 10px;
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 0 10px 0 3px;
		text-decoration: none;
		color: var(--text);
		transition:
			background var(--transition-fast),
			gap 220ms cubic-bezier(0.4, 0, 0.2, 1);
		width: 100%;
		box-sizing: border-box;
		white-space: nowrap;
	}
	.app-shell.collapsed .rail-util {
		gap: 0;
	}
	.rail-util:hover {
		background: rgba(17, 24, 39, 0.06);
	}
	.rail-util .rail-icon-wrap {
		width: 20px;
		height: 20px;
		/* same left position as nav icons */
		margin-left: 10px;
		flex-shrink: 0;
	}

	/* ── Collapse toggle button ── */
	.rail-collapse-btn {
		height: 36px;
		border-radius: 8px;
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 0 10px 0 13px;
		border: none;
		background: none;
		color: #9ca3af;
		cursor: pointer;
		font: inherit;
		font-size: 0.8125rem;
		font-weight: 500;
		transition:
			background var(--transition-fast),
			color var(--transition-fast),
			gap 220ms cubic-bezier(0.4, 0, 0.2, 1);
		width: 100%;
		box-sizing: border-box;
		white-space: nowrap;
		margin-top: 2px;
	}
	.app-shell.collapsed .rail-collapse-btn {
		gap: 0;
	}
	.rail-collapse-btn:hover {
		background: rgba(17, 24, 39, 0.06);
		color: #374151;
	}

	/* ── Main content ── */
	.main-content {
		margin: 12px 12px 12px calc(var(--sidebar-w) + 12px);
		height: calc(100vh - 24px);
		display: flex;
		flex-direction: column;
		overflow: hidden;
		box-sizing: border-box;
		min-width: 0;
		padding: 0.5rem 2rem 0rem;
		max-width: 100%;
		background: var(--bg);
		position: relative;
		transition: margin-left 220ms cubic-bezier(0.4, 0, 0.2, 1);
	}

	.top-actions {
		position: absolute;
		top: 0.5rem;
		left: 0;
		right: 2rem;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		z-index: 5;
	}

	.top-actions--no-pill {
		justify-content: flex-end;
	}
	.top-actions-spacer {
		flex: 1;
		min-width: 0;
	}
	.top-actions-pill {
		flex-shrink: 0;
	}
	.top-actions-pill :global(.mode-selector-wrap) {
		margin: 0;
	}
	.top-actions-right {
		flex: 1;
		min-width: 0;
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 0.375rem;
	}

	.top-actions--no-pill .top-actions-right {
		flex: 0 1 auto;
	}

	.top-action-btn {
		width: 44px;
		height: 44px;
		border-radius: 8px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		color: #374151;
		transition: all 0.2s;
		text-decoration: none;
	}
	.top-action-btn:hover {
		background: transparent;
		color: #111827;
	}
	.top-bell {
		display: inline-flex;
	}
	.top-bell :global(.tray-trigger) {
		width: 44px;
		height: 44px;
		border-radius: 8px;
		background: transparent;
		color: #374151;
	}
	.top-bell :global(.tray-trigger:hover) {
		background: transparent;
		color: #111827;
	}

	.main-content-inner {
		width: 100%;
		min-width: 0;
		min-height: 0;
		flex: 1;
		display: flex;
		flex-direction: column;
		overflow-y: auto;
		overflow-x: hidden;
	}

	@media (max-width: 1024px) {
		.app-shell {
			--sidebar-w: 64px;
			padding: 8px 0 8px 8px;
		}

		.left-rail {
			left: 8px;
			top: 8px;
			bottom: 8px;
			padding: 1rem 0;
			border-radius: 12px;
			align-items: center;
		}

		.logo-button {
			width: 40px;
			height: 40px;
			padding: 5px;
			margin-left: 0;
		}

		/* Force collapsed icon-only layout on tablet */
		.rail-nav { margin: 0 4px; }
		.rail-nav-item { gap: 0; padding: 0 0 0 9px; }
		.user-avatar-wrap :global(.avatar-trigger) { width: 40px; height: 40px; border-radius: 10px; }
		.rail-util { gap: 0; }
		.rail-user-row { gap: 0; }
		.rail-item-label { opacity: 0; max-width: 0; pointer-events: none; transition: none; }
		.rail-collapse-btn { display: none; }

		.main-content {
			margin: 8px 8px 8px 76px;
			height: calc(100vh - 16px);
			padding: 0.75rem 1.5rem 0rem;
			transition: none;
		}
	}

	@media (max-width: 640px) {
		.app-shell {
			padding: 0;
		}

		.trip-sticky-header {
			display: flex;
			align-items: center;
			gap: 0.5rem;
			position: sticky;
			top: 0;
			z-index: 30;
			background: var(--bg);
			padding: 0.35rem 0 0.5rem;
			margin: 0 0 0.15rem;
		}

		.mobile-drawer-trigger {
			display: inline-flex;
		}

		.trip-sticky-header .top-actions {
			position: static;
			flex: 1;
			min-width: 0;
			top: auto;
			left: auto;
			right: auto;
		}

		.app-shell.drawer-open .mobile-nav-backdrop {
			display: block;
		}

		.left-rail {
			display: flex !important;
			left: 0;
			top: 0;
			bottom: 0;
			width: min(288px, 88vw);
			max-width: 288px;
			margin: 0;
			padding: 1rem 0;
			border-radius: 0 14px 14px 0;
			align-items: stretch;
			transform: translateX(calc(-100% - 8px));
			transition: transform 0.26s cubic-bezier(0.4, 0, 0.2, 1);
			z-index: 200;
			box-shadow: 8px 0 36px rgba(0, 0, 0, 0.14);
		}

		.app-shell.drawer-open .left-rail {
			transform: translateX(0);
		}

		/* Expanded labels inside the mobile drawer */
		.app-shell.drawer-open .rail-item-label {
			opacity: 1 !important;
			max-width: 200px !important;
			pointer-events: auto !important;
		}
		.app-shell.drawer-open .rail-nav-item {
			justify-content: flex-start;
			padding-left: 12px;
			padding-right: 10px;
			gap: 10px;
		}
		.app-shell.drawer-open .rail-nav {
			margin: 0 8px;
			align-self: stretch;
			width: calc(100% - 16px);
		}
		.app-shell.drawer-open .rail-user-row {
			gap: 10px;
			padding-left: 4px;
			padding-right: 4px;
		}
		.app-shell.drawer-open .rail-util {
			gap: 10px;
			padding-left: 12px;
		}

		.main-content {
			margin: 0;
			height: 100vh;
			padding: 0.65rem 0.5rem 0;
		}
	}
</style>
