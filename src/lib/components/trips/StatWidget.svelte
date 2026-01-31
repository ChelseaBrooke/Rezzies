<script lang="ts">
	import type { Snippet } from 'svelte';
	import WidgetCard from './WidgetCard.svelte';

	interface Props {
		title: string;
		value: string | number;
		subtext?: string;
		/** Bar heights 0-100 for micro chart (e.g. [75, 60, 90, 45, 80, 70, 50]) */
		barHeights?: number[];
		children?: Snippet;
	}

	let { title, value, subtext = '', barHeights = [], children }: Props = $props();
</script>

<WidgetCard {title}>
	<div class="stat-widget">
		<div class="stat-value">{value}</div>
		{#if subtext}
			<div class="stat-subtext">{subtext}</div>
		{/if}
		{#if barHeights.length > 0}
			<div class="micro-bars" role="presentation">
				{#each barHeights as h}
					<div class="bar" data-h={h} style="--bar-h: {h}%"></div>
				{/each}
			</div>
		{/if}
		{#if children != null && typeof children === 'function'}
			{@render children()}
		{/if}
	</div>
</WidgetCard>

<style>
	.stat-widget {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.stat-value {
		font-size: 1.5rem;
		font-weight: 600;
		color: var(--text);
	}

	.stat-subtext {
		font-size: 0.75rem;
		color: var(--muted);
	}

	.micro-bars {
		display: flex;
		align-items: flex-end;
		gap: 0.25rem;
		height: 2.5rem;
		margin-top: 0.5rem;
	}

	.bar {
		flex: 1;
		min-width: 4px;
		height: var(--bar-h, 50%);
		border-radius: 2px;
		background: linear-gradient(180deg, var(--slate) 0%, var(--muted) 100%);
		opacity: 0.6;
		transition: height var(--transition-base);
	}
</style>
