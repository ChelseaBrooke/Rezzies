<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { enhance } from '$app/forms';
	import type { PageData } from './$types';
	import LeaderboardPanel from '$lib/components/games/caption-this/LeaderboardPanel.svelte';
	import PhotoSubmitBox from '$lib/components/games/caption-this/PhotoSubmitBox.svelte';
	import CaptionWall from '$lib/components/games/caption-this/CaptionWall.svelte';
	import CaptionInput from '$lib/components/games/caption-this/CaptionInput.svelte';
	import VotingGrid from '$lib/components/games/caption-this/VotingGrid.svelte';
	import ResultsPanel from '$lib/components/games/caption-this/ResultsPanel.svelte';
	import { getMsUntilMidnight, formatCountdown } from '$lib/utils/caption-this.js';

	let { data, form }: { data: PageData; form?: unknown } = $props();

	const round = $derived(data.round);
	const leaderboard = $derived(data.leaderboard ?? []);
	const currentUserId = $derived(data.currentUserId ?? null);
	const tripTimezone = $derived(data.tripTimezone ?? 'UTC');
	const captionMaxLength = $derived(data.captionMaxLength ?? 120);
	const eligibleCaptionCount = $derived(data.eligibleCaptionCount ?? 0);
	const formResult = $derived(form);

	const phase = $derived(round?.phase ?? null);
	const roundId = $derived(round?.id ?? '');
	const photoUrl = $derived(round?.photoUrl ?? null);
	const photoSubmitterUserId = $derived(round?.photoSubmitterUserId ?? null);
	const dayKey = $derived(round?.dayKey ?? '');
	const isPhotoSubmitter = $derived(
		currentUserId != null && photoSubmitterUserId === currentUserId
	);
	const voteCount = $derived(round?.votes?.length ?? 0);
	const canRemovePhoto = $derived(
		isPhotoSubmitter &&
			(phase === 'CAPTION_SUBMISSION' || phase === 'VOTING') &&
			voteCount === 0 &&
			(photoUrl ?? null) != null
	);

	const anonymousCaptions = $derived(
		round?.captions?.map((c) => ({ id: c.id, text: c.text, voteCount: c.voteCount })) ?? []
	);
	const myCaptionIds = $derived(
		new Set(
			round?.captions?.filter((c) => c.userId === currentUserId).map((c) => c.id) ?? []
		)
	);
	const myVoteCaptionId = $derived(
		round?.votes?.find((v) => v.voterUserId === currentUserId)?.captionId ?? null
	);
	const myCaptionText = $derived(
		round?.captions?.find((c) => c.userId === currentUserId)?.text ?? null
	);
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

	let countdownMs = $state(0);
	let collapsedLeaderboard = $state(false);
	let endRoundEarlyConfirm = $state(false);

	$effect(() => {
		if (phase === 'RESULTS' || !dayKey || !tripTimezone) {
			countdownMs = 0;
			return;
		}
		const update = () => {
			countdownMs = getMsUntilMidnight(tripTimezone, dayKey);
		};
		update();
		const interval = setInterval(update, 1000);
		return () => clearInterval(interval);
	});

	// In RESULTS, poll so we see when photo submitter starts next round
	$effect(() => {
		if (phase !== 'RESULTS') return;
		const t = setInterval(() => invalidateAll(), 5000);
		return () => clearInterval(t);
	});

	$effect(() => {
		if (phase !== 'CAPTION_SUBMISSION' && phase !== 'VOTING') {
			endRoundEarlyConfirm = false;
		}
	});

	const countdownLabel = $derived(
		countdownMs > 0 ? formatCountdown(countdownMs) : ''
	);

	const actionError = $derived(
		formResult && typeof formResult === 'object' && 'type' in formResult && formResult.type === 'failure' && formResult.data && typeof formResult.data === 'object' && 'error' in formResult.data
			? String((formResult.data as { error?: string }).error)
			: null
	);
</script>

<svelte:head>
	<title>Caption This | {data.trip?.name ?? 'Trip'}</title>
</svelte:head>

