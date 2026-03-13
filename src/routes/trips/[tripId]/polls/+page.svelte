<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import type { PageData } from './$types';
	import {
		PollFiltersBar,
		PollCard,
		PollClosedCard,
		CreatePollModal,
		PollDetailModal,
		type PollWithMeta,
		type PollCategory,
		type PollSort,
		getStatusDisplay,
		getTimeLabel,
	} from '$lib/components/trips/polls';

	let { data, form }: { data: PageData; form: any } = $props();

	const tripId = $derived(data.trip?.id ?? '');
	const isHost = $derived(data.isHost ?? false);
	const currentUserId = $derived(data.currentUserId ?? '');

	let searchQuery = $state('');
	let category = $state<PollCategory>('All');
	let sort = $state<PollSort>('recent');
	$effect(() => {
		if (data.searchQuery != null) searchQuery = data.searchQuery;
		if (data.category != null) category = data.category as PollCategory;
		if (data.sort != null) sort = data.sort as PollSort;
	});

	let showCreateModal = $state(false);
	let detailPollId = $state<string | null>(null);
	let showDetailModal = $state(false);

	const rawPolls = $derived(data.polls ?? []);
	const pollsWithMeta = $derived(
		rawPolls.map((p: any) => {
			const statusDisplay = getStatusDisplay(p.status ?? 'open', p.endAt);
			const timeLabel = getTimeLabel(p.status ?? 'open', p.endAt);
			return {
				...p,
				title: p.title ?? p.question ?? 'Untitled',
				statusDisplay,
				timeLabel,
				userOptionIds: p.userOptionIds ?? (p.userOptionId ? [p.userOptionId] : []),
				allowAnonymous: p.allowAnonymous ?? false,
				userWatching: p.userWatching ?? false,
				watcherCount: p.watcherCount ?? 0
			} as PollWithMeta;
		})
	);

	const filteredPolls = $derived.by(() => {
		let list = [...pollsWithMeta];
		if (searchQuery.trim()) {
			const q = searchQuery.toLowerCase();
			list = list.filter(
				(p) =>
					p.title?.toLowerCase().includes(q) ||
					p.description?.toLowerCase().includes(q) ||
					p.category?.toLowerCase().includes(q)
			);
		}
		if (category !== 'All') {
			list = list.filter((p) => p.category === category);
		}
		if (sort === 'ending_soon') {
			list.sort((a, b) => {
				const aEnd = a.endAt ? new Date(a.endAt).getTime() : Infinity;
				const bEnd = b.endAt ? new Date(b.endAt).getTime() : Infinity;
				return aEnd - bEnd;
			});
		} else if (sort === 'most_votes') {
			list.sort((a, b) => (b.totalVotes ?? 0) - (a.totalVotes ?? 0));
		} else if (sort === 'newest' || sort === 'recent') {
			list.sort(
				(a, b) =>
					new Date(b.updatedAt ?? b.createdAt).getTime() -
					new Date(a.updatedAt ?? a.createdAt).getTime()
			);
		} else if (sort === 'oldest') {
			list.sort(
				(a, b) =>
					new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
			);
		}
		return list;
	});

	const pollsUnvoted = $derived(
		filteredPolls.filter(
			(p) => (p.statusDisplay === 'open' || p.statusDisplay === 'closing_soon') && !p.userVoted
		)
	);
	const pollsVotedActive = $derived(
		filteredPolls.filter(
			(p) => (p.statusDisplay === 'open' || p.statusDisplay === 'closing_soon') && p.userVoted
		)
	);
	const pollsClosed = $derived(
		filteredPolls.filter(
			(p) => p.statusDisplay === 'closed' || p.statusDisplay === 'canceled'
		)
	);
	const pollsDrafts = $derived(filteredPolls.filter((p) => p.statusDisplay === 'draft'));

	const openCount = $derived(
		pollsUnvoted.length + pollsVotedActive.length + (isHost ? pollsDrafts.length : 0)
	);
	const closedCount = $derived(pollsClosed.length);

	const detailPoll = $derived(
		showDetailModal && detailPollId ? pollsWithMeta.find((p) => p.id === detailPollId) ?? null : null
	);

	function openDetail(poll: PollWithMeta) {
		detailPollId = poll.id;
		showDetailModal = true;
	}
	function closeDetail() {
		showDetailModal = false;
		detailPollId = null;
	}

	async function handleVote(optionIds: string[]) {
		const form = document.getElementById('vote-form') as HTMLFormElement;
		if (!form || !detailPoll) return;
		const fd = new FormData(form);
		fd.set('pollId', detailPoll.id);
		fd.set('optionIds', optionIds.join(','));
		await fetch(form.action, { method: 'POST', body: fd });
		await invalidateAll();
	}

	function handleNudge() {
		if (!detailPoll) return;
		const form = document.getElementById('nudge-form') as HTMLFormElement;
		if (!form) return;
		const fd = new FormData();
		fd.set('pollId', detailPoll.id);
		fetch(form.action, { method: 'POST', body: fd }).then(() => invalidateAll());
	}

	function handleClosePoll() {
		if (!detailPoll) return;
		const form = document.getElementById('close-poll-form') as HTMLFormElement;
		if (!form) return;
		const fd = new FormData();
		fd.set('pollId', detailPoll.id);
		fetch(form.action, { method: 'POST', body: fd }).then(() => {
			invalidateAll();
			closeDetail();
		});
	}

	function handleWatch(pollId: string) {
		const form = document.getElementById('watch-form') as HTMLFormElement;
		if (!form) return;
		const fd = new FormData();
		fd.set('pollId', pollId);
		fetch(form.action, { method: 'POST', body: fd }).then(() => invalidateAll());
	}
