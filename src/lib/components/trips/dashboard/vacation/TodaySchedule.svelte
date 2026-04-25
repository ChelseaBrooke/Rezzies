<script lang="ts">
	export type ScheduleRow = {
		id: string;
		kind: 'activity' | 'meal' | 'checkin' | 'checkout';
		timeLabel: string;
		title: string;
		subtitle: string;
		emoji: string;
		participantCount?: number;
		userParticipating?: boolean;
	};

	let {
		tripId,
		isHost = false,
		todayHeading = 'Today',
		todaySub = '',
		itineraryHref = '',
		rows = [] as ScheduleRow[],
		highlightIndex = -1,
		freeDayPhrase = '',
		loading = false
	}: {
		tripId: string;
		isHost?: boolean;
		todayHeading?: string;
		todaySub?: string;
		itineraryHref?: string;
		rows?: ScheduleRow[];
		highlightIndex?: number;
		freeDayPhrase?: string;
		loading?: boolean;
	} = $props();

	const MAIN_CAP = 4;
	const mainRows = $derived(rows.slice(0, MAIN_CAP));
	const laterRows = $derived(rows.slice(MAIN_CAP));
	let laterOpen = $state(false);
</script>

<section class="sched" aria-labelledby="sched-title">
	<header class="sched-head">
		<div class="sched-head-left">
			<h2 id="sched-title" class="sched-title">{todayHeading}</h2>
			{#if todaySub}<span class="sched-sub">{todaySub}</span>{/if}
		</div>
		{#if itineraryHref}
			<a href={itineraryHref} class="sched-link">Full itinerary →</a>
		{/if}
	</header>

	{#if loading}
		<div class="skeleton" aria-hidden="true">
			<div class="sk sk-1"></div>
			<div class="sk sk-2"></div>
			<div class="sk sk-3"></div>
		</div>
	{:else if rows.length === 0}
		<div class="free-card">
			<p class="free-title">Free day</p>
			<p class="free-dek">{freeDayPhrase}</p>
		</div>
		<!-- HOST ONLY -->
		{#if isHost}
			<a href="/trips/{tripId}/itinerary" class="add-today">Add something to today →</a>
		{/if}
	{:else}
		<div class="timeline" role="list">
			{#each mainRows as row, i (row.id)}
				<div
					class="t-row"
					class:t-row--hl={i === highlightIndex}
					role="listitem"
				>
					<div class="t-time">
						<span class="t-time-text">{row.timeLabel}</span>
						<span class="t-dot" class:t-dot--pulse={i === highlightIndex} aria-hidden="true"></span>
					</div>
					<div class="t-card">
						<p class="t-emoji" aria-hidden="true">{row.emoji}</p>
						<div class="t-body">
							<p class="t-name">{row.title}</p>
							{#if row.subtitle}<p class="t-sub">{row.subtitle}</p>{/if}
							{#if row.participantCount != null && row.participantCount > 0}
								<p class="t-pill">
									{#if row.userParticipating}<span>You're in</span>{/if}
									{#if row.userParticipating && row.participantCount}<span class="dot">·</span>{/if}
									<span>{row.participantCount} attending</span>
								</p>
							{/if}
						</div>
					</div>
				</div>
			{/each}
		</div>

		{#if laterRows.length > 0}
			<button type="button" class="later-toggle" onclick={() => (laterOpen = !laterOpen)} aria-expanded={laterOpen}>
				Later today ({laterRows.length} more)
			</button>
			{#if laterOpen}
				<ul class="later-list">
					{#each laterRows as row (row.id)}
						<li>
							<span class="later-time">{row.timeLabel}</span>
							<span class="later-text">{row.emoji} {row.title}</span>
						</li>
					{/each}
				</ul>
			{/if}
		{/if}
	{/if}
</section>

<style>
	.sched {
		font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
		margin-bottom: 1.5rem;
	}
	.sched-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 1rem;
		margin-bottom: 1rem;
		flex-wrap: wrap;
	}
	.sched-head-left {
		display: flex;
		align-items: baseline;
		gap: 0.65rem;
		flex-wrap: wrap;
	}
	.sched-title {
		font-family: 'Fraunces', Georgia, serif;
		font-size: 22px;
		font-weight: 700;
		color: #0f172a;
		margin: 0;
		letter-spacing: -0.02em;
	}
	.sched-sub {
		font-size: 14px;
		color: #64748b;
	}
	.sched-link {
		font-size: 14px;
		font-weight: 600;
		color: #2f7778;
		text-decoration: none;
		padding: 0.35rem 0.75rem;
		border-radius: 999px;
		border: 1px solid rgba(47, 119, 120, 0.35);
		background: rgba(47, 119, 120, 0.06);
	}
	.sched-link:hover {
		background: rgba(47, 119, 120, 0.12);
	}

	.timeline {
		position: relative;
		padding-left: 0.5rem;
	}
	.timeline::before {
		content: '';
		position: absolute;
		left: 52px;
		top: 0.5rem;
		bottom: 0.5rem;
		width: 3px;
		background: linear-gradient(180deg, #2f7778 0%, rgba(47, 119, 120, 0.25) 100%);
		border-radius: 3px;
	}
	.t-row {
		display: grid;
		grid-template-columns: 56px minmax(0, 1fr);
		gap: 0.65rem;
		align-items: stretch;
		margin-bottom: 0.65rem;
		position: relative;
		z-index: 1;
	}
	.t-time {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		padding-top: 0.85rem;
		position: relative;
	}
	.t-time-text {
		font-size: 13px;
		color: #94a3b8;
		font-variant-numeric: tabular-nums;
		text-align: right;
	}
	.t-dot {
		position: absolute;
		right: -5px;
		top: 1.05rem;
		width: 11px;
		height: 11px;
		border-radius: 50%;
		background: #fff;
		border: 2px solid #2f7778;
		box-shadow: 0 0 0 2px rgba(47, 119, 120, 0.15);
	}
	.t-dot--pulse {
		animation: td-pulse 2s ease-in-out infinite;
	}
	@keyframes td-pulse {
		0%,
		100% {
			opacity: 1;
			box-shadow: 0 0 0 0 rgba(47, 119, 120, 0.35);
		}
		50% {
			opacity: 0.85;
			box-shadow: 0 0 0 6px rgba(47, 119, 120, 0);
		}
	}
	.t-card {
		display: flex;
		gap: 0.6rem;
		background: #fff;
		border: 1px solid rgba(15, 23, 42, 0.08);
		border-radius: 14px;
		padding: 0.75rem 1rem;
		box-shadow: 0 2px 10px rgba(15, 23, 42, 0.05);
	}
	.t-row--hl .t-card {
		border-left: 3px solid #2f7778;
		background: linear-gradient(135deg, rgba(47, 119, 120, 0.05) 0%, #fff 55%);
		box-shadow: 0 4px 18px rgba(47, 119, 120, 0.1);
	}
	.t-emoji {
		margin: 0;
		font-size: 1.1rem;
		line-height: 1;
		padding-top: 0.15rem;
	}
	.t-body {
		min-width: 0;
	}
	.t-name {
		margin: 0;
		font-size: 15px;
		font-weight: 600;
		color: #0f172a;
		line-height: 1.3;
	}
	.t-sub {
		margin: 0.15rem 0 0;
		font-size: 13px;
		color: #64748b;
		line-height: 1.35;
	}
	.t-pill {
		margin: 0.45rem 0 0;
		display: inline-flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.2rem;
		font-size: 11px;
		font-weight: 600;
		color: #2f7778;
		background: rgba(47, 119, 120, 0.1);
		padding: 0.2rem 0.5rem;
		border-radius: 999px;
		width: fit-content;
	}
	.t-pill .dot {
		opacity: 0.6;
	}

	.later-toggle {
		font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
		margin-top: 0.35rem;
		font-size: 13px;
		color: #64748b;
		background: none;
		border: none;
		padding: 0.25rem 0;
		cursor: pointer;
		text-decoration: underline;
		text-underline-offset: 2px;
	}
	.later-list {
		list-style: none;
		margin: 0.35rem 0 0;
		padding: 0.5rem 0 0 56px;
		font-size: 13px;
		color: #64748b;
	}
	.later-list li {
		display: flex;
		gap: 0.5rem;
		margin-bottom: 0.25rem;
	}
	.later-time {
		font-variant-numeric: tabular-nums;
		min-width: 3.5rem;
		color: #94a3b8;
	}

	.free-card {
		border-radius: 16px;
		padding: 1.5rem 1.25rem;
		background: linear-gradient(135deg, #fff7ed 0%, #ffedd5 40%, #fef3c7 100%);
		border: 1px solid rgba(206, 86, 18, 0.2);
		box-shadow: 0 4px 20px rgba(206, 86, 18, 0.08);
	}
	.free-title {
		font-family: 'Fraunces', Georgia, serif;
		font-size: 1.5rem;
		font-weight: 700;
		margin: 0 0 0.35rem;
		color: #9a3412;
	}
	.free-dek {
		margin: 0;
		font-size: 15px;
		color: #b45309;
		line-height: 1.45;
	}
	.add-today {
		display: inline-block;
		margin-top: 0.65rem;
		font-size: 14px;
		font-weight: 600;
		color: #5a8f90;
		text-decoration: none;
	}
	.add-today:hover {
		color: #2f7778;
		text-decoration: underline;
	}

	.skeleton {
		display: flex;
		flex-direction: column;
		gap: 0.65rem;
	}
	.sk {
		height: 72px;
		border-radius: 14px;
		background: linear-gradient(90deg, #f1f5f9 0%, #e2e8f0 50%, #f1f5f9 100%);
		background-size: 200% 100%;
		animation: sk-shimmer 1.2s ease-in-out infinite;
	}
	.sk-2 {
		animation-delay: 0.1s;
	}
	.sk-3 {
		animation-delay: 0.2s;
	}
	@keyframes sk-shimmer {
		0% {
			background-position: 200% 0;
		}
		100% {
			background-position: -200% 0;
		}
	}
</style>
