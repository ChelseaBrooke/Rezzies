<script lang="ts">
	import type { PollWithMeta } from './types.js';
	import { CATEGORY_ICONS } from './types.js';

	interface Props {
		poll: PollWithMeta;
		onClick?: () => void;
		onViewActivityDetails?: (snapshot: Record<string, unknown>) => void;
	}

	let { poll, onClick, onViewActivityDetails }: Props = $props();

	const icon = $derived(CATEGORY_ICONS[poll.category] ?? '📋');

	const userAnswerLabels = $derived(
		poll.userOptionIds
			.map((id) => poll.options.find((o) => o.id === id)?.label)
			.filter(Boolean) as string[]
	);

	const totalVotes = $derived(poll.totalVotes ?? 0);

	// Sort options by vote count descending for display
	const sortedOptions = $derived(
		[...poll.options].sort((a, b) => (b.voteCount ?? 0) - (a.voteCount ?? 0))
	);

	const winner = $derived(sortedOptions[0] ?? null);

	function pct(voteCount: number): number {
		return totalVotes > 0 ? Math.round((voteCount / totalVotes) * 100) : 0;
	}

	const isCanceled = $derived(poll.statusDisplay === 'canceled');
</script>

<article
	class="closed-card"
	class:clickable={!!onClick}
	role={onClick ? 'button' : 'article'}
	tabindex={onClick ? 0 : undefined}
	onclick={onClick}
	onkeydown={(e) => {
		if (onClick && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onClick(); }
	}}
