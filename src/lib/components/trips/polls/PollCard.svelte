<script lang="ts">
	import type { PollWithMeta } from './types.js';
	import { CATEGORY_ICONS } from './types.js';

	interface Props {
		poll: PollWithMeta;
		onClick?: () => void;
	}

	let { poll, onClick }: Props = $props();

	function truncate(str: string | null | undefined, maxLen: number): string {
		if (!str) return '';
		return str.length <= maxLen ? str : str.slice(0, maxLen) + '…';
	}

	const statusClass = $derived({
		open: poll.statusDisplay === 'open',
		'closing-soon': poll.statusDisplay === 'closing_soon',
		closed: poll.statusDisplay === 'closed',
		draft: poll.statusDisplay === 'draft',
		canceled: poll.statusDisplay === 'canceled'
	});

	const icon = $derived(CATEGORY_ICONS[poll.category] ?? '📋');
</script>

<article
	class="poll-card"
	class:clickable={!!onClick}
	role={onClick ? 'button' : 'article'}
	tabindex={onClick ? 0 : undefined}
	onclick={onClick}
	onkeydown={(e) => {
		if (onClick && (e.key === 'Enter' || e.key === ' ')) {
			e.preventDefault();
			onClick();
		}
	}}
>
	<div class="card-top">
		<div class="category-row">
			<span class="category-icon" aria-hidden="true">{icon}</span>
			<span class="category-name">{poll.category}</span>
		</div>
		<span
			class="status-pill {Object.entries(statusClass)
				.filter(([, v]) => v)
				.map(([k]) => k)
				.join(' ')}"
			data-status={poll.statusDisplay}
		>
			{#if poll.statusDisplay === 'closing_soon'}
				Closing soon
			{:else if poll.statusDisplay === 'open'}
				Open
			{:else if poll.statusDisplay === 'closed'}
				Closed
			{:else if poll.statusDisplay === 'draft'}
				Draft
			{:else if poll.statusDisplay === 'canceled'}
				Canceled
			{:else}
				{poll.status}
			{/if}
		</span>
	</div>

	<h2 class="poll-title">{poll.title}</h2>
	{#if poll.description}
		<p class="poll-description">{truncate(poll.description, 120)}</p>
	{/if}

	<div class="card-footer">
		<span class="time-label">{poll.timeLabel}</span>
		<span class="vote-count">{poll.totalVotes} {poll.totalVotes === 1 ? 'vote' : 'votes'}</span>
	</div>
</article>

<style>
	.poll-card {
		background: var(--surfaceSolid, #fff);
		border-radius: var(--radius-2xl, 14px);
		border: 1px solid var(--border-soft, rgba(17, 24, 39, 0.06));
		box-shadow: var(--shadow-sm, 0 1px 2px rgba(0, 0, 0, 0.04));
		padding: 1.25rem 1.5rem;
		transition: box-shadow 0.2s ease, transform 0.2s ease;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}
	.poll-card.clickable {
		cursor: pointer;
	}
	.poll-card.clickable:hover {
		box-shadow: var(--shadow-md, 0 4px 6px rgba(0, 0, 0, 0.06));
		transform: translateY(-2px);
	}
	.poll-card.clickable:focus-visible {
		outline: none;
		box-shadow: 0 0 0 3px var(--focusRing);
	}
	.card-top {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
	}
	.category-row {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		font-size: 0.8125rem;
		color: var(--muted);
	}
	.category-icon {
		font-size: 1rem;
	}
	.category-name {
		font-weight: 500;
	}
	.status-pill {
		padding: 0.2rem 0.5rem;
		border-radius: 9999px;
		font-weight: 600;
		font-size: 0.75rem;
		flex-shrink: 0;
	}
	.status-pill.open {
		background: rgba(34, 197, 94, 0.15);
		color: #15803d;
	}
	.status-pill.closing-soon {
		background: rgba(245, 158, 11, 0.2);
		color: #b45309;
	}
	.status-pill.closed {
		background: var(--border-soft);
		color: var(--muted);
	}
	.status-pill.draft {
		background: rgba(99, 102, 241, 0.15);
		color: #4f46e5;
	}
	.status-pill.canceled {
		background: rgba(185, 28, 28, 0.1);
		color: var(--danger);
	}
	.poll-title {
		font-size: 1.125rem;
		font-weight: 700;
		margin: 0;
		color: var(--text);
		line-height: 1.35;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
	.poll-description {
		font-size: 0.875rem;
		color: var(--muted);
		margin: 0;
		line-height: 1.45;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
	.card-footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		font-size: 0.8125rem;
		color: var(--muted);
		margin-top: auto;
		padding-top: 0.5rem;
		border-top: 1px solid var(--border-soft);
	}
	.time-label {
	}
	.vote-count {
		font-weight: 500;
	}
</style>
