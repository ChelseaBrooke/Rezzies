<script lang="ts">
	import {
		getTriviaQuestions,
		setTriviaQuestions,
		getTriviaGameHasSubmissions,
		getTriviaGamePublished,
		setTriviaGamePublished,
		submitAllTriviaAnswers,
		getTriviaAnswersForUser,
		isTriviaQuestionComplete,
		type TriviaQuestion,
	} from '$lib/stores/tripGames.js';
	import GameLeaderboard from './GameLeaderboard.svelte';
	import type { LeaderboardPlayer } from './GameLeaderboard.svelte';

	interface Props {
		tripId: string;
		tripGameId: string;
		userId: string;
		isHostOfGame: boolean;
		players: LeaderboardPlayer[];
	}

	let { tripId, tripGameId, userId, isHostOfGame, players }: Props = $props();

	// ── State ─────────────────────────────────────────────────────────────────
	let questions = $state<TriviaQuestion[]>([]);
	let answers   = $state<Record<string, { answerIndex: number; correct: boolean }>>({});
	let published = $state(false);
	let canEdit   = $state(false);

	let draggedIndex = $state<number | null>(null);

	/** While authoring before publish, questions live only in memory until Publish writes storage. */
	let draftSessionKey = $state('');

	// Guest: pending answers (before submit)
	let pending = $state<Record<string, number>>({});
	let submitted = $state(false);

	function emptyQuestion(): TriviaQuestion {
		return {
			id: crypto.randomUUID(),
			question: '',
			options: [
				{ text: '', correct: true },
				{ text: '', correct: false },
				{ text: '', correct: false },
			],
		};
	}

	function cloneQuestion(q: TriviaQuestion): TriviaQuestion {
		return {
			id: q.id,
			question: q.question,
			options: q.options.map((o) => ({ text: o.text, correct: o.correct })),
		};
	}

	const isHostDraftAuthoring = $derived(isHostOfGame && canEdit && !published);

	function refresh() {
		answers = getTriviaAnswersForUser(tripId, tripGameId, userId);
		published = getTriviaGamePublished(tripId, tripGameId);
		canEdit = !getTriviaGameHasSubmissions(tripId, tripGameId);

		const sessionKey = `${tripId}:${tripGameId}`;

		if (isHostOfGame && canEdit && !published) {
			if (draftSessionKey !== sessionKey) {
				draftSessionKey = sessionKey;
				const fromStore = getTriviaQuestions(tripId, tripGameId);
				questions = fromStore.length > 0 ? fromStore.map(cloneQuestion) : [emptyQuestion()];
			}
		} else {
			draftSessionKey = '';
			questions = getTriviaQuestions(tripId, tripGameId);
		}
	}

	$effect.pre(() => {
		tripId;
		tripGameId;
		userId;
		isHostOfGame;
		published;
		refresh();
	});

	// ── Host actions ──────────────────────────────────────────────────────────
	function addNewQuestion() {
		if (!isHostDraftAuthoring) return;
		questions = [...questions, emptyQuestion()];
	}

	function moveQuestion(fromIdx: number, toIdx: number) {
		if (!isHostDraftAuthoring || fromIdx === toIdx) return;
		const next = questions.map(cloneQuestion);
		const [removed] = next.splice(fromIdx, 1);
		next.splice(toIdx, 0, removed);
		questions = next;
	}

	function removeQuestion(qId: string) {
		if (!isHostDraftAuthoring) return;
		const next = questions.filter((q) => q.id !== qId);
		questions = next.length > 0 ? next : [emptyQuestion()];
	}

	function publishGame() {
		if (!isHostOfGame || !canEdit || questions.length === 0 || published) return;
		if (!questions.every(isTriviaQuestionComplete)) return;
		setTriviaQuestions(tripId, tripGameId, questions.map(cloneQuestion));
		setTriviaGamePublished(tripId, tripGameId);
		draftSessionKey = '';
		refresh();
	}

	// Drag handlers
	function onDragStart(e: DragEvent, i: number) {
		draggedIndex = i;
		if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
	}
	function onDragOver(e: DragEvent) {
		e.preventDefault();
		if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
	}
	function onDrop(e: DragEvent, toIdx: number) {
		e.preventDefault();
		if (draggedIndex !== null) moveQuestion(draggedIndex, toIdx);
		draggedIndex = null;
	}
	function onDragEnd() { draggedIndex = null; }

	// ── Guest actions ─────────────────────────────────────────────────────────
	function setPending(qId: string, optIdx: number) {
		pending = { ...pending, [qId]: optIdx };
	}

	const canSubmit = $derived(
		questions.length > 0 && questions.every((q) => pending[q.id] !== undefined)
	);

	function submitAnswers() {
		if (!canSubmit) return;
		submitAllTriviaAnswers(tripId, tripGameId, userId, pending);
		submitted = true;
		refresh();
	}

	const score = $derived(Object.values(answers).filter((a) => a.correct).length);
	const hasAnswered = $derived(Object.keys(answers).length > 0);

	const allQuestionsComplete = $derived(questions.every(isTriviaQuestionComplete));
