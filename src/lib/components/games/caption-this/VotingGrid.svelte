<script lang="ts">
	type Caption = { id: string; text: string };
	type Props = {
		captions: Caption[];
		roundId: string;
		myVoteCaptionId: string | null;
		myCaptionIds: Set<string>;
		voteError: string | null;
		activeTabId?: string | null;
	};
	let {
		captions = [],
		roundId,
		myVoteCaptionId = null,
		myCaptionIds = new Set(),
		voteError = null,
		activeTabId = null
	}: Props = $props();

	let voting = $state<string | null>(null);
	let error = $state<string | null>(voteError ?? null);

	$effect(() => {
		error = voteError ?? null;
	});
</script>

<div class="voting-grid">
	{#each captions as c}
		{@const isMine = myCaptionIds.has(c.id)}
		{@const isVoted = myVoteCaptionId === c.id}
		<div class="vote-card">
			<p class="vote-card-text">"{c.text}"</p>
			{#if isVoted}
				<span class="voted-badge">You voted</span>
			{:else if isMine}
				<span class="voted-badge own">Your caption</span>
			{:else}
				<form method="POST" action="?/submitVote" class="vote-form">
					<input type="hidden" name="roundId" value={roundId} />
					<input type="hidden" name="captionId" value={c.id} />
					{#if activeTabId}
						<input type="hidden" name="activeTab" value={activeTabId} />
					{/if}
					<button
						type="submit"
						class="vote-btn"
						disabled={myVoteCaptionId != null || voting != null}
					>
						Vote
					</button>
				</form>
			{/if}
		</div>
	{/each}
</div>
{#if error}
	<p class="error">{error}</p>
{/if}

<style>
	.voting-grid {
		display: grid;
		grid-template-columns: repeat(1, 1fr);
		gap: 0.75rem;
		margin-top: 1rem;
	}
	@media (min-width: 640px) {
		.voting-grid {
			grid-template-columns: repeat(2, 1fr);
		}
	}
	@media (min-width: 900px) {
		.voting-grid {
			grid-template-columns: repeat(3, 1fr);
		}
	}
	.vote-card {
		background: var(--surface, #fff);
		border: 1px solid var(--border, #e5e5e5);
		border-radius: 10px;
		padding: 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}
	.vote-card-text {
		margin: 0;
		font-size: 0.9375rem;
		line-height: 1.4;
		color: var(--text, #1a1a1a);
		flex: 1;
	}
	.vote-form {
		margin: 0;
	}
	.vote-btn {
		padding: 0.4rem 0.75rem;
		font-size: 0.8125rem;
		font-weight: 600;
		background: var(--primary, #e85d04);
		color: white;
		border: none;
		border-radius: 6px;
		cursor: pointer;
	}
	.vote-btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}
	.voted-badge {
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--success, #16a34a);
	}
	.voted-badge.own {
		color: var(--muted, #666);
	}
	.error {
		font-size: 0.875rem;
		color: var(--error, #c00);
		margin: 0.5rem 0 0 0;
	}
</style>