>
	<!-- Meta row -->
	<div class="meta-row">
		<span class="category-tag">
			<span aria-hidden="true">{icon}</span>
			{poll.category}
		</span>
		<div class="meta-right">
			{#if poll.allowAnonymous}
				<span class="meta-pill anon-pill">🔒 Anon</span>
			{/if}
			<span class="status-chip" class:canceled={isCanceled}>
				{isCanceled ? 'Canceled' : 'Closed'}
			</span>
		</div>
	</div>

	<!-- Title -->
	<h3 class="poll-title">{poll.title}</h3>

	{#if poll.category === 'Activities' && poll.activitySnapshot && onViewActivityDetails}
		<button
			type="button"
			class="btn-view-activity-details"
			onclick={(e) => { e.stopPropagation(); e.preventDefault(); onViewActivityDetails(poll.activitySnapshot ?? {}); }}
			aria-label="View activity details"
		>
			View activity details
		</button>
	{/if}

		<!-- Results bars (top options, max 4) -->
		{#if totalVotes > 0}
			<div class="results">
				{#each sortedOptions.slice(0, 4) as opt, i (opt.id)}
					{@const p = pct(opt.voteCount ?? 0)}
					{@const isWinner = i === 0}
					{@const isUserPick = poll.userOptionIds.includes(opt.id)}
					<div class="result-row" class:is-winner={isWinner} class:is-user-pick={isUserPick}>
						<span class="result-label">
							{#if isWinner}🏆{/if}
							{opt.label}
						</span>
						<div class="bar-wrap">
							<div class="bar" class:bar-winner={isWinner} class:bar-user={isUserPick && !isWinner} style="width:{p}%"></div>
						</div>
						<span class="result-pct">{p}%</span>
					</div>
				{/each}
				{#if sortedOptions.length > 4}
					<p class="more-options">+{sortedOptions.length - 4} more · click to see all</p>
				{/if}
			</div>
		{:else}
			<p class="no-votes">No votes were cast</p>
		{/if}

		<!-- Footer -->
		<div class="card-foot">
			{#if userAnswerLabels.length > 0}
				<span class="your-vote">
					<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6 9 17l-5-5"/></svg>
					Your vote: {userAnswerLabels.join(', ')}
				</span>
			{:else}
				<span class="no-vote">Didn't vote</span>
			{/if}
			<span class="total-votes">{totalVotes} {totalVotes === 1 ? 'vote' : 'votes'}</span>
		</div>
</article>

<style>
	.closed-card {
		border-radius: 12px;
		border: 1px solid #f0f2f5;
		background: #f8fafc;
		padding: .9rem 1.1rem .75rem;
		margin-bottom: .55rem;
		display: flex;
		flex-direction: column;
		gap: .42rem;
		transition: box-shadow .15s, transform .15s;
		user-select: none;
		min-width: 0;
	}
	.closed-card:last-child { margin-bottom: 0; }
	.closed-card.clickable { cursor: pointer; }
	.closed-card.clickable:hover {
		box-shadow: 0 3px 12px rgba(0,0,0,.07);
		transform: translateY(-1px);
	}
	.closed-card:focus-visible {
		outline: none;
		box-shadow: 0 0 0 3px rgba(232,93,38,.2);
	}

	/* Meta */
	.meta-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: .5rem;
	}
	.meta-right {
		display: flex;
		align-items: center;
		gap: .35rem;
		flex-shrink: 0;
	}
	.meta-pill {
		display: inline-flex;
		align-items: center;
		gap: .2rem;
		padding: .13rem .45rem;
		border-radius: 5px;
		font-size: .65rem;
		font-weight: 600;
	}
	.anon-pill { background: rgba(99,102,241,.09); color: #6366f1; }
	.category-tag {
		display: flex;
		align-items: center;
		gap: .3rem;
		font-size: .73rem;
		font-weight: 500;
		color: #94a3b8;
	}
	.status-chip {
		padding: .13rem .5rem;
		border-radius: 5px;
		font-size: .65rem;
		font-weight: 700;
		background: #e2e8f0;
		color: #64748b;
		flex-shrink: 0;
	}
	.status-chip.canceled {
		background: rgba(239,68,68,.1);
		color: #b91c1c;
	}

	/* Title */
	.poll-title {
		font-size: 1rem;
		font-weight: 700;
		color: #475569;
		margin: 0;
		line-height: 1.35;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
	.btn-view-activity-details {
		align-self: flex-start;
		font-size: .75rem;
		color: var(--primary, #E85D26);
		background: none;
		border: none;
		padding: 0;
		cursor: pointer;
		text-decoration: underline;
	}
	.btn-view-activity-details:hover {
		text-decoration: none;
	}

	/* Results bars */
	.results {
		display: flex;
		flex-direction: column;
		gap: .35rem;
		margin-top: .1rem;
	}
	.result-row {
		display: grid;
		grid-template-columns: 1fr auto auto;
		align-items: center;
		gap: .5rem;
	}
	.result-label {
		font-size: .78rem;
		color: #64748b;
		font-weight: 500;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		display: flex;
		align-items: center;
		gap: .25rem;
	}
	.result-row.is-winner .result-label { color: #1e293b; font-weight: 700; }
	.result-row.is-user-pick .result-label { color: #E85D26; }
	.bar-wrap {
		width: 80px;
		height: 6px;
		background: #e2e8f0;
		border-radius: 3px;
		overflow: hidden;
		flex-shrink: 0;
	}
	.bar {
		height: 100%;
		background: #cbd5e1;
		border-radius: 3px;
		transition: width .3s ease;
	}
	.bar-winner { background: #001B2E; }
	.bar-user   { background: #E85D26; }
	.result-pct {
		font-size: .73rem;
		font-weight: 600;
		color: #94a3b8;
		width: 2.5rem;
		text-align: right;
		flex-shrink: 0;
	}
	.result-row.is-winner .result-pct { color: #475569; }
	.more-options {
		font-size: .72rem;
		color: #94a3b8;
		margin: .1rem 0 0;
		font-style: italic;
	}
	.no-votes {
		font-size: .8rem;
		color: #94a3b8;
		margin: .1rem 0;
		font-style: italic;
	}

	/* Footer */
	.card-foot {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: .75rem;
		padding-top: .5rem;
		border-top: 1px solid #e2e8f0;
		margin-top: .1rem;
	}
	.your-vote {
		display: flex;
		align-items: center;
		gap: .3rem;
		font-size: .73rem;
		color: #10b981;
		font-weight: 600;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.no-vote {
		font-size: .73rem;
		color: #94a3b8;
		font-style: italic;
	}
	.total-votes {
		font-size: .73rem;
		font-weight: 500;
		color: #94a3b8;
		flex-shrink: 0;
	}
</style>
