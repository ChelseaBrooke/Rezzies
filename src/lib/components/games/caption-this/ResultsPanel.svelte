<script lang="ts">
	import { enhance } from '$app/forms';

	type CaptionWithVotes = { id: string; text: string; voteCount?: number };
	type Props = {
		captions: CaptionWithVotes[];
		isPhotoSubmitter: boolean;
		activeTabId?: string | null;
	};
	let { captions = [], isPhotoSubmitter = false, activeTabId = null }: Props = $props();

	let startingNext = $state(false);

	const sorted = $derived(
		[...captions].sort((a, b) => (b.voteCount ?? 0) - (a.voteCount ?? 0))
	);
	const maxVotes = $derived(
		sorted.length ? Math.max(...sorted.map((c) => c.voteCount ?? 0)) : 0
	);
	const winners = $derived(sorted.filter((c) => (c.voteCount ?? 0) === maxVotes && maxVotes > 0));
</script>

<div class="results-panel">
	<h3 class="results-title">Round results</h3>
	{#if winners.length > 0}
		<p class="winners-label">Winning caption{winners.length !== 1 ? 's' : ''}</p>
		{#each winners as w}
			<div class="winner-card">
				<p class="winner-text">"{w.text}"</p>
				<span class="winner-votes">{w.voteCount} vote{(w.voteCount ?? 0) !== 1 ? 's' : ''}</span>
			</div>
		{/each}
	{:else}
		<p class="no-winners">No captions this round.</p>
	{/if}
	<div class="vote-distribution">
		<p class="dist-label">Vote distribution</p>
		<ul class="dist-list">
			{#each sorted as c}
				<li class="dist-item">
					<span class="dist-text">"{c.text}"</span>
					<span class="dist-count">{c.voteCount ?? 0} vote{(c.voteCount ?? 0) !== 1 ? 's' : ''}</span>
				</li>
			{/each}
		</ul>
	</div>
	{#if isPhotoSubmitter}
		<form
			method="POST"
			action="?/startNextRound"
			class="next-round-form"
			use:enhance={() => {
				return async ({ update }) => {
					startingNext = true;
					try {
						await update();
					} finally {
						startingNext = false;
					}
				};
			}}
		>
			{#if activeTabId}
				<input type="hidden" name="activeTab" value={activeTabId} />
			{/if}
			<button type="submit" class="next-round-btn" disabled={startingNext}>
				{startingNext ? 'Starting…' : 'Start next round'}
			</button>
		</form>
	{:else}
		<p class="waiting-next">Photo submitter will start the next round.</p>
	{/if}
</div>

<style>
	.results-panel {
		margin-top: 1rem;
		padding: 1rem;
		background: var(--surface2, #f5f5f5);
		border-radius: 12px;
		border: 1px solid var(--border, #e5e5e5);
	}
	.results-title {
		margin: 0 0 0.75rem 0;
		font-size: 1rem;
		font-weight: 600;
		color: var(--text, #1a1a1a);
	}
	.winners-label {
		font-size: 0.8125rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.03em;
		color: var(--muted, #666);
		margin: 0 0 0.5rem 0;
	}
	.winner-card {
		background: var(--surface, #fff);
		border: 1px solid var(--success, #16a34a);
		border-radius: 8px;
		padding: 0.75rem 1rem;
		margin-bottom: 0.5rem;
	}
	.winner-text {
		margin: 0 0 0.25rem 0;
		font-size: 0.9375rem;
		color: var(--text, #1a1a1a);
	}
	.winner-votes {
		font-size: 0.75rem;
		color: var(--muted, #666);
	}
	.no-winners {
		font-size: 0.9375rem;
		color: var(--muted, #666);
		margin: 0 0 0.75rem 0;
	}
	.vote-distribution {
		margin-top: 1rem;
		padding-top: 1rem;
		border-top: 1px solid var(--border, #eee);
	}
	.dist-label {
		font-size: 0.8125rem;
		font-weight: 600;
		color: var(--muted, #666);
		margin: 0 0 0.5rem 0;
	}
	.dist-list {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.dist-item {
		display: flex;
		justify-content: space-between;
		gap: 0.5rem;
		padding: 0.35rem 0;
		font-size: 0.875rem;
		border-bottom: 1px solid var(--border, #f0f0f0);
	}
	.dist-text {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		color: var(--text, #1a1a1a);
	}
	.dist-count {
		flex-shrink: 0;
		color: var(--muted, #666);
	}
	.next-round-form {
		margin-top: 1rem;
	}
	.next-round-btn {
		padding: 0.6rem 1.25rem;
		font-size: 0.9375rem;
		font-weight: 600;
		background: var(--primary, #2F7778);
		color: white;
		border: none;
		border-radius: 8px;
		cursor: pointer;
	}
	.next-round-btn:disabled {
		opacity: 0.7;
		cursor: not-allowed;
	}
	.waiting-next {
		font-size: 0.875rem;
		color: var(--muted, #666);
		margin: 1rem 0 0 0;
	}
</style>
