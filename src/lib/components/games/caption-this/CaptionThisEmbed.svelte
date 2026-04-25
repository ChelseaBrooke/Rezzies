<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { enhance } from '$app/forms';
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
		captionMaxLength = 120,
		eligibleCaptionCount = 0,
		form,
		activeTabId = null
	}: Props = $props();

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
	let endRoundConfirm = $state(false);
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
		action="?/submitPhoto"
		bind:this={photoFormRef}
		onsubmit={() => { uploading = false; uploadPendingUrl = null; }}
		class="ct-hidden-form"
	>
		<input type="hidden" name="roundId" value={roundId} />
		<input type="hidden" name="photoUrl" value={uploadPendingUrl ?? ''} />
		{#if activeTabId}<input type="hidden" name="activeTab" value={activeTabId} />{/if}
	</form>
	<input type="file" accept="image/*" capture="environment" class="ct-hidden-input" aria-hidden="true" tabindex="-1" bind:this={photoCameraInputRef} onchange={handlePhotoFile} />
	<input type="file" accept="image/*" class="ct-hidden-input" aria-hidden="true" tabindex="-1" bind:this={photoFileInputRef} onchange={handlePhotoFile} />

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
		<!-- ── Current round ── -->

		<!-- SUB-STATE A: Waiting for photo -->
		{#if isWaitingForPhoto}
			{#if isPhotoSubmitter}
				<div class="ct-section">
					<p class="ct-section-label">It's your turn to post a photo</p>
					<div class="ct-upload-zone" role="group">
						<span class="ct-upload-icon" aria-hidden="true">📷</span>
						<p class="ct-upload-heading">Post a photo to start the round</p>
						<div class="ct-upload-btns">
							<button type="button" class="ct-upload-btn ct-upload-btn--primary" disabled={uploading} onclick={() => photoCameraInputRef?.click()}>
								{uploading ? 'Uploading…' : '📷 Take a photo'}
							</button>
							<button type="button" class="ct-upload-btn ct-upload-btn--ghost" disabled={uploading} onclick={() => photoFileInputRef?.click()}>
								🖼 Choose from gallery
							</button>
						</div>
					</div>
				</div>
			{:else}
				<div class="ct-holding-card">
					<span class="ct-holding-icon" aria-hidden="true">⏳</span>
					<p class="ct-holding-text">Waiting for someone to post a photo to start the round…</p>
				</div>
			{/if}

		<!-- SUB-STATE B: Caption submission -->
		{:else if isCaptionPhase}
			{#if photoUrl}
				<div class="ct-photo-block">
					<img class="ct-round-photo" src={photoUrl} alt="Round photo" />
				</div>
			{/if}

			{#if isPhotoSubmitter}
				<div class="ct-poster-waiting">
					<p class="ct-poster-waiting-text">You posted this photo. Waiting for everyone to submit captions…</p>
					<span class="ct-captions-count">{captions.length} caption{captions.length !== 1 ? 's' : ''} in so far</span>
				</div>
			{:else if submittedCaption}
				<div class="ct-submitted-confirm">
					<span class="ct-submitted-icon" aria-hidden="true">✓</span>
					<p>Your caption is in — voting starts when everyone's ready.</p>
					{#if myCaption}
						<p class="ct-submitted-preview">"{myCaption.text}"</p>
					{/if}
				</div>
			{:else}
				<form
					method="POST"
					action="?/submitCaption"
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
					{#if activeTabId}<input type="hidden" name="activeTab" value={activeTabId} />{/if}
					<div class="ct-textarea-wrap">
						<textarea
							name="text"
							class="ct-caption-input"
							placeholder="Write your caption…"
							maxlength={captionMaxLength}
							rows="2"
							bind:value={captionText}
							disabled={captionSubmitting}
						></textarea>
						<span class="ct-char-count" class:ct-char-count--warn={captionText.length > captionMaxLength * 0.85}>
							{captionText.length} / {captionMaxLength}
						</span>
					</div>
					<button
						type="submit"
						class="ct-submit-btn"
						disabled={!captionText.trim() || captionSubmitting}
					>
						{captionSubmitting ? 'Submitting…' : 'Submit caption →'}
					</button>
				</form>
			{/if}

		<!-- SUB-STATE C: Voting -->
		{:else if isVotingPhase}
			{#if photoUrl}
				<div class="ct-photo-block">
					<img class="ct-round-photo" src={photoUrl} alt="Round photo" />
				</div>
			{/if}

			<div class="ct-voting-section">
				<p class="ct-section-label">
					{#if myVoteCaptionId}Your vote is in!{:else}Vote for the funniest caption{/if}
				</p>
				<div class="ct-caption-cards">
					{#each sortedCaptions as c}
						{@const isMyCaption = c.id === myCaptionId}
						{@const isVoted = myVoteCaptionId === c.id}
						{@const canVoteThis = canVote && !isMyCaption}

						{#if canVoteThis}
							<form
								method="POST"
								action="?/submitVote"
								class="ct-vote-form"
								use:enhance={() => async ({ result, update }) => {
									await update();
									if (result.type === 'success' || result.type === 'redirect') await invalidateAll();
								}}
							>
								<input type="hidden" name="roundId" value={roundId} />
								<input type="hidden" name="captionId" value={c.id} />
								{#if activeTabId}<input type="hidden" name="activeTab" value={activeTabId} />{/if}
								<button type="submit" class="ct-caption-card ct-caption-card--voteable">
									<span class="ct-caption-card-text">"{c.text}"</span>
									<span class="ct-vote-btn-label">Vote</span>
								</button>
							</form>
						{:else}
							<div class="ct-caption-card" class:ct-caption-card--voted={isVoted} class:ct-caption-card--mine={isMyCaption && !isVoted}>
								<span class="ct-caption-card-text">"{c.text}"</span>
								{#if isVoted}
									<span class="ct-voted-label">Your vote ✓</span>
								{:else if isMyCaption}
									<span class="ct-mine-label">Yours</span>
								{/if}
							</div>
						{/if}
					{/each}

					{#if captions.length === 0}
						<p class="ct-no-captions">No captions submitted yet.</p>
					{/if}
				</div>
			</div>

		<!-- RESULTS -->
		{:else if isResultsPhase}
			{#if photoUrl}
				<div class="ct-photo-block">
					<img class="ct-round-photo" src={photoUrl} alt="Round photo" />
				</div>
			{/if}

			<div class="ct-results">
				{#if winners.length > 0}
					{#each winners as w}
						<div class="ct-winner-card">
							<span class="ct-winner-badge">🏆 Funniest caption</span>
							<p class="ct-winner-text">"{w.text}"</p>
							<span class="ct-winner-votes">{w.voteCount} vote{(w.voteCount ?? 0) !== 1 ? 's' : ''}</span>
						</div>
					{/each}
				{:else}
					<div class="ct-no-winners">No captions this round.</div>
				{/if}

				<div class="ct-vote-dist">
					<p class="ct-section-label">All captions</p>
					{#each sortedCaptions as c}
						<div class="ct-dist-row" class:ct-dist-row--winner={winners.some((w) => w.id === c.id)}>
							<span class="ct-dist-text">"{c.text}"</span>
							<span class="ct-dist-votes">{c.voteCount ?? 0}v</span>
						</div>
					{/each}
				</div>

				{#if isPhotoSubmitter}
					<div class="ct-next-row">
						{#if endRoundConfirm}
							<span class="ct-end-confirm">
								<form method="POST" action="?/startNextRound">
									{#if activeTabId}<input type="hidden" name="activeTab" value={activeTabId} />{/if}
									<button type="submit" class="ct-btn-primary ct-btn-start-next" disabled={startingNext} onclick={() => { startingNext = true; }}>
										{startingNext ? 'Starting…' : 'Start next round'}
									</button>
								</form>
								<button type="button" class="ct-btn-ghost" onclick={() => (endRoundConfirm = false)}>Cancel</button>
							</span>
						{:else}
							<button type="button" class="ct-btn-primary ct-btn-start-next" onclick={() => (endRoundConfirm = true)}>
								Start next round →
							</button>
						{/if}
					</div>
				{:else}
					<p class="ct-waiting-next">The photo poster will start the next round.</p>
				{/if}
			</div>

			<!-- End round early (non-results phases, photo submitter) -->
		{/if}

		{#if (isCaptionPhase || isVotingPhase) && isPhotoSubmitter}
			<div class="ct-end-early">
				{#if endRoundConfirm}
					<span class="ct-end-confirm">
						End round now?
						<form method="POST" action="?/endRoundNow" class="ct-inline-form" use:enhance>
							<input type="hidden" name="roundId" value={roundId} />
							{#if activeTabId}<input type="hidden" name="activeTab" value={activeTabId} />{/if}
							<button type="submit" class="ct-btn-danger">Yes, end it</button>
						</form>
						<button type="button" class="ct-btn-ghost" onclick={() => (endRoundConfirm = false)}>Cancel</button>
					</span>
				{:else}
					<button type="button" class="ct-btn-ghost ct-end-btn" onclick={() => (endRoundConfirm = true)}>
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
		max-width: 680px;
		width: 100%;
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
		font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
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

	/* ── Section label ── */
	.ct-section-label {
		font-size: 0.75rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: #94a3b8;
		margin: 0 0 0.625rem;
	}

	/* ── Photo block ── */
	.ct-photo-block {
		border-radius: 14px;
		overflow: hidden;
		line-height: 0;
	}
	.ct-round-photo {
		width: 100%;
		height: clamp(220px, 38vw, 340px);
		object-fit: cover;
		display: block;
	}

	/* ── Upload zone (Sub-state A, poster) ── */
	.ct-section { display: flex; flex-direction: column; }

	.ct-upload-zone {
		border: 2px dashed #cbd5e1;
		border-radius: 16px;
		padding: 2.5rem 1.5rem;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.75rem;
		text-align: center;
		background: #f8fafc;
		transition: border-color 0.15s, background 0.15s;
	}

	.ct-upload-icon {
		font-size: 2.5rem;
	}

	.ct-upload-heading {
		font-family: 'Fraunces', Georgia, serif;
		font-size: 1.0625rem;
		font-weight: 700;
		color: #1d4d4e;
		margin: 0;
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
		gap: 0.75rem;
		padding: 2.5rem 1.5rem;
		background: #f8fafc;
		border-radius: 14px;
		border: 1.5px solid #e2e8f0;
		text-align: center;
	}

	.ct-holding-icon {
		font-size: 2rem;
	}

	.ct-holding-text {
		font-size: 0.9375rem;
		color: #64748b;
		margin: 0;
	}

	/* ── Poster waiting (Sub-state B, is poster) ── */
	.ct-poster-waiting {
		background: rgba(47,119,120,0.06);
		border: 1px solid rgba(47,119,120,0.18);
		border-radius: 12px;
		padding: 1rem 1.25rem;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		flex-wrap: wrap;
	}

	.ct-poster-waiting-text {
		font-size: 0.9375rem;
		color: #1d4d4e;
		margin: 0;
	}

	.ct-captions-count {
		font-size: 0.8125rem;
		font-weight: 700;
		color: #2f7778;
		white-space: nowrap;
	}

	/* ── Submitted confirm (Sub-state B, after submit) ── */
	.ct-submitted-confirm {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.5rem;
		padding: 1.25rem;
		background: rgba(29,158,117,0.06);
		border: 1px solid rgba(29,158,117,0.25);
		border-radius: 12px;
		text-align: center;
		font-size: 0.9375rem;
		color: #1d4d4e;
	}

	.ct-submitted-icon {
		font-size: 1.5rem;
		color: #1D9E75;
	}

	.ct-submitted-confirm p {
		margin: 0;
	}

	.ct-submitted-preview {
		color: #64748b;
		font-style: italic;
	}

	/* ── Caption form (Sub-state B, not submitted) ── */
	.ct-caption-form {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.ct-textarea-wrap {
		position: relative;
	}

	.ct-caption-input {
		width: 100%;
		border: 1.5px solid #e2e8f0;
		border-radius: 12px;
		padding: 0.875rem 1rem 2rem;
		font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
		font-size: 0.9375rem;
		color: #1d4d4e;
		resize: none;
		transition: border-color 0.12s;
		box-sizing: border-box;
	}

	.ct-caption-input:focus {
		outline: none;
		border-color: #CE5612;
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

	.ct-caption-cards {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.ct-vote-form {
		display: contents;
	}

	.ct-caption-card {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.875rem 1rem;
		border-radius: 12px;
		border: 1.5px solid #e2e8f0;
		background: white;
		font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
		font-size: 0.9375rem;
		color: #1d4d4e;
		text-align: left;
		min-height: 56px;
		transition: border-color 0.12s, background 0.12s;
	}

	.ct-caption-card--voteable {
		cursor: pointer;
		width: 100%;
	}

	.ct-caption-card--voteable:hover {
		border-color: #CE5612;
		background: rgba(206,86,18,0.04);
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
		font-size: 0.8125rem;
		font-weight: 700;
		color: #CE5612;
		border: 1.5px solid #CE5612;
		border-radius: 7px;
		padding: 3px 10px;
		white-space: nowrap;
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
		gap: 1rem;
	}

	.ct-winner-card {
		background: white;
		border: 2px solid rgba(192,136,32,0.4);
		border-radius: 14px;
		padding: 1.125rem 1.25rem;
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
		background: rgba(192,136,32,0.05);
	}

	.ct-winner-badge {
		font-size: 0.75rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: #a87818;
	}

	.ct-winner-text {
		font-family: 'Fraunces', Georgia, serif;
		font-size: 1.125rem;
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
		gap: 0.35rem;
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
		background: white;
		border: 1px solid #e2e8f0;
		border-radius: 14px;
		padding: 1rem 1.125rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.ct-lb-title {
		font-family: 'Fraunces', Georgia, serif;
		font-size: 1rem;
		font-weight: 700;
		color: #1d4d4e;
		margin: 0;
		letter-spacing: -0.01em;
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

		.ct-round-photo {
			height: 220px;
			border-radius: 0;
		}

		.ct-photo-block {
			border-radius: 0;
			margin: 0 -16px;
		}

		.ct-past-photo {
			height: 200px;
		}
	}
</style>
