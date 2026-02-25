<script lang="ts">
	type Caption = { id: string; text: string };
	type Props = {
		captions: Caption[];
		phase: 'CAPTION_SUBMISSION' | 'VOTING' | 'RESULTS';
		expectedCount?: number;
	};
	let { captions = [], phase, expectedCount = 0 }: Props = $props();
</script>

<div class="caption-wall-wrap">
	{#if phase === 'CAPTION_SUBMISSION' && expectedCount > 0}
		<p class="caption-count">
			{captions.length} of {expectedCount} caption{captions.length !== 1 ? 's' : ''} in
			{#if captions.length < expectedCount}
				— more can still submit
			{/if}
		</p>
	{/if}
	<ul class="caption-list" role="list">
		{#each captions as c}
			<li class="caption-option">
				<span class="option-dot" aria-hidden="true"></span>
				<p class="caption-text">"{c.text}"</p>
			</li>
		{/each}
	</ul>
</div>

<style>
	.caption-wall-wrap {
		margin-top: 1rem;
	}
	.caption-count {
		font-size: 0.8125rem;
		color: var(--muted, #666);
		margin: 0 0 0.5rem 0;
	}
	.caption-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.caption-option {
		display: flex;
		align-items: flex-start;
		gap: 0.75rem;
		padding: 0.75rem 1rem;
		background: var(--surface, #fff);
		border: 1px solid var(--border, #e5e5e5);
		border-radius: 10px;
		border-left: 3px solid transparent;
		transition: background 0.2s, border-color 0.2s, box-shadow 0.2s;
	}
	.caption-option:hover {
		background: rgba(147, 112, 219, 0.08);
		border-left-color: #9370db;
		box-shadow: 0 2px 8px rgba(147, 112, 219, 0.12);
	}
	.option-dot {
		flex-shrink: 0;
		width: 10px;
		height: 10px;
		border-radius: 50%;
		background: var(--border, #e0e0e0);
		margin-top: 0.35rem;
		transition: background 0.2s, transform 0.2s;
	}
	.caption-option:hover .option-dot {
		background: #9370db;
		transform: scale(1.15);
	}
	.caption-text {
		margin: 0;
		font-size: 0.9375rem;
		line-height: 1.4;
		color: var(--text, #1a1a1a);
		min-width: 0;
	}
</style>
