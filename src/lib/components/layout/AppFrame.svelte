<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		sidebar?: Snippet;
		children?: Snippet;
	}

	let { sidebar, children }: Props = $props();
</script>

<div class="app-frame">
	{#if sidebar != null && typeof sidebar === 'function'}
		<aside class="app-frame-sidebar">
			{@render sidebar()}
		</aside>
	{/if}
	<div class="app-frame-main">
		{#if children != null && typeof children === 'function'}
			{@render children()}
		{/if}
	</div>
</div>

<style>
	.app-frame {
		display: flex;
		width: 100%;
		height: 100vh;
		overflow: hidden;
		background: transparent;
		/* No rounded box here: sidebar blends into background; only main pane is the soft-edge box */
	}

	.app-frame-sidebar {
		flex-shrink: 0;
		width: 240px;
		display: flex;
		flex-direction: column;
		max-height: 100vh;
		overflow-y: auto;
		/* No soft edges; blends into shell background */
	}

	.app-frame-main {
		flex: 1;
		display: flex;
		flex-direction: column;
		min-width: 0;
		min-height: 0;
		margin: 1.5rem;
		margin-left: 0.75rem;
		border-radius: var(--radius-2xl);
		overflow: hidden;
		background: white;
		border: 1px solid var(--border);
		box-shadow: var(--shadow-lg);
	}
</style>
