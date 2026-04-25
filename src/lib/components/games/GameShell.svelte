<script lang="ts">
	import type { Snippet } from 'svelte';

	type GameColor = 'teal' | 'coral' | 'purple' | 'amber';

	interface Props {
		gameName: string;
		gameIcon: string;
		gameColor: GameColor;
		onBack: () => void;
		children?: Snippet;
	}

	let { gameName, gameIcon, gameColor, onBack, children }: Props = $props();

	const colorMap: Record<GameColor, string> = {
		teal:   '#1D9E75',
		coral:  '#CE5612',
		purple: '#7850b4',
		amber:  '#c08820',
	};

	const bgMap: Record<GameColor, string> = {
		teal:   'rgba(29,158,117,0.1)',
		coral:  'rgba(206,86,18,0.1)',
		purple: 'rgba(120,80,180,0.1)',
		amber:  'rgba(192,136,32,0.1)',
	};

	const color = $derived(colorMap[gameColor]);
	const bg = $derived(bgMap[gameColor]);
</script>

<div class="gs-shell">
	<nav class="gs-nav">
		<button type="button" class="gs-back" onclick={onBack} aria-label="Back to Games">
			<span class="gs-back-arrow" aria-hidden="true">←</span>
			Games
		</button>
	</nav>

	<header class="gs-header">
		<div class="gs-badge" style="background: {bg}; color: {color};" aria-hidden="true">
			{gameIcon}
		</div>
		<h1 class="gs-title">{gameName}</h1>
	</header>

	<div class="gs-content">
		{#if children}
			{@render children()}
		{/if}
	</div>
</div>

<style>
	.gs-shell {
		display: flex;
		flex-direction: column;
		gap: 0;
		min-width: 0;
	}

	.gs-nav {
		padding: 0 0 0.5rem;
	}

	.gs-back {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		background: none;
		border: none;
		padding: 12px 16px 12px 0;
		font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
		font-size: 0.875rem;
		font-weight: 500;
		color: #2f7778;
		cursor: pointer;
		transition: color 0.12s;
		min-height: 44px;
	}

	.gs-back:hover {
		color: #1d4d4e;
	}

	.gs-back-arrow {
		font-size: 1rem;
	}

	.gs-header {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding-bottom: 1.25rem;
		border-bottom: 1px solid #e2e8f0;
		margin-bottom: 1.25rem;
	}

	.gs-badge {
		flex-shrink: 0;
		width: 36px;
		height: 36px;
		border-radius: 10px;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 1.125rem;
	}

	.gs-title {
		font-family: 'Fraunces', Georgia, serif;
		font-size: clamp(1.25rem, 3.5vw, 1.625rem);
		font-weight: 700;
		color: #1d4d4e;
		margin: 0;
		letter-spacing: -0.02em;
	}

	.gs-content {
		min-width: 0;
	}

	@media (max-width: 767px) {
		.gs-nav {
			padding: 0;
		}

		.gs-header {
			padding-bottom: 1rem;
			margin-bottom: 1rem;
		}
	}
</style>