<div class="page">
	<div class="layout">
		<aside class="aside" class:collapsed={collapsedLeaderboard}>
			<LeaderboardPanel
				leaderboard={leaderboard}
				currentUserId={currentUserId}
				thisRoundTopVotes={thisRoundTopVotes}
				thisRoundTiedCount={thisRoundTiedCount}
				bind:collapsed={collapsedLeaderboard}
			/>
		</aside>
		<main class="main">
			<header class="header">
				<a href="/trips/{data.trip?.id ?? ''}/games" class="back-link">← Games</a>
				<h1 class="title">Caption This</h1>
				<div class="header-meta">
					{#if phase}
						<span class="phase-pill" data-phase={phase}>{phase.replace(/_/g, ' ')}</span>
					{/if}
					{#if countdownLabel}
						<span class="countdown">Ends at midnight: {countdownLabel}</span>
					{/if}
				</div>
			</header>

			{#if actionError}
				<div class="toast error" role="alert">{actionError}</div>
			{/if}

			{#if !round}
				<p class="empty">No active round. Refresh the page.</p>
			{:else}
				<div class="game-area">
					<div class="photo-section">
						<PhotoSubmitBox
							photoUrl={photoUrl}
							roundId={roundId}
							disabled={phase !== 'WAITING_FOR_PHOTO'}
						/>
						{#if canRemovePhoto}
							<div class="remove-photo">
								<form
									method="POST"
									action="?/removePhoto"
									class="remove-photo-form"
									use:enhance={() => async ({ result, update }) => {
										await update();
										if (result.type === 'success' || result.type === 'redirect') await invalidateAll();
									}}
								>
									<input type="hidden" name="roundId" value={roundId} />
									<button type="submit" class="remove-photo-btn" title="Clears the photo and all captions. Not available after anyone votes.">
										Remove photo
									</button>
								</form>
								<p class="remove-photo-hint">You can take this back until the first vote. This resets the round.</p>
							</div>
						{/if}
					</div>

					{#if phase === 'CAPTION_SUBMISSION'}
						<section class="section">
							<h2 class="section-title">Captions</h2>
							<CaptionInput
								roundId={roundId}
								maxLength={captionMaxLength}
								existingText={myCaptionText}
								submitted={submittedCaption}
								isPhotoSubmitter={isPhotoSubmitter}
							/>
							<CaptionWall
								captions={anonymousCaptions}
								phase="CAPTION_SUBMISSION"
								expectedCount={eligibleCaptionCount}
							/>
						</section>
					{:else if phase === 'VOTING'}
						<section class="section">
							<h2 class="section-title">Vote for a caption</h2>
							<VotingGrid
								captions={anonymousCaptions}
								roundId={roundId}
								myVoteCaptionId={myVoteCaptionId}
								myCaptionIds={myCaptionIds}
								voteError={actionError}
							/>
						</section>
					{:else if phase === 'RESULTS'}
						<ResultsPanel
							captions={anonymousCaptions}
							isPhotoSubmitter={isPhotoSubmitter}
						/>
					{/if}

					{#if (phase === 'CAPTION_SUBMISSION' || phase === 'VOTING') && isPhotoSubmitter}
						<div class="end-round-wrap">
							{#if endRoundEarlyConfirm}
								<span class="end-round-confirm">
									End round now?
									<form method="POST" action="?/endRoundNow" class="inline-form">
										<input type="hidden" name="roundId" value={roundId} />
										<button type="submit" class="btn-danger">Yes, end round</button>
									</form>
									<button type="button" class="btn-ghost" onclick={() => (endRoundEarlyConfirm = false)}>Cancel</button>
								</span>
							{:else}
								<button type="button" class="btn-ghost end-round-btn" onclick={() => (endRoundEarlyConfirm = true)}>
									End round now
								</button>
							{/if}
						</div>
					{/if}
				</div>
			{/if}
		</main>
	</div>
</div>

<style>
	.page {
		min-height: 100%;
		padding: 1rem;
	}
	.layout {
		display: grid;
		gap: 1.5rem;
		max-width: 1200px;
		margin: 0 auto;
	}
	@media (min-width: 768px) {
		.layout {
			grid-template-columns: 280px 1fr;
		}
	}
	.aside {
		position: relative;
	}
	.main {
		min-width: 0;
	}
	.header {
		margin-bottom: 1.25rem;
	}
	.back-link {
		display: inline-block;
		font-size: 0.875rem;
		color: var(--muted, #666);
		text-decoration: none;
		margin-bottom: 0.5rem;
	}
	.back-link:hover {
		color: var(--primary, #e85d04);
	}
	.title {
		margin: 0 0 0.5rem 0;
		font-size: 1.5rem;
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
		padding: 0.25rem 0.6rem;
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.03em;
		border-radius: 999px;
		background: var(--surface2, #eee);
		color: var(--text, #1a1a1a);
	}
	.countdown {
		font-size: 0.8125rem;
		color: var(--muted, #666);
	}
	.toast {
		padding: 0.75rem 1rem;
		border-radius: 8px;
		margin-bottom: 1rem;
		font-size: 0.875rem;
	}
	.toast.error {
		background: rgba(200, 0, 0, 0.1);
		color: var(--error, #c00);
	}
	.empty {
		font-size: 0.9375rem;
		color: var(--muted, #666);
		margin: 0;
	}
	.game-area {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}
	.photo-section {
		width: 100%;
	}
	.remove-photo {
		margin-top: 0.75rem;
		text-align: center;
	}
	.remove-photo-form {
		display: inline;
	}
	.remove-photo-btn {
		background: none;
		border: none;
		font: inherit;
		cursor: pointer;
		color: var(--muted, #666);
		text-decoration: underline;
		font-size: 0.8125rem;
		padding: 0.25rem 0.5rem;
	}
	.remove-photo-btn:hover {
		color: var(--error, #c00);
	}
	.remove-photo-hint {
		margin: 0.35rem 0 0 0;
		font-size: 0.75rem;
		color: var(--muted, #999);
		line-height: 1.35;
	}
	.section {
		margin-top: 0.5rem;
	}
	.section-title {
		margin: 0 0 0.5rem 0;
		font-size: 1rem;
		font-weight: 600;
		color: var(--text, #1a1a1a);
	}
	.end-round-wrap {
		margin-top: 1rem;
		padding-top: 1rem;
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
	.end-round-btn {
		color: var(--muted, #666);
	}
</style>