</script>

<div class="trivia-wrap">
	{#if isHostOfGame}
		<!-- ── Host view ──────────────────────────────────────────────── -->
		<div class="trivia-host">
			<div class="trivia-hero" aria-hidden="false">
				<div class="trivia-hero-deco" aria-hidden="true"></div>
				<p class="trivia-hero-kicker">Crew game</p>
				<h2 class="trivia-hero-title">Daily Trivia</h2>
				<p class="trivia-hero-lede">
					Each line is its own question card. Edit freely, nothing is stored until you <strong>Publish quiz</strong> (then guests can play). Use <strong>Add new question</strong> for another row. Drag ⠿ or ↑ ↓ to reorder; ✕ removes. Finish every card before publishing. Guests answer once; first try counts.
				</p>
			</div>

			<div class="trivia-host-header">
				<span class="game-master-badge">You’re the host ✦</span>
				{#if published}
					<span class="trivia-published-pill">Live · guests can play</span>
				{:else if questions.length > 0}
					<span class="trivia-draft-pill">{questions.length} question{questions.length === 1 ? '' : 's'} · not published yet</span>
				{/if}
			</div>

			<div class="trivia-host-body">
				<!-- Question list -->
				<div class="trivia-q-list">
					{#if isHostDraftAuthoring && questions.length > 1}
						<p class="trivia-reorder-hint">Reorder: drag the ⠿ handle, or tap ↑ ↓.</p>
					{/if}
					{#if questions.length > 0}
						{#each questions as q, i (q.id)}
							<div
								class="trivia-q-row"
								class:trivia-q-row--dragging={draggedIndex === i}
								class:trivia-q-row--editable={isHostDraftAuthoring}
								draggable={isHostDraftAuthoring}
								role="listitem"
								ondragstart={(e) => onDragStart(e, i)}
								ondragover={onDragOver}
								ondrop={(e) => onDrop(e, i)}
								ondragend={onDragEnd}
							>
								{#if isHostDraftAuthoring}
									<button
										type="button"
										class="trivia-q-delete"
										draggable="false"
										aria-label="Delete question"
										onclick={(e) => {
											e.stopPropagation();
											removeQuestion(q.id);
										}}
									>×</button>
								{/if}
								<span class="trivia-q-index" aria-label="Question {i + 1}">{i + 1}</span>
								{#if isHostDraftAuthoring}
									<span class="trivia-drag-handle" aria-hidden="true">⠿</span>
								{:else}
									<span class="trivia-q-lead-spacer" aria-hidden="true"></span>
								{/if}
								<div class="trivia-q-content">
									{#if isHostDraftAuthoring}
										<textarea
											class="trivia-q-input"
											rows="4"
											bind:value={q.question}
											placeholder="Question text"
										></textarea>
										<div class="trivia-opts-edit">
											{#each q.options as opt, j (q.id + '-' + j)}
												<label class="trivia-opt-row">
													<input
														type="radio"
														name="correct-{q.id}"
														checked={opt.correct}
														onchange={() => {
															q.options = q.options.map((o, k) => ({ ...o, correct: k === j }));
														}}
													/>
													<input
														type="text"
														class="trivia-opt-input"
														placeholder="Option {j + 1}"
														bind:value={q.options[j].text}
													/>
													{#if q.options.length > 2}
														<button
															type="button"
															class="trivia-opt-remove"
															aria-label="Remove option"
															onclick={() => {
																const next = q.options.filter((_, idx) => idx !== j);
																let opts = next;
																if (!opts.some((o) => o.correct)) {
																	opts = opts.map((o, k) => ({ ...o, correct: k === 0 }));
																}
																q.options = opts;
															}}
														>×</button>
													{/if}
												</label>
											{/each}
										</div>
										<div class="trivia-edit-actions">
											<button
												type="button"
												class="trivia-btn trivia-btn-ghost"
												onclick={() => {
													q.options = [...q.options, { text: '', correct: false }];
												}}
											>+ Option</button>
										</div>
									{:else}
										{#if q.question.trim()}
											<p class="trivia-q-text">{q.question}</p>
										{:else}
											<p class="trivia-q-text trivia-q-text--placeholder">Question text</p>
										{/if}
										<div class="trivia-q-meta">
											<span class="trivia-q-opts-count">{q.options.length} options</span>
											<span class="trivia-q-correct">
												✓ {(q.options.find((o) => o.correct)?.text ?? '').trim() || '-'}
											</span>
										</div>
									{/if}
								</div>
								<!-- Mobile up/down (touch-friendly reorder) -->
								{#if isHostDraftAuthoring}
									<div class="trivia-reorder-btns">
										<button
											type="button"
											class="trivia-reorder-btn"
											disabled={i === 0}
											onclick={() => moveQuestion(i, i - 1)}
											aria-label="Move question up"
										>↑</button>
										<button
											type="button"
											class="trivia-reorder-btn"
											disabled={i === questions.length - 1}
											onclick={() => moveQuestion(i, i + 1)}
											aria-label="Move question down"
										>↓</button>
									</div>
								{:else}
									<span class="trivia-reorder-spacer" aria-hidden="true"></span>
								{/if}
							</div>
						{/each}
					{/if}

					{#if isHostDraftAuthoring}
						<button type="button" class="trivia-add-btn" onclick={addNewQuestion}>
							<span class="trivia-add-btn-icon" aria-hidden="true">＋</span>
							Add new question
						</button>
					{/if}
				</div>

				{#if isHostDraftAuthoring && questions.length > 0}
					<div class="trivia-publish-row">
						{#if !allQuestionsComplete}
							<p class="trivia-publish-warn">
								Finish every question (prompt + two or more answers, one marked correct) before publishing.
							</p>
						{:else}
							<p class="trivia-publish-warn">Publishing locks the questions. Guests will be able to answer.</p>
						{/if}
						<button
							type="button"
							class="trivia-btn trivia-btn-publish"
							disabled={!allQuestionsComplete}
							onclick={publishGame}
						>
							Publish quiz →
						</button>
					</div>
				{/if}

				{#if published}
					<div class="trivia-host-stats">
						<p class="trivia-hint">You’re live. Guests use the same Daily Trivia card, remind them to submit once they’ve picked every answer.</p>
						<GameLeaderboard title="Who’s playing" {players} emptyText="Scores show after guests submit." />
					</div>
				{/if}
			</div>
		</div>

	{:else}
		<!-- ── Guest view ─────────────────────────────────────────────── -->
		<div class="trivia-guest">
			<div class="trivia-hero trivia-hero--guest">
				<div class="trivia-hero-deco" aria-hidden="true"></div>
				<p class="trivia-hero-kicker">Crew game</p>
				<h2 class="trivia-hero-title">Daily Trivia</h2>
				<p class="trivia-hero-lede">
					How well do you know this trip? One pass through every question, choose carefully before you submit.
				</p>
			</div>
		{#if !published}
			<div class="trivia-holding">
				<span class="trivia-holding-emoji" aria-hidden="true">🧠</span>
				<p class="trivia-holding-title">Questions are on the way</p>
				<p class="trivia-holding-text">Your host is still writing the set. Grab a snack and check back in a bit.</p>
			</div>
		{:else if hasAnswered}
			<!-- Results -->
			<div class="trivia-results">
				<div class="trivia-score-callout">
					<span class="trivia-score-num">{score}</span>
					<span class="trivia-score-denom">/ {questions.length} right</span>
				</div>
				<p class="trivia-results-sub">
					{score === questions.length ? 'Perfect score! 🎉' : score > questions.length / 2 ? 'Nice work!' : 'Better luck next time!'}
				</p>
				<div class="trivia-breakdown">
					{#each questions as q, i}
						{@const ans = answers[q.id]}
						{@const correct = ans?.correct}
						{@const chosen = ans !== undefined ? q.options[ans.answerIndex]?.text : null}
						{@const rightOption = q.options.find((o) => o.correct)?.text}
						<div
							class="trivia-breakdown-card"
							class:trivia-breakdown-card--correct={correct}
							class:trivia-breakdown-card--wrong={!correct && ans !== undefined}
						>
							<span class="trivia-q-index" aria-hidden="true">{i + 1}</span>
							<div class="trivia-breakdown-card-main">
								<p class="tbc-q">{q.question}</p>
								<p class="tbc-answer tbc-answer--correct">✓ {rightOption}</p>
								{#if !correct && chosen}
									<p class="tbc-answer tbc-answer--wrong">✗ You said: {chosen}</p>
								{/if}
							</div>
						</div>
					{/each}
				</div>
				<GameLeaderboard title="Leaderboard" {players} emptyText="No scores yet." />
			</div>
		{:else}
			<!-- Answer questions -->
			<div class="trivia-answer-wrap">
				<div class="trivia-questions-list">
					{#each questions as q, i}
						<div class="trivia-question-card">
							<span class="trivia-q-index" aria-label="Question {i + 1}">{i + 1}</span>
							<div class="trivia-question-card-main">
							<p class="tq-text">{q.question}</p>
							<div class="tq-options">
								{#each q.options as opt, j}
									<button
										type="button"
										class="tq-option"
										class:tq-option--selected={pending[q.id] === j}
										onclick={() => setPending(q.id, j)}
									>
										{opt.text}
									</button>
								{/each}
							</div>
							</div>
						</div>
					{/each}
				</div>

				<div class="trivia-submit-bar">
					<button
						type="button"
						class="trivia-submit-btn"
						disabled={!canSubmit}
						onclick={submitAnswers}
					>
						Submit answers →
					</button>
					{#if !canSubmit}
						<p class="trivia-submit-hint">Answer every question above to submit.</p>
					{/if}
				</div>
			</div>
		{/if}
		</div>
	{/if}
</div>

<style>
	.trivia-wrap {
		max-width: 720px;
		min-width: 0;
		margin: 0 auto;
		padding: 1.25rem 1rem 2rem;
		border-radius: 20px;
		border: 1px solid rgba(47, 119, 120, 0.12);
		background:
			radial-gradient(120% 80% at 100% 0%, rgba(206, 86, 18, 0.08) 0%, transparent 55%),
			radial-gradient(90% 60% at 0% 20%, rgba(122, 206, 211, 0.12) 0%, transparent 50%),
			linear-gradient(165deg, #fffefb 0%, #f8faf9 45%, #f1f5f4 100%);
		box-shadow: 0 10px 40px rgba(29, 77, 78, 0.06);
	}

	.trivia-hero {
		position: relative;
		overflow: hidden;
		border-radius: 16px;
		padding: 1.35rem 1.25rem 1.5rem;
		margin-bottom: 1.25rem;
		background: linear-gradient(125deg, #1d4d4e 0%, #2f7778 42%, #256a6b 100%);
		color: #fff;
		box-shadow: 0 8px 28px rgba(29, 77, 78, 0.25);
	}

	.trivia-hero--guest {
		margin-bottom: 1.5rem;
	}

	.trivia-hero-deco {
		position: absolute;
		inset: 0;
		background:
			radial-gradient(circle at 88% 12%, rgba(247, 170, 41, 0.35) 0%, transparent 38%),
			radial-gradient(circle at 8% 80%, rgba(122, 206, 211, 0.25) 0%, transparent 35%);
		pointer-events: none;
	}

	.trivia-hero-kicker {
		position: relative;
		margin: 0 0 0.35rem;
		font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
		font-size: 0.68rem;
		font-weight: 700;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: rgba(255, 255, 255, 0.72);
	}

	.trivia-hero-title {
		position: relative;
		margin: 0 0 0.5rem;
		font-family: 'Fraunces', Georgia, serif;
		font-size: clamp(1.5rem, 4vw, 1.875rem);
		font-weight: 800;
		letter-spacing: -0.03em;
		line-height: 1.15;
		text-shadow: 0 2px 12px rgba(0, 0, 0, 0.15);
	}

	.trivia-hero-lede {
		position: relative;
		margin: 0;
		max-width: 36rem;
		font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
		font-size: 0.9rem;
		line-height: 1.55;
		color: rgba(255, 255, 255, 0.88);
	}

	.trivia-guest {
		display: flex;
		flex-direction: column;
	}

	/* ── Game master badge ── */
	.game-master-badge {
		display: inline-flex;
		align-items: center;
		padding: 3px 10px;
		background: rgba(192,136,32,0.12);
		color: #a87818;
		border-radius: 999px;
		font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
		font-size: 0.75rem;
		font-weight: 700;
		letter-spacing: 0.04em;
	}

	.trivia-published-pill {
		display: inline-flex;
		align-items: center;
		padding: 3px 10px;
		background: rgba(29,158,117,0.1);
		color: #1D9E75;
		border-radius: 999px;
		font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
		font-size: 0.75rem;
		font-weight: 600;
	}

	.trivia-draft-pill {
		display: inline-flex;
		align-items: center;
		padding: 3px 10px;
		background: rgba(206, 86, 18, 0.12);
		color: #b45309;
		border-radius: 999px;
		font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
		font-size: 0.75rem;
		font-weight: 600;
	}

	/* ── Host view ── */
	.trivia-host {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		position: relative;
	}

	.trivia-host-header {
		display: flex;
		align-items: center;
		gap: 0.625rem;
		flex-wrap: wrap;
	}

	.trivia-host-body {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	/* ── Question list (host) ── */
	.trivia-q-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.trivia-reorder-hint {
		margin: 0 0 0.25rem;
		padding: 0 0.125rem;
		font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
		font-size: 0.78rem;
		color: #64748b;
		line-height: 1.4;
	}

	.trivia-q-index {
		flex-shrink: 0;
		width: 2rem;
		height: 2rem;
		display: flex;
		align-items: center;
		justify-content: center;
		font-family: 'Fraunces', Georgia, serif;
		font-size: 1rem;
		font-weight: 800;
		color: #1d4d4e;
		background: rgba(47, 119, 120, 0.1);
		border-radius: 10px;
		line-height: 1;
		margin-top: 2px;
	}

	.trivia-q-lead-spacer {
		width: 1rem;
		flex-shrink: 0;
		pointer-events: none;
	}

	.trivia-q-row {
		position: relative;
		display: flex;
		align-items: flex-start;
		gap: 0.5rem;
		background: white;
		border: 1.5px solid #e2e8f0;
		border-radius: 12px;
		padding: 0.875rem 1rem;
		min-height: 56px;
		cursor: grab;
		transition: border-color 0.12s, box-shadow 0.12s;
	}

	.trivia-q-row--editable {
		padding-right: 0.75rem;
	}

	/* Keep ↑ ↓ below the ✕ so both stay usable */
	.trivia-q-row--editable .trivia-reorder-btns {
		margin-top: 2.125rem;
		align-self: flex-end;
	}

	.trivia-q-delete {
		position: absolute;
		top: 0.5rem;
		right: 0.5rem;
		z-index: 2;
		width: 2rem;
		height: 2rem;
		padding: 0;
		border: none;
		border-radius: 8px;
		background: #f1f5f9;
		color: #64748b;
		font-size: 1.25rem;
		line-height: 1;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		font-family: system-ui, sans-serif;
		transition: background 0.12s, color 0.12s;
	}

	.trivia-q-delete:hover {
		background: #fee2e2;
		color: #b91c1c;
	}

	.trivia-q-row--dragging {
		opacity: 0.55;
		cursor: grabbing;
	}

	.trivia-q-row:not([draggable='true']) {
		cursor: default;
	}

	.trivia-reorder-spacer {
		width: 28px;
		flex-shrink: 0;
		pointer-events: none;
		align-self: stretch;
	}

	.trivia-drag-handle {
		color: #94a3b8;
		font-size: 1rem;
		flex-shrink: 0;
		cursor: grab;
		margin-top: 2px;
	}

	.trivia-q-content {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
	}

	.trivia-q-text {
		font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
		font-size: 0.9375rem;
		color: #1d4d4e;
		margin: 0;
		white-space: pre-wrap;
		word-break: break-word;
	}

	.trivia-q-text--placeholder {
		color: #94a3b8;
		font-style: italic;
	}

	.trivia-q-meta {
		display: flex;
		gap: 0.75rem;
	}

	.trivia-q-opts-count {
		font-size: 0.75rem;
		color: #94a3b8;
		font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
	}

	.trivia-q-correct {
		font-size: 0.75rem;
		color: #1D9E75;
		font-weight: 600;
		font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	/* Reorder arrows (visible on mobile, hidden on desktop) */
	.trivia-reorder-btns {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.trivia-reorder-btn {
		width: 28px;
		height: 28px;
		border: 1px solid #e2e8f0;
		background: white;
		border-radius: 6px;
		font-size: 0.75rem;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		color: #475569;
		flex-shrink: 0;
	}

	.trivia-reorder-btn:disabled {
		opacity: 0.35;
		cursor: default;
	}

	.trivia-reorder-btn:not(:disabled):hover {
		background: #f8fafc;
		border-color: #2f7778;
	}

	/* ── Inline edit styles ── */
	.trivia-q-input {
		width: 100%;
		border: 1.5px solid #e2e8f0;
		border-radius: 8px;
		padding: 0.5rem 0.625rem;
		font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
		font-size: 0.9375rem;
		color: #1d4d4e;
		resize: none;
		transition: border-color 0.12s;
		box-sizing: border-box;
	}

	.trivia-q-input:focus {
		outline: none;
		border-color: #2f7778;
	}

	.trivia-opts-edit {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		margin-top: 0.25rem;
	}

	.trivia-opt-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.trivia-opt-input {
		flex: 1;
		border: 1.5px solid #e2e8f0;
		border-radius: 8px;
		padding: 0.375rem 0.5rem;
		font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
		font-size: 0.875rem;
		min-width: 0;
	}

	.trivia-opt-input:focus {
		outline: none;
		border-color: #2f7778;
	}

	.trivia-opt-remove {
		width: 24px;
		height: 24px;
		border: none;
		background: none;
		color: #ef4444;
		font-size: 1.1rem;
		cursor: pointer;
		border-radius: 4px;
		flex-shrink: 0;
	}

	.trivia-edit-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin-top: 0.25rem;
	}

	.trivia-q-row-actions {
		margin-top: 0.375rem;
	}

	/* ── Buttons ── */
	.trivia-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		height: 40px;
		padding: 0 1rem;
		border-radius: 9px;
		font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
		font-size: 0.875rem;
		font-weight: 600;
		cursor: pointer;
		border: 1.5px solid transparent;
		transition: background 0.12s, border-color 0.12s;
	}

	.trivia-btn-ghost {
		background: white;
		border-color: #e2e8f0;
		color: #475569;
	}

	.trivia-btn-ghost:hover {
		border-color: #2f7778;
		color: #1d4d4e;
	}

	.trivia-btn-publish {
		background: #2f7778;
		border-color: #2f7778;
		color: white;
		width: 100%;
		height: 52px;
		font-size: 1rem;
	}

	.trivia-btn-publish:hover:not(:disabled) {
		background: #1d6566;
	}

	.trivia-btn-publish:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}

	/* ── Dashed “Add new question” strip ── */
	.trivia-add-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		width: 100%;
		min-height: 48px;
		padding: 0.625rem 1rem;
		border: 1.5px dashed #94a3b8;
		background: linear-gradient(180deg, #fff 0%, #f8fafc 100%);
		border-radius: 14px;
		font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
		font-size: 0.9375rem;
		font-weight: 600;
		color: #1d4d4e;
		cursor: pointer;
		transition: border-color 0.12s, background 0.12s, box-shadow 0.12s;
		box-shadow: 0 1px 0 rgba(255, 255, 255, 0.8) inset;
	}

	.trivia-add-btn:hover {
		border-color: #2f7778;
		background: rgba(47, 119, 120, 0.06);
		box-shadow: 0 0 0 1px rgba(47, 119, 120, 0.08);
	}

	.trivia-add-btn-icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1.75rem;
		height: 1.75rem;
		border-radius: 10px;
		background: rgba(47, 119, 120, 0.14);
		color: #1d4d4e;
		font-size: 1.05rem;
		line-height: 1;
		font-weight: 700;
	}

	/* ── Publish row ── */
	.trivia-publish-row {
		background: rgba(192,136,32,0.07);
		border: 1px solid rgba(192,136,32,0.2);
		border-radius: 12px;
		padding: 1rem 1.125rem;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.trivia-publish-warn {
		font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
		font-size: 0.875rem;
		color: #a87818;
		margin: 0;
	}

	.trivia-hint {
		font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
		font-size: 0.8125rem;
		color: #94a3b8;
		margin: 0;
	}

	/* ── Guest: holding ── */
	.trivia-holding {
		background: linear-gradient(165deg, #fff 0%, #f1f5f9 100%);
		border: 1.5px solid #e2e8f0;
		border-radius: 16px;
		padding: 2rem 1.5rem 2.25rem;
		text-align: center;
		box-shadow: 0 4px 20px rgba(29, 77, 78, 0.05);
	}

	.trivia-holding-emoji {
		display: block;
		font-size: 2.25rem;
		line-height: 1;
		margin-bottom: 0.75rem;
		filter: drop-shadow(0 2px 6px rgba(0, 0, 0, 0.08));
	}

	.trivia-holding-title {
		font-family: 'Fraunces', Georgia, serif;
		font-size: 1.25rem;
		font-weight: 700;
		color: #1d4d4e;
		margin: 0 0 0.5rem;
		letter-spacing: -0.02em;
	}

	.trivia-holding-text {
		font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
		font-size: 0.9375rem;
		color: #64748b;
		margin: 0;
		line-height: 1.55;
		max-width: 22rem;
		margin-left: auto;
		margin-right: auto;
	}

	/* ── Guest: answer questions ── */
	.trivia-answer-wrap {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.trivia-questions-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.trivia-question-card {
		display: flex;
		align-items: flex-start;
		gap: 0.5rem;
		background: white;
		border: 1.5px solid #e2e8f0;
		border-radius: 12px;
		padding: 0.875rem 1rem;
		min-width: 0;
	}

	.trivia-question-card-main {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.tq-text {
		font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
		font-size: 0.9375rem;
		font-weight: 600;
		color: #1d4d4e;
		margin: 0;
		line-height: 1.35;
	}

	.tq-options {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.tq-option {
		display: flex;
		align-items: center;
		width: 100%;
		min-height: 52px;
		padding: 0.625rem 1rem;
		border-radius: 10px;
		border: 1.5px solid #e2e8f0;
		background: white;
		cursor: pointer;
		font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
		font-size: 0.9375rem;
		color: #1d4d4e;
		text-align: left;
		transition: border-color 0.12s, background 0.12s;
	}

	.tq-option:hover {
		border-color: #2f7778;
		background: rgba(47,119,120,0.03);
	}

	.tq-option--selected {
		border-color: #2f7778;
		border-left-width: 4px;
		background: rgba(47,119,120,0.07);
		color: #1d4d4e;
		font-weight: 600;
	}

	/* ── Submit bar (sticky on mobile) ── */
	.trivia-submit-bar {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		position: sticky;
		bottom: 0;
		background: white;
		padding: 12px 0;
		border-top: 1px solid #f1f5f9;
	}

	.trivia-submit-btn {
		width: 100%;
		height: 52px;
		border-radius: 12px;
		background: #2f7778;
		border: none;
		color: white;
		font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
		font-size: 1rem;
		font-weight: 700;
		cursor: pointer;
		transition: background 0.12s;
	}

	.trivia-submit-btn:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}

	.trivia-submit-btn:not(:disabled):hover {
		background: #1d6566;
	}

	.trivia-submit-hint {
		font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
		font-size: 0.8125rem;
		color: #94a3b8;
		margin: 0;
		text-align: center;
	}

	/* ── Results ── */
	.trivia-results {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}

	.trivia-score-callout {
		display: flex;
		align-items: baseline;
		gap: 0.25rem;
		justify-content: center;
		padding: 1.5rem 1.25rem;
		background:
			radial-gradient(80% 100% at 50% 0%, rgba(122, 206, 211, 0.15) 0%, transparent 55%),
			linear-gradient(180deg, #fff 0%, #f8fafc 100%);
		border: 1.5px solid #e2e8f0;
		border-radius: 16px;
		box-shadow: 0 6px 24px rgba(29, 77, 78, 0.06);
	}

	.trivia-score-num {
		font-family: 'Fraunces', Georgia, serif;
		font-size: 4rem;
		font-weight: 900;
		color: #2f7778;
		line-height: 1;
		letter-spacing: -0.04em;
	}

	.trivia-score-denom {
		font-family: 'Fraunces', Georgia, serif;
		font-size: 1.5rem;
		font-weight: 600;
		color: #94a3b8;
	}

	.trivia-results-sub {
		font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
		font-size: 0.9375rem;
		color: #64748b;
		margin: -0.75rem 0 0;
		text-align: center;
	}

	.trivia-breakdown {
		display: flex;
		flex-direction: column;
		gap: 0.625rem;
	}

	.trivia-breakdown-card {
		background: white;
		border: 1.5px solid #e2e8f0;
		border-radius: 12px;
		padding: 0.875rem 1rem;
		display: flex;
		flex-direction: row;
		align-items: flex-start;
		gap: 0.5rem;
	}

	.trivia-breakdown-card-main {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.trivia-breakdown-card--correct {
		border-color: rgba(29,158,117,0.35);
		background: rgba(29,158,117,0.04);
	}

	.trivia-breakdown-card--wrong {
		border-color: rgba(239,68,68,0.25);
		background: rgba(239,68,68,0.03);
	}

	.tbc-q {
		font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
		font-size: 0.9375rem;
		font-weight: 600;
		color: #1d4d4e;
		margin: 0;
	}

	.tbc-answer {
		font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
		font-size: 0.8125rem;
		margin: 0;
	}

	.tbc-answer--correct { color: #1D9E75; font-weight: 600; }
	.tbc-answer--wrong   { color: #ef4444; }

	.trivia-host-stats {
		padding: 1rem 1.125rem;
		background: linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%);
		border: 1px solid #e2e8f0;
		border-radius: 14px;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

</style>
