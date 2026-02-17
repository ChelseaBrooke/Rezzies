<script lang="ts">
	import type { Snippet } from 'svelte';
	import { setContext } from 'svelte';
	import { page } from '$app/stores';
	import divviLogo from '$lib/assets/images/divvi logo.png';
	import NotificationTray from '$lib/components/NotificationTray.svelte';
	import AvatarMenu from '$lib/components/AvatarMenu.svelte';
	interface Props {
		tripId: string;
		user?: { id: string; name: string | null; email: string; avatarUrl?: string | null } | null;
		children?: Snippet;
		onInvite?: () => void;
		showToast?: (msg: string) => void;
		/** When false, Guests tab is hidden (guest portal only). Hosts and co-hosts see it. */
		showGuestsTab?: boolean;
		/** Badge count: new polls since last visit; hidden when on polls page */
		pollsBadgeCount?: number;
	}

	let { tripId, user, children, onInvite, showToast, showGuestsTab = true, pollsBadgeCount = 0 }: Props = $props();

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

	function isActive(href: string): boolean {
		if (href === `/trips/${tripId}`) return currentPath === href;
		return currentPath.startsWith(href);
	}

	const allNavItems = [
		{ href: `/trips/${tripId}`, label: 'Dashboard', icon: 'dashboard' },
		{ href: `/trips/${tripId}/guests`, label: 'Guests', icon: 'guests' },
		{ href: `/trips/${tripId}/rooms`, label: 'Rooms', icon: 'rooms' },
		{ href: `/trips/${tripId}/itinerary`, label: 'Itinerary', icon: 'itinerary' },
		{ href: `/trips/${tripId}/meals`, label: 'Meals', icon: 'meals' },
		{ href: `/trips/${tripId}/activities`, label: 'Activities', icon: 'activities' },
		{ href: `/trips/${tripId}/polls`, label: 'Polls', icon: 'polls' },
		{ href: `/trips/${tripId}/games`, label: 'Games', icon: 'games' },
		{ href: `/trips/${tripId}/files`, label: 'Files', icon: 'files' }
	];
	const navItems = $derived(showGuestsTab ? allNavItems : allNavItems.filter((item) => item.icon !== 'guests'));
</script>

