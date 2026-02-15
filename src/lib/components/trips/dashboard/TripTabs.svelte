<script lang="ts">
	import { page } from '$app/stores';

	interface Props {
		tripId: string;
	}

	let { tripId }: Props = $props();

	const currentPath = $derived($page.url.pathname);

	const tabs = [
		{ href: `/trips/${tripId}`, label: 'Overview' },
		{ href: `/trips/${tripId}/rooms`, label: 'Rooms' },
		{ href: `/trips/${tripId}/itinerary`, label: 'Itinerary' }
	];

	function isActive(href: string): boolean {
		if (href === `/trips/${tripId}`) {
			return currentPath === href || currentPath === `/trips/${tripId}/host` || currentPath === `/trips/${tripId}/guest`;
		}
		return currentPath.startsWith(href);
	}
</script>

<nav class="trip-tabs" aria-label="Trip navigation">
	{#each tabs as tab}
		<a href={tab.href} class="tab-item" class:active={isActive(tab.href)}>
			{tab.label}
		</a>
	{/each}
</nav>

<style>
	.trip-tabs {
		display: flex;
		gap: 0.5rem;
		margin-top: 0.75rem;
		margin-bottom: 0;
		margin-left: 0;
		padding: 0.5rem 0 1.25rem;
		border-bottom: 1px solid var(--border-soft);
		position: relative;
		z-index: 1;
	}

	@media (min-width: 1025px) {
		.trip-tabs {
			margin-left: 352px; /* Account for sticky card width + gap */
		}
	}

	.tab-item {
		padding: 0.625rem 1.25rem;
		border-radius: 9999px;
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--muted);
		text-decoration: none;
		background: transparent;
		transition: all var(--transition-fast);
		border: 1px solid transparent;
	}

	.tab-item:hover {
		color: var(--text);
		background: var(--surface);
	}

	.tab-item.active {
		color: var(--text);
		background: var(--surfaceSolid);
		border-color: var(--border-soft);
		font-weight: 600;
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
	}

	@media (max-width: 640px) {
		.trip-tabs {
			overflow-x: auto;
			-webkit-overflow-scrolling: touch;
			scrollbar-width: none;
		}

		.trip-tabs::-webkit-scrollbar {
			display: none;
		}

		.tab-item {
			flex-shrink: 0;
			padding: 0.5rem 1rem;
			font-size: 0.8125rem;
		}
	}
</style>
