<script lang="ts">
	import WidgetCard from './WidgetCard.svelte';

	interface Props {
		title: string;
		subtitle?: string;
		ctaLabel: string;
		ctaHref: string;
	}

	let { title, subtitle = '', ctaLabel, ctaHref }: Props = $props();
</script>

<WidgetCard {title}>
	<div class="promo-widget">
		{#if subtitle}
			<p class="promo-subtitle">{subtitle}</p>
		{/if}
		<div class="promo-visual" role="presentation">
			<!-- Mini illustration placeholder (no external assets) -->
			<div class="promo-placeholder"></div>
		</div>
		<a href={ctaHref} class="promo-cta">{ctaLabel}</a>
	</div>
</WidgetCard>

<style>
	.promo-widget {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.promo-subtitle {
		font-size: 0.8125rem;
		color: #64748b;
		margin: 0;
		line-height: 1.4;
	}

	.promo-visual {
		min-height: 4rem;
		border-radius: 0.5rem;
		overflow: hidden;
	}

	.promo-placeholder {
		width: 100%;
		height: 100%;
		min-height: 4rem;
		background: linear-gradient(135deg, #e0f2fe 0%, #bae6fd 50%, #7dd3fc 100%);
		opacity: 0.8;
	}

	.promo-cta {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.375rem;
		padding: 0.5rem 1rem;
		font-size: 0.875rem;
		font-weight: 600;
		color: white;
		background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%);
		border-radius: 0.5rem;
		text-decoration: none;
		transition: opacity 0.2s ease;
		margin-top: auto;
	}

	.promo-cta:hover {
		opacity: 0.95;
	}
</style>
