<script lang="ts">
	/** Minimal poll for the floating card (one at a time, unanswered) */
	export type PollCardPoll = {
		id: string;
		title: string;
		pollType: string;
		options: Array<{ id: string; label: string }>;
	};

	let {
		poll,
		onVote,
		disabled = false
	}: {
		poll: PollCardPoll;
		onVote: (optionId: string) => void;
		disabled?: boolean;
	} = $props();

	function handleOptionClick(optionId: string) {
		if (disabled) return;
		onVote(optionId);
	}
</script>

<article class="poll-card" aria-label="Poll: {poll.title}">
	<h3 class="poll-card-title">{poll.title}</h3>
	<div class="poll-card-options">
		{#each poll.options as opt (opt.id)}
			<button
				type="button"
				class="poll-card-option"
				disabled={disabled}
				onclick={() => handleOptionClick(opt.id)}
				aria-pressed="false"
			>
				{opt.label}
			</button>
		{/each}
	</div>
</article>

<style>
	.poll-card {
		background: var(--surface, #fff);
		border-radius: var(--radius-xl, 16px);
		box-shadow: var(--shadow-soft, 0 4px 20px rgba(0, 0, 0, 0.08));
		padding: 1.25rem 1.375rem;
		width: 320px;
		min-height: 200px;
		box-sizing: border-box;
		border: 1px solid var(--border-soft, rgba(0, 0, 0, 0.06));
	}

	.poll-card-title {
		margin: 0 0 0.75rem 0;
		font-size: 0.9375rem;
		font-weight: 600;
		color: var(--text);
		line-height: 1.35;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.poll-card-options {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.poll-card-option {
		width: 100%;
		text-align: left;
		padding: 0.625rem 0.875rem;
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--text);
		background: var(--surface2, #f5f5f5);
		border: 1px solid var(--border-soft, rgba(0, 0, 0, 0.06));
		border-radius: var(--radius-md, 10px);
		cursor: pointer;
		transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
	}

	.poll-card-option:hover:not(:disabled) {
		background: rgba(191, 78, 48, 0.08);
		border-color: var(--copper, #bf4e30);
		color: var(--copper, #bf4e30);
	}

	.poll-card-option:disabled {
		opacity: 0.7;
		cursor: not-allowed;
	}
</style>
