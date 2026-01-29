<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		title: string;
		/** CSS grid column span: 1 or 2 */
		span?: 1 | 2;
		/** Optional CTA at bottom of card */
		cta?: { label: string; href: string };
		children?: Snippet;
	}

	let { title, span = 1, cta, children }: Props = $props();
</script>

<article class="dashboard-card" class:span-2={span === 2}>
	<h2 class="card-title">{title}</h2>
	<div class="card-body">
		{#if children}
			{@render children()}
		{/if}
	</div>
	{#if cta}
		<div class="card-cta">
			<a href={cta.href} class="cta-link">{cta.label}</a>
		</div>
	{/if}
</article>

<style>
	.dashboard-card {
		background: white;
		border-radius: var(--radius-xl, 1.25rem);
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
		padding: 1.5rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.dashboard-card.span-2 {
		grid-column: span 2;
	}

	.card-title {
		font-size: 1rem;
		font-weight: 600;
		color: var(--text);
		margin: 0;
	}

	.card-body {
		flex: 1;
		min-height: 0;
	}

	.card-cta {
		margin-top: auto;
		padding-top: 0.75rem;
		border-top: 1px solid rgba(0, 0, 0, 0.06);
	}

	.cta-link {
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--primary);
		text-decoration: none;
	}

	.cta-link:hover {
		text-decoration: underline;
	}

	@media (max-width: 1024px) {
		.dashboard-card.span-2 {
			grid-column: span 1;
		}
	}
</style>
