<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { enhance } from '$app/forms';
	import { openProfileCard } from '$lib/stores/profileOverlay.js';
	import LeaderboardPanel from '$lib/components/games/caption-this/LeaderboardPanel.svelte';
	import PhotoSubmitBox from '$lib/components/games/caption-this/PhotoSubmitBox.svelte';
	import ResultsPanel from '$lib/components/games/caption-this/ResultsPanel.svelte';

	type PastRoundSummary = {
		id: string;
		dayKey: string;
		photoUrl: string | null;
		captions: {
			id: string;
			text: string;
			userId: string;
			voteCount: number;
			userName: string | null;
			userAvatarUrl: string | null;
		}[];
	};
	type Round = {
		id: string;
		phase: string;
		photoUrl: string | null;
		photoSubmitterUserId: string | null;
		dayKey: string;
		captions?: { id: string; text: string; userId: string; voteCount?: number }[];
		votes?: { voterUserId: string; captionId: string }[];
	};
	type LeaderboardRow = { userId: string; name: string | null; pointsTotal: number; rank: number };

	type Props = {
		round: Round | null;
		leaderboard: LeaderboardRow[];
		pastRounds?: PastRoundSummary[];
		currentUserId: string | null;
		tripTimezone: string;
		captionMaxLength: number;
		eligibleCaptionCount: number;
		form?: unknown;
		activeTabId?: string | null;
	};
	let {
		round,
		leaderboard = [],
		pastRounds = [],
		currentUserId = null,
		tripTimezone = 'UTC',
		captionMaxLength = 120,
		eligibleCaptionCount = 0,
		form,
		activeTabId = null
	}: Props = $props();

	const phase = $derived(round?.phase ?? null);
	const roundId = $derived(round?.id ?? '');
	const photoUrl = $derived(round?.photoUrl ?? null);
	const photoSubmitterUserId = $derived(round?.photoSubmitterUserId ?? null);
	const dayKey = $derived(round?.dayKey ?? '');
	const isPhotoSubmitter = $derived(currentUserId != null && photoSubmitterUserId === currentUserId);

	const anonymousCaptions = $derived(
		round?.captions?.map((c) => ({ id: c.id, text: c.text, voteCount: c.voteCount })) ?? []
	);
	const leftSlots = $derived(anonymousCaptions.filter((_, i) => i % 2 === 0));
	const rightSlots = $derived(anonymousCaptions.filter((_, i) => i % 2 === 1));
	const canVoteForCaption = $derived(
		(phase === 'VOTING' || (phase === 'CAPTION_SUBMISSION' && isPhotoSubmitter)) && myVoteCaptionId == null
	);

	const myCaptionIds = $derived(
		new Set(round?.captions?.filter((c) => c.userId === currentUserId).map((c) => c.id) ?? [])
	);
	const myVoteCaptionId = $derived(
		round?.votes?.find((v) => v.voterUserId === currentUserId)?.captionId ?? null
	);
	const myCaptionText = $derived(round?.captions?.find((c) => c.userId === currentUserId)?.text ?? null);
	const submittedCaption = $derived(myCaptionText != null);

	const thisRoundTopVotes = $derived.by(() => {
		if (phase !== 'RESULTS' || !round?.captions?.length) return undefined;
		const counts = round.captions.map((c) => c.voteCount ?? 0);
		const max = Math.max(...counts);
		return max > 0 ? max : undefined;
	});
	const thisRoundTiedCount = $derived.by(() => {
		if (phase !== 'RESULTS' || thisRoundTopVotes == null) return undefined;
		return round?.captions?.filter((c) => (c.voteCount ?? 0) === thisRoundTopVotes).length ?? 0;
	});

	let collapsedLeaderboard = $state(false);
	let endRoundConfirm = $state(false);
	let selectedPastRoundId = $state<string | null>(null);
	let overlayCaptionText = $state('');
	let overlaySubmitting = $state(false);

	const selectedPastRound = $derived(
		selectedPastRoundId ? pastRounds.find((r) => r.id === selectedPastRoundId) ?? null : null
	);
	const selectedPastWinner = $derived.by(() => {
		if (!selectedPastRound?.captions?.length) return null;
		const maxVotes = Math.max(...selectedPastRound.captions.map((c) => c.voteCount));
		if (maxVotes === 0) return null;
		return selectedPastRound.captions.find((c) => c.voteCount === maxVotes) ?? null;
	});

	$effect(() => {
		if (phase !== 'RESULTS') return;
		const t = setInterval(() => invalidateAll(), 5000);
		return () => clearInterval(t);
	});

	// Refetch periodically during caption/voting so e.g. photo submitter sees VOTING after guest submits
	$effect(() => {
		if (phase !== 'CAPTION_SUBMISSION' && phase !== 'VOTING') return;
		const t = setInterval(() => invalidateAll(), 4000);
		return () => clearInterval(t);
	});

	const actionError = $derived(
		form &&
			typeof form === 'object' &&
			'type' in form &&
			(form as { type: string }).type === 'failure' &&
			'data' in form &&
			form.data &&
			typeof form.data === 'object' &&
			'error' in form.data
			? String((form.data as { error?: string }).error)
			: null
	);

	function handleOverlayCaptionSubmit() {
		return async ({
			result,
			update
		}: {
			result: { type: string };
			update: () => Promise<void>;
		}) => {
			overlaySubmitting = true;
			await update();
			overlaySubmitting = false;
			if (result.type === 'success' || result.type === 'redirect') {
				overlayCaptionText = '';
				await invalidateAll();
			}
		};
	}

	function submitOverlayOnEnter(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			const form = (e.target as HTMLElement).closest('form');
			if (form && overlayCaptionText.trim()) form.requestSubmit();
		}
	}
