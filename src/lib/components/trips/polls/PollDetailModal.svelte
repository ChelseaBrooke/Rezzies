<script lang="ts">
	import type { PollWithMeta } from './types.js';
	import PollResultsBar from './PollResultsBar.svelte';

	interface Props {
		open: boolean;
		poll: PollWithMeta | null;
		onClose: () => void;
		onVote: (optionIds: string[]) => void;
		onNudge?: () => void;
		onClosePoll?: () => void;
		/** Host can nudge, close poll */
		canManage: boolean;
		submitting?: boolean;
		voteError?: string | null;
	}

	let {
		open,
		poll,
		onClose,
		onVote,
		onNudge,
		onClosePoll,
		canManage = false,
		submitting = false,
		voteError = null
	}: Props = $props();

	$effect(() => {
		if (!open) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') onClose();
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	});

	// For single choice: one optionId; for multi: array
	let selectedIds = $state<string[]>([]);

	$effect(() => {
		if (open && poll) {
			selectedIds = poll.userOptionIds ? [...poll.userOptionIds] : [];
		}
	});

	const canVote = $derived(
		poll && (poll.statusDisplay === 'open' || poll.statusDisplay === 'closing_soon') && !poll.userVoted
	);
	const showResults = $derived(
		poll &&
			(poll.statusDisplay === 'closed' ||
				poll.statusDisplay === 'canceled' ||
				(poll.showResultsLive && poll.userVoted))
	);

	function toggleOption(optionId: string) {
		if (!poll) return;
		if (poll.pollType === 'single') {
			selectedIds = [optionId];
		} else {
			const idx = selectedIds.indexOf(optionId);
			if (idx >= 0) selectedIds = selectedIds.filter((id) => id !== optionId);
			else selectedIds = [...selectedIds, optionId];
		}
	}

	function submitVote() {
		if (selectedIds.length === 0) return;
		if (poll?.pollType === 'single' && selectedIds.length > 1) return;
		onVote(selectedIds);
	}
</script>

