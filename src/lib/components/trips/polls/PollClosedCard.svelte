<script lang="ts">
	import type { PollWithMeta } from './types.js';
	import { CATEGORY_ICONS } from './types.js';
	import PollResultsPie from './PollResultsPie.svelte';

	interface Props {
		poll: PollWithMeta;
		onClick?: () => void;
	}

	let { poll, onClick }: Props = $props();

	const icon = $derived(CATEGORY_ICONS[poll.category] ?? '📋');

	const userAnswerLabels = $derived(
		poll.userOptionIds
			.map((id) => poll.options.find((o) => o.id === id)?.label)
			.filter(Boolean) as string[]
	);

	const totalVotes = poll.totalVotes ?? 0;
	const winner = $derived(
		poll.options.length > 0
			? poll.options.reduce((a, b) => ((b.voteCount ?? 0) >= (a.voteCount ?? 0) ? b : a))
			: null
	);
	const winnerPercentage = $derived(
		winner && totalVotes > 0 ? Math.round(((winner.voteCount ?? 0) / totalVotes) * 100) : 0
	);
</script>

<article
	class="closed-card"
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
		<span class="status-pill closed">{poll.statusDisplay === 'canceled' ? 'Canceled' : 'Closed'}</span>
	</div>

	<h2 class="poll-title">{poll.title}</h2>
	{#if poll.description}
		<p class="poll-description">{poll.description}</p>
	{/if}

	<div class="winner-block">
		<p class="winner-line">
			<span class="winner-label">Winner:</span>
			{#if winner}
				<span class="winner-value">{winner.label}</span>
				<span class="winner-pct">({winnerPercentage}%)</span>
			{:else}
				<span class="winner-muted">No votes</span>
			{/if}
		</p>
	</div>

	<div class="results-area">
		<PollResultsPie
			options={poll.options}
			totalVotes={poll.totalVotes}
			userOptionIds={poll.userOptionIds}
			size={100}
		/>
	</div>

	<div class="card-footer">
		<span class="time-label">
			Your vote: {userAnswerLabels.length > 0 ? userAnswerLabels.join(', ') : '—'}
		</span>
		<span class="vote-count">{poll.totalVotes} {poll.totalVotes === 1 ? 'vote' : 'votes'}</span>
	</div>
</article>

<style>
	.closed-card {
		background: var(--surfaceSolid, #fff);
		border-radius: var(--radius-2xl, 14px);
		border: 1px solid var(--border-soft, rgba(17, 24, 39, 0.06));
		box-shadow: var(--shadow-sm, 0 1px 2px rgba(0, 0, 0, 0.04));
		padding: 1.25rem 1.5rem;
		transition: box-shadow 0.2s ease, transform 0.2s ease;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		min-width: 0;
	}
	.closed-card.clickable {
		cursor: pointer;
	}
	.closed-card.clickable:hover {
		box-shadow: var(--shadow-md, 0 4px 6px rgba(0, 0, 0, 0.06));
		transform: translateY(-2px);
	}
	.card-top {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		flex-shrink: 0;
	}
	.category-row {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		font-size: 0.8125rem;
		color: var(--muted);
		min-width: 0;
	}
	.category-icon {
		flex-shrink: 0;
		font-size: 1rem;
	}
	.category-name {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.status-pill.closed {
		background: var(--border-soft);
		color: var(--muted);
		padding: 0.2rem 0.5rem;
		border-radius: 9999px;
		font-weight: 600;
		font-size: 0.75rem;
		flex-shrink: 0;
	}
	.poll-title {
		font-size: 1.125rem;
		font-weight: 700;
		margin: 0;
		color: var(--text);
		line-height: 1.35;
		overflow: hidden;
		text-overflow: ellipsis;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		word-break: break-word;
	}
	.poll-description {
		font-size: 0.875rem;
		color: var(--muted);
		margin: 0;
		line-height: 1.45;
		overflow: hidden;
		text-overflow: ellipsis;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		word-break: break-word;
	}
	.winner-block {
		padding: 0.75rem 1rem;
		background: linear-gradient(135deg, rgba(34, 197, 94, 0.08), rgba(34, 197, 94, 0.04));
		border-radius: var(--radius-lg);
		border: 1px solid rgba(34, 197, 94, 0.2);
		margin: 0.25rem 0;
	}
	.winner-line {
		font-size: 0.9375rem;
		color: var(--text);
		margin: 0;
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 0.35rem;
	}
	.winner-label {
		font-weight: 700;
		color: var(--text);
	}
	.winner-value {
		font-weight: 600;
		color: var(--text);
	}
	.winner-pct {
		color: var(--muted);
		font-size: 0.8125rem;
		font-weight: 500;
	}
	.winner-muted {
		color: var(--muted);
		font-style: italic;
	}
	.results-area {
		margin: 0.25rem 0;
		min-width: 0;
	}
	.card-footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		font-size: 0.8125rem;
		color: var(--muted);
		margin-top: auto;
		padding-top: 0.75rem;
		border-top: 1px solid var(--border-soft);
		flex-shrink: 0;
	}
	.time-label,
	.vote-count {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.vote-count {
		font-weight: 500;
		flex-shrink: 0;
	}
</style>
