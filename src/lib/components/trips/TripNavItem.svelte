<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';

	let {
		href,
		icon,
		label,
		badge = null
	}: {
		href: string;
		icon: string;
		label: string;
		badge?: string | null;
	} = $props();

	const isActive = $derived(
		$page.url.pathname === href || (href !== '/trips' && $page.url.pathname.startsWith(href + '/'))
	);

	function handleClick() {
		goto(href);
	}
</script>

<button
	type="button"
	class="nav-item"
	class:active={isActive}
	onclick={handleClick}
	aria-current={isActive ? 'page' : undefined}
>
	<span class="nav-icon">{icon}</span>
	<span class="nav-label">{label}</span>
	{#if badge}
		<span class="nav-badge">{badge}</span>
	{/if}
</button>

<style>
	.nav-item {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		height: 44px;
		min-height: 44px;
		padding: 0 1rem 0 1rem;
		border: none;
		background: transparent;
		border-radius: var(--radius-md);
		border-left: 3px solid transparent;
		cursor: pointer;
		transition: all var(--transition-base);
		font-family: inherit;
		font-size: 0.9375rem;
		color: var(--muted);
		text-align: left;
		width: 100%;
		position: relative;
	}

	.nav-item:hover {
		background: var(--surface2);
		color: var(--text);
	}

	.nav-item.active {
		background: var(--surface2);
		color: var(--text);
		font-weight: 500;
		border-left-color: var(--primary);
		box-shadow: var(--shadow-sm);
	}

	.nav-icon {
		font-size: 1.125rem;
		width: 1.5rem;
		text-align: center;
		flex-shrink: 0;
		line-height: 1;
	}

	.nav-label {
		flex: 1;
		min-width: 0;
	}

	.nav-badge {
		font-size: 0.75rem;
		font-weight: 500;
		color: var(--muted);
		background: var(--surface2);
		border: 1px solid var(--border);
		padding: 0.125rem 0.5rem;
		border-radius: 9999px;
		flex-shrink: 0;
	}
</style>
