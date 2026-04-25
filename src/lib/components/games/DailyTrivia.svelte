<script lang="ts">
	import {
		getTriviaQuestions,
		addTriviaQuestion,
		updateTriviaQuestion,
		reorderTriviaQuestions,
		getTriviaGameHasSubmissions,
		getTriviaGamePublished,
		setTriviaGamePublished,
		submitAllTriviaAnswers,
		getTriviaAnswersForUser,
		type TriviaQuestion,
		type TriviaOption,
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

	// Host: question form
	let showAddForm    = $state(false);
	let addForm = $state({ question: '', options: ['', '', ''], correctIndex: 0 });
	let editStates = $state<Record<string, { question: string; options: string[]; correctIndex: number }>>({});
	let draggedIndex   = $state<number | null>(null);

	// Guest: pending answers (before submit)
	let pending = $state<Record<string, number>>({});
	let submitted = $state(false);

	// Mobile: add-form bottom sheet
	let showAddSheet = $state(false);

	function refresh() {
		questions  = getTriviaQuestions(tripId, tripGameId);
		answers    = getTriviaAnswersForUser(tripId, tripGameId, userId);
		published  = getTriviaGamePublished(tripId, tripGameId);
		canEdit    = !getTriviaGameHasSubmissions(tripId, tripGameId);

		// Populate edit states for any new questions
		const next = { ...editStates };
		let changed = false;
		for (const q of questions) {
			if (!(q.id in next)) {
				const texts = q.options.map((o) => o.text);
				next[q.id] = {
					question: q.question,
					options: texts.length >= 2 ? texts : [...texts, '', ''].slice(0, 2),
					correctIndex: Math.max(0, q.options.findIndex((o) => o.correct)),
				};
				changed = true;
			}
		}
		if (changed) editStates = next;
	}

	$effect(() => {
		if (typeof window !== 'undefined') refresh();
	});

	// ── Host actions ──────────────────────────────────────────────────────────
	function submitAdd() {
		const opts: TriviaOption[] = addForm.options
			.map((text, i) => ({ text: text.trim(), correct: i === addForm.correctIndex }))
			.filter((o) => o.text !== '');
		if (!addForm.question.trim() || opts.length < 2) return;
		addTriviaQuestion(tripId, tripGameId, { question: addForm.question.trim(), options: opts });
		addForm = { question: '', options: ['', '', ''], correctIndex: 0 };
		showAddForm = false;
		showAddSheet = false;
		refresh();
	}

	function saveEdit(qId: string) {
		const form = editStates[qId];
		if (!form) return;
		const opts: TriviaOption[] = form.options
			.map((text, i) => ({ text: text.trim(), correct: i === form.correctIndex }))
			.filter((o) => o.text !== '');
		if (!form.question.trim() || opts.length < 2) return;
		updateTriviaQuestion(tripId, tripGameId, qId, { question: form.question.trim(), options: opts });
		refresh();
	}

	function moveQuestion(fromIdx: number, toIdx: number) {
		if (!canEdit || fromIdx === toIdx) return;
		const ids = questions.map((q) => q.id);
		const [removed] = ids.splice(fromIdx, 1);
		ids.splice(toIdx, 0, removed);
		reorderTriviaQuestions(tripId, tripGameId, ids);
		refresh();
	}

	function publishGame() {
		if (!isHostOfGame || !canEdit || questions.length === 0) return;
		setTriviaGamePublished(tripId, tripGameId);
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
</script>

<div class="trivia-wrap">
	{#if isHostOfGame}
		<!-- ── Host view ──────────────────────────────────────────────── -->
		<div class="trivia-host">
			<div class="trivia-host-header">
				<span class="game-master-badge">Game Master ✦</span>
				{#if published}
					<span class="trivia-published-pill">Published · guests can play</span>
				{/if}
			</div>

			<div class="trivia-host-body">
				<!-- Question list -->
				<div class="trivia-q-list">
					{#if questions.length === 0}
						<div class="trivia-empty">
							<p>No questions yet. Add your first one below.</p>
						</div>
					{:else}
						{#each questions as q, i}
							{@const isEditing = !!editStates[q.id]}
							{@const form = editStates[q.id]}
							<div
								class="trivia-q-row"
								class:trivia-q-row--dragging={draggedIndex === i}
								draggable={canEdit}
								role="listitem"
								ondragstart={(e) => onDragStart(e, i)}
								ondragover={onDragOver}
								ondrop={(e) => onDrop(e, i)}
								ondragend={onDragEnd}
							>
								{#if canEdit}
									<span class="trivia-drag-handle" aria-hidden="true">⠿</span>
								{/if}
								<div class="trivia-q-content">
									{#if isEditing && canEdit && form}
										<!-- Inline edit -->
										<textarea
											class="trivia-q-input"
											rows="2"
											bind:value={form.question}
											placeholder="Question text"
										></textarea>
										<div class="trivia-opts-edit">
											{#each form.options as _, j}
												<label class="trivia-opt-row">
													<input
														type="radio"
														name="correct-{q.id}"
														checked={form.correctIndex === j}
														onchange={() => { form.correctIndex = j; }}
													/>
													<input
														type="text"
														class="trivia-opt-input"
														placeholder="Option {j + 1}"
														bind:value={form.options[j]}
													/>
													{#if form.options.length > 2}
														<button
															type="button"
															class="trivia-opt-remove"
															aria-label="Remove option"
															onclick={() => {
																form.options = form.options.filter((_, idx) => idx !== j);
																if (form.correctIndex >= form.options.length)
																	form.correctIndex = Math.max(0, form.options.length - 1);
																else if (j < form.correctIndex) form.correctIndex -= 1;
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
												onclick={() => { form.options = [...form.options, '']; }}
											>+ Option</button>
											<button type="button" class="trivia-btn trivia-btn-save" onclick={() => saveEdit(q.id)}>Save</button>
										</div>
									{:else}
										<p class="trivia-q-text">{q.question}</p>
										<div class="trivia-q-meta">
											<span class="trivia-q-opts-count">{q.options.length} options</span>
											<span class="trivia-q-correct">
												✓ {q.options.find((o) => o.correct)?.text ?? '—'}
											</span>
										</div>
									{/if}
								</div>
								<!-- Mobile up/down (touch-friendly reorder) -->
								{#if canEdit}
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
								{/if}
							</div>
						{/each}
					{/if}

					{#if canEdit}
						<button
							type="button"
							class="trivia-add-btn"
							onclick={() => { showAddForm = true; showAddSheet = true; }}
						>
							+ Add question
						</button>
					{/if}
				</div>

				<!-- Publish -->
				{#if canEdit && questions.length > 0 && !published}
					<div class="trivia-publish-row">
						<p class="trivia-publish-warn">Publishing locks the questions. Guests will be able to answer.</p>
						<button type="button" class="trivia-btn trivia-btn-publish" onclick={publishGame}>
							Publish →
						</button>
					</div>
				{/if}

				{#if published}
					<div class="trivia-host-stats">
						<!-- TODO: wire to API — show per-question guest answer progress -->
						<p class="trivia-hint">Game is live. Guests can answer now.</p>
					</div>
				{/if}
			</div>

			<!-- Add-question bottom sheet (mobile) / inline (desktop) -->
			{#if showAddForm}
				<div class="sheet-backdrop" role="presentation" onclick={() => { showAddForm = false; showAddSheet = false; }}></div>
				<div class="add-sheet" role="dialog" aria-modal="true" aria-label="Add question">
					<div class="add-sheet-handle" aria-hidden="true"></div>
					<h3 class="add-sheet-title">Add a question</h3>
					<label class="trivia-label">Question</label>
					<textarea
						class="trivia-q-input"
						rows="2"
						placeholder="e.g. What's our host's middle name?"
						bind:value={addForm.question}
					></textarea>
					<label class="trivia-label">Answer choices <span class="trivia-label-hint">(mark the correct one)</span></label>
					<div class="trivia-opts-edit">
						{#each addForm.options as _, i}
							<label class="trivia-opt-row">
								<input
									type="radio"
									name="add-correct"
									checked={addForm.correctIndex === i}
									onchange={() => { addForm.correctIndex = i; }}
								/>
								<input
									type="text"
									class="trivia-opt-input"
									placeholder="Option {i + 1}"
									bind:value={addForm.options[i]}
								/>
								{#if addForm.options.length > 2}
									<button
										type="button"
										class="trivia-opt-remove"
										aria-label="Remove option"
										onclick={() => {
											addForm.options = addForm.options.filter((_, idx) => idx !== i);
											if (addForm.correctIndex >= addForm.options.length)
												addForm.correctIndex = Math.max(0, addForm.options.length - 1);
											else if (i < addForm.correctIndex) addForm.correctIndex -= 1;
										}}
									>×</button>
								{/if}
							</label>
						{/each}
					</div>
					<button
						type="button"
						class="trivia-btn trivia-btn-ghost"
						onclick={() => { addForm.options = [...addForm.options, '']; }}
					>+ Add option</button>
					<div class="add-sheet-footer">
						<button type="button" class="trivia-btn trivia-btn-publish" onclick={submitAdd}>
							Save question
						</button>
					</div>
				</div>
			{/if}
		</div>

	{:else}
		<!-- ── Guest view ─────────────────────────────────────────────── -->
		{#if !published}
			<div class="trivia-holding">
				<p class="trivia-holding-text">The game master is still setting up questions. Check back soon!</p>
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
					{#each questions as q}
						{@const ans = answers[q.id]}
						{@const correct = ans?.correct}
						{@const chosen = ans !== undefined ? q.options[ans.answerIndex]?.text : null}
						{@const rightOption = q.options.find((o) => o.correct)?.text}
						<div class="trivia-breakdown-card" class:trivia-breakdown-card--correct={correct} class:trivia-breakdown-card--wrong={!correct && ans !== undefined}>
							<p class="tbc-q">{q.question}</p>
							<p class="tbc-answer tbc-answer--correct">✓ {rightOption}</p>
							{#if !correct && chosen}
								<p class="tbc-answer tbc-answer--wrong">✗ You said: {chosen}</p>
							{/if}
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
							<p class="tq-num">Question {i + 1} of {questions.length}</p>
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
	{/if}
</div>

<style>
	.trivia-wrap {
		max-width: 640px;
		min-width: 0;
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

	.trivia-empty {
		padding: 1.25rem;
		background: #f8fafc;
		border-radius: 12px;
		text-align: center;
		font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
		font-size: 0.875rem;
		color: #64748b;
	}

	.trivia-empty p { margin: 0; }

	.trivia-q-row {
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

	.trivia-q-row--dragging {
		opacity: 0.55;
		cursor: grabbing;
	}

	.trivia-q-row:not([draggable='true']) {
		cursor: default;
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
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
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
		gap: 0.5rem;
		margin-top: 0.25rem;
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

	.trivia-btn-save {
		background: #2f7778;
		border-color: #2f7778;
		color: white;
	}

	.trivia-btn-save:hover {
		background: #1d6566;
	}

	.trivia-btn-publish {
		background: #2f7778;
		border-color: #2f7778;
		color: white;
		width: 100%;
		height: 52px;
		font-size: 1rem;
	}

	.trivia-btn-publish:hover {
		background: #1d6566;
	}

	/* ── Add button ── */
	.trivia-add-btn {
		width: 100%;
		height: 48px;
		border: 1.5px dashed #cbd5e1;
		background: white;
		border-radius: 12px;
		font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
		font-size: 0.9375rem;
		font-weight: 600;
		color: #2f7778;
		cursor: pointer;
		transition: border-color 0.12s, background 0.12s;
	}

	.trivia-add-btn:hover {
		border-color: #2f7778;
		background: rgba(47,119,120,0.04);
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

	/* ── Add sheet (bottom sheet / modal) ── */
	.sheet-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0,0,0,0.4);
		z-index: 200;
	}

	.add-sheet {
		position: fixed;
		bottom: 0;
		left: 0;
		right: 0;
		z-index: 201;
		background: white;
		border-radius: 16px 16px 0 0;
		box-shadow: 0 -4px 24px rgba(0,0,0,0.08);
		padding: 0 16px 32px;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		max-height: 90vh;
		overflow-y: auto;
		animation: sheet-up 0.2s ease-out;
	}

	@keyframes sheet-up {
		from { transform: translateY(100%); }
		to   { transform: translateY(0); }
	}

	.add-sheet-handle {
		width: 32px;
		height: 4px;
		background: #d1d5db;
		border-radius: 999px;
		margin: 10px auto 2px;
		flex-shrink: 0;
	}

	.add-sheet-title {
		font-family: 'Fraunces', Georgia, serif;
		font-size: 1.125rem;
		font-weight: 700;
		color: #1d4d4e;
		margin: 0;
	}

	.add-sheet-footer {
		position: sticky;
		bottom: 0;
		padding-top: 0.75rem;
		background: white;
	}

	.trivia-label {
		font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
		font-size: 0.8125rem;
		font-weight: 600;
		color: #1d4d4e;
	}

	.trivia-label-hint {
		font-weight: 400;
		color: #64748b;
	}

	.trivia-hint {
		font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
		font-size: 0.8125rem;
		color: #94a3b8;
		margin: 0;
	}

	/* ── Guest: holding ── */
	.trivia-holding {
		background: #f8fafc;
		border-radius: 14px;
		padding: 2rem 1.5rem;
		text-align: center;
	}

	.trivia-holding-text {
		font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
		font-size: 0.9375rem;
		color: #64748b;
		margin: 0;
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
		gap: 1rem;
	}

	.trivia-question-card {
		background: white;
		border: 1.5px solid #e2e8f0;
		border-radius: 14px;
		padding: 1.125rem 1.25rem;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.tq-num {
		font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.07em;
		color: #94a3b8;
		margin: 0;
	}

	.tq-text {
		font-family: 'Fraunces', Georgia, serif;
		font-size: 1.0625rem;
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
		padding: 1.5rem;
		background: white;
		border: 1.5px solid #e2e8f0;
		border-radius: 16px;
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
		padding: 0.75rem 1rem;
		background: #f8fafc;
		border-radius: 10px;
	}

	/* ── Desktop: add sheet becomes a dialog ── */
	@media (min-width: 640px) {
		.add-sheet {
			position: fixed;
			bottom: auto;
			left: 50%;
			top: 50%;
			transform: translate(-50%, -50%);
			right: auto;
			width: 440px;
			border-radius: 16px;
			max-height: 80vh;
			animation: sheet-scale 0.18s ease-out;
		}

		@keyframes sheet-scale {
			from { opacity: 0; transform: translate(-50%, -50%) scale(0.96); }
			to   { opacity: 1; transform: translate(-50%, -50%) scale(1); }
		}

		/* On desktop, hide up/down arrows — drag handles are sufficient */
		.trivia-reorder-btns {
			display: none;
		}
	}
</style>
