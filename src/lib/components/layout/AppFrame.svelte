<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		sidebar?: Snippet;
		children?: Snippet;
	}

	let { sidebar, children }: Props = $props();
</script>

<div class="app-frame">
	{#if sidebar}
		<aside class="app-frame-sidebar">
			{@render sidebar()}
		</aside>
	{/if}
	<div class="app-frame-main">
		{#if children}
			{@render children()}
		{/if}
	</div>
</div>

<style>
	.app-frame {
		display: flex;
		width: 100%;
		min-height: 100vh;
		/* No rounded box here: sidebar blends into background; only main pane is the soft-edge box */
	}

	.app-frame-sidebar {
		flex-shrink: 0;
		width: 240px;
		display: flex;
		flex-direction: column;
		min-height: 100%;
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
		border-radius: 32px;
		overflow: hidden;
		background: linear-gradient(to bottom right, #f7fbff 0%, #f2f8ff 50%, #f7fbff 100%);
		border: 1px solid rgba(0, 0, 0, 0.05);
		box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(255, 255, 255, 0.7);
	}
</style>
