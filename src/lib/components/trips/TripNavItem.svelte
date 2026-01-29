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
		padding: 0.625rem 0.75rem;
		border: none;
		background: transparent;
		border-radius: var(--radius-md, 0.5rem);
		cursor: pointer;
		transition: all 0.2s ease;
		font-family: inherit;
		font-size: 0.9375rem;
		color: var(--muted);
		text-align: left;
		width: 100%;
		position: relative;
	}

	.nav-item:hover {
		background: rgba(30, 58, 138, 0.06);
		color: var(--primary);
	}

	.nav-item.active {
		background: rgba(30, 58, 138, 0.08);
		color: var(--primary);
		font-weight: 500;
		box-shadow: 0 0 0 1px rgba(30, 58, 138, 0.12);
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
		background: var(--border);
		padding: 0.125rem 0.5rem;
		border-radius: 9999px;
		flex-shrink: 0;
	}
</style>
