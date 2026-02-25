<script lang="ts">
	type Props = {
		roundId: string;
		maxLength: number;
		existingText: string | null;
		submitted: boolean;
		isPhotoSubmitter: boolean;
		activeTabId?: string | null;
	};
	let { roundId, maxLength, existingText = null, submitted = false, isPhotoSubmitter = false, activeTabId = null }: Props = $props();

	let text = $state(existingText ?? '');
	let submitting = $state(false);
	let error = $state<string | null>(null);

	$effect(() => {
		if (existingText != null) text = existingText;
	});
</script>

{#if isPhotoSubmitter}
	<p class="message">You submitted the photo — you can vote, but you can't add a caption this round.</p>
{:else if submitted}
	<p class="submitted-badge">Submitted</p>
{:else}
	<form method="POST" action="?/submitCaption" class="caption-form" onsubmit={() => { submitting = true; }}>
		<input type="hidden" name="roundId" value={roundId} />
		{#if activeTabId}
			<input type="hidden" name="activeTab" value={activeTabId} />
		{/if}
		<textarea
			name="text"
			class="caption-textarea"
			placeholder="Write a caption…"
			maxlength={maxLength}
			rows="2"
			bind:value={text}
			disabled={submitting}
		></textarea>
		<div class="caption-form-footer">
			<span class="char-count" class:over={text.length >= maxLength}>{text.length}/{maxLength}</span>
			<button type="submit" class="submit-btn" disabled={!text.trim() || submitting}>
				{submitting ? 'Submitting…' : 'Submit caption'}
			</button>
		</div>
	</form>
	{#if error}
		<p class="error">{error}</p>
	{/if}
{/if}

<style>
	.message {
		font-size: 0.9375rem;
		color: var(--muted, #666);
		margin: 0;
		padding: 0.75rem 0;
	}
	.submitted-badge {
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--success, #16a34a);
		margin: 0;
		padding: 0.5rem 0;
	}
	.caption-form {
		margin-top: 0.5rem;
	}
	.caption-textarea {
		width: 100%;
		padding: 0.75rem;
		border: 1.5px solid var(--border, #e5e5e5);
		border-radius: 8px;
		font: inherit;
		font-size: 0.9375rem;
		resize: vertical;
		min-height: 4rem;
	}
	.caption-textarea:focus {
		outline: none;
		border-color: var(--primary, #e85d04);
	}
	.caption-form-footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		margin-top: 0.5rem;
	}
	.char-count {
		font-size: 0.75rem;
		color: var(--muted, #666);
	}
	.char-count.over {
		color: var(--error, #c00);
	}
	.submit-btn {
		padding: 0.5rem 1rem;
		font-size: 0.875rem;
		font-weight: 600;
		background: var(--primary, #e85d04);
		color: white;
		border: none;
		border-radius: 8px;
		cursor: pointer;
	}
	.submit-btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}
	.error {
		font-size: 0.875rem;
		color: var(--error, #c00);
		margin: 0.5rem 0 0 0;
	}
</style>
