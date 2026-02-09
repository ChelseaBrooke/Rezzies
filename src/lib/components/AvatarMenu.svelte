<script lang="ts">
	import { page } from '$app/stores';
	import { browser } from '$app/environment';
	import { onMount, onDestroy } from 'svelte';
	import { openProfileCard } from '$lib/stores/profileOverlay.js';

	interface User {
		id?: string;
		name?: string | null;
		email?: string;
		avatarUrl?: string | null;
	}

	let { user, class: className = '', placement = 'below' } = $props<{
		user: User;
		class?: string;
		/** 'above' = open upward (e.g. when avatar is at bottom of rail) */
		placement?: 'below' | 'above';
	}>();

	let open = $state(false);
	let menuEl: HTMLDivElement;
	let triggerEl: HTMLButtonElement;
	let closeTimeout: ReturnType<typeof setTimeout> | null = null;

	const isSettingsPage = $derived($page.url.pathname.startsWith('/settings'));

	function clearCloseTimeout() {
		if (closeTimeout) {
			clearTimeout(closeTimeout);
			closeTimeout = null;
		}
	}

	function scheduleClose() {
		clearCloseTimeout();
		closeTimeout = setTimeout(() => (open = false), 150);
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

	function handleClickOutside(e: MouseEvent) {
		if (open && menuEl && triggerEl && !menuEl.contains(e.target as Node) && !triggerEl.contains(e.target as Node)) {
			open = false;
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') open = false;
	}

	function toggle() {
		if (isSettingsPage) return;
		clearCloseTimeout();
		open = !open;
	}

	function onTriggerEnter() {
		if (isSettingsPage) return;
		clearCloseTimeout();
		open = true;
	}

	function onTriggerLeave() {
		scheduleClose();
	}

	function onMenuEnter() {
		clearCloseTimeout();
	}

	function onMenuLeave() {
		scheduleClose();
	}

	function close() {
		clearCloseTimeout();
		open = false;
	}

	onMount(() => {
		if (!browser) return;
		document.addEventListener('click', handleClickOutside);
		document.addEventListener('keydown', handleKeydown);
	});

	onDestroy(() => {
		if (!browser) return;
		document.removeEventListener('click', handleClickOutside);
		document.removeEventListener('keydown', handleKeydown);
	});
</script>

<div
	class="avatar-menu {className}"
	onmouseenter={onTriggerEnter}
	onmouseleave={onTriggerLeave}
>
	<button
		type="button"
		class="avatar-trigger"
		aria-label="Account menu"
		aria-expanded={open}
		aria-haspopup="true"
		onclick={toggle}
		bind:this={triggerEl}
	>
		{#if user?.avatarUrl}
			<img src={user.avatarUrl} alt="" class="avatar-img" />
		{:else}
			<span class="avatar-inner">{initials(user?.name, user?.email)}</span>
		{/if}
	</button>

	{#if open && !isSettingsPage}
		<div
			class="avatar-dropdown"
			class:avatar-dropdown-above={placement === 'above'}
			bind:this={menuEl}
			role="menu"
			onmouseenter={onMenuEnter}
			onmouseleave={onMenuLeave}
		>
			<a href="/trips" class="avatar-dropdown-item" role="menuitem" onclick={close}>My Trips</a>
			{#if user?.id}
				<button type="button" class="avatar-dropdown-item" role="menuitem" onclick={() => { openProfileCard(user.id!); close(); }}>My Profile</button>
			{/if}
			<a href="/settings" class="avatar-dropdown-item" role="menuitem" onclick={close}>Account Settings</a>
			<form method="POST" action="/logout" class="avatar-dropdown-form">
				<button type="submit" class="avatar-dropdown-item avatar-dropdown-logout" role="menuitem">
					Log out
				</button>
			</form>
		</div>
	{/if}
</div>

<style>
	.avatar-menu {
		position: relative;
		display: inline-flex;
	}

	.avatar-trigger {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 40px;
		height: 40px;
		border-radius: 50%;
		overflow: hidden;
		flex-shrink: 0;
		border: 2px solid rgba(255, 255, 255, 0.3);
		background: transparent;
		cursor: pointer;
		padding: 0;
		transition: opacity 0.2s, box-shadow 0.2s;
	}
	.avatar-trigger:hover {
		opacity: 0.9;
		box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.4);
	}

	.avatar-trigger .avatar-img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}

	.avatar-trigger .avatar-inner {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		height: 100%;
		font-size: 0.875rem;
		font-weight: 600;
		background: linear-gradient(135deg, var(--slate) 0%, var(--navy) 100%);
		color: white;
	}

	/* Dropdown when used on light background (e.g. navbar) */
	:global(.navbar) .avatar-trigger {
		border-color: var(--border);
	}
	:global(.navbar) .avatar-trigger:hover {
		box-shadow: 0 0 0 2px var(--primary);
	}
	:global(.navbar) .avatar-trigger .avatar-inner {
		background: linear-gradient(135deg, var(--slate) 0%, var(--navy) 100%);
	}

	.avatar-dropdown {
		position: absolute;
		top: 100%;
		right: 0;
		margin-top: 0.35rem;
		min-width: 180px;
		background: var(--surfaceSolid, #fff);
		border-radius: var(--radius-md);
		box-shadow: var(--shadow-lg);
		border: 1px solid var(--border);
		z-index: 1000;
		overflow: hidden;
		display: flex;
		flex-direction: column;
		padding: 0.5rem 0;
	}
	.avatar-dropdown-above {
		top: auto;
		bottom: 100%;
		left: 0;
		right: auto;
		margin-top: 0;
		margin-bottom: 0.35rem;
	}

	.avatar-dropdown-item {
		display: block;
		width: 100%;
		padding: 0.5rem 1rem;
		text-align: left;
		font-size: 0.9375rem;
		font-weight: 500;
		color: var(--text);
		text-decoration: none;
		background: none;
		border: none;
		cursor: pointer;
		font-family: inherit;
		transition: background 0.15s;
		flex: 0 0 auto;
	}
	.avatar-dropdown-item:hover {
		background: var(--surface2);
	}

	.avatar-dropdown-form {
		margin: 0;
		padding: 0;
		border-top: 1px solid var(--border);
		flex: 0 0 auto;
	}
	.avatar-dropdown-form .avatar-dropdown-item {
		margin: 0;
	}
	.avatar-dropdown-logout {
		color: var(--muted);
	}
	.avatar-dropdown-logout:hover {
		background: rgba(115, 44, 44, 0.08);
		color: var(--danger, var(--chocolate));
	}
</style>