</script>

<svelte:head>
	<title>Polls – {data.trip?.name ?? 'Trip'}</title>
</svelte:head>

<form id="vote-form" method="POST" action="?/vote" use:enhance style="display:none">
	<input type="hidden" name="pollId" />
	<input type="hidden" name="optionIds" />
</form>
<form id="close-poll-form" method="POST" action="?/close" use:enhance style="display:none">
	<input type="hidden" name="pollId" />
</form>
<form id="nudge-form" method="POST" action="?/nudge" use:enhance style="display:none">
	<input type="hidden" name="pollId" />
</form>
<form id="watch-form" method="POST" action="?/watch" use:enhance style="display:none">
	<input type="hidden" name="pollId" />
</form>

<div class="polls-page">
	<div class="polls-card">

		<!-- Card header -->
		<div class="card-header">
			<div class="header-left">
				<h1 class="polls-title">Polls</h1>
				<p class="polls-subtitle">
					{isHost
						? 'Create polls, track votes, and see what the group decides.'
						: 'Cast your vote and see what the group thinks.'}
				</p>
			</div>
			{#if isHost}
				<button class="btn-new-poll" onclick={() => (showCreateModal = true)}>
					<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
						<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
					</svg>
					New Poll
				</button>
			{/if}
		</div>

		<!-- Filters -->
		<div class="card-filters">
			<PollFiltersBar
				{searchQuery}
				onSearchChange={(v) => (searchQuery = v)}
				{category}
				onCategoryChange={(c) => (category = c)}
				{sort}
				onSortChange={(s) => (sort = s)}
				onAddNewPoll={() => (showCreateModal = true)}
				canCreate={false}
			/>
		</div>

		<!-- Content -->
		{#if filteredPolls.length === 0}
			<div class="empty-state">
				<div class="empty-icon" aria-hidden="true">🗳️</div>
				<p class="empty-title">No polls yet</p>
				<p class="empty-hint">
					{isHost ? 'Click "New Poll" above to get started.' : 'Check back later for new polls.'}
				</p>
			</div>
		{:else}
			<div class="polls-body">

				<!-- Open column -->
				<div class="polls-col">
					<div class="col-header">
						<span class="col-title">Open</span>
						{#if openCount > 0}
							<span class="col-count">{openCount}</span>
						{/if}
					</div>
					<div class="col-content">
						{#if pollsUnvoted.length > 0}
							<div class="sub-group">
								<p class="sub-label">
									<span class="sub-dot urgent"></span>Needs your vote
								</p>
								{#each pollsUnvoted as poll (poll.id)}
									<PollCard {poll} onClick={() => openDetail(poll)} onWatch={handleWatch} />
								{/each}
							</div>
						{/if}

						{#if pollsVotedActive.length > 0}
							<div class="sub-group">
								{#if pollsUnvoted.length > 0}
									<p class="sub-label">
										<span class="sub-dot done"></span>Voted
									</p>
								{/if}
								{#each pollsVotedActive as poll (poll.id)}
									<PollCard {poll} onClick={() => openDetail(poll)} onWatch={handleWatch} />
								{/each}
							</div>
						{/if}

						{#if isHost && pollsDrafts.length > 0}
							<div class="sub-group">
								<p class="sub-label">
									<span class="sub-dot draft"></span>Drafts
								</p>
								{#each pollsDrafts as poll (poll.id)}
									<PollCard {poll} onClick={() => openDetail(poll)} onWatch={handleWatch} />
								{/each}
							</div>
						{/if}

						{#if openCount === 0}
							<div class="col-empty">
								<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="empty-col-icon"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>
								<p>No open polls</p>
							</div>
						{/if}
					</div>
				</div>

				<!-- Divider -->
				<div class="col-divider"></div>

				<!-- Closed column -->
				<div class="polls-col">
					<div class="col-header">
						<span class="col-title">Closed</span>
						{#if closedCount > 0}
							<span class="col-count col-count-muted">{closedCount}</span>
						{/if}
					</div>
					<div class="col-content">
						{#if pollsClosed.length === 0}
							<div class="col-empty">
								<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="empty-col-icon"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
								<p>No closed polls yet</p>
							</div>
						{:else}
							{#each pollsClosed as poll (poll.id)}
								<PollClosedCard {poll} onClick={() => openDetail(poll)} />
							{/each}
						{/if}
					</div>
				</div>

			</div>
		{/if}
	</div>
</div>

<CreatePollModal
	open={showCreateModal}
	onClose={() => (showCreateModal = false)}
	formAction={`/trips/${tripId}/polls?/create`}
	onSuccess={() => { showCreateModal = false; invalidateAll(); }}
	error={form?.createError}
/>

<PollDetailModal
	open={showDetailModal}
	poll={detailPoll}
	onClose={closeDetail}
	onVote={handleVote}
	onNudge={handleNudge}
	onClosePoll={isHost || detailPoll?.createdById === currentUserId ? handleClosePoll : undefined}
	onWatch={handleWatch}
	canManage={isHost}
	voteError={form?.voteError}
/>

<style>
	.polls-page {
		max-width: 1200px;
		margin: 0 auto;
		padding: 0 1rem 3rem;
	}

	/* ── Main card ── */
	.polls-card {
		background: white;
		border-radius: 20px;
		box-shadow: 0 4px 32px rgba(17,24,39,.07), 0 1px 6px rgba(17,24,39,.04);
		overflow: hidden;
	}

	/* ── Card header ── */
	.card-header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1rem;
		padding: 1.75rem 2rem 1.25rem;
		border-bottom: 1px solid #f0f2f5;
	}
	.header-left { min-width: 0; }
	.polls-title {
		font-size: 1.5rem;
		font-weight: 800;
		color: #001B2E;
		margin: 0 0 .25rem;
		line-height: 1.2;
	}
	.polls-subtitle {
		font-size: .875rem;
		color: #64748b;
		margin: 0;
	}
	.btn-new-poll {
		display: inline-flex;
		align-items: center;
		gap: .4rem;
		padding: .55rem 1.1rem;
		background: #E85D26;
		color: white;
		border: none;
		border-radius: 10px;
		font-size: .875rem;
		font-weight: 600;
		cursor: pointer;
		white-space: nowrap;
		flex-shrink: 0;
		transition: background .15s, transform .15s;
	}
	.btn-new-poll:hover { background: #d04e1f; transform: translateY(-1px); }

	/* ── Filters strip ── */
	.card-filters {
		padding: 1rem 2rem;
		border-bottom: 1px solid #f0f2f5;
		background: #f8fafc;
	}

	/* ── Body ── */
	.polls-body {
		display: grid;
		grid-template-columns: 1fr 1px 1fr;
		align-items: start;
		min-height: 400px;
	}
	.col-divider {
		background: #f0f2f5;
		align-self: stretch;
	}
	.polls-col {
		padding: 1.5rem 2rem 2rem;
		min-width: 0;
	}

	/* ── Column header ── */
	.col-header {
		display: flex;
		align-items: center;
		gap: .6rem;
		margin-bottom: 1.25rem;
	}
	.col-title {
		font-size: .7rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: .07em;
		color: #94a3b8;
	}
	.col-count {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 20px;
		height: 20px;
		padding: 0 .4rem;
		background: #E85D26;
		color: white;
		border-radius: 10px;
		font-size: .65rem;
		font-weight: 700;
	}
	.col-count-muted {
		background: #e2e8f0;
		color: #64748b;
	}

	/* ── Sub-groups ── */
	.sub-group { margin-bottom: 1.25rem; }
	.sub-group:last-child { margin-bottom: 0; }
	.sub-label {
		display: flex;
		align-items: center;
		gap: .45rem;
		font-size: .7rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: .06em;
		color: #94a3b8;
		margin: 0 0 .6rem;
	}
	.sub-dot {
		width: 7px; height: 7px;
		border-radius: 50%;
		flex-shrink: 0;
	}
	.sub-dot.urgent  { background: #E85D26; }
	.sub-dot.done    { background: #10b981; }
	.sub-dot.draft   { background: #6366f1; }

	/* ── Column empty ── */
	.col-empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: .5rem;
		padding: 2.5rem 1rem;
		color: #cbd5e1;
		text-align: center;
		border: 1.5px dashed #e2e8f0;
		border-radius: 14px;
	}
	.col-empty p { margin: 0; font-size: .875rem; color: #94a3b8; }
	.empty-col-icon { opacity: .5; }

	/* ── Page-level empty state ── */
	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: .5rem;
		padding: 4rem 2rem;
		text-align: center;
	}
	.empty-icon { font-size: 2.5rem; opacity: .6; }
	.empty-title { font-size: 1rem; font-weight: 600; color: #1e293b; margin: .25rem 0 0; }
	.empty-hint  { font-size: .875rem; color: #94a3b8; margin: 0; }

	@media (max-width: 860px) {
		.polls-body {
			grid-template-columns: 1fr;
		}
		.col-divider {
			height: 1px;
			width: auto;
		}
		.polls-col {
			padding: 1.25rem 1.25rem 1.5rem;
		}
		.card-header, .card-filters {
			padding-left: 1.25rem;
			padding-right: 1.25rem;
		}
	}
</style>
