<script lang="ts">
	import type { Snippet } from 'svelte';
	import WidgetCard from './WidgetCard.svelte';

	interface Props {
		title: string;
		headers: string[];
		span?: 1 | 2;
		children?: Snippet;
	}

	let { title, headers, span = 2, children }: Props = $props();
</script>

<WidgetCard {title} span={span}>
	<div class="table-widget">
		<div class="table-header">
			{#each headers as h}
				<span class="th">{h}</span>
			{/each}
		</div>
		<div class="table-body">
			{#if children != null && typeof children === 'function'}
				{@render children()}
			{/if}
		</div>
	</div>
</WidgetCard>

<style>
	.table-widget {
		font-size: 0.8125rem;
	}

	.table-header {
		display: grid;
		grid-template-columns: 1fr 1fr auto;
		gap: 0.5rem;
		padding-bottom: 0.5rem;
		margin-bottom: 0.5rem;
		border-bottom: 1px solid rgba(0, 0, 0, 0.06);
	}

	.th {
		font-size: 0.6875rem;
		font-weight: 600;
		letter-spacing: 0.03em;
		text-transform: uppercase;
		color: #64748b;
	}

	.table-body {
		display: flex;
		flex-direction: column;
		gap: 0;
	}
</style>
