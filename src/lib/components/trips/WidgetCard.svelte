<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		title: string;
		/** Grid column span: 1 or 2 */
		span?: 1 | 2;
		children?: Snippet;
	}

	let { title, span = 1, children }: Props = $props();
</script>

<article class="widget-card" class:span-2={span === 2}>
	<header class="widget-header">
		<span class="widget-label">{title}</span>
		<button type="button" class="widget-kebab" aria-label="More options">
			<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/>
			</svg>
		</button>
	</header>
	<div class="widget-body">
		{#if children}
			{@render children()}
		{/if}
	</div>
</article>

<style>
	.widget-card {
		background: white;
		border-radius: 0.75rem;
		box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
		padding: 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.widget-card.span-2 {
		grid-column: span 2;
	}

	.widget-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		min-height: 1.5rem;
	}

	.widget-label {
		font-size: 0.6875rem;
		font-weight: 600;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		color: #64748b;
	}

	.widget-kebab {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 1.75rem;
		height: 1.75rem;
		border: none;
		background: transparent;
		border-radius: 0.375rem;
		cursor: pointer;
		color: #64748b;
	}

	.widget-kebab:hover {
		background: #f1f5f9;
		border-radius: 0.375rem;
		color: #334155;
	}

	.widget-body {
		flex: 1;
		min-height: 0;
	}

	@media (max-width: 1024px) {
		.widget-card.span-2 {
			grid-column: span 1;
		}
	}
</style>
