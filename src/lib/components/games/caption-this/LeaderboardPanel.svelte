<script lang="ts">
	type LeaderboardRow = { userId: string; name: string | null; pointsTotal: number; rank: number };
	type Props = {
		leaderboard: LeaderboardRow[];
		currentUserId: string | null;
		thisRoundTopVotes?: number;
		thisRoundTiedCount?: number;
		collapsed?: boolean;
	};
	let { leaderboard = [], currentUserId = null, thisRoundTopVotes, thisRoundTiedCount, collapsed = $bindable(false) }: Props = $props();
</script>

<div class="panel" class:collapsed>
	<button
		type="button"
		class="panel-toggle"
		aria-expanded={!collapsed}
		onclick={() => (collapsed = !collapsed)}
	>
		<h2 class="panel-title">Leaderboard</h2>
		<span class="panel-toggle-icon" aria-hidden="true">{collapsed ? '›' : '∨'}</span>
	</button>
	{#if !collapsed}
		{#if thisRoundTopVotes != null && thisRoundTiedCount != null}
			<p class="this-round-indicator">
				This round: {thisRoundTopVotes} vote{thisRoundTopVotes !== 1 ? 's' : ''} leading
				{#if thisRoundTiedCount > 1}
					({thisRoundTiedCount} tied)
				{/if}
			</p>
		{/if}
		<ul class="leaderboard-list">
			{#each leaderboard as row}
				<li class="leaderboard-row" class:current={currentUserId === row.userId}>
					<span class="rank">{row.rank}</span>
					<span class="name">{row.name ?? 'Anonymous'}</span>
					<span class="points">{row.pointsTotal} pt{row.pointsTotal !== 1 ? 's' : ''}</span>
				</li>
			{/each}
		</ul>
		{#if leaderboard.length === 0}
			<p class="empty">No scores yet.</p>
		{/if}
	{/if}
</div>

<style>
	.panel {
		background: var(--surface2, #f5f5f5);
		border-radius: 12px;
		padding: 1rem;
		border: 1px solid var(--border, #e5e5e5);
	}
	.panel-toggle {
		display: flex;
		align-items: center;
		justify-content: space-between;
		width: 100%;
		background: none;
		border: none;
		cursor: pointer;
		padding: 0;
		text-align: left;
		font: inherit;
	}
	.panel-title {
		margin: 0;
		font-size: 1rem;
		font-weight: 600;
		color: var(--text, #1a1a1a);
	}
	.panel-toggle-icon {
		font-size: 1.25rem;
		color: var(--muted, #666);
	}
	@media (min-width: 641px) {
		.panel-toggle-icon {
			display: none;
		}
	}
	.this-round-indicator {
		font-size: 0.8125rem;
		color: var(--muted, #666);
		margin: 0.5rem 0 0.75rem 0;
	}
	.leaderboard-list {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.leaderboard-row {
		display: grid;
		grid-template-columns: 1.5rem 1fr auto;
		gap: 0.5rem;
		align-items: center;
		padding: 0.5rem 0;
		border-bottom: 1px solid var(--border, #eee);
		font-size: 0.9375rem;
	}
	.leaderboard-row:last-child {
		border-bottom: none;
	}
	.leaderboard-row.current {
		background: rgba(232, 93, 4, 0.08);
		margin: 0 -0.5rem;
		padding-left: 0.5rem;
		padding-right: 0.5rem;
		border-radius: 6px;
		font-weight: 500;
	}
	.rank {
		font-weight: 600;
		color: var(--muted, #666);
	}
	.name {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.points {
		font-weight: 600;
		color: var(--text, #1a1a1a);
	}
	.empty {
		font-size: 0.875rem;
		color: var(--muted, #666);
		margin: 0.5rem 0 0 0;
	}
	.collapsed .leaderboard-list,
	.collapsed .this-round-indicator,
	.collapsed .empty {
		display: none;
	}
</style>
