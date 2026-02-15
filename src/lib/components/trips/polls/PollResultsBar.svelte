<script lang="ts">
	import type { PollOptionWithCount } from './types.js';

	interface Props {
		options: PollOptionWithCount[];
		totalVotes: number;
		/** Optional: highlight options the current user voted for */
		userOptionIds?: string[];
	}

	let { options, totalVotes, userOptionIds = [] }: Props = $props();
</script>

<div class="poll-results">
	{#each options as opt}
		<div class="result-row" class:user-voted={userOptionIds.includes(opt.id)}>
			<span class="option-label">{opt.label}</span>
			<span class="option-bar-wrap">
				<span
					class="option-bar"
					style="width: {totalVotes > 0 ? (100 * opt.voteCount) / totalVotes : 0}%"
				></span>
			</span>
			<span class="option-meta">
				{totalVotes > 0 ? Math.round((100 * opt.voteCount) / totalVotes) : 0}% · {opt.voteCount} {opt
					.voteCount === 1
					? 'vote'
					: 'votes'}
			</span>
		</div>
	{/each}
	<p class="total-votes">{totalVotes} {totalVotes === 1 ? 'vote' : 'votes'} total</p>
</div>

<style>
	.poll-results {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.result-row {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		font-size: 0.9375rem;
	}
	.result-row.user-voted .option-label {
		font-weight: 600;
		color: var(--primary);
	}
	.option-label {
		flex: 0 0 auto;
		min-width: 120px;
		color: var(--text);
	}
	.option-bar-wrap {
		flex: 1;
		height: 8px;
		background: var(--border-soft, #e2e8f0);
		border-radius: 4px;
		overflow: hidden;
	}
	.option-bar {
		display: block;
		height: 100%;
		background: var(--primary);
		border-radius: 4px;
		transition: width 0.3s ease;
	}
	.option-meta {
		flex: 0 0 auto;
		font-size: 0.8125rem;
		color: var(--muted);
		width: 6rem;
		text-align: right;
	}
	.total-votes {
		font-size: 0.8125rem;
		color: var(--muted);
		margin: 0.5rem 0 0 0;
	}
</style>