<div class="app-shell">
	<aside class="left-rail">
		<a href="/trips" class="logo-button" aria-label="Divvi">
			<img src={divviLogo} alt="Divvi" class="logo-img" />
		</a>
		<div class="rail-nav-wrap">
			<nav class="rail-nav" aria-label="Primary navigation">
				{#each navItems as item}
				<a
					href={item.href}
					class="rail-nav-item"
					class:active={isActive(item.href)}
					aria-label={item.label}
					title={item.label}
				>
					<span class="rail-nav-item-inner">
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
						<svg class="rail-icon-svg" xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18v12H3V6z"/><path d="M3 12h18"/><path d="M12 6v12"/></svg>
					{:else if item.icon === 'files'}
						<svg class="rail-icon-svg" xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/><path d="M2 10h20"/></svg>
					{/if}
					{#if item.icon === 'polls' && pollsBadgeCount > 0 && !isActive(item.href)}
						<span class="rail-nav-badge" aria-label="{pollsBadgeCount} new poll(s) since last visit">{pollsBadgeCount > 9 ? '9+' : pollsBadgeCount}</span>
					{/if}
					</span>
				</a>
				{/each}
			</nav>
		</div>
		<div class="rail-bottom">
			{#if user}
				<AvatarMenu user={user} class="user-avatar-wrap" placement="above" />
			{/if}
			<a href="/trips/{tripId}/settings" class="rail-util" aria-label="Settings" title="Settings">
				<svg class="rail-icon-svg" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
			</a>
		</div>
	</aside>
	<main class="main-content">
		<div class="top-actions">
			<a href="/messages" class="top-action-btn" title="Messages" aria-label="Messages">
				<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719"/></svg>
			</a>
			<span class="top-bell">
				<NotificationTray />
			</span>
		</div>
		{#if children != null && typeof children === 'function'}
			<div class="main-content-inner">
				{@render children()}
			</div>
		{/if}
	</main>
</div>

<style>
	.app-shell {
		display: block;
		height: 100vh;
		overflow: hidden;
		background: var(--bg);
		padding: 12px 0 12px 12px;
		box-sizing: border-box;
	}

	.left-rail {
		position: fixed;
		left: 12px;
		top: 12px;
		bottom: 12px;
		width: 72px;
		background: #fcfcfc;
		border-radius: 12px;
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 1rem 0;
		gap: 0;
		box-shadow: 4px 0 24px rgba(17, 24, 39, 0.06);
		z-index: 10;
	}

	.logo-button {
		width: 48px;
		height: 48px;
		border-radius: 50%;
		background: #facc15;
		display: flex;
		align-items: center;
		justify-content: center;
		text-decoration: none;
		transition: transform var(--transition-fast);
		flex-shrink: 0;
		overflow: hidden;
		padding: 6px;
		box-sizing: border-box;
	}

	.logo-button:hover {
		transform: scale(1.05);
		background: #fbbf24;
	}

	.logo-img {
		width: 100%;
		height: 100%;
		object-fit: contain;
		display: block;
	}

	.rail-nav-wrap {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		padding: 0 12px;
	}

	.rail-nav {
		background: #d1d5db;
		border-radius: 10px;
		padding: 10px 0;
		display: flex;
		flex-direction: column;
		gap: 4px;
		width: 100%;
		align-items: center;
	}

	.rail-nav-item {
		width: 44px;
		height: 44px;
		border-radius: 8px;
		display: flex;
		align-items: center;
		justify-content: center;
		text-decoration: none;
		color: #374151;
		transition: all var(--transition-fast);
		position: relative;
	}

	.rail-nav-item:hover {
		background: rgba(0, 0, 0, 0.06);
		color: #111827;
	}

	.rail-nav-item.active {
		background: rgba(0, 0, 0, 0.1);
		color: #111827;
	}

	.rail-nav-item-inner {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		height: 100%;
	}

	.rail-nav-badge {
		position: absolute;
		top: -2px;
		right: -2px;
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

	.rail-nav .rail-icon-svg {
		color: inherit;
	}

	.rail-icon-svg {
		display: block;
		flex-shrink: 0;
	}

	.rail-bottom {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
		width: 100%;
		padding: 1rem 12px 0;
		margin-top: auto;
		flex-shrink: 0;
	}

	.user-avatar-wrap {
		display: inline-flex;
	}
	.user-avatar-wrap :global(.avatar-trigger) {
		width: 44px;
		height: 44px;
		border-radius: 12px;
		background: var(--surface2);
		border: 1px solid var(--border-soft);
	}
	.user-avatar-wrap :global(.avatar-trigger:hover) {
		background: rgba(17, 24, 39, 0.06);
	}
	.user-avatar-wrap :global(.avatar-trigger .avatar-inner) {
		border-radius: 10px;
	}
	.user-avatar-wrap :global(.avatar-trigger .avatar-img) {
		border-radius: 10px;
	}

	.rail-util {
		width: 44px;
		height: 44px;
		border-radius: 12px;
		display: flex;
		align-items: center;
		justify-content: center;
		text-decoration: none;
		color: var(--text);
		transition: all var(--transition-fast);
	}

	.rail-util:hover {
		background: rgba(17, 24, 39, 0.06);
		color: var(--text);
	}

	.main-content {
		margin: 12px 12px 12px 84px;
		height: calc(100vh - 24px);
		overflow-y: auto;
		overflow-x: hidden;
		box-sizing: border-box;
		min-width: 0;
		padding: 0.5rem 2rem 2rem;
		max-width: 100%;
		background: var(--bg);
		position: relative;
	}

	.top-actions {
		position: absolute;
		top: 0.5rem;
		right: 2rem;
		display: flex;
		align-items: center;
		gap: 0.125rem;
		z-index: 5;
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
		display: block;
	}

	@media (max-width: 1024px) {
		.app-shell {
			padding: 8px 0 8px 8px;
		}

		.left-rail {
			left: 8px;
			top: 8px;
			bottom: 8px;
			width: 64px;
			padding: 1rem 0;
			border-radius: 12px;
		}

		.logo-button {
			width: 40px;
			height: 40px;
			padding: 5px;
		}

		.rail-nav-item,
		.user-avatar-wrap :global(.avatar-trigger),
		.rail-util {
			width: 40px;
			height: 40px;
		}
		.user-avatar-wrap :global(.avatar-trigger) {
			border-radius: 10px;
		}

		.rail-nav {
			margin-top: 1.5rem;
		}

		.main-content {
			margin: 8px 8px 8px 72px;
			height: calc(100vh - 16px);
			padding: 0.75rem 1.5rem 1.5rem;
		}
	}

	@media (max-width: 640px) {
		.app-shell {
			padding: 0;
		}

		.left-rail {
			display: none;
		}

		.main-content {
			margin: 0;
			height: 100vh;
			padding: 1rem;
		}
	}
</style>
