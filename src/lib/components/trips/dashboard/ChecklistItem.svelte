<script lang="ts">
	import { goto } from '$app/navigation';

	interface Props {
		label: string;
		isComplete: boolean;
		href: string;
	}

	let { label, isComplete, href }: Props = $props();

	function handleClick() {
		goto(href);
	}
</script>

<button class="checklist-item" class:complete={isComplete} onclick={handleClick} type="button">
	<div class="checkbox-icon">
		{#if isComplete}
			<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
				<path d="M9 12l2 2 4-4" />
				<rect x="3" y="3" width="18" height="18" rx="2" />
			</svg>
		{:else}
			<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<rect x="3" y="3" width="18" height="18" rx="2" />
			</svg>
		{/if}
	</div>
	<span class="checklist-label">{label}</span>
</button>

<style>
	.checklist-item {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		width: 100%;
		padding: 0.5rem 0;
		background: transparent;
		border: none;
		cursor: pointer;
		text-align: left;
		transition: opacity 0.2s ease;
	}

	.checklist-item:hover {
		opacity: 0.7;
	}

	.checkbox-icon {
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 16px;
		height: 16px;
		color: var(--text, #111827);
	}

	.checklist-item.complete .checkbox-icon {
		color: var(--muted, #6b7280);
	}

	.checklist-label {
		font-size: 0.875rem;
		line-height: 1.4;
		color: var(--text, #111827);
		flex: 1;
	}

	.checklist-item.complete .checklist-label {
		color: var(--muted, #6b7280);
		font-style: italic;
		text-decoration: line-through;
	}
</style>
