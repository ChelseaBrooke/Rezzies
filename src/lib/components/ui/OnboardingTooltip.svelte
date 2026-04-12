<script lang="ts">
	import { onboardingStore } from '$lib/stores/onboarding.js';

	interface Props {
		key: string;
		title: string;
		body: string;
		position?: 'top' | 'bottom' | 'left' | 'right';
		align?: 'start' | 'center' | 'end';
		offsetX?: number;
		offsetY?: number;
	}

	let {
		key,
		title,
		body,
		position = 'bottom',
		align = 'center',
		offsetX = 0,
		offsetY = 0
	}: Props = $props();

	let activeKey = $state<string | null>(null);
	let exiting = $state(false);

	$effect(() => {
		const unsub = onboardingStore.activeKey.subscribe((k) => { activeKey = k; });
		return unsub;
	});

	const show = $derived(activeKey === key);

	function handleDismiss() {
		exiting = true;
		setTimeout(() => {
			onboardingStore.dismiss(key);
			exiting = false;
		}, 150);
	}
</script>

{#if show && !exiting}
	<div
		class="obt obt--{position} obt-align--{align}"
		style:--obt-ox="{offsetX}px"
		style:--obt-oy="{offsetY}px"
		role="status"
		aria-live="polite"
	>
		<div class="obt-arrow"></div>
		<button type="button" class="obt-close" onclick={handleDismiss} aria-label="Dismiss tip">
			<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
		</button>
		<p class="obt-title">{title}</p>
		<p class="obt-body">{body}</p>
		<button type="button" class="obt-got-it" onclick={handleDismiss}>Got it</button>
	</div>
{/if}

<style>
	.obt {
		position: absolute;
		z-index: 10000;
		max-width: 280px;
		padding: 14px 32px 14px 16px;
		background: rgba(29, 77, 78, 0.96);
		border-radius: var(--radius-xl, 0.75rem);
		border-top: 2px solid var(--carrot, #F7AA29);
		box-shadow: 0 8px 24px rgba(29, 77, 78, 0.3);
		pointer-events: auto;
		animation: obt-enter 150ms ease both;
	}

	/* Position variants */
	.obt--bottom { top: calc(100% + 10px); }
	.obt--top { bottom: calc(100% + 10px); }
	.obt--left {
		right: calc(100% + 10px);
		top: 50%;
		transform: translateY(-50%) translateX(var(--obt-ox, 0px));
	}
	.obt--right {
		left: calc(100% + 10px);
		top: 50%;
		transform: translateY(-50%) translateX(var(--obt-ox, 0px));
	}

	/* Alignment along the edge (for top/bottom) */
	.obt--bottom.obt-align--start, .obt--top.obt-align--start { left: var(--obt-ox, 0px); }
	.obt--bottom.obt-align--center, .obt--top.obt-align--center { left: 50%; transform: translateX(calc(-50% + var(--obt-ox, 0px))); }
	.obt--bottom.obt-align--end, .obt--top.obt-align--end { right: var(--obt-ox, 0px); }

	/* Alignment for left/right */
	.obt--left.obt-align--start, .obt--right.obt-align--start { top: var(--obt-oy, 0px); transform: translateX(0); }
	.obt--left.obt-align--end, .obt--right.obt-align--end { top: auto; bottom: var(--obt-oy, 0px); transform: translateX(0); }

	/* Arrow */
	.obt-arrow {
		position: absolute;
		width: 12px;
		height: 12px;
		background: rgba(29, 77, 78, 0.96);
	}
	.obt--bottom .obt-arrow {
		top: -6px;
		left: 50%;
		transform: translateX(-50%) rotate(45deg);
		border-top: 2px solid var(--carrot, #F7AA29);
		border-left: 2px solid var(--carrot, #F7AA29);
	}
	.obt--top .obt-arrow {
		bottom: -6px;
		left: 50%;
		transform: translateX(-50%) rotate(45deg);
		border-bottom: 2px solid transparent;
		border-right: 2px solid transparent;
	}
	.obt--left .obt-arrow {
		right: -6px;
		top: 50%;
		transform: translateY(-50%) rotate(45deg);
		border-top: 2px solid transparent;
		border-right: 2px solid transparent;
	}
	.obt--right .obt-arrow {
		left: -6px;
		top: 50%;
		transform: translateY(-50%) rotate(45deg);
		border-bottom: 2px solid var(--carrot, #F7AA29);
		border-left: 2px solid var(--carrot, #F7AA29);
	}

	.obt-close {
		position: absolute;
		top: 8px;
		right: 8px;
		background: none;
		border: none;
		color: rgba(255, 255, 255, 0.5);
		cursor: pointer;
		padding: 2px;
		line-height: 1;
		transition: color 150ms ease;
	}
	.obt-close:hover { color: #fff; }

	.obt-title {
		margin: 0 0 4px;
		font-family: 'Fraunces', Georgia, serif;
		font-size: 0.875rem;
		font-weight: 600;
		color: #fff;
		line-height: 1.3;
	}
	.obt-body {
		margin: 0 0 10px;
		font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
		font-size: 0.8125rem;
		font-weight: 400;
		color: rgba(255, 255, 255, 0.85);
		line-height: 1.45;
	}
	.obt-got-it {
		display: inline-block;
		padding: 4px 14px;
		font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--navy, #1d4d4e);
		background: var(--carrot, #F7AA29);
		border: none;
		border-radius: var(--radius-md, 0.375rem);
		cursor: pointer;
		transition: opacity 150ms ease;
	}
	.obt-got-it:hover { opacity: 0.85; }

	@keyframes obt-enter {
		from { opacity: 0; transform: translateY(6px); }
		to   { opacity: 1; transform: translateY(0); }
	}
	.obt--top { animation-name: obt-enter-up; }
	@keyframes obt-enter-up {
		from { opacity: 0; transform: translateY(-6px); }
		to   { opacity: 1; transform: translateY(0); }
	}
	.obt--left { animation-name: obt-enter-left; }
	@keyframes obt-enter-left {
		from { opacity: 0; transform: translateY(-50%) translateX(6px); }
		to   { opacity: 1; transform: translateY(-50%) translateX(var(--obt-ox, 0px)); }
	}
	.obt--right { animation-name: obt-enter-right; }
	@keyframes obt-enter-right {
		from { opacity: 0; transform: translateY(-50%) translateX(-6px); }
		to   { opacity: 1; transform: translateY(-50%) translateX(var(--obt-ox, 0px)); }
	}
	.obt--left.obt-align--start, .obt--right.obt-align--start,
	.obt--left.obt-align--end, .obt--right.obt-align--end {
		animation-name: obt-enter;
	}
	.obt--bottom.obt-align--center { animation-name: obt-enter-center-down; }
	@keyframes obt-enter-center-down {
		from { opacity: 0; transform: translateX(calc(-50% + var(--obt-ox, 0px))) translateY(6px); }
		to   { opacity: 1; transform: translateX(calc(-50% + var(--obt-ox, 0px))) translateY(0); }
	}
	.obt--top.obt-align--center { animation-name: obt-enter-center-up; }
	@keyframes obt-enter-center-up {
		from { opacity: 0; transform: translateX(calc(-50% + var(--obt-ox, 0px))) translateY(-6px); }
		to   { opacity: 1; transform: translateX(calc(-50% + var(--obt-ox, 0px))) translateY(0); }
	}
</style>
