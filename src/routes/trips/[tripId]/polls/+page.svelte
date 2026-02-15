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

	// Client state for filters (synced with URL when using form actions)
	let searchQuery = $state(data.searchQuery ?? '');
	let category = $state<PollCategory>((data.category as PollCategory) ?? 'All');
	let sort = $state<PollSort>((data.sort as PollSort) ?? 'recent');

	// Modals
	let showCreateModal = $state(false);
	let detailPollId = $state<string | null>(null);
	let showDetailModal = $state(false);

	// Build polls with meta (from server or fallback dummy)
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
				userOptionIds: p.userOptionIds ?? (p.userOptionId ? [p.userOptionId] : [])
			} as PollWithMeta;
		})
	);

	// Client-side filter/sort when not using URL params
	const filteredPolls = $derived.by(() => {
		let list = [...pollsWithMeta];

		// Search
		if (searchQuery.trim()) {
			const q = searchQuery.toLowerCase();
			list = list.filter(
				(p) =>
					p.title?.toLowerCase().includes(q) ||
					p.description?.toLowerCase().includes(q) ||
					p.category?.toLowerCase().includes(q)
			);
		}

		// Category
		if (category !== 'All') {
			list = list.filter((p) => p.category === category);
		}

		// Sort
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

	// Partition into 3 sections
	const pollsUnvoted = $derived(
		filteredPolls.filter(
			(p) =>
				(p.statusDisplay === 'open' || p.statusDisplay === 'closing_soon') && !p.userVoted
		)
	);
	const pollsVotedActive = $derived(
		filteredPolls.filter(
			(p) =>
				(p.statusDisplay === 'open' || p.statusDisplay === 'closing_soon') && p.userVoted
		)
	);
	const pollsClosed = $derived(
		filteredPolls.filter(
			(p) => p.statusDisplay === 'closed' || p.statusDisplay === 'canceled'
		)
	);
	const pollsDrafts = $derived(filteredPolls.filter((p) => p.statusDisplay === 'draft'));

	// Derive detailPoll from server data so vote counts stay correct after voting
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
		// detailPoll is derived from pollsWithMeta, so it auto-updates with fresh vote counts
	}

	function handleNudge() {
		if (!detailPoll) return;
		const form = document.getElementById('nudge-form') as HTMLFormElement;
		if (!form) return;
		const fd = new FormData();
		fd.set('pollId', detailPoll.id);
		fetch(form.action, { method: 'POST', body: fd }).then(async () => {
			await invalidateAll();
			// Could show toast "Nudges sent"
		});
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
</script>

<svelte:head>
	<title>Polls – {data.trip?.name ?? 'Trip'}</title>
</svelte:head>

<!-- Hidden forms for form actions -->
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

<div class="polls-page">
	<header class="page-header">
		<h1>Polls</h1>
		<p class="subtitle">
			{isHost
				? 'Create and manage polls for the group. Guests can vote on open polls.'
				: 'Vote on polls and see results.'}
		</p>
	</header>

	<PollFiltersBar
		searchQuery={searchQuery}
		onSearchChange={(v) => (searchQuery = v)}
		category={category}
		onCategoryChange={(c) => (category = c)}
		sort={sort}
		onSortChange={(s) => (sort = s)}
		onAddNewPoll={() => (showCreateModal = true)}
		canCreate={true}
	/>

	{#if filteredPolls.length === 0}
		<div class="empty-state">
			<div class="empty-icon" aria-hidden="true">🗳️</div>
			<p>No polls yet.</p>
			<p class="empty-hint">
				{isHost ? 'Click "Add New Poll" to create one.' : 'Check back later for new polls.'}
			</p>
			<button type="button" class="btn-add-empty" onclick={() => (showCreateModal = true)}>
				Add New Poll
			</button>
		</div>
	{:else}
		<div class="polls-side-by-side">
			<div class="polls-column polls-column-open">
				<h2 id="section-open" class="column-title">Open</h2>
				{#if pollsUnvoted.length > 0 || pollsVotedActive.length > 0 || (isHost && pollsDrafts.length > 0)}
					<div class="polls-grid">
						{#each pollsUnvoted as poll}
							<PollCard poll={poll} onClick={() => openDetail(poll)} />
						{/each}
						{#each pollsVotedActive as poll}
							<PollCard poll={poll} onClick={() => openDetail(poll)} />
						{/each}
						{#if isHost}
							{#each pollsDrafts as poll}
								<PollCard poll={poll} onClick={() => openDetail(poll)} />
							{/each}
						{/if}
					</div>
				{:else}
					<p class="column-empty">No open polls</p>
				{/if}
			</div>
			<div class="polls-column polls-column-closed">
				<h2 id="section-closed" class="column-title">Closed</h2>
				{#if pollsClosed.length > 0}
					<div class="polls-grid">
						{#each pollsClosed as poll}
							<PollClosedCard poll={poll} onClick={() => openDetail(poll)} />
						{/each}
					</div>
				{:else}
					<p class="column-empty">No closed polls</p>
				{/if}
			</div>
		</div>
	{/if}
</div>

<CreatePollModal
	open={showCreateModal}
	onClose={() => (showCreateModal = false)}
	formAction={`/trips/${tripId}/polls?/create`}
	onSuccess={() => {
		showCreateModal = false;
		invalidateAll();
	}}
	error={form?.createError}
/>

<PollDetailModal
	open={showDetailModal}
	poll={detailPoll}
	onClose={closeDetail}
	onVote={handleVote}
	onNudge={handleNudge}
	onClosePoll={
				isHost || detailPoll?.createdById === currentUserId ? handleClosePoll : undefined
			}
	canManage={isHost}
	voteError={form?.voteError}
/>

<style>
	.polls-page {
		max-width: 1200px;
		margin: 0 auto;
		padding: 0 1rem 2rem;
	}
	.polls-side-by-side {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 2rem;
		align-items: start;
	}
	@media (max-width: 900px) {
		.polls-side-by-side {
			grid-template-columns: 1fr;
		}
	}
	.polls-column {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		min-width: 0;
	}
	.column-title {
		font-size: 1rem;
		font-weight: 600;
		color: var(--muted);
		margin: 0 0 0.5rem 0;
		letter-spacing: 0.02em;
	}
	.column-empty {
		font-size: 0.9375rem;
		color: var(--muted);
		margin: 0;
		padding: 2rem 1rem;
		text-align: center;
		background: var(--surface);
		border-radius: var(--radius-xl);
		border: 1px dashed var(--border-soft);
	}
	.page-header {
		margin-bottom: 1.5rem;
	}
	.page-header h1 {
		font-size: 1.75rem;
		font-weight: 700;
		margin: 0 0 0.35rem 0;
		color: var(--text);
	}
	.subtitle {
		font-size: 0.9375rem;
		color: var(--muted);
		margin: 0;
	}
	.poll-section {
		margin-bottom: 0;
	}
	.section-title {
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--muted);
		margin: 0 0 0.5rem 0;
		letter-spacing: 0.02em;
	}
	.polls-grid {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}
	.empty-state {
		text-align: center;
		padding: 3rem 1.5rem;
		background: var(--surface);
		border-radius: var(--radius-2xl);
		border: 1px solid var(--border-soft);
	}
	.empty-icon {
		font-size: 2.5rem;
		margin-bottom: 0.75rem;
		opacity: 0.7;
	}
	.empty-state p {
		margin: 0 0 0.25rem 0;
		color: var(--text);
		font-size: 1rem;
	}
	.empty-hint {
		color: var(--muted) !important;
		font-size: 0.875rem !important;
		margin-bottom: 1rem !important;
	}
	.btn-add-empty {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.625rem 1.25rem;
		background: var(--primary);
		color: white;
		border: none;
		border-radius: var(--radius-lg);
		font-size: 0.9375rem;
		font-weight: 600;
		cursor: pointer;
	}
	.btn-add-empty:hover {
		background: var(--primaryHover);
	}
</style>
