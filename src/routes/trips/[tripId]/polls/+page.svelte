<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import type { PageData } from './$types';
	import {
		PollFiltersBar,
		PollCard,
		CreatePollModal,
		PollDetailModal,
		type PollWithMeta,
		type PollCategory,
		type PollSort,
		getStatusDisplay,
		getTimeLabel,
		type CreatePollFormData
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
	let detailPoll = $state<PollWithMeta | null>(null);
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

	function openDetail(poll: PollWithMeta) {
		detailPoll = poll;
		showDetailModal = true;
	}

	function closeDetail() {
		showDetailModal = false;
		detailPoll = null;
	}

	function handleCreateSubmit(formData: CreatePollFormData, action: 'draft' | 'open') {
		const form = document.getElementById('create-poll-form') as HTMLFormElement;
		if (!form) return;
		const fd = new FormData();
		fd.set('title', formData.title);
		fd.set('description', formData.description);
		fd.set('category', formData.category);
		fd.set('pollType', formData.pollType);
		fd.set('options', formData.options.join('\n'));
		fd.set('durationHours', String(formData.durationHours));
		fd.set('showResultsLive', formData.showResultsLive ? '1' : '0');
		fd.set('asDraft', action === 'draft' ? '1' : '0');
		fetch(form.action, { method: 'POST', body: fd }).then(async () => {
			await invalidateAll();
			showCreateModal = false;
		});
	}

	function handleVote(optionIds: string[]) {
		const form = document.getElementById('vote-form') as HTMLFormElement;
		if (!form || !detailPoll) return;
		const fd = new FormData(form);
		fd.set('pollId', detailPoll.id);
		fd.set('optionIds', optionIds.join(','));
		fetch(form.action, { method: 'POST', body: fd }).then(() => {
			invalidateAll();
			if (detailPoll) {
				detailPoll = { ...detailPoll, userVoted: true, userOptionIds: optionIds };
			}
		});
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
<form id="create-poll-form" method="POST" action="?/create" use:enhance style="display:none">
	<input type="hidden" name="title" />
	<input type="hidden" name="description" />
	<input type="hidden" name="category" />
	<input type="hidden" name="pollType" />
	<input type="hidden" name="options" />
	<input type="hidden" name="durationHours" />
	<input type="hidden" name="showResultsLive" />
	<input type="hidden" name="asDraft" />
</form>
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
		canCreate={isHost}
	/>

	<div class="polls-grid">
		{#if filteredPolls.length === 0}
			<div class="empty-state">
				<div class="empty-icon" aria-hidden="true">🗳️</div>
				<p>No polls yet.</p>
				<p class="empty-hint">
					{isHost ? 'Click "Add New Poll" to create one.' : 'Check back later for new polls.'}
				</p>
				{#if isHost}
					<button type="button" class="btn-add-empty" onclick={() => (showCreateModal = true)}>
						Add New Poll
					</button>
				{/if}
			</div>
		{:else}
			{#each filteredPolls as poll}
				<PollCard
					poll={poll}
					onClick={() => openDetail(poll)}
				/>
			{/each}
		{/if}
	</div>
</div>

<CreatePollModal
	open={showCreateModal}
	onClose={() => (showCreateModal = false)}
	onSubmit={(d, action) => handleCreateSubmit(d, action)}
	error={form?.createError}
	submitting={form?.submitting}
/>

<PollDetailModal
	open={showDetailModal}
	poll={detailPoll}
	onClose={closeDetail}
	onVote={handleVote}
	onNudge={handleNudge}
	onClosePoll={isHost && detailPoll?.createdById === currentUserId ? handleClosePoll : undefined}
	canManage={isHost}
	voteError={form?.voteError}
/>

<style>
	.polls-page {
		max-width: 960px;
		margin: 0 auto;
		padding: 0 1rem 2rem;
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
	.polls-grid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 1.25rem;
	}
	@media (max-width: 768px) {
		.polls-grid {
			grid-template-columns: 1fr;
		}
	}
	.empty-state {
		grid-column: 1 / -1;
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
