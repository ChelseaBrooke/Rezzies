<script lang="ts">
	import type { PollWithMeta } from './types.js';
	import { CATEGORY_ICONS } from './types.js';

	interface Props {
		poll: PollWithMeta;
		onClick?: () => void;
		onWatch?: (pollId: string) => void;
	}

	let { poll, onClick, onWatch }: Props = $props();

	const isActive   = $derived(poll.statusDisplay === 'open' || poll.statusDisplay === 'closing_soon');
	const needsVote  = $derived(isActive && !poll.userVoted);
	const voted      = $derived(isActive && poll.userVoted);
	const isDraft    = $derived(poll.statusDisplay === 'draft');
	const icon       = $derived(CATEGORY_ICONS[poll.category] ?? '📋');
</script>

<article
	class="poll-card"
	class:needs-vote={needsVote}
	class:voted={voted}
	class:draft={isDraft}
	class:closing-soon={poll.statusDisplay === 'closing_soon'}
	role={onClick ? 'button' : 'article'}
	tabindex={onClick ? 0 : undefined}
	onclick={onClick}
	onkeydown={(e) => {
		if (onClick && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onClick(); }
	}}
>
	<!-- Notification indicator for polls needing attention -->
	{#if needsVote}
		<span class="notify-dot" aria-label="Needs your vote"></span>
	{/if}

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
			{#if poll.showResultsLive && isActive}
				<span class="meta-pill live-pill">
					<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="3"/><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/></svg>
					Live
				</span>
			{/if}
			{#if poll.statusDisplay === 'closing_soon'}
				<span class="meta-pill warn-pill">⚡ Soon</span>
			{:else if isDraft}
				<span class="meta-pill draft-pill">Draft</span>
			{/if}
			<span class="time-chip">{poll.timeLabel}</span>
		</div>
	</div>

	<!-- Title -->
	<h3 class="poll-title">{poll.title}</h3>

	<!-- Description -->
	{#if poll.description}
		<p class="poll-desc">{poll.description}</p>
	{/if}

	<!-- Footer -->
	<div class="card-foot">
		<span class="foot-stat">
			<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
				<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
				<path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
			</svg>
			{poll.totalVotes} {poll.totalVotes === 1 ? 'vote' : 'votes'}
		</span>
		<span class="foot-stat">
			{poll.options.length} options
		</span>

		<div class="foot-right">
			{#if voted}
				<span class="voted-chip">
					<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6 9 17l-5-5"/></svg>
					Voted
				</span>
			{/if}
			{#if onWatch && isActive}
				<button
					type="button"
					class="btn-watch"
					class:watching={poll.userWatching}
					title={poll.userWatching ? 'Stop watching' : 'Remind me when this closes'}
					onclick={(e) => { e.stopPropagation(); onWatch(poll.id); }}
					aria-label={poll.userWatching ? 'Stop watching poll' : 'Watch poll'}
				>
					{#if poll.userWatching}
						<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden="true"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0" fill="none" stroke="currentColor" stroke-width="2"/></svg>
					{:else}
						<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
					{/if}
				</button>
			{/if}
		</div>
	</div>
</article>

<style>
	.poll-card {
		position: relative;
		border-radius: 12px;
		border: 1px solid #edf0f3;
		background: white;
		padding: .95rem 1.1rem .8rem;
		margin-bottom: .55rem;
		display: flex;
		flex-direction: column;
		gap: .42rem;
		cursor: pointer;
		transition: box-shadow .15s, transform .15s, background .15s;
		user-select: none;
		box-shadow: 0 2px 10px rgba(0,0,0,.07), 0 0 0 1px rgba(0,0,0,.03);
	}
	.poll-card:last-child { margin-bottom: 0; }
	.poll-card:hover {
		box-shadow: 0 6px 20px rgba(0,0,0,.1), 0 0 0 1px rgba(0,0,0,.04);
		transform: translateY(-1px);
	}
	.poll-card:focus-visible {
		outline: none;
		box-shadow: 0 0 0 3px rgba(232,93,38,.25);
	}

	/* ── Status via visual weight, not bars ── */
	.voted {
		background: #f8fafc;
		border-color: #f0f2f5;
		box-shadow: none;
	}
	.voted:hover {
		box-shadow: 0 3px 12px rgba(0,0,0,.06);
	}
	.closing-soon {
		background: #fffaf7;
	}
	.draft {
		background: #fafaff;
		border-color: #edeeff;
		box-shadow: none;
	}

	/* ── Notification dot for unvoted polls ── */
	.notify-dot {
		position: absolute;
		top: 11px;
		right: 11px;
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: #E85D26;
		box-shadow: 0 0 0 2px white;
	}
	.notify-dot::after {
		content: '';
		position: absolute;
		inset: -3px;
		border-radius: 50%;
		border: 1.5px solid #E85D26;
		opacity: 0;
		animation: pulse-ring 2s ease-out infinite;
	}
	@keyframes pulse-ring {
		0%   { transform: scale(1); opacity: .65; }
		100% { transform: scale(2.2); opacity: 0; }
	}

	/* ── Meta row ── */
	.meta-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: .5rem;
	}
	.category-tag {
		display: flex;
		align-items: center;
		gap: .3rem;
		font-size: .73rem;
		font-weight: 500;
		color: #94a3b8;
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
		letter-spacing: .02em;
	}
	.anon-pill  { background: rgba(99,102,241,.09); color: #6366f1; }
	.live-pill  { background: rgba(16,185,129,.09); color: #059669; }
	.warn-pill  { background: rgba(245,158,11,.12); color: #b45309; }
	.draft-pill { background: rgba(99,102,241,.1);  color: #4f46e5; }
	.time-chip {
		font-size: .71rem;
		font-weight: 500;
		color: #94a3b8;
	}

	/* ── Title ── */
	.poll-title {
		font-size: .9875rem;
		font-weight: 700;
		color: #1e293b;
		margin: 0;
		line-height: 1.35;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
		/* needs-vote gets full visual weight — voted titles are muted */
	}
	.voted .poll-title { color: #94a3b8; font-weight: 500; }
	.draft .poll-title { color: #64748b; }

	/* ── Description ── */
	.poll-desc {
		font-size: .8125rem;
		color: #64748b;
		margin: 0;
		line-height: 1.45;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
	.voted .poll-desc { color: #94a3b8; }

	/* ── Footer ── */
	.card-foot {
		display: flex;
		align-items: center;
		gap: .65rem;
		margin-top: .1rem;
		padding-top: .5rem;
		border-top: 1px solid #f0f2f5;
	}
	.foot-stat {
		display: flex;
		align-items: center;
		gap: .25rem;
		font-size: .72rem;
		color: #94a3b8;
		font-weight: 500;
	}
	.foot-right {
		display: flex;
		align-items: center;
		gap: .4rem;
		margin-left: auto;
	}
	.voted-chip {
		display: inline-flex;
		align-items: center;
		gap: .25rem;
		padding: .13rem .45rem;
		background: rgba(16,185,129,.1);
		color: #047857;
		border-radius: 5px;
		font-size: .67rem;
		font-weight: 700;
	}
	.btn-watch {
		display: inline-flex;
		align-items: center;
		padding: .25rem .35rem;
		border-radius: 6px;
		border: 1.5px solid transparent;
		background: none;
		color: #cbd5e1;
		cursor: pointer;
		transition: all .15s;
		line-height: 1;
	}
	.btn-watch:hover { color: #E85D26; border-color: rgba(232,93,38,.2); background: rgba(232,93,38,.05); }
	.btn-watch.watching { color: #E85D26; border-color: rgba(232,93,38,.25); background: rgba(232,93,38,.07); }
</style>
