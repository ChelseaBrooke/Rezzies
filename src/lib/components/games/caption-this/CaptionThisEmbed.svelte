<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { enhance } from '$app/forms';
	import { page } from '$app/stores';
	import { openProfileCard } from '$lib/stores/profileOverlay.js';

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
		captionMaxLength: number;
		eligibleCaptionCount: number;
		form?: unknown;
	};

	let {
		round,
		leaderboard = [],
		pastRounds = [],
		currentUserId = null,
		captionMaxLength = 120,
		eligibleCaptionCount = 0,
		form
	}: Props = $props();

	/**
	 * SvelteKit named actions use `?/actionName` in the query, which *replaces* the entire search string
	 * if written as a bare `?/submitPhoto`. We must re-append the current `?game=` and any other params
	 * (e.g. on `/trips/.../games?game=caption-this`) or the post lands on `/games` and the user loses
	 * the inline game view. See: https://github.com/sveltejs/kit/issues/7137
	 */
	const formAction = $derived.by(() => {
		const rest = $page.url.searchParams.toString();
		return (name: 'submitPhoto' | 'submitCaption' | 'submitVote' | 'removePhoto' | 'startNextRound' | 'endRoundNow') =>
			rest ? `?/${name}&${rest}` : `?/${name}`;
	});

	// ── Derived state ─────────────────────────────────────────────────────────
	const phase = $derived(round?.phase ?? null);
	const roundId = $derived(round?.id ?? '');
	const photoUrl = $derived(round?.photoUrl ?? null);
	const photoSubmitterUserId = $derived(round?.photoSubmitterUserId ?? null);
	const isPhotoSubmitter = $derived(currentUserId != null && photoSubmitterUserId === currentUserId);

	const captions = $derived(round?.captions ?? []);
	const myCaption = $derived(captions.find((c) => c.userId === currentUserId) ?? null);
	const myCaptionId = $derived(myCaption?.id ?? null);
	const submittedCaption = $derived(myCaption != null);
	const myVoteCaptionId = $derived(
		round?.votes?.find((v) => v.voterUserId === currentUserId)?.captionId ?? null
	);
	const canVote = $derived(
		(phase === 'VOTING' || (phase === 'CAPTION_SUBMISSION' && isPhotoSubmitter)) &&
		myVoteCaptionId == null
	);

	const voteCount = $derived(round?.votes?.length ?? 0);
	const canRemovePhoto = $derived(
		isPhotoSubmitter &&
			(phase === 'CAPTION_SUBMISSION' || phase === 'VOTING') &&
			voteCount === 0 &&
			(photoUrl ?? null) != null
	);

	const sortedCaptions = $derived(
		[...captions].sort((a, b) => (b.voteCount ?? 0) - (a.voteCount ?? 0))
	);
	const maxVotes = $derived(
		sortedCaptions.length ? Math.max(...sortedCaptions.map((c) => c.voteCount ?? 0)) : 0
	);
	const winners = $derived(
		sortedCaptions.filter((c) => (c.voteCount ?? 0) === maxVotes && maxVotes > 0)
	);

	// ── UI state ──────────────────────────────────────────────────────────────
	let captionText   = $state('');
	let captionSubmitting = $state(false);
	/** "End round early" (caption / voting) — separate from starting the next round so state does not cross flows */
	let endRoundEarlyConfirm = $state(false);
	let startingNext  = $state(false);
	let selectedPastId = $state<string | null>(null);
	let uploadPendingUrl = $state<string | null>(null);
	let uploading = $state(false);

	// photo upload inputs
	let photoFileInputRef = $state<HTMLInputElement | null>(null);
	let photoCameraInputRef = $state<HTMLInputElement | null>(null);
	let photoFormRef = $state<HTMLFormElement | null>(null);

	const selectedPast = $derived(
		selectedPastId ? pastRounds.find((r) => r.id === selectedPastId) ?? null : null
	);
	const selectedPastWinner = $derived.by(() => {
		if (!selectedPast?.captions?.length) return null;
		const max = Math.max(...selectedPast.captions.map((c) => c.voteCount));
		return max > 0 ? selectedPast.captions.find((c) => c.voteCount === max) ?? null : null;
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

	// ── Polling ───────────────────────────────────────────────────────────────
	$effect(() => {
		if (phase !== 'RESULTS') return;
		const t = setInterval(() => invalidateAll(), 5000);
		return () => clearInterval(t);
	});
	$effect(() => {
		if (phase !== 'CAPTION_SUBMISSION' && phase !== 'VOTING') return;
		const t = setInterval(() => invalidateAll(), 4000);
		return () => clearInterval(t);
	});

	$effect(() => {
		if (phase !== 'CAPTION_SUBMISSION' && phase !== 'VOTING') {
			endRoundEarlyConfirm = false;
		}
	});

	// ── Photo upload helpers ──────────────────────────────────────────────────
	function handlePhotoFile(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		input.value = '';
		if (!file || !file.type.startsWith('image/')) return;
		const reader = new FileReader();
		reader.onload = () => {
			uploadPendingUrl = reader.result as string;
			uploading = true;
			setTimeout(() => photoFormRef?.requestSubmit(), 0);
		};
		reader.readAsDataURL(file);
	}

	// Phase helpers
	const isWaitingForPhoto  = $derived(phase === 'WAITING_FOR_PHOTO');
	const isCaptionPhase     = $derived(phase === 'CAPTION_SUBMISSION');
	const isVotingPhase      = $derived(phase === 'VOTING');
	const isResultsPhase     = $derived(phase === 'RESULTS');
</script>

<div class="ct-wrap">
	<!-- Hidden photo upload form -->
	<form
		method="POST"
		action={formAction('submitPhoto')}
		bind:this={photoFormRef}
		onsubmit={() => { uploading = false; uploadPendingUrl = null; }}
		class="ct-hidden-form"
	>
		<input type="hidden" name="roundId" value={roundId} />
		<input type="hidden" name="photoUrl" value={uploadPendingUrl ?? ''} />
	</form>
	<input
		type="file"
		accept="image/*"
		capture="environment"
		class="ct-hidden-input"
		aria-hidden="true"
		tabindex="-1"
		bind:this={photoCameraInputRef}
		onchange={handlePhotoFile}
	/>
	<!-- gallery input also bound inside upload label in waiting state; ref set there -->

	{#if actionError}
		<div class="ct-error-toast" role="alert">{actionError}</div>
	{/if}

	<!-- ── Past round viewer ── -->
	{#if selectedPast}
		<div class="ct-past-view">
			<button type="button" class="ct-back-btn" onclick={() => selectedPastId = null}>
				← Back to current round
			</button>
			<div class="ct-past-layout">
				{#if selectedPast.photoUrl}
					<div class="ct-past-photo-wrap">
						<img class="ct-past-photo" src={selectedPast.photoUrl} alt="Past round" />
						{#if selectedPastWinner}
							<div class="ct-past-winner-overlay">
								<span class="ct-winner-crown">👑</span>
								<p class="ct-past-winner-text">"{selectedPastWinner.text}"</p>
							</div>
						{/if}
					</div>
				{/if}
				<div class="ct-past-captions">
					<h3 class="ct-past-captions-title">Captions</h3>
					<ul class="ct-past-cap-list">
						{#each selectedPast.captions.sort((a, b) => b.voteCount - a.voteCount) as c}
							<li class="ct-past-cap-row" class:ct-past-cap-row--winner={c.voteCount > 0 && c.voteCount === selectedPast.captions.reduce((m, x) => Math.max(m, x.voteCount), 0)}>
								<button
									type="button"
									class="ct-past-avatar"
									title={c.userName ?? ''}
									onclick={() => openProfileCard(c.userId)}
								>
									{#if c.userAvatarUrl}
										<img src={c.userAvatarUrl} alt="" />
									{:else}
										<span>{(c.userName ?? '?').charAt(0).toUpperCase()}</span>
									{/if}
								</button>
								<span class="ct-past-cap-text">"{c.text}"</span>
								{#if c.voteCount > 0}
									<span class="ct-past-votes">{c.voteCount}v</span>
								{/if}
							</li>
						{/each}
					</ul>
				</div>
			</div>
		</div>

	{:else}
		<!-- ── Hero (phase vibes) ── -->
		{@const phaseKey = isWaitingForPhoto
			? 'waiting'
			: isCaptionPhase
				? 'captions'
				: isVotingPhase
					? 'voting'
					: isResultsPhase
						? 'results'
						: 'idle'}
		<header class="ct-hero" data-phase={phaseKey}>
			<div class="ct-hero__burst" aria-hidden="true"></div>
			<div class="ct-hero__inner">
				<p class="ct-hero__eyebrow">Caption This</p>
				<h2 class="ct-hero__title">
					{#if phaseKey === 'waiting'}
						Set the scene
					{:else if phaseKey === 'captions'}
						Roast the photo in one line
					{:else if phaseKey === 'voting'}
						Pick the line that slayed
					{:else if phaseKey === 'results'}
						We have a winner
					{:else}
						Let’s play
					{/if}
				</h2>
				<p class="ct-hero__sub">
					{#if phaseKey === 'waiting' && currentUserId}
						Upload a picture to get going—anyone in the trip can. Everyone will caption it anonymously, then the group votes.
					{:else if phaseKey === 'waiting'}
						Sign in to play. The group is waiting for someone to start by posting a picture.
					{:else if phaseKey === 'captions' && !isPhotoSubmitter}
						No names, no stress—just the funniest line you can write.
					{:else if phaseKey === 'captions'}
						You’re on camera duty this round. Everyone else is writing.
					{:else if phaseKey === 'voting'}
						One vote. Make it count. (You can’t vote for your own line.)
					{:else if phaseKey === 'results'}
						Bragging rights, sealed. Ready for another round?
					{:else}
						Group captions, secret ballots, one champion.
					{/if}
				</p>
			</div>
		</header>

		<!-- ── Current round ── -->

		<!-- SUB-STATE A: Waiting for photo -->
		{#if isWaitingForPhoto}
			{#if currentUserId}
				<div class="ct-section">
					<p class="ct-section-label"><span class="ct-section-pill">Round opener</span></p>
					<div class="ct-upload-outer">
						<!-- Entire zone is a label; tap anywhere to open image picker (same as "From library") -->
						<label
							class="ct-upload-zone"
							class:ct-upload-zone--loading={uploading}
							aria-busy={uploading}
						>
							<input
								type="file"
								accept="image/*"
								class="ct-upload-file-overlay"
								bind:this={photoFileInputRef}
								onchange={handlePhotoFile}
								disabled={uploading}
								aria-label="Add a picture to start the round. Tap or click anywhere in this area."
							/>
							<div class="ct-upload-overlay-stack">
								<div class="ct-upload-sparkles" aria-hidden="true">
									<span>✨</span><span>💬</span><span>🎬</span>
								</div>
								<span class="ct-upload-icon" aria-hidden="true">📷</span>
								<p class="ct-upload-heading">Drop the photo that starts the chaos</p>
								<p class="ct-upload-lede">
									Tap or click this whole box to add a picture—then the group will caption it blind. Anyone in the trip can be
									first.
								</p>
							</div>
						</label>
						<div class="ct-upload-btns" role="group" aria-label="Or pick a source">
							<button
								type="button"
								class="ct-upload-btn ct-upload-btn--primary"
								disabled={uploading}
								onclick={() => photoCameraInputRef?.click()}
							>
								{uploading ? 'Uploading…' : 'Take a photo'}
							</button>
							<button
								type="button"
								class="ct-upload-btn ct-upload-btn--ghost"
								disabled={uploading}
								onclick={() => photoFileInputRef?.click()}
							>
								From library
							</button>
						</div>
					</div>
				</div>
			{:else}
				<div class="ct-holding-card">
					<div class="ct-holding-illus" aria-hidden="true">🎞️</div>
					<p class="ct-holding-kicker">Sign in to play</p>
					<p class="ct-holding-text">Caption This is for trip guests. Sign in, then you or someone else can post a picture to start a round.</p>
				</div>
			{/if}

		<!-- SUB-STATE B: Caption submission -->
		{:else if isCaptionPhase}
			{#if photoUrl}
				<div class="ct-photo-theatre">
					<div class="ct-photo-polaroid">
						<div class="ct-photo-block">
							<img class="ct-round-photo" src={photoUrl} alt="Round photo" />
						</div>
						<span class="ct-photo-tape ct-photo-tape--left" aria-hidden="true"></span>
						<span class="ct-photo-tape ct-photo-tape--right" aria-hidden="true"></span>
					</div>
				</div>
				{#if canRemovePhoto}
					<div class="ct-remove-photo-wrap">
						<form
							method="POST"
							action={formAction('removePhoto')}
							class="ct-inline-form"
							use:enhance={() => async ({ result, update }) => {
								await update();
								if (result.type === 'success' || result.type === 'redirect') await invalidateAll();
							}}
						>
							<input type="hidden" name="roundId" value={roundId} />
							<button type="submit" class="ct-btn-ghost ct-remove-photo-btn" title="Clears the photo and all captions. Not available after anyone votes.">
								Remove photo
							</button>
						</form>
						<p class="ct-remove-hint">You can take this back until the first vote. This resets the round.</p>
					</div>
				{/if}
			{/if}

			{#if isPhotoSubmitter}
				<div class="ct-poster-waiting">
					<div class="ct-poster-waiting-ico" aria-hidden="true">🍿</div>
					<div class="ct-poster-waiting-body">
						<p class="ct-poster-waiting-text">You’re the photog this round. Grab popcorn while the crew writes.</p>
						<span class="ct-captions-count">{captions.length} caption{captions.length !== 1 ? 's' : ''} in so far</span>
					</div>
				</div>
			{:else if submittedCaption}
				<div class="ct-submitted-confirm">
					<div class="ct-submitted-burst" aria-hidden="true">✨</div>
					<span class="ct-submitted-icon" aria-hidden="true">✓</span>
					<p class="ct-submitted-hed">You’re in the mix</p>
					<p class="ct-submitted-sub">When everyone’s done, the vote opens. No peeking.</p>
					{#if myCaption}
						<blockquote class="ct-submitted-preview">“{myCaption.text}”</blockquote>
					{/if}
				</div>
			{:else}
				<form
					method="POST"
					action={formAction('submitCaption')}
					class="ct-caption-form"
					use:enhance={() => async ({ result, update }) => {
						captionSubmitting = true;
						await update();
						captionSubmitting = false;
						if (result.type === 'success' || result.type === 'redirect') {
							captionText = '';
							await invalidateAll();
						}
					}}
				>
					<input type="hidden" name="roundId" value={roundId} />
					<p class="ct-caption-form-label"><span class="ct-section-pill">Your line</span></p>
					<div class="ct-bubble-wrap">
						<div class="ct-textarea-wrap">
							<textarea
								name="text"
								class="ct-caption-input"
								placeholder="The punchline, the roast, the chaos…"
								maxlength={captionMaxLength}
								rows="3"
								bind:value={captionText}
								disabled={captionSubmitting}
							></textarea>
							<span class="ct-char-count" class:ct-char-count--warn={captionText.length > captionMaxLength * 0.85}>
								{captionText.length} / {captionMaxLength}
							</span>
						</div>
					</div>
					<button
						type="submit"
						class="ct-submit-btn"
						disabled={!captionText.trim() || captionSubmitting}
					>
						{captionSubmitting ? 'Sending…' : 'Lock it in — submit caption'}
					</button>
				</form>
			{/if}

		<!-- SUB-STATE C: Voting -->
		{:else if isVotingPhase}
			{#if photoUrl}
				<div class="ct-photo-theatre">
					<div class="ct-photo-polaroid">
						<div class="ct-photo-block">
							<img class="ct-round-photo" src={photoUrl} alt="Round photo" />
						</div>
						<span class="ct-photo-tape ct-photo-tape--left" aria-hidden="true"></span>
						<span class="ct-photo-tape ct-photo-tape--right" aria-hidden="true"></span>
					</div>
				</div>
				{#if canRemovePhoto}
					<div class="ct-remove-photo-wrap">
						<form
							method="POST"
							action={formAction('removePhoto')}
							class="ct-inline-form"
							use:enhance={() => async ({ result, update }) => {
								await update();
								if (result.type === 'success' || result.type === 'redirect') await invalidateAll();
							}}
						>
							<input type="hidden" name="roundId" value={roundId} />
							<button type="submit" class="ct-btn-ghost ct-remove-photo-btn" title="Clears the photo and all captions. Not available after anyone votes.">
								Remove photo
							</button>
						</form>
						<p class="ct-remove-hint">You can take this back until the first vote. This resets the round.</p>
					</div>
				{/if}
			{/if}

			<div class="ct-voting-section">
				<p class="ct-vote-hed">
					{#if myVoteCaptionId}
						<span class="ct-section-pill ct-section-pill--done">Ballot in</span>
					{:else}
						<span class="ct-section-pill">The ballot</span>
					{/if}
				</p>
				<p class="ct-vote-deck">
					{#if myVoteCaptionId}
						Your vote is locked. Watch the room decide.
					{:else}
						Tap the line that made you actually laugh.
					{/if}
				</p>
				<div class="ct-caption-cards">
					{#each sortedCaptions as c, i}
						{@const isMyCaption = c.id === myCaptionId}
						{@const isVoted = myVoteCaptionId === c.id}
						{@const canVoteThis = canVote && !isMyCaption}

						{#if canVoteThis}
							<form
								method="POST"
								action={formAction('submitVote')}
								class="ct-vote-form"
								use:enhance={() => async ({ result, update }) => {
									await update();
									if (result.type === 'success' || result.type === 'redirect') await invalidateAll();
								}}
							>
								<input type="hidden" name="roundId" value={roundId} />
								<input type="hidden" name="captionId" value={c.id} />
								<button type="submit" class="ct-caption-card ct-caption-card--voteable" style="--i:{i};">
									<span class="ct-card-num" aria-hidden="true">#{i + 1}</span>
									<span class="ct-caption-card-text">“{c.text}”</span>
									<span class="ct-vote-btn-label">This one →</span>
								</button>
							</form>
						{:else}
							<div
								class="ct-caption-card"
								class:ct-caption-card--voted={isVoted}
								class:ct-caption-card--mine={isMyCaption && !isVoted}
								style="--i:{i};"
							>
								<span class="ct-card-num" aria-hidden="true">#{i + 1}</span>
								<span class="ct-caption-card-text">“{c.text}”</span>
								{#if isVoted}
									<span class="ct-voted-label">Your pick ✓</span>
								{:else if isMyCaption}
									<span class="ct-mine-label">Yours (no self-votes)</span>
								{/if}
							</div>
						{/if}
					{/each}

					{#if captions.length === 0}
						<p class="ct-no-captions">No captions yet. Reality is stranger than fiction.</p>
					{/if}
				</div>
			</div>

		<!-- RESULTS -->
		{:else if isResultsPhase}
			{#if photoUrl}
				<div class="ct-photo-theatre">
					<div class="ct-photo-polaroid">
						<div class="ct-photo-block">
							<img class="ct-round-photo" src={photoUrl} alt="Round photo" />
						</div>
						<span class="ct-photo-tape ct-photo-tape--left" aria-hidden="true"></span>
						<span class="ct-photo-tape ct-photo-tape--right" aria-hidden="true"></span>
					</div>
				</div>
			{/if}

			<div class="ct-results">
				{#if winners.length > 0}
					{#each winners as w}
						<div class="ct-winner-card">
							<div class="ct-winner-shine" aria-hidden="true"></div>
							<span class="ct-winner-badge">Funniest line</span>
							<p class="ct-winner-text">“{w.text}”</p>
							<span class="ct-winner-votes">{w.voteCount} vote{(w.voteCount ?? 0) !== 1 ? 's' : ''}</span>
						</div>
					{/each}
				{:else}
					<div class="ct-no-winners">No captions this round. Crickets.</div>
				{/if}

				<div class="ct-vote-dist">
					<p class="ct-vote-dist-label"><span class="ct-section-pill">Scoreboard</span></p>
					{#each sortedCaptions as c}
						<div class="ct-dist-row" class:ct-dist-row--winner={winners.some((w) => w.id === c.id)}>
							<span class="ct-dist-text">"{c.text}"</span>
							<span class="ct-dist-votes">{c.voteCount ?? 0}v</span>
						</div>
					{/each}
				</div>

				{#if isPhotoSubmitter}
					<div class="ct-next-row">
						<form
							method="POST"
							action={formAction('startNextRound')}
							class="ct-start-next-form"
							use:enhance={() => {
								return async ({ update }) => {
									startingNext = true;
									try {
										await update();
									} finally {
										startingNext = false;
									}
								};
							}}
						>
							<button type="submit" class="ct-btn-primary ct-btn-start-next" disabled={startingNext}>
								{startingNext ? 'Starting…' : 'Start next round'}
							</button>
						</form>
					</div>
				{:else}
					<p class="ct-waiting-next">The photo poster will start the next round.</p>
				{/if}
			</div>

			<!-- End round early (non-results phases, photo submitter) -->
		{/if}

		{#if (isCaptionPhase || isVotingPhase) && isPhotoSubmitter}
			<div class="ct-end-early">
				{#if endRoundEarlyConfirm}
					<span class="ct-end-confirm">
						End round now?
						<form method="POST" action={formAction('endRoundNow')} class="ct-inline-form" use:enhance>
							<input type="hidden" name="roundId" value={roundId} />
							<button type="submit" class="ct-btn-danger">Yes, end it</button>
						</form>
						<button type="button" class="ct-btn-ghost" onclick={() => (endRoundEarlyConfirm = false)}>Cancel</button>
					</span>
				{:else}
					<button type="button" class="ct-btn-ghost ct-end-btn" onclick={() => (endRoundEarlyConfirm = true)}>
						End round early
					</button>
				{/if}
			</div>
		{/if}
	{/if}

	<!-- ── Leaderboard ── -->
	{#if leaderboard.length > 0}
		<div class="ct-leaderboard">
			<h3 class="ct-lb-title">Leaderboard</h3>
			<div class="ct-lb-rows">
				{#each leaderboard as row}
					<div class="ct-lb-row" class:ct-lb-row--me={row.userId === currentUserId}>
						<span class="ct-lb-rank">#{row.rank}</span>
						<span class="ct-lb-avatar" aria-hidden="true">{(row.name ?? '?').charAt(0).toUpperCase()}</span>
						<span class="ct-lb-name">{row.name ?? 'Guest'}</span>
						<span class="ct-lb-pts">{row.pointsTotal} win{row.pointsTotal !== 1 ? 's' : ''}</span>
					</div>
				{/each}
			</div>
		</div>
	{/if}

	<!-- ── Past rounds accordion ── -->
	{#if pastRounds.length > 0}
		<details class="ct-past-rounds">
			<summary class="ct-past-summary">
				<span>Past rounds ({pastRounds.length})</span>
				<span class="ct-past-icon" aria-hidden="true">+</span>
			</summary>
			<div class="ct-past-list">
				{#each pastRounds as pr}
					{@const prWinner = pr.captions.length ? pr.captions.reduce((best, c) => c.voteCount > best.voteCount ? c : best, pr.captions[0]) : null}
					<button
						type="button"
						class="ct-past-row"
						onclick={() => selectedPastId = selectedPastId === pr.id ? null : pr.id}
					>
						{#if pr.photoUrl}
							<img class="ct-past-thumb" src={pr.photoUrl} alt="" />
						{:else}
							<div class="ct-past-thumb ct-past-thumb--empty" aria-hidden="true">📷</div>
						{/if}
						<div class="ct-past-row-info">
							<span class="ct-past-row-key">{pr.dayKey}</span>
							{#if prWinner && prWinner.voteCount > 0}
								<span class="ct-past-row-winner">🏆 "{prWinner.text}"</span>
							{:else}
								<span class="ct-past-row-empty">No winner</span>
							{/if}
						</div>
						<span class="ct-past-row-chevron" aria-hidden="true">→</span>
					</button>
				{/each}
			</div>
		</details>
	{/if}
</div>

<style>
	.ct-wrap {
		--ct-coral: #ce5612;
		--ct-coral-dim: rgba(206, 86, 18, 0.12);
		--ct-teal: #2f7778;
		--ct-ink: #1d4d4e;
		max-width: 720px;
		width: 100%;
		margin-left: auto;
		margin-right: auto;
		display: flex;
		flex-direction: column;
		gap: 1.35rem;
		font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
		position: relative;
		padding: 0.5rem 0 0;
	}

	/* ── Hero band ── */
	.ct-hero {
		position: relative;
		border-radius: 18px;
		padding: 1.15rem 1.25rem 1.3rem;
		background: linear-gradient(135deg, #fff6ef 0%, #fff 42%, #f0faf9 100%);
		border: 1px solid rgba(206, 86, 18, 0.2);
		box-shadow: 0 8px 32px -12px rgba(29, 77, 78, 0.18);
		overflow: hidden;
	}
	.ct-hero__burst {
		position: absolute;
		inset: -40%;
		background: radial-gradient(circle at 30% 20%, rgba(255, 180, 100, 0.35) 0%, transparent 45%),
			radial-gradient(circle at 80% 60%, rgba(122, 206, 211, 0.22) 0%, transparent 40%);
		pointer-events: none;
	}
	.ct-hero__inner {
		position: relative;
		z-index: 1;
		text-align: center;
	}
	.ct-hero__eyebrow {
		font-size: 0.68rem;
		font-weight: 800;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--ct-coral);
		margin: 0 0 0.35rem;
	}
	.ct-hero__title {
		font-family: 'Fraunces', Georgia, serif;
		font-size: clamp(1.35rem, 4.5vw, 1.7rem);
		font-weight: 700;
		color: var(--ct-ink);
		letter-spacing: -0.03em;
		line-height: 1.15;
		margin: 0 0 0.45rem;
	}
	.ct-hero__sub {
		margin: 0 auto;
		font-size: 0.9rem;
		line-height: 1.5;
		color: #475569;
		max-width: 38rem;
	}
	[data-phase='voting'] .ct-hero {
		border-color: rgba(47, 119, 120, 0.25);
		background: linear-gradient(135deg, #f0fdfa 0%, #fff 50%, #fff7ed 100%);
	}
	[data-phase='results'] .ct-hero {
		background: linear-gradient(135deg, #fffbeb 0%, #fff 55%, #fef3c7 100%);
		border-color: rgba(192, 136, 32, 0.35);
	}

	/* ── Section pills (replace flat labels) ── */
	.ct-section-pill {
		display: inline-block;
		padding: 0.22rem 0.65rem;
		border-radius: 999px;
		font-size: 0.65rem;
		font-weight: 800;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: #b45309;
		background: linear-gradient(180deg, #fff7ed, #ffedd5);
		border: 1px solid rgba(206, 86, 18, 0.28);
	}
	.ct-section-pill--done {
		color: #15803d;
		background: linear-gradient(180deg, #ecfdf5, #d1fae5);
		border-color: rgba(21, 128, 61, 0.3);
	}
	.ct-caption-form-label {
		margin: 0 0 0.4rem;
	}

	/* ── Photo theatre (polaroid) ── */
	.ct-photo-theatre {
		display: flex;
		justify-content: center;
		perspective: 800px;
	}
	.ct-photo-polaroid {
		position: relative;
		padding: 0.65rem 0.75rem 1.4rem;
		background: linear-gradient(180deg, #fefefe 0%, #f1f0eb 100%);
		border-radius: 3px;
		box-shadow:
			0 1px 0 rgba(0, 0, 0, 0.06),
			0 10px 28px -8px rgba(0, 0, 0, 0.2);
		transform: rotate(-1.2deg);
		max-width: 100%;
	}
	.ct-photo-tape {
		position: absolute;
		width: 3.25rem;
		height: 0.9rem;
		background: linear-gradient(90deg, rgba(255, 255, 200, 0.85), rgba(255, 248, 200, 0.65));
		opacity: 0.9;
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
		top: -0.2rem;
	}
	.ct-photo-tape--left {
		left: 12%;
		transform: rotate(-8deg);
	}
	.ct-photo-tape--right {
		right: 10%;
		transform: rotate(6deg);
	}
	.ct-photo-theatre .ct-photo-block {
		border-radius: 2px;
		box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.04);
	}

	/* ── Hidden form infrastructure ── */
	.ct-hidden-form {
		position: absolute;
		width: 0;
		height: 0;
		opacity: 0;
		pointer-events: none;
		overflow: hidden;
	}
	.ct-hidden-input {
		position: absolute;
		width: 1px;
		height: 1px;
		opacity: 0;
		pointer-events: none;
	}

	/* ── Error toast ── */
	.ct-error-toast {
		padding: 0.75rem 1rem;
		background: rgba(239, 68, 68, 0.08);
		border: 1px solid rgba(239, 68, 68, 0.25);
		border-radius: 10px;
		font-size: 0.875rem;
		color: #dc2626;
	}

	/* ── Section label (legacy + pill container) ── */
	.ct-section-label {
		margin: 0 0 0.75rem;
		text-align: center;
	}

	/* ── Photo block (inside polaroid) ── */
	.ct-photo-block {
		border-radius: 2px;
		overflow: hidden;
		line-height: 0;
	}
	.ct-round-photo {
		width: 100%;
		max-height: 52vh;
		height: clamp(220px, 40vw, 360px);
		object-fit: cover;
		display: block;
	}

	/* ── Upload zone (Sub-state A, poster) ── */
	.ct-section {
		display: flex;
		flex-direction: column;
		align-items: center;
		width: 100%;
	}

	.ct-upload-outer {
		width: 100%;
		max-width: 26rem;
		margin-left: auto;
		margin-right: auto;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.75rem;
	}

	.ct-upload-zone {
		--ct-upload-pad: 2.5rem 1.5rem 2.25rem;
		display: block;
		position: relative;
		border: 2px dashed rgba(206, 86, 18, 0.45);
		border-radius: 18px;
		padding: var(--ct-upload-pad);
		width: 100%;
		box-sizing: border-box;
		background: linear-gradient(165deg, #fff7ed 0%, #fff 38%, #f0fdfa 100%);
		box-shadow: 0 10px 36px -20px rgba(206, 86, 18, 0.35);
		overflow: hidden;
		cursor: pointer;
		transition: border-color 0.2s, transform 0.2s, box-shadow 0.2s, opacity 0.2s;
	}
	.ct-upload-file-overlay {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		margin: 0;
		padding: 0;
		opacity: 0.001;
		font-size: 0;
		cursor: pointer;
		z-index: 2;
	}
	.ct-upload-overlay-stack {
		position: relative;
		z-index: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.5rem;
		text-align: center;
		pointer-events: none;
	}
	.ct-upload-zone--loading,
	.ct-upload-zone--loading .ct-upload-file-overlay {
		cursor: wait;
	}
	.ct-upload-zone--loading {
		pointer-events: none;
		opacity: 0.72;
	}
	.ct-upload-zone:has(.ct-upload-file-overlay:disabled) {
		cursor: not-allowed;
	}
	.ct-upload-zone::before {
		content: '';
		position: absolute;
		inset: 0;
		background: radial-gradient(circle at 15% 30%, rgba(255, 200, 120, 0.2) 0%, transparent 45%);
		pointer-events: none;
		z-index: 0;
	}
	@media (hover: hover) and (pointer: fine) {
		.ct-upload-zone:has(.ct-upload-file-overlay:not(:disabled):hover) {
			border-color: var(--ct-coral);
			transform: translateY(-2px);
			box-shadow: 0 16px 44px -18px rgba(47, 119, 120, 0.35);
		}
	}
	.ct-upload-zone:has(.ct-upload-file-overlay:focus-visible) {
		outline: 2px solid #2f7778;
		outline-offset: 2px;
	}
	.ct-upload-sparkles {
		display: flex;
		gap: 0.75rem;
		font-size: 1.15rem;
		opacity: 0.85;
		margin-bottom: 0.15rem;
	}
	.ct-upload-icon {
		font-size: 2.75rem;
		filter: drop-shadow(0 2px 6px rgba(0, 0, 0, 0.12));
	}
	.ct-upload-heading {
		font-family: 'Fraunces', Georgia, serif;
		font-size: 1.2rem;
		font-weight: 700;
		color: #1d4d4e;
		margin: 0;
		position: relative;
	}
	.ct-upload-lede {
		margin: 0 0 0.35rem;
		font-size: 0.875rem;
		line-height: 1.45;
		color: #64748b;
		max-width: 22rem;
	}

	.ct-upload-btns {
		display: flex;
		flex-wrap: wrap;
		gap: 0.625rem;
		justify-content: center;
		margin-top: 0.25rem;
	}

	.ct-upload-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.375rem;
		min-height: 44px;
		padding: 0 1.25rem;
		border-radius: 10px;
		font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
		font-size: 0.9375rem;
		font-weight: 600;
		cursor: pointer;
		border: 1.5px solid transparent;
		transition: background 0.12s, border-color 0.12s;
	}

	.ct-upload-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.ct-upload-btn--primary {
		background: #CE5612;
		color: white;
	}
	.ct-upload-btn--primary:not(:disabled):hover {
		background: #b34b10;
	}

	.ct-upload-btn--ghost {
		background: white;
		border-color: #e2e8f0;
		color: #475569;
	}
	.ct-upload-btn--ghost:not(:disabled):hover {
		border-color: #CE5612;
		color: #CE5612;
	}

	/* ── Holding card (Sub-state A, non-poster) ── */
	.ct-holding-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.4rem;
		padding: 2.25rem 1.5rem 2.5rem;
		background: linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%);
		border-radius: 16px;
		border: 1.5px dashed rgba(47, 119, 120, 0.3);
		text-align: center;
		position: relative;
		overflow: hidden;
	}
	.ct-holding-card::after {
		content: '';
		position: absolute;
		width: 120px;
		height: 120px;
		background: repeating-linear-gradient(
			-12deg,
			transparent,
			transparent 6px,
			rgba(47, 119, 120, 0.04) 6px,
			rgba(47, 119, 120, 0.04) 7px
		);
		right: -20px;
		top: -20px;
		border-radius: 50%;
		pointer-events: none;
	}
	.ct-holding-illus {
		font-size: 2.5rem;
		line-height: 1;
		filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1));
	}
	.ct-holding-kicker {
		margin: 0.25rem 0 0;
		font-size: 0.72rem;
		font-weight: 800;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: #2f7778;
	}
	.ct-holding-text {
		font-size: 0.95rem;
		color: #475569;
		margin: 0;
		max-width: 22rem;
		line-height: 1.45;
		position: relative;
		z-index: 1;
	}

	/* ── Poster waiting (Sub-state B, is poster) ── */
	.ct-poster-waiting {
		background: linear-gradient(90deg, rgba(47, 119, 120, 0.1) 0%, rgba(47, 119, 120, 0.04) 100%);
		border: 1px solid rgba(47, 119, 120, 0.2);
		border-radius: 14px;
		padding: 1rem 1.15rem;
		display: flex;
		align-items: center;
		gap: 0.9rem;
		flex-wrap: wrap;
	}
	.ct-poster-waiting-ico {
		font-size: 1.75rem;
		line-height: 1;
		flex-shrink: 0;
	}
	.ct-poster-waiting-body {
		flex: 1;
		min-width: 0;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		flex-wrap: wrap;
	}
	.ct-poster-waiting-text {
		font-size: 0.9rem;
		color: #1d4d4e;
		margin: 0;
		line-height: 1.4;
	}

	.ct-captions-count {
		font-size: 0.8125rem;
		font-weight: 700;
		color: #2f7778;
		white-space: nowrap;
	}

	/* ── Submitted confirm (Sub-state B, after submit) ── */
	.ct-submitted-confirm {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.35rem;
		padding: 1.4rem 1.25rem 1.5rem;
		background: linear-gradient(145deg, #ecfdf5 0%, #d1fae5 50%, #fff 100%);
		border: 1.5px solid rgba(16, 185, 129, 0.35);
		border-radius: 16px;
		text-align: center;
		color: #1d4d4e;
		box-shadow: 0 6px 24px -12px rgba(16, 185, 129, 0.35);
	}
	.ct-submitted-burst {
		position: absolute;
		top: 0.5rem;
		right: 0.75rem;
		font-size: 1.25rem;
		opacity: 0.85;
	}
	.ct-submitted-confirm .ct-submitted-icon {
		font-size: 1.35rem;
		color: #059669;
		background: #fff;
		width: 2.25rem;
		height: 2.25rem;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
	}
	.ct-submitted-hed {
		margin: 0.25rem 0 0;
		font-family: 'Fraunces', Georgia, serif;
		font-size: 1.15rem;
		font-weight: 700;
	}
	.ct-submitted-sub {
		margin: 0 0 0.25rem;
		font-size: 0.85rem;
		color: #64748b;
		line-height: 1.4;
	}
	.ct-submitted-preview {
		margin: 0.35rem 0 0;
		color: #0f766e;
		font-style: italic;
		font-size: 0.95rem;
		font-weight: 500;
		padding: 0.5rem 0.75rem;
		background: rgba(255, 255, 255, 0.6);
		border-radius: 10px;
		border: 1px solid rgba(16, 185, 129, 0.2);
	}

	/* ── Caption form (Sub-state B, not submitted) ── */
	.ct-caption-form {
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
	}
	.ct-bubble-wrap {
		position: relative;
	}
	.ct-bubble-wrap::before {
		content: '“';
		position: absolute;
		left: 0.5rem;
		top: 0.35rem;
		font-family: 'Fraunces', Georgia, serif;
		font-size: 2.5rem;
		font-weight: 700;
		color: rgba(206, 86, 18, 0.2);
		line-height: 1;
		pointer-events: none;
	}
	.ct-textarea-wrap {
		position: relative;
	}

	.ct-caption-input {
		width: 100%;
		border: 2px solid #e2e8f0;
		border-radius: 16px;
		border-top-left-radius: 6px;
		padding: 0.9rem 1rem 1.9rem 1.75rem;
		font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
		font-size: 1rem;
		line-height: 1.45;
		color: #1d4d4e;
		resize: none;
		transition: border-color 0.12s, box-shadow 0.12s;
		box-sizing: border-box;
		background: linear-gradient(180deg, #fffefb 0%, #fff 100%);
	}

	.ct-caption-input:focus {
		outline: none;
		border-color: var(--ct-coral);
		box-shadow: 0 0 0 3px var(--ct-coral-dim);
	}

	.ct-char-count {
		position: absolute;
		bottom: 0.5rem;
		right: 0.75rem;
		font-size: 0.6875rem;
		color: #94a3b8;
		pointer-events: none;
		font-variant-numeric: tabular-nums;
	}

	.ct-char-count--warn {
		color: #CE5612;
	}

	.ct-submit-btn {
		align-self: flex-end;
		display: inline-flex;
		align-items: center;
		min-height: 44px;
		padding: 0 1.5rem;
		border-radius: 10px;
		background: #CE5612;
		color: white;
		border: none;
		font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
		font-size: 0.9375rem;
		font-weight: 700;
		cursor: pointer;
		transition: background 0.12s;
	}

	.ct-submit-btn:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}

	.ct-submit-btn:not(:disabled):hover {
		background: #b34b10;
	}

	/* ── Caption cards (Sub-state C: voting) ── */
	.ct-voting-section {
		display: flex;
		flex-direction: column;
	}
	.ct-vote-hed {
		margin: 0 0 0.35rem;
	}
	.ct-vote-deck {
		margin: 0 0 0.9rem;
		font-size: 0.9rem;
		line-height: 1.45;
		color: #64748b;
	}

	.ct-caption-cards {
		display: flex;
		flex-direction: column;
		gap: 0.65rem;
	}

	.ct-vote-form {
		display: contents;
	}
	.ct-card-num {
		flex-shrink: 0;
		font-size: 0.65rem;
		font-weight: 800;
		letter-spacing: 0.06em;
		color: #94a3b8;
		min-width: 1.5rem;
	}
	.ct-caption-card {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.95rem 1rem 0.95rem 0.85rem;
		border-radius: 14px;
		border: 1.5px solid #e2e8f0;
		background: linear-gradient(135deg, #fff 0%, #f8fafc 100%);
		font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
		font-size: 0.95rem;
		color: #1d4d4e;
		text-align: left;
		min-height: 60px;
		transition:
			border-color 0.15s,
			background 0.15s,
			transform 0.15s,
			box-shadow 0.15s;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
		animation: ct-card-in 0.45s ease backwards;
		animation-delay: calc(var(--i, 0) * 0.05s);
	}
	@keyframes ct-card-in {
		from {
			opacity: 0;
			transform: translateX(-8px);
		}
		to {
			opacity: 1;
			transform: translateX(0);
		}
	}

	.ct-caption-card--voteable {
		cursor: pointer;
		width: 100%;
	}
	.ct-caption-card--voteable:hover {
		border-color: var(--ct-coral);
		background: linear-gradient(135deg, #fffdfb 0%, #fff5eb 100%);
		transform: translateX(2px) scale(1.01);
		box-shadow: 0 6px 20px -6px rgba(206, 86, 18, 0.35);
	}

	.ct-caption-card--voted {
		border-color: #CE5612;
		background: rgba(206,86,18,0.07);
	}

	.ct-caption-card--mine {
		border-style: dashed;
		opacity: 0.7;
	}

	.ct-caption-card-text {
		flex: 1;
		min-width: 0;
	}

	.ct-vote-btn-label {
		flex-shrink: 0;
		font-size: 0.7rem;
		font-weight: 800;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: #fff;
		background: linear-gradient(180deg, #ea6a2a, var(--ct-coral));
		border: none;
		border-radius: 8px;
		padding: 0.45rem 0.65rem;
		white-space: nowrap;
		box-shadow: 0 2px 6px rgba(206, 86, 18, 0.4);
	}

	.ct-voted-label {
		flex-shrink: 0;
		font-size: 0.8125rem;
		font-weight: 700;
		color: #CE5612;
	}

	.ct-mine-label {
		flex-shrink: 0;
		font-size: 0.75rem;
		color: #94a3b8;
		font-style: italic;
	}

	.ct-no-captions {
		font-size: 0.875rem;
		color: #94a3b8;
		margin: 0;
		font-style: italic;
	}

	/* ── Results ── */
	.ct-results {
		display: flex;
		flex-direction: column;
		gap: 1.1rem;
	}

	.ct-winner-card {
		position: relative;
		border: 2px solid rgba(192, 136, 32, 0.45);
		border-radius: 16px;
		padding: 1.3rem 1.35rem 1.2rem;
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		background: linear-gradient(160deg, #fffbeb 0%, #fff 45%, #fef3c7 100%);
		overflow: hidden;
		box-shadow: 0 8px 28px -10px rgba(192, 136, 32, 0.45);
	}
	.ct-winner-shine {
		position: absolute;
		inset: -20% -30%;
		background: linear-gradient(115deg, transparent 40%, rgba(255, 255, 255, 0.5) 50%, transparent 60%);
		transform: translateX(-100%);
		animation: ct-shine 1.1s ease-out 0.2s forwards;
		pointer-events: none;
	}
	@keyframes ct-shine {
		to {
			transform: translateX(100%);
		}
	}

	.ct-winner-badge {
		position: relative;
		z-index: 1;
		font-size: 0.7rem;
		font-weight: 800;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: #b45309;
		widows: 1;
	}
	.ct-winner-badge::before {
		content: '👑 ';
	}
	.ct-winner-text {
		position: relative;
		z-index: 1;
		font-family: 'Fraunces', Georgia, serif;
		font-size: 1.25rem;
		font-weight: 700;
		color: #1d4d4e;
		margin: 0;
		line-height: 1.35;
	}

	.ct-winner-votes {
		font-size: 0.75rem;
		color: #64748b;
	}

	.ct-no-winners {
		padding: 1rem;
		text-align: center;
		font-size: 0.9375rem;
		color: #64748b;
		background: #f8fafc;
		border-radius: 12px;
	}

	.ct-vote-dist {
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
	}
	.ct-vote-dist-label {
		margin: 0.25rem 0 0.1rem;
	}

	.ct-dist-row {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.5rem 0.75rem;
		border-radius: 9px;
		font-size: 0.875rem;
		color: #475569;
		background: white;
		border: 1px solid #f1f5f9;
	}

	.ct-dist-row--winner {
		background: rgba(192,136,32,0.05);
		border-color: rgba(192,136,32,0.25);
		color: #1d4d4e;
	}

	.ct-dist-text {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.ct-dist-votes {
		flex-shrink: 0;
		font-size: 0.75rem;
		font-weight: 700;
		color: #94a3b8;
		font-variant-numeric: tabular-nums;
	}

	.ct-next-row {
		padding-top: 0.5rem;
	}

	.ct-end-early {
		padding-top: 0.25rem;
		border-top: 1px solid #f1f5f9;
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.ct-end-confirm {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.875rem;
		color: #64748b;
		flex-wrap: wrap;
	}

	.ct-inline-form {
		display: inline;
	}

	.ct-remove-photo-wrap {
		margin-top: 0.75rem;
		text-align: center;
	}

	.ct-remove-photo-btn {
		font-size: 0.8125rem;
	}

	.ct-remove-hint {
		margin: 0.35rem 0 0 0;
		font-size: 0.75rem;
		color: #94a3b8;
		line-height: 1.35;
	}

	.ct-waiting-next {
		font-size: 0.875rem;
		color: #94a3b8;
		margin: 0;
		font-style: italic;
	}

	/* ── Buttons ── */
	.ct-btn-primary {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-height: 44px;
		padding: 0 1.5rem;
		border-radius: 10px;
		background: #CE5612;
		color: white;
		border: none;
		font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
		font-size: 0.9375rem;
		font-weight: 700;
		cursor: pointer;
		transition: background 0.12s;
	}
	.ct-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
	.ct-btn-primary:not(:disabled):hover { background: #b34b10; }

	.ct-btn-start-next { width: 100%; }

	.ct-btn-ghost {
		display: inline-flex;
		align-items: center;
		min-height: 40px;
		padding: 0 1rem;
		border-radius: 9px;
		background: none;
		border: 1.5px solid #e2e8f0;
		font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
		font-size: 0.875rem;
		color: #64748b;
		cursor: pointer;
		transition: border-color 0.12s, color 0.12s;
	}
	.ct-btn-ghost:hover { border-color: #94a3b8; color: #475569; }

	.ct-end-btn {
		font-size: 0.8125rem;
		min-height: 36px;
	}

	.ct-btn-danger {
		display: inline-flex;
		align-items: center;
		min-height: 36px;
		padding: 0 0.875rem;
		border-radius: 8px;
		background: #dc2626;
		color: white;
		border: none;
		font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
		font-size: 0.8125rem;
		font-weight: 600;
		cursor: pointer;
	}
	.ct-btn-danger:hover { background: #b91c1c; }

	/* ── Leaderboard ── */
	.ct-leaderboard {
		background: linear-gradient(180deg, #fff 0%, #f8fafc 100%);
		border: 1px solid rgba(47, 119, 120, 0.2);
		border-radius: 16px;
		padding: 1.1rem 1.2rem 1.2rem;
		display: flex;
		flex-direction: column;
		gap: 0.55rem;
		box-shadow: 0 4px 20px -8px rgba(29, 77, 78, 0.15);
	}
	.ct-lb-title {
		font-family: 'Fraunces', Georgia, serif;
		font-size: 1.1rem;
		font-weight: 700;
		color: #1d4d4e;
		margin: 0;
		letter-spacing: -0.01em;
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}
	.ct-lb-title::after {
		content: '🥇';
		font-size: 0.9rem;
	}

	.ct-lb-rows {
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
	}

	.ct-lb-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.35rem 0.4rem;
		border-radius: 8px;
		border-left: 3px solid transparent;
	}

	.ct-lb-row--me {
		border-left-color: #CE5612;
		background: rgba(206,86,18,0.04);
	}

	.ct-lb-rank {
		font-size: 0.6875rem;
		font-weight: 700;
		color: #94a3b8;
		width: 1.5rem;
		text-align: right;
		flex-shrink: 0;
		font-variant-numeric: tabular-nums;
	}

	.ct-lb-avatar {
		width: 26px;
		height: 26px;
		border-radius: 50%;
		background: #CE5612;
		color: white;
		font-size: 0.625rem;
		font-weight: 700;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.ct-lb-name {
		font-size: 0.8125rem;
		font-weight: 500;
		color: #1d4d4e;
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.ct-lb-pts {
		font-size: 0.6875rem;
		font-weight: 700;
		color: #64748b;
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}

	/* ── Past rounds accordion ── */
	.ct-past-rounds {
		background: white;
		border: 1px solid #e2e8f0;
		border-radius: 14px;
		overflow: hidden;
	}

	.ct-past-summary {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.875rem 1.125rem;
		cursor: pointer;
		list-style: none;
		font-size: 0.875rem;
		font-weight: 600;
		color: #1d4d4e;
		user-select: none;
	}

	.ct-past-summary::-webkit-details-marker { display: none; }

	.ct-past-icon {
		font-size: 1.1rem;
		font-weight: 300;
		color: #64748b;
		transition: transform 0.2s;
	}

	details[open] .ct-past-icon { transform: rotate(45deg); }

	.ct-past-list {
		padding: 0 0 0.5rem;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.ct-past-row {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.625rem 1.125rem;
		background: none;
		border: none;
		cursor: pointer;
		font: inherit;
		text-align: left;
		width: 100%;
		border-radius: 0;
		transition: background 0.1s;
	}

	.ct-past-row:hover {
		background: #f8fafc;
	}

	.ct-past-thumb {
		width: 60px;
		height: 60px;
		border-radius: 8px;
		object-fit: cover;
		flex-shrink: 0;
		background: #f1f5f9;
	}

	.ct-past-thumb--empty {
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 1.5rem;
	}

	.ct-past-row-info {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
	}

	.ct-past-row-key {
		font-size: 0.75rem;
		font-weight: 700;
		color: #94a3b8;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.ct-past-row-winner {
		font-size: 0.8125rem;
		color: #1d4d4e;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.ct-past-row-empty {
		font-size: 0.8125rem;
		color: #94a3b8;
		font-style: italic;
	}

	.ct-past-row-chevron {
		color: #CE5612;
		opacity: 0.6;
		flex-shrink: 0;
	}

	/* ── Past round viewer ── */
	.ct-past-view {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.ct-back-btn {
		display: inline-flex;
		align-items: center;
		min-height: 44px;
		padding: 0 0.75rem 0 0;
		background: none;
		border: none;
		font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
		font-size: 0.875rem;
		font-weight: 500;
		color: #CE5612;
		cursor: pointer;
		transition: color 0.12s;
	}

	.ct-back-btn:hover { color: #b34b10; }

	.ct-past-layout {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.ct-past-photo-wrap {
		position: relative;
		border-radius: 14px;
		overflow: hidden;
	}

	.ct-past-photo {
		width: 100%;
		height: 260px;
		object-fit: cover;
		display: block;
	}

	.ct-past-winner-overlay {
		position: absolute;
		bottom: 0;
		left: 0;
		right: 0;
		background: rgba(0,0,0,0.72);
		padding: 0.75rem 1rem;
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.ct-winner-crown {
		font-size: 1.25rem;
		flex-shrink: 0;
	}

	.ct-past-winner-text {
		margin: 0;
		font-size: 0.9375rem;
		color: white;
		font-weight: 600;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.ct-past-captions {
		background: white;
		border: 1px solid #e2e8f0;
		border-radius: 14px;
		padding: 1rem 1.125rem;
	}

	.ct-past-captions-title {
		font-family: 'Fraunces', Georgia, serif;
		font-size: 1rem;
		font-weight: 700;
		color: #1d4d4e;
		margin: 0 0 0.75rem;
	}

	.ct-past-cap-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
	}

	.ct-past-cap-row {
		display: flex;
		align-items: center;
		gap: 0.625rem;
		padding: 0.5rem 0;
		border-bottom: 1px solid #f1f5f9;
		font-size: 0.875rem;
	}

	.ct-past-cap-row:last-child { border-bottom: none; }

	.ct-past-cap-row--winner {
		background: rgba(192,136,32,0.04);
		border-radius: 8px;
		padding-left: 0.5rem;
		padding-right: 0.5rem;
	}

	.ct-past-avatar {
		width: 28px;
		height: 28px;
		border-radius: 50%;
		overflow: hidden;
		background: #e2e8f0;
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		border: none;
		padding: 0;
		cursor: pointer;
		font-size: 0.6875rem;
		font-weight: 700;
		color: #475569;
		transition: outline 0.1s;
	}

	.ct-past-avatar img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.ct-past-avatar:hover {
		outline: 2px solid #CE5612;
		outline-offset: 2px;
	}

	.ct-past-cap-text {
		flex: 1;
		min-width: 0;
		color: #1d4d4e;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.ct-past-votes {
		flex-shrink: 0;
		font-size: 0.75rem;
		font-weight: 700;
		color: #a87818;
	}

	/* ── Mobile ── */
	@media (max-width: 767px) {
		.ct-caption-card {
			min-height: 56px;
		}
		.ct-hero {
			margin: 0 -4px;
			border-radius: 14px;
		}
		.ct-photo-theatre {
			margin: 0 -12px;
		}
		.ct-photo-polaroid {
			transform: rotate(-0.5deg);
		}

		.ct-round-photo {
			height: 220px;
			border-radius: 0;
		}

		.ct-photo-theatre .ct-photo-block {
			border-radius: 0;
		}

		.ct-past-photo {
			height: 200px;
		}
	}
</style>
