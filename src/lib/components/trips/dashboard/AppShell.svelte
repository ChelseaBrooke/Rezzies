<script lang="ts">
	import type { Snippet } from 'svelte';
	import { page } from '$app/stores';
	import divviLogo from '$lib/assets/images/divvi logo.png';

	interface Props {
		tripId: string;
		user?: { id: string; name: string | null; email: string } | null;
		children?: Snippet;
	}

	let { tripId, user, children }: Props = $props();

	const currentPath = $derived($page.url.pathname);

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

	function isActive(href: string): boolean {
		if (href === `/trips/${tripId}`) return currentPath === href;
		return currentPath.startsWith(href);
	}

	const navItems = [
		{ href: `/trips/${tripId}`, label: 'Dashboard', icon: 'dashboard' },
		{ href: `/trips/${tripId}/rooms`, label: 'Rooms', icon: 'rooms' },
		{ href: `/trips/${tripId}/itinerary`, label: 'Itinerary', icon: 'itinerary' },
		{ href: `/trips/${tripId}/payments`, label: 'Payments', icon: 'payments' },
		{ href: `/trips/${tripId}/files`, label: 'Files', icon: 'files' },
		{ href: `/trips/${tripId}/settings`, label: 'Settings', icon: 'settings' }
	];
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
					{#if item.icon === 'dashboard'}
						<svg class="rail-icon-svg" xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
					{:else if item.icon === 'rooms'}
						<svg class="rail-icon-svg" xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 4v16"/><path d="M2 8h20a2 2 0 0 1 2 2v10"/><path d="M6 8V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v4"/><rect x="6" y="12" width="8" height="4"/></svg>
					{:else if item.icon === 'itinerary'}
						<svg class="rail-icon-svg" xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
					{:else if item.icon === 'payments'}
						<svg class="rail-icon-svg" xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
					{:else if item.icon === 'files'}
						<svg class="rail-icon-svg" xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/><line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/></svg>
					{:else if item.icon === 'settings'}
						<svg class="rail-icon-svg" xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
					{/if}
				</a>
				{/each}
			</nav>
		</div>
		<div class="rail-bottom">
			{#if user}
				<a href="/profile" class="user-avatar" aria-label="My profile" title="My profile">
					<span class="avatar-inner">{initials(user.name, user.email)}</span>
				</a>
			{/if}
			<a href="/trips/{tripId}/settings" class="rail-util" aria-label="Settings" title="Settings">
				<svg class="rail-icon-svg" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
			</a>
			<a href="/trips" class="rail-util" aria-label="All trips" title="All trips">
				<svg class="rail-icon-svg" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
			</a>
		</div>
	</aside>
	<main class="main-content">
		{#if children != null && typeof children === 'function'}
			{@render children()}
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

	.user-avatar {
		width: 44px;
		height: 44px;
		border-radius: 12px;
		background: var(--surface2);
		color: var(--text);
		display: flex;
		align-items: center;
		justify-content: center;
		text-decoration: none;
		font-size: 0.8125rem;
		font-weight: 600;
		border: 1px solid var(--border-soft);
		transition: all var(--transition-fast);
		flex-shrink: 0;
	}

	.user-avatar:hover {
		background: rgba(17, 24, 39, 0.06);
		color: var(--text);
	}

	.avatar-inner {
		display: block;
		line-height: 1;
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
		padding: 2rem;
		max-width: 100%;
		background: var(--bg);
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
		.user-avatar,
		.rail-util {
			width: 40px;
			height: 40px;
		}

		.rail-nav {
			margin-top: 1.5rem;
		}

		.main-content {
			margin: 8px 8px 8px 72px;
			height: calc(100vh - 16px);
			padding: 1rem 1.5rem;
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
