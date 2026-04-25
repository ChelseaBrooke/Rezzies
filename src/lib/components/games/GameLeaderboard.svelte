<script lang="ts">
	export interface LeaderboardPlayer {
		userId: string;
		name: string | null;
		initials: string;
		score: number;
		scoreLabel: string;
		isCurrentUser: boolean;
	}

	interface Props {
		title?: string;
		players: LeaderboardPlayer[];
		emptyText?: string;
		collapsedOnMobile?: boolean;
	}

	let {
		title = 'Who\'s winning',
		players,
		emptyText = 'No scores yet — play to get on the board!',
		collapsedOnMobile = false
	}: Props = $props();

	const sorted = $derived([...players].sort((a, b) => b.score - a.score));
	const maxScore = $derived(sorted[0]?.score ?? 1);

	let mobileExpanded = $state(false);

	function toggle() {
		mobileExpanded = !mobileExpanded;
	}
</script>

{#if collapsedOnMobile}
	<div class="glb-card">
		<button class="glb-mobile-toggle" type="button" onclick={toggle} aria-expanded={mobileExpanded}>
			<h3 class="glb-title">{title}</h3>
			<span class="glb-toggle-icon" aria-hidden="true">{mobileExpanded ? '−' : '+'}</span>
		</button>
		{#if mobileExpanded}
			<div class="glb-body">
				{@render rows()}
			</div>
		{/if}
	</div>
{:else}
	<div class="glb-card">
		<h3 class="glb-title">{title}</h3>
		<div class="glb-body">
			{@render rows()}
		</div>
	</div>
{/if}

{#snippet rows()}
	{#if sorted.length === 0}
		<p class="glb-empty">{emptyText}</p>
	{:else}
		<ul class="glb-list">
			{#each sorted as player, i}
				<li class="glb-row" class:glb-row--me={player.isCurrentUser}>
					<span class="glb-avatar" aria-hidden="true">{player.initials}</span>
					<span class="glb-name">{player.name ?? 'Guest'}</span>
					{#if i === 0 && player.score > 0}
						<span class="glb-trophy" aria-label="Leader" title="Leader">🏆</span>
					{/if}
					<span class="glb-score-label">{player.scoreLabel}</span>
					<span class="glb-bar-wrap" aria-hidden="true">
						<span class="glb-bar-fill" style="width: {maxScore > 0 ? Math.round((player.score / maxScore) * 100) : 0}%"></span>
					</span>
				</li>
			{/each}
		</ul>
	{/if}
{/snippet}

<style>
	.glb-card {
		background: white;
		border: 1px solid #e2e8f0;
		border-radius: 14px;
		padding: 1rem 1.125rem;
		display: flex;
		flex-direction: column;
		gap: 0.625rem;
		min-width: 0;
	}

	.glb-mobile-toggle {
		display: flex;
		align-items: center;
		justify-content: space-between;
		background: none;
		border: none;
		padding: 0;
		width: 100%;
		cursor: pointer;
		font: inherit;
	}

	.glb-toggle-icon {
		font-size: 1.25rem;
		font-weight: 300;
		color: #64748b;
	}

	.glb-title {
		font-family: 'Fraunces', Georgia, serif;
		font-size: 1rem;
		font-weight: 700;
		color: #1d4d4e;
		margin: 0;
		letter-spacing: -0.01em;
	}

	.glb-body {
		display: flex;
		flex-direction: column;
	}

	.glb-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
	}

	.glb-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.35rem 0.4rem;
		border-radius: 8px;
		border-left: 3px solid transparent;
		min-width: 0;
	}

	.glb-row--me {
		border-left-color: #2f7778;
		background: rgba(47, 119, 120, 0.04);
	}

	.glb-avatar {
		flex-shrink: 0;
		width: 26px;
		height: 26px;
		border-radius: 50%;
		background: #2f7778;
		color: white;
		font-size: 0.625rem;
		font-weight: 700;
		font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
		display: flex;
		align-items: center;
		justify-content: center;
		letter-spacing: 0.02em;
	}

	.glb-name {
		font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
		font-size: 0.8125rem;
		font-weight: 500;
		color: #1d4d4e;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		min-width: 0;
	}

	.glb-trophy {
		font-size: 0.875rem;
		flex-shrink: 0;
	}

	.glb-score-label {
		font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
		font-size: 0.6875rem;
		font-weight: 700;
		color: #64748b;
		white-space: nowrap;
		flex-shrink: 0;
		margin-left: auto;
		font-variant-numeric: tabular-nums;
	}

	.glb-bar-wrap {
		flex-shrink: 0;
		width: 40px;
		height: 4px;
		background: rgba(47, 119, 120, 0.1);
		border-radius: 999px;
		overflow: hidden;
	}

	.glb-bar-fill {
		display: block;
		height: 100%;
		background: #2f7778;
		border-radius: 999px;
		transition: width 0.4s ease;
	}

	.glb-empty {
		font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
		font-size: 0.8125rem;
		color: #94a3b8;
		margin: 0;
		font-style: italic;
	}
</style>