{#if open && poll}
	<div
		class="modal-backdrop"
		role="dialog"
		aria-modal="true"
		aria-labelledby="poll-detail-title"
		onclick={onClose}
	>
		<div class="modal" onclick={(e) => e.stopPropagation()}>
			<div class="modal-header">
				<h2 id="poll-detail-title" class="modal-title">{poll.title}</h2>
				<button type="button" class="modal-close" onclick={onClose} aria-label="Close">×</button>
			</div>
			<div class="modal-body">
				<div class="poll-meta-row">
					<span class="category-badge">{poll.category}</span>
					{#if poll.statusDisplay !== 'closed' && poll.statusDisplay !== 'canceled'}
						<span class="status-badge" data-status={poll.statusDisplay}>
							{poll.statusDisplay === 'closing_soon'
								? 'Closing soon'
								: poll.statusDisplay.charAt(0).toUpperCase() + poll.statusDisplay.slice(1)}
						</span>
					{/if}
					<span class="time-badge">{poll.timeLabel}</span>
				</div>
				{#if poll.description}
					<p class="poll-description">{poll.description}</p>
				{/if}

				{#if canVote}
					<div class="vote-section">
						<p class="section-label">Select your {poll.pollType === 'single' ? 'answer' : 'answers'}</p>
						{#if voteError}
							<p class="form-error" role="alert">{voteError}</p>
						{/if}
						<div class="options-list">
							{#each poll.options as opt}
								<label
									class="option-item"
									class:selected={selectedIds.includes(opt.id)}
								>
									{#if poll.pollType === 'single'}
										<input
											type="radio"
											name="poll-option"
											checked={selectedIds.includes(opt.id)}
											onchange={() => toggleOption(opt.id)}
										/>
									{:else}
										<input
											type="checkbox"
											checked={selectedIds.includes(opt.id)}
											onchange={() => toggleOption(opt.id)}
										/>
									{/if}
									<span class="option-text">{opt.label}</span>
								</label>
							{/each}
						</div>
						<button
							type="button"
							class="btn-submit-vote"
							onclick={submitVote}
							disabled={submitting || selectedIds.length === 0}
						>
							{submitting ? 'Submitting…' : 'Submit vote'}
						</button>
					</div>
				{:else if showResults}
					<div class="results-section">
						<p class="section-label">Results</p>
						<PollResultsBar
							options={poll.options}
							totalVotes={poll.totalVotes}
							userOptionIds={poll.userOptionIds}
						/>
					</div>
				{:else if poll.statusDisplay === 'draft'}
					<p class="muted">This poll is a draft. Only the host can open it.</p>
				{/if}

				{#if canManage && (poll.statusDisplay === 'open' || poll.statusDisplay === 'closing_soon')}
					<div class="manage-actions">
						{#if onNudge}
							<button type="button" class="btn-ghost" onclick={onNudge}>
								Nudge non-responders
							</button>
						{/if}
						{#if onClosePoll}
							<button type="button" class="btn-ghost" onclick={onClosePoll}>
								Close poll
							</button>
						{/if}
					</div>
				{/if}
			</div>
		</div>
	</div>
{/if}

<style>
	.modal-backdrop {
		position: fixed;
		inset: 0;
		z-index: 1000;
		background: rgba(0, 0, 0, 0.4);
		backdrop-filter: blur(4px);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1.5rem;
	}
	.modal {
		background: var(--surfaceSolid);
		border-radius: var(--radius-2xl);
		box-shadow: var(--shadow-lg);
		border: 1px solid var(--border-soft);
		max-width: 480px;
		width: 100%;
		max-height: 90vh;
		display: flex;
		flex-direction: column;
	}
	.modal-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 1rem 1.25rem;
		border-bottom: 1px solid var(--border-soft);
	}
	.modal-title {
		margin: 0;
		font-size: 1.25rem;
		font-weight: 600;
		color: var(--text);
	}
	.modal-close {
		background: none;
		border: none;
		font-size: 1.5rem;
		color: var(--muted);
		cursor: pointer;
		padding: 0.25rem;
		border-radius: var(--radius-md);
	}
	.modal-close:hover {
		color: var(--text);
		background: var(--surface2);
	}
	.modal-body {
		padding: 1rem 1.25rem;
		overflow-y: auto;
	}
	.poll-meta-row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin-bottom: 1rem;
	}
	.category-badge,
	.status-badge,
	.time-badge {
		padding: 0.2rem 0.5rem;
		border-radius: 6px;
		font-size: 0.75rem;
		font-weight: 500;
	}
	.category-badge {
		background: var(--surface2);
		color: var(--muted);
	}
	.status-badge {
		background: rgba(34, 197, 94, 0.15);
		color: #15803d;
	}
	.status-badge[data-status='closed'] {
		background: var(--border-soft);
		color: var(--muted);
	}
	.poll-description {
		font-size: 0.9375rem;
		color: var(--muted);
		margin: 0 0 1rem 0;
		line-height: 1.5;
	}
	.section-label {
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--text);
		margin: 0 0 0.75rem 0;
	}
	.form-error {
		font-size: 0.875rem;
		color: var(--danger);
		margin: 0 0 0.75rem 0;
	}
	.options-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		margin-bottom: 1rem;
	}
	.option-item {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.75rem 1rem;
		border-radius: var(--radius-md);
		border: 2px solid var(--border-soft);
		cursor: pointer;
		transition: border-color var(--transition-fast), background var(--transition-fast);
	}
	.option-item:hover {
		background: var(--surface2);
	}
	.option-item.selected {
		border-color: var(--primary);
		background: rgba(191, 78, 48, 0.06);
	}
	.option-item input {
		accent-color: var(--primary);
	}
	.option-text {
		font-size: 0.9375rem;
		color: var(--text);
	}
	.btn-submit-vote {
		padding: 0.625rem 1.25rem;
		background: var(--primary);
		color: white;
		border: none;
		border-radius: var(--radius-md);
		font-weight: 600;
		cursor: pointer;
	}
	.btn-submit-vote:hover:not(:disabled) {
		background: var(--primaryHover);
	}
	.btn-submit-vote:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}
	.results-section {
		margin-top: 0.5rem;
	}
	.muted {
		font-size: 0.875rem;
		color: var(--muted);
		margin: 0;
	}
	.manage-actions {
		display: flex;
		gap: 1rem;
		margin-top: 1.5rem;
		padding-top: 1rem;
		border-top: 1px solid var(--border-soft);
	}
	.btn-ghost {
		background: none;
		border: none;
		font-size: 0.875rem;
		color: var(--muted);
		cursor: pointer;
		padding: 0;
	}
	.btn-ghost:hover {
		color: var(--primary);
		text-decoration: underline;
	}
</style>
