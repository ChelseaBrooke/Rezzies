<script lang="ts">
	import type { Snippet } from 'svelte';
	import FocusBackground from './FocusBackground.svelte';
	import divviLogo from '$lib/assets/images/divvi logo.png';

	let {
		progressPercent = 0,
		stepLabel = '',
		onBack,
		children
	}: {
		progressPercent: number;
		stepLabel?: string;
		onBack?: () => void;
		children: Snippet;
	} = $props();
</script>

<div class="fs">
	<FocusBackground />

	<header class="fs-top">
		<a href="/trips" class="fs-wordmark" aria-label="Back to all trips">
			<img src={divviLogo} alt="Divvi" class="fs-wordmark-img" />
		</a>

		<div
			class="fs-progress-wrap"
			role="progressbar"
			aria-valuenow={progressPercent}
			aria-valuemin={0}
			aria-valuemax={100}
			aria-label="Wizard progress"
		>
			<div class="fs-progress-fill" style="width: {Math.min(100, Math.max(0, progressPercent))}%"></div>
		</div>

		{#if stepLabel}
			<span class="fs-step-label" aria-hidden="true">{stepLabel}</span>
		{/if}
	</header>

	<main class="fs-main">
		<div class="fs-content">
			{@render children()}
		</div>
	</main>
</div>

<style>
	/* ── Shell wrapper ────────────────────────────────────── */
	.fs {
		position: relative;
		min-height: 100dvh;
		display: flex;
		flex-direction: column;
		background: var(--surfaceSolid);
		color: var(--text);
		font-family: 'Plus Jakarta Sans', Helvetica, Arial, sans-serif;
	}

	/* ── Top bar ──────────────────────────────────────────── */
	.fs-top {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		z-index: 10;
		height: 52px;
		display: grid;
		grid-template-columns: auto 1fr auto;
		align-items: center;
		gap: 1rem;
		padding: 0 1.5rem;
		background: var(--surfaceSolid);
		border-bottom: 1px solid var(--border);
		box-sizing: border-box;
	}

	/* ── Wordmark ─────────────────────────────────────────── */
	.fs-wordmark {
		display: inline-flex;
		align-items: center;
		text-decoration: none;
		line-height: 1;
	}

	.fs-wordmark-img {
		display: block;
		height: 1.75rem;
		width: auto;
		max-width: 7rem;
		object-fit: contain;
	}

	.fs-wordmark:hover {
		opacity: 0.8;
	}

	/* ── Progress bar ─────────────────────────────────────── */
	.fs-progress-wrap {
		max-width: 480px;
		margin: 0 auto;
		width: 100%;
		height: 4px;
		background: var(--border-paper);
		border-radius: 2px;
		overflow: hidden;
	}

	.fs-progress-fill {
		height: 100%;
		background: var(--carrot);
		border-radius: 2px;
		transition: width 0.4s ease;
	}

	/* ── Step label ───────────────────────────────────────── */
	.fs-step-label {
		font-size: 0.6875rem;
		color: var(--muted);
		white-space: nowrap;
		text-align: right;
	}

	/* ── Main content area ────────────────────────────────── */
	.fs-main {
		position: relative;
		z-index: 1;
		flex: 1;
		display: flex;
		flex-direction: column;
		padding-top: 52px;
		min-height: 100dvh;
		box-sizing: border-box;
	}

	.fs-content {
		flex: 1;
		display: flex;
		flex-direction: column;
		justify-content: center;
		padding: 2.5rem 1.5rem 3rem;
		width: 100%;
		max-width: 568px;
		margin: 0 auto;
		box-sizing: border-box;
	}

	/* ── Mobile ───────────────────────────────────────────── */
	@media (max-width: 640px) {
		.fs-top {
			height: 48px;
		}

		.fs-wordmark-img {
			height: 1.5rem;
		}

		.fs-step-label {
			display: none;
		}

		.fs-main {
			padding-top: 48px;
		}

		.fs-content {
			justify-content: flex-start;
			padding: 2rem 1.25rem 3rem;
		}
	}
</style>