</script>

<div class="caption-this-embed">
	<!-- Top: Leaderboard (left) + Past photos (right) -->
	<div class="top-bar">
		<div class="leaderboard-wrap">
			<LeaderboardPanel
				leaderboard={leaderboard}
				currentUserId={currentUserId}
				thisRoundTopVotes={thisRoundTopVotes}
				thisRoundTiedCount={thisRoundTiedCount}
				bind:collapsed={collapsedLeaderboard}
			/>
		</div>
		{#if pastRounds.length > 0}
			<div class="past-photos">
				<span class="past-photos-label">Past photos</span>
				<div class="past-photos-grid">
					{#each pastRounds as pr}
						<button
							type="button"
							class="past-photo-thumb"
							class:selected={selectedPastRoundId === pr.id}
							onclick={() => selectedPastRoundId = selectedPastRoundId === pr.id ? null : pr.id}
							title={pr.dayKey}
						>
							{#if pr.photoUrl}
								<img src={pr.photoUrl} alt="" />
							{:else}
								<span class="past-photo-placeholder">No photo</span>
							{/if}
						</button>
					{/each}
				</div>
			</div>
		{/if}
	</div>

	{#if actionError}
		<div class="toast error" role="alert">{actionError}</div>
	{/if}

	{#if !round && !selectedPastRound}
		<p class="empty">No active round. Refresh the page.</p>
	{:else if selectedPastRound}
		<!-- Static view of a past round: photo + winner on photo with crown + captions with avatars -->
		<div class="past-round-view">
			<button type="button" class="back-to-current" onclick={() => (selectedPastRoundId = null)}>
				← Back to current
			</button>
			<div class="past-round-layout">
				<div class="past-captions-list">
					<h3 class="past-captions-title">Captions</h3>
					<ul class="past-captions-ul" role="list">
					{#each selectedPastRound.captions as c}
						<li class="past-caption-row">
							<button type="button" class="past-caption-avatar past-caption-avatar--btn" title={c.userName ?? ''} onclick={() => openProfileCard(c.userId)}>
								{#if c.userAvatarUrl}
									<img src={c.userAvatarUrl} alt="" />
								{:else}
									<span class="past-caption-initial">{ (c.userName ?? '?').charAt(0).toUpperCase() }</span>
								{/if}
							</button>
								<span class="past-caption-text">"{c.text}"</span>
								{#if c.voteCount > 0}
									<span class="past-caption-votes">{c.voteCount} vote{c.voteCount !== 1 ? 's' : ''}</span>
								{/if}
							</li>
						{/each}
					</ul>
				</div>
				<div class="past-photo-wrap">
					{#if selectedPastRound.photoUrl}
						<div class="polaroid past-polaroid">
							<div class="polaroid-inner">
								<img src={selectedPastRound.photoUrl} alt="Past round photo" class="photo-img" />
							</div>
							{#if selectedPastWinner}
								<div class="winner-on-photo">
									<span class="winner-crown" aria-hidden="true">👑</span>
									<p class="winner-text">"{selectedPastWinner.text}"</p>
								</div>
							{/if}
						</div>
					{:else}
						<p class="no-photo">No photo for this round.</p>
					{/if}
				</div>
			</div>
		</div>
	{:else}
		<!-- Current round: left slots | photo | right slots -->
		<header class="header">
			<h2 class="title">Caption This</h2>
			<div class="header-meta">
				{#if phase}
					<span class="phase-pill" data-phase={phase}>{phase.replace(/_/g, ' ')}</span>
				{/if}
			</div>
		</header>

		<div class="game-area three-col">
			<div class="slots slots-left">
				{#each leftSlots as c}
					{@const canVoteThis = canVoteForCaption && !myCaptionIds.has(c.id)}
					{#if canVoteThis}
						<form method="POST" action="?/submitVote" class="slot-vote-form" use:enhance={() => async ({ result, update }) => { await update(); if (result.type === 'success' || result.type === 'redirect') await invalidateAll(); }}>
							<input type="hidden" name="roundId" value={roundId} />
							<input type="hidden" name="captionId" value={c.id} />
							{#if activeTabId}<input type="hidden" name="activeTab" value={activeTabId} />{/if}
							<button type="submit" class="slot-card slot-card-vote">"{c.text}"</button>
						</form>
					{:else}
						<div class="slot-card" class:slot-voted={myVoteCaptionId === c.id}>"{c.text}"</div>
					{/if}
				{/each}
			</div>

			<div class="photo-section">
				<div class="photo-wrap">
					<PhotoSubmitBox
						photoUrl={photoUrl}
						roundId={roundId}
						disabled={phase !== 'WAITING_FOR_PHOTO'}
						activeTabId={activeTabId}
					/>
					{#if phase === 'CAPTION_SUBMISSION' && photoUrl && !isPhotoSubmitter && !submittedCaption}
						<div class="overlay-caption">
							<form
								method="POST"
								action="?/submitCaption"
								class="overlay-form"
								use:enhance={handleOverlayCaptionSubmit}
							>
								<input type="hidden" name="roundId" value={roundId} />
								{#if activeTabId}
									<input type="hidden" name="activeTab" value={activeTabId} />
								{/if}
								<input
									type="text"
									name="text"
									class="overlay-input"
									placeholder="Write a caption… (Enter to submit)"
									maxlength={captionMaxLength}
									bind:value={overlayCaptionText}
									onkeydown={submitOverlayOnEnter}
									disabled={overlaySubmitting}
								/>
							</form>
						</div>
					{/if}
				</div>
			</div>

			<div class="slots slots-right">
				{#each rightSlots as c}
					{@const canVoteThis = canVoteForCaption && !myCaptionIds.has(c.id)}
					{#if canVoteThis}
						<form method="POST" action="?/submitVote" class="slot-vote-form" use:enhance={() => async ({ result, update }) => { await update(); if (result.type === 'success' || result.type === 'redirect') await invalidateAll(); }}>
							<input type="hidden" name="roundId" value={roundId} />
							<input type="hidden" name="captionId" value={c.id} />
							{#if activeTabId}<input type="hidden" name="activeTab" value={activeTabId} />{/if}
							<button type="submit" class="slot-card slot-card-vote">"{c.text}"</button>
						</form>
					{:else}
						<div class="slot-card" class:slot-voted={myVoteCaptionId === c.id}>"{c.text}"</div>
					{/if}
				{/each}
			</div>
		</div>

		{#if phase === 'RESULTS'}
			<ResultsPanel
				captions={anonymousCaptions}
				isPhotoSubmitter={isPhotoSubmitter}
				activeTabId={activeTabId}
			/>
		{/if}

		{#if (phase === 'CAPTION_SUBMISSION' || phase === 'VOTING') && isPhotoSubmitter}
			<div class="end-round-wrap">
				{#if endRoundConfirm}
					<span class="end-round-confirm">
						End round now?
						<form method="POST" action="?/endRoundNow" class="inline-form">
							<input type="hidden" name="roundId" value={roundId} />
							{#if activeTabId}
								<input type="hidden" name="activeTab" value={activeTabId} />
							{/if}
							<button type="submit" class="btn-danger">Yes, end round</button>
						</form>
						<button type="button" class="btn-ghost" onclick={() => (endRoundConfirm = false)}>Cancel</button>
					</span>
				{:else}
					<button type="button" class="btn-ghost end-round-btn" onclick={() => (endRoundConfirm = true)}>
						End round now
					</button>
				{/if}
			</div>
		{/if}
	{/if}
</div>

<style>
	.caption-this-embed {
		width: 100%;
		min-height: 100%;
		display: flex;
		flex-direction: column;
	}
	.top-bar {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-start;
		gap: 1rem;
		margin-bottom: 1rem;
	}
	.leaderboard-wrap {
		flex: 1;
		min-width: 200px;
	}
	.past-photos {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}
	.past-photos-label {
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--muted, #666);
	}
	.past-photos-grid {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}
	.past-photo-thumb {
		width: 56px;
		height: 56px;
		border-radius: 8px;
		overflow: hidden;
		border: 2px solid var(--border, #e5e5e5);
		background: var(--surface2, #f0f0f0);
		padding: 0;
		cursor: pointer;
		transition: border-color 0.2s, box-shadow 0.2s;
	}
	.past-photo-thumb:hover {
		border-color: var(--primary, #e85d04);
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
	}
	.past-photo-thumb.selected {
		border-color: var(--primary, #e85d04);
		box-shadow: 0 0 0 2px rgba(232, 93, 4, 0.3);
	}
	.past-photo-thumb img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.past-photo-placeholder {
		font-size: 0.65rem;
		color: var(--muted, #999);
		display: flex;
		align-items: center;
		justify-content: center;
		height: 100%;
	}
	.toast.error {
		padding: 0.6rem 0.875rem;
		border-radius: 8px;
		margin-bottom: 0.75rem;
		font-size: 0.875rem;
		background: rgba(200, 0, 0, 0.1);
		color: var(--error, #c00);
	}
	.empty {
		font-size: 0.9375rem;
		color: var(--muted, #666);
		margin: 0;
	}

	/* Past round view */
	.past-round-view {
		margin-top: 0.5rem;
	}
	.back-to-current {
		padding: 0.35rem 0.75rem;
		font-size: 0.8125rem;
		background: var(--surface2, #f0f0f0);
		border: 1px solid var(--border, #ddd);
		border-radius: 6px;
		cursor: pointer;
		margin-bottom: 1rem;
		color: var(--text, #1a1a1a);
	}
	.back-to-current:hover {
		background: var(--border, #e5e5e5);
	}
	.past-round-layout {
		display: grid;
		gap: 1.5rem;
		grid-template-columns: 1fr minmax(280px, 400px);
		align-items: start;
	}
	@media (max-width: 640px) {
		.past-round-layout {
			grid-template-columns: 1fr;
		}
	}
	.past-captions-list {
		background: var(--surface2, #f5f5f5);
		border-radius: 12px;
		padding: 1rem;
		border: 1px solid var(--border, #e5e5e5);
	}
	.past-captions-title {
		margin: 0 0 0.75rem 0;
		font-size: 0.9375rem;
		font-weight: 600;
		color: var(--text, #1a1a1a);
	}
	.past-captions-ul {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.past-caption-row {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.5rem 0;
		border-bottom: 1px solid var(--border, #eee);
		font-size: 0.875rem;
	}
	.past-caption-row:last-child {
		border-bottom: none;
	}
	.past-caption-avatar {
		width: 28px;
		height: 28px;
		border-radius: 50%;
		overflow: hidden;
		background: var(--surface, #ddd);
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.past-caption-avatar--btn {
		border: none;
		padding: 0;
		cursor: pointer;
		transition: outline 120ms ease;
	}
	.past-caption-avatar--btn:hover {
		outline: 2px solid var(--copper, #bf4e30);
		outline-offset: 2px;
	}
	.past-caption-avatar img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.past-caption-initial {
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--text, #1a1a1a);
	}
	.past-caption-text {
		flex: 1;
		min-width: 0;
		color: var(--text, #1a1a1a);
	}
	.past-caption-votes {
		font-size: 0.75rem;
		color: var(--muted, #666);
		flex-shrink: 0;
	}
	.past-photo-wrap {
		display: flex;
		justify-content: center;
	}
	.past-polaroid {
		position: relative;
		display: inline-block;
		padding: 0.75rem 0.75rem 2.5rem 0.75rem;
		background: #fff;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08), 0 8px 24px rgba(0, 0, 0, 0.06);
		border-radius: 2px;
		max-width: 100%;
	}
	.past-polaroid .polaroid-inner {
		overflow: hidden;
		border-radius: 1px;
		line-height: 0;
	}
	.past-polaroid .photo-img {
		width: 100%;
		height: auto;
		max-height: 50vh;
		object-fit: contain;
		display: block;
	}
	.winner-on-photo {
		position: absolute;
		bottom: 0.5rem;
		left: 0.75rem;
		right: 0.75rem;
		background: rgba(0, 0, 0, 0.75);
		color: #fff;
		padding: 0.5rem 0.75rem;
		border-radius: 8px;
		text-align: center;
	}
	.winner-crown {
		display: block;
		font-size: 1.25rem;
		margin-bottom: 0.25rem;
	}
	.winner-text {
		margin: 0;
		font-size: 0.8125rem;
		line-height: 1.3;
	}
	.no-photo {
		font-size: 0.9375rem;
		color: var(--muted, #666);
		margin: 0;
	}

	/* Current round */
	.header {
		margin-bottom: 1rem;
	}
	.title {
		margin: 0 0 0.5rem 0;
		font-size: 1.25rem;
		font-weight: 700;
		color: var(--text, #1a1a1a);
	}
	.header-meta {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.75rem;
	}
	.phase-pill {
		display: inline-block;
		padding: 0.2rem 0.5rem;
		font-size: 0.7rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.03em;
		border-radius: 999px;
		background: var(--surface2, #eee);
		color: var(--text, #1a1a1a);
	}
	.game-area.three-col {
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		gap: 1rem;
		align-items: start;
		margin-bottom: 1rem;
	}
	@media (max-width: 768px) {
		.game-area.three-col {
			grid-template-columns: 1fr;
		}
		.game-area.three-col .photo-section {
			order: -1;
		}
	}
	.slots {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		min-height: 120px;
	}
	.slot-vote-form {
		width: 100%;
		margin: 0;
	}
	.slot-card {
		background: var(--surface, #fff);
		border: 1px solid var(--border, #e5e5e5);
		border-radius: 10px;
		padding: 0.625rem 0.875rem;
		font-size: 0.875rem;
		line-height: 1.35;
		color: var(--text, #1a1a1a);
	}
	.slot-card-vote {
		width: 100%;
		display: block;
		text-align: left;
		background: var(--surface, #fff);
		border: 1px solid var(--border, #e5e5e5);
		border-radius: 10px;
		padding: 0.625rem 0.875rem;
		font-size: 0.875rem;
		line-height: 1.35;
		color: var(--text, #1a1a1a);
		cursor: pointer;
		transition: border-color 0.2s, background 0.2s;
	}
	.slot-card-vote:hover {
		border-color: var(--primary, #48bb78);
		background: rgba(72, 187, 120, 0.06);
	}
	.slot-card.slot-voted {
		border-color: var(--success, #16a34a);
		background: rgba(22, 163, 74, 0.06);
	}
	.photo-section {
		display: flex;
		justify-content: center;
	}
	.photo-wrap {
		position: relative;
		display: inline-block;
	}
	.overlay-caption {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: flex-end;
		justify-content: center;
		background: rgba(0, 0, 0, 0.4);
		border-radius: 2px;
		padding: 1rem 1rem 1.5rem 1rem;
	}
	.overlay-form {
		width: 100%;
		max-width: 320px;
	}
	.overlay-input {
		width: 100%;
		padding: 0.75rem 1rem;
		font-size: 0.9375rem;
		border: 2px solid #fff;
		border-radius: 8px;
		background: #fff;
		color: var(--text, #1a1a1a);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
	}
	.overlay-input::placeholder {
		color: var(--muted, #888);
	}
	.section-title {
		margin: 0 0 0.5rem 0;
		font-size: 0.9375rem;
		font-weight: 600;
		color: var(--text, #1a1a1a);
	}
	.end-round-wrap {
		margin-top: 0.75rem;
		padding-top: 0.75rem;
		border-top: 1px solid var(--border, #eee);
	}
	.end-round-confirm {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.875rem;
		color: var(--muted, #666);
	}
	.inline-form {
		display: inline;
	}
	.btn-danger {
		padding: 0.35rem 0.75rem;
		font-size: 0.8125rem;
		font-weight: 600;
		background: var(--error, #c00);
		color: white;
		border: none;
		border-radius: 6px;
		cursor: pointer;
	}
	.btn-ghost {
		padding: 0.35rem 0.75rem;
		font-size: 0.8125rem;
		background: none;
		border: 1px solid var(--border, #ccc);
		border-radius: 6px;
		cursor: pointer;
		color: var(--muted, #666);
	}
</style>
