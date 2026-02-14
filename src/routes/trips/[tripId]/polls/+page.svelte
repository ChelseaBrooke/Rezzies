<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageData } from './$types';

	let { data, form }: { data: PageData; form: any } = $props();

	const filters = [
		{ value: 'all', label: 'All' },
		{ value: 'active', label: 'Active' },
		{ value: 'closed', label: 'Closed' },
		{ value: 'mine', label: 'My polls' }
	] as const;

	const polls = $derived(data.polls ?? []);
	const filter = $derived(data.filter ?? 'all');
	const currentUserId = $derived(data.currentUserId ?? '');
	const tripId = $derived(data.trip?.id ?? '');

	function filterHref(f: string) {
		return `/trips/${tripId}/polls${f === 'all' ? '' : `?filter=${f}`}`;
	}

	function formatDate(d: Date | string) {
		return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
	}
	function initials(name: string | null | undefined): string {
		if (!name?.trim()) return '?';
		const parts = name.trim().split(/\s+/);
		return parts.length >= 2 ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase() : name.slice(0, 2).toUpperCase();
	}
</script>

<svelte:head>
	<title>Polls – {data.trip?.name ?? 'Trip'}</title>
</svelte:head>

<div class="polls-page">
	<header class="page-header">
		<h1>Polls</h1>
		<p class="subtitle">Create polls for the group (e.g. dinner votes, activity choices). Anyone can add a poll.</p>
	</header>

	<!-- Filter tabs -->
	<nav class="filter-tabs" aria-label="Filter polls">
		{#each filters as f}
			<a
				href={filterHref(f.value)}
				class="filter-tab"
				class:active={filter === f.value}
			>
				{f.label}
			</a>
		{/each}
	</nav>

	<!-- Add poll (anyone) -->
	<details class="add-poll-section">
		<summary class="add-poll-summary">+ New poll</summary>
		<form method="POST" action="?/create" use:enhance class="add-poll-form">
			<label for="poll-question">Question</label>
			<input
				id="poll-question"
				type="text"
				name="question"
				placeholder="e.g. Where should we have dinner Friday?"
				maxlength="500"
				required
			/>
			<label for="poll-options">Options (one per line)</label>
			<textarea
				id="poll-options"
				name="options"
				rows="4"
				placeholder="Option A&#10;Option B&#10;Option C"
				required
			></textarea>
			{#if form?.createError}
				<p class="form-error" role="alert">{form.createError}</p>
			{/if}
			<button type="submit" class="btn btn-primary">Create poll</button>
		</form>
	</details>

	{#if form?.createSuccess}
		<p class="success-msg">Poll created!</p>
	{/if}

	<!-- Poll list -->
	<div class="polls-list">
		{#if polls.length === 0}
			<div class="empty-state">
				<div class="empty-icon" aria-hidden="true">📋</div>
				<p>No polls yet.</p>
				<p class="empty-hint">Create one above to get the group’s input.</p>
			</div>
		{:else}
			{#each polls as poll}
				<article class="poll-card" class:closed={poll.status === 'closed'}>
					<div class="poll-header">
						<div class="poll-header-main">
							<h2 class="poll-question">{poll.question}</h2>
							<div class="poll-meta">
								<span class="poll-date">{formatDate(poll.createdAt)}</span>
								{#if poll.status === 'closed'}
									<span class="poll-badge closed">Closed</span>
								{:else}
									<span class="poll-badge active">Active</span>
								{/if}
							</div>
						</div>
						<div class="poll-creator-avatar" title={poll.createdBy?.name ?? 'Created by'}>
							{#if poll.createdBy?.avatarUrl}
								<img src={poll.createdBy.avatarUrl} alt="" />
							{:else}
								<span class="avatar-initials">{initials(poll.createdBy?.name)}</span>
							{/if}
						</div>
					</div>

					<div class="poll-options">
						{#if poll.status === 'closed' || poll.userVoted}
							<!-- Show results -->
							{#each poll.options as opt}
								<div class="poll-option result">
									<span class="option-label">{opt.label}</span>
									<span class="option-bar-wrap">
										<span
											class="option-bar"
											style="width: {poll.totalVotes > 0 ? (100 * opt.voteCount) / poll.totalVotes : 0}%"
										></span>
									</span>
									<span class="option-count">{opt.voteCount} {opt.voteCount === 1 ? 'vote' : 'votes'}</span>
								</div>
							{/each}
							<p class="total-votes">{poll.totalVotes} {poll.totalVotes === 1 ? 'vote' : 'votes'} total</p>
						{:else}
							<!-- Vote form -->
							<form method="POST" action="?/vote" use:enhance class="vote-form">
								<input type="hidden" name="pollId" value={poll.id} />
								{#each poll.options as opt}
									<label class="poll-option vote-option">
										<input type="radio" name="optionId" value={opt.id} required />
										<span class="option-label">{opt.label}</span>
									</label>
								{/each}
								<button type="submit" class="btn btn-primary btn-sm">Submit vote</button>
							</form>
						{/if}
					</div>

					{#if poll.status === 'active' && poll.createdById === currentUserId}
						<form method="POST" action="?/close" use:enhance class="close-form">
							<input type="hidden" name="pollId" value={poll.id} />
							<button type="submit" class="btn-ghost">Close poll</button>
						</form>
					{/if}
				</article>
			{/each}
		{/if}
	</div>
</div>

<style>
	.polls-page {
		max-width: 640px;
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
		color: var(--text, #0f172a);
	}
	.subtitle {
		font-size: 0.9375rem;
		color: var(--muted, #64748b);
		margin: 0;
	}

	.filter-tabs {
		display: flex;
		gap: 0.25rem;
		margin-bottom: 1.5rem;
		flex-wrap: wrap;
	}
	.filter-tab {
		padding: 0.5rem 1rem;
		border-radius: 8px;
		font-size: 0.875rem;
		font-weight: 500;
		text-decoration: none;
		color: var(--muted, #64748b);
		background: var(--surface, #f8fafc);
		border: 1px solid var(--border-soft, #e2e8f0);
		transition: all 0.15s ease;
	}
	.filter-tab:hover {
		color: var(--text, #0f172a);
		background: var(--surface-hover, #f1f5f9);
	}
	.filter-tab.active {
		background: var(--primary, #6366f1);
		color: white;
		border-color: var(--primary, #6366f1);
	}

	.add-poll-section {
		margin-bottom: 1.5rem;
		border: 1px dashed var(--border, #cbd5e1);
		border-radius: 12px;
		background: var(--surface, #fafafa);
		overflow: hidden;
	}
	.add-poll-summary {
		padding: 0.875rem 1.25rem;
		font-weight: 600;
		font-size: 0.9375rem;
		color: var(--primary, #6366f1);
		cursor: pointer;
		list-style: none;
	}
	.add-poll-summary::-webkit-details-marker {
		display: none;
	}
	.add-poll-form {
		padding: 0 1.25rem 1.25rem;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}
	.add-poll-form label {
		font-size: 0.8125rem;
		font-weight: 600;
		color: var(--text, #0f172a);
	}
	.add-poll-form input,
	.add-poll-form textarea {
		padding: 0.5rem 0.75rem;
		border-radius: 8px;
		border: 1px solid var(--border, #e2e8f0);
		font-size: 0.9375rem;
		font-family: inherit;
	}
	.add-poll-form textarea {
		resize: vertical;
		min-height: 80px;
	}
	.form-error {
		font-size: 0.875rem;
		color: var(--error, #b91c1c);
		margin: 0;
	}
	.success-msg {
		font-size: 0.9375rem;
		color: var(--success, #15803d);
		margin: 0 0 1rem 0;
	}

	.polls-list {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}
	.empty-state {
		text-align: center;
		padding: 3rem 1.5rem;
		background: var(--surface, #f8fafc);
		border-radius: 12px;
		border: 1px solid var(--border-soft, #e2e8f0);
	}
	.empty-icon {
		font-size: 2.5rem;
		margin-bottom: 0.75rem;
		opacity: 0.7;
	}
	.empty-state p {
		margin: 0 0 0.25rem 0;
		color: var(--text, #0f172a);
		font-size: 1rem;
	}
	.empty-hint {
		color: var(--muted, #64748b) !important;
		font-size: 0.875rem !important;
	}

	.poll-card {
		background: var(--surface-solid, #fff);
		border-radius: 12px;
		border: 1px solid var(--border-soft, #e2e8f0);
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
		padding: 1.25rem 1.5rem;
		transition: box-shadow 0.2s ease;
	}
	.poll-card:hover {
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
	}
	.poll-card.closed {
		opacity: 0.92;
	}
	.poll-header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1rem;
		margin-bottom: 1rem;
	}
	.poll-header-main {
		flex: 1;
		min-width: 0;
	}
	.poll-creator-avatar {
		flex-shrink: 0;
		width: 36px;
		height: 36px;
		border-radius: 50%;
		overflow: hidden;
		background: var(--border-soft, #e2e8f0);
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.poll-creator-avatar img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.poll-creator-avatar .avatar-initials {
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--muted, #64748b);
	}
	.poll-question {
		font-size: 1.125rem;
		font-weight: 600;
		margin: 0 0 0.5rem 0;
		color: var(--text, #0f172a);
		line-height: 1.35;
	}
	.poll-meta {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem 1rem;
		font-size: 0.8125rem;
		color: var(--muted, #64748b);
	}
	.poll-badge {
		padding: 0.2rem 0.5rem;
		border-radius: 6px;
		font-weight: 600;
		font-size: 0.75rem;
	}
	.poll-badge.active {
		background: rgba(34, 197, 94, 0.15);
		color: #15803d;
	}
	.poll-badge.closed {
		background: var(--border-soft, #e2e8f0);
		color: var(--muted, #64748b);
	}
	.poll-options {
		margin-bottom: 0.75rem;
	}
	.poll-option {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		margin-bottom: 0.5rem;
	}
	.poll-option.result {
		align-items: center;
	}
	.option-label {
		flex: 0 0 auto;
		min-width: 120px;
		font-size: 0.9375rem;
		color: var(--text, #0f172a);
	}
	.option-bar-wrap {
		flex: 1;
		height: 8px;
		background: var(--border-soft, #e2e8f0);
		border-radius: 4px;
		overflow: hidden;
	}
	.option-bar {
		display: block;
		height: 100%;
		background: var(--primary, #6366f1);
		border-radius: 4px;
		transition: width 0.3s ease;
	}
	.option-count {
		flex: 0 0 auto;
		font-size: 0.8125rem;
		color: var(--muted, #64748b);
		width: 4rem;
		text-align: right;
	}
	.total-votes {
		font-size: 0.8125rem;
		color: var(--muted, #64748b);
		margin: 0.5rem 0 0 0;
	}
	.vote-option {
		cursor: pointer;
		padding: 0.5rem 0;
		border-radius: 8px;
	}
	.vote-option:hover {
		background: var(--surface-hover, #f1f5f9);
	}
	.vote-option input {
		margin: 0;
	}
	.vote-form {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}
	.vote-form .btn-sm {
		align-self: flex-start;
		margin-top: 0.5rem;
	}
	.close-form {
		margin-top: 0.5rem;
		padding-top: 0.75rem;
		border-top: 1px solid var(--border-soft, #e2e8f0);
	}
	.btn-ghost {
		background: none;
		border: none;
		font-size: 0.8125rem;
		color: var(--muted, #64748b);
		cursor: pointer;
		padding: 0.25rem 0;
	}
	.btn-ghost:hover {
		color: var(--text, #0f172a);
		text-decoration: underline;
	}
	.btn {
		padding: 0.5rem 1rem;
		border-radius: 8px;
		font-size: 0.9375rem;
		font-weight: 600;
		border: none;
		cursor: pointer;
		font-family: inherit;
	}
	.btn-primary {
		background: var(--primary, #6366f1);
		color: white;
	}
	.btn-primary:hover {
		background: var(--primaryHover, #4f46e5);
	}
	.btn-sm {
		padding: 0.35rem 0.75rem;
		font-size: 0.875rem;
	}
</style>
