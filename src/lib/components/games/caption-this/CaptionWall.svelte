<script lang="ts">
	type Caption = { id: string; text: string };
	type Props = {
		captions: Caption[];
		phase: 'CAPTION_SUBMISSION' | 'VOTING' | 'RESULTS';
		expectedCount?: number;
	};
	let { captions = [], phase, expectedCount = 0 }: Props = $props();
</script>

<div class="caption-wall">
	{#each captions as c}
		<div class="caption-card">
			<p class="caption-text">"{c.text}"</p>
		</div>
	{/each}
	{#if phase === 'CAPTION_SUBMISSION' && expectedCount > captions.length}
		{#each Array(Math.max(0, expectedCount - captions.length)) as _}
			<div class="caption-card placeholder">
				<span class="placeholder-text">Waiting for others…</span>
			</div>
		{/each}
	{/if}
</div>

<style>
	.caption-wall {
		display: grid;
		grid-template-columns: repeat(1, 1fr);
		gap: 0.75rem;
		margin-top: 1rem;
	}
	@media (min-width: 640px) {
		.caption-wall {
			grid-template-columns: repeat(2, 1fr);
		}
	}
	@media (min-width: 900px) {
		.caption-wall {
			grid-template-columns: repeat(3, 1fr);
		}
	}
	.caption-card {
		background: var(--surface, #fff);
		border: 1px solid var(--border, #e5e5e5);
		border-radius: 10px;
		padding: 0.875rem 1rem;
	}
	.caption-card.placeholder {
		background: var(--surface2, #f9f9f9);
		border-style: dashed;
	}
	.caption-text {
		margin: 0;
		font-size: 0.9375rem;
		line-height: 1.4;
		color: var(--text, #1a1a1a);
	}
	.placeholder-text {
		font-size: 0.8125rem;
		color: var(--muted, #666);
	}
</style>
