<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';

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
	let error = $state<string | null>(null);

	$effect(() => {
		error = voteError ?? null;
	});

	function handleVoteSubmit() {
		return async ({
			result,
			update
		}: {
			result: { type: string };
			update: () => Promise<void>;
		}) => {
			await update();
			if (result.type === 'success' || result.type === 'redirect') {
				await invalidateAll();
			}
		};
	}
</script>

<ul class="voting-list" role="list">
	{#each captions as c}
		{@const isMine = myCaptionIds.has(c.id)}
		{@const isVoted = myVoteCaptionId === c.id}
		{@const votable = !isVoted && !isMine && myVoteCaptionId == null && voting == null}
		<li
			class="vote-option"
			class:voted={isVoted}
			class:own={isMine}
			class:disabled={myVoteCaptionId != null || voting != null}
		>
			{#if votable}
				<form method="POST" action="?/submitVote" class="vote-form-full" use:enhance={handleVoteSubmit}>
					<input type="hidden" name="roundId" value={roundId} />
					<input type="hidden" name="captionId" value={c.id} />
					{#if activeTabId}
						<input type="hidden" name="activeTab" value={activeTabId} />
					{/if}
					<button type="submit" class="vote-option-btn">
						<span class="option-dot" aria-hidden="true"></span>
						<div class="vote-option-body">
							<p class="vote-card-text">"{c.text}"</p>
							<span class="vote-hint">Click to vote</span>
						</div>
					</button>
				</form>
			{:else}
				<span class="option-dot" aria-hidden="true"></span>
				<div class="vote-option-body">
					<p class="vote-card-text">"{c.text}"</p>
					{#if isVoted}
						<span class="choice-badge voted">You voted</span>
					{:else if isMine}
						<span class="choice-badge own">Your caption</span>
					{/if}
				</div>
			{/if}
		</li>
	{/each}
</ul>
{#if error}
	<p class="error">{error}</p>
{/if}

<style>
	.voting-list {
		list-style: none;
		margin: 1rem 0 0 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.vote-option {
		display: flex;
		align-items: flex-start;
		gap: 0.75rem;
		padding: 0.875rem 1rem;
		background: var(--surface, #fff);
		border: 1px solid var(--border, #e5e5e5);
		border-radius: 10px;
		border-left: 3px solid transparent;
		transition: background 0.2s, border-color 0.2s, box-shadow 0.2s;
	}
	.vote-option:hover:not(.disabled):not(.voted):not(.own) {
		background: rgba(72, 187, 120, 0.08);
		border-left-color: #48bb78;
		box-shadow: 0 2px 8px rgba(72, 187, 120, 0.15);
	}
	.vote-option.voted {
		background: rgba(22, 163, 74, 0.06);
		border-left-color: var(--success, #16a34a);
	}
	.vote-option.own {
		border-left-color: var(--muted, #999);
	}
	.vote-option .option-dot {
		flex-shrink: 0;
		width: 12px;
		height: 12px;
		border-radius: 50%;
		border: 2px solid var(--border, #d0d0d0);
		background: transparent;
		margin-top: 0.3rem;
		transition: background 0.2s, border-color 0.2s, transform 0.2s;
	}
	.vote-option:hover:not(.disabled):not(.voted):not(.own) .option-dot {
		border-color: #48bb78;
		transform: scale(1.1);
	}
	.vote-option.voted .option-dot {
		background: var(--success, #16a34a);
		border-color: var(--success, #16a34a);
	}
	.vote-form-full {
		display: flex;
		align-items: flex-start;
		gap: 0.75rem;
		width: 100%;
		margin: 0;
	}
	.vote-option-btn {
		display: flex;
		align-items: flex-start;
		gap: 0.75rem;
		flex: 1;
		width: 100%;
		text-align: left;
		padding: 0;
		margin: 0;
		background: none;
		border: none;
		cursor: pointer;
		font: inherit;
		color: inherit;
	}
	.vote-option-body {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.vote-card-text {
		margin: 0;
		font-size: 0.9375rem;
		line-height: 1.4;
		color: var(--text, #1a1a1a);
	}
	.vote-hint {
		font-size: 0.75rem;
		color: var(--muted, #666);
	}
	.choice-badge {
		font-size: 0.75rem;
		font-weight: 600;
	}
	.choice-badge.voted {
		color: var(--success, #16a34a);
	}
	.choice-badge.own {
		color: var(--muted, #666);
	}
	.error {
		font-size: 0.875rem;
		color: var(--error, #c00);
		margin: 0.5rem 0 0 0;
	}
</style>
