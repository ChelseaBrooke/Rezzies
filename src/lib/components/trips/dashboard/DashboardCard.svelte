<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		title?: string;
		/** When set, title is rendered as a link to this href */
		titleHref?: string;
		/** CSS grid column span: 1 or 2 */
		span?: 1 | 2;
		/** Variant styling */
		variant?: 'default' | 'sticky' | 'glass';
		/** Optional CTA at bottom of card (href = link, onClick = button for e.g. modal) */
		cta?: { label: string; href?: string; onClick?: () => void };
		/** Optional content before title (e.g. icon) */
		headerLeft?: Snippet;
		/** Optional header right content */
		headerRight?: Snippet;
		children?: Snippet;
	}

	let { title, titleHref, span = 1, variant = 'default', cta, headerLeft, headerRight, children }: Props = $props();
</script>

<article class="dashboard-card" class:span-2={span === 2} class:variant-sticky={variant === 'sticky'} class:variant-glass={variant === 'glass'}>
	{#if title}
		<div class="card-header">
			{#if headerLeft != null && typeof headerLeft === 'function'}
				<div class="card-header-left">
					{@render headerLeft()}
				</div>
			{/if}
			<h2 class="card-title">
				{#if titleHref}
					<a href={titleHref} class="card-title-link">{title}</a>
				{:else}
					{title}
				{/if}
			</h2>
			{#if headerRight != null && typeof headerRight === 'function'}
				<div class="card-header-right">
					{@render headerRight()}
				</div>
			{/if}
		</div>
	{/if}
	<div class="card-body">
		{#if children != null && typeof children === 'function'}
			{@render children()}
		{/if}
	</div>
	{#if cta}
		<div class="card-cta">
			{#if cta.onClick}
				<button type="button" class="cta-link cta-button" onclick={cta.onClick}>{cta.label}</button>
			{:else if cta.href}
				<a href={cta.href} class="cta-link">{cta.label}</a>
			{/if}
		</div>
	{/if}
</article>

<style>
	.dashboard-card {
		background: var(--surfaceSolid);
		border-radius: var(--radius-2xl);
		box-shadow: var(--shadow-soft);
		border: 1px solid var(--border-soft);
		padding: 1rem 1.125rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		transition: transform var(--transition-fast), box-shadow var(--transition-fast);
		min-width: 0;
		overflow: hidden;
	}

	.dashboard-card:hover {
		transform: translateY(-1px);
		box-shadow: var(--shadow-soft-hover);
	}

	.dashboard-card.variant-sticky {
		background: linear-gradient(
			to bottom,
			rgba(255, 253, 230, 0.68) 0%,
			rgba(252, 248, 200, 0.85) 45%,
			rgba(250, 235, 140, 0.97) 100%
		);
		backdrop-filter: blur(8px);
		border: none;
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
	}

	.dashboard-card.variant-glass {
		background: color-mix(in srgb, var(--surface) 70%, transparent);
		backdrop-filter: blur(10px);
	}

	.dashboard-card.span-2 {
		grid-column: span 2;
	}

	.card-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
	}

	.card-title {
		font-family: 'Fraunces', Georgia, serif;
		font-size: 1rem;
		font-weight: 600;
		color: var(--text);
		margin: 0;
		letter-spacing: -0.01em;
	}

	.card-title-link {
		color: inherit;
		text-decoration: none;
		transition: color var(--transition-fast);
	}

	.card-title-link:hover {
		color: var(--primary);
		text-decoration: underline;
	}

	.card-header-left {
		display: flex;
		align-items: center;
		margin-right: 0.5rem;
	}

	.card-header-right {
		margin-left: auto;
	}

	.card-body {
		flex: 1;
		min-height: 0;
		min-width: 0;
		overflow: hidden;
	}

	.card-cta {
		margin-top: auto;
		padding-top: 0.375rem;
		border-top: 1px solid var(--border-soft);
	}

	.cta-link {
		font-size: 0.8125rem;
		font-weight: 500;
		color: var(--primary);
		text-decoration: none;
		transition: color var(--transition-fast);
	}

	.cta-link:hover {
		color: var(--primaryHover);
		text-decoration: underline;
	}

	.cta-button {
		background: none;
		border: none;
		cursor: pointer;
		font: inherit;
		padding: 0;
	}

	@media (max-width: 1024px) {
		.dashboard-card.span-2 {
			grid-column: span 1;
		}
	}
</style>
