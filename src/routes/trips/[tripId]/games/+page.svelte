<script lang="ts">
	import { goto } from '$app/navigation';
	import type { PageData } from './$types';
	import type { GameId, TripGame, TriviaQuestion } from '$lib/stores/tripGames.js';
	import {
		GAME_DEFS,
		getTripGames,
		addTripGame,
		removeTripGame,
		getJoinedGames,
		joinGame,
		getUnderstoodGames,
		markUnderstood,
		purgeRemovedGamesDataIfTripEnded,
		getTriviaQuestions,
		addTriviaQuestion,
		updateTriviaQuestion,
		reorderTriviaQuestions,
		getTriviaGameHasSubmissions,
		getTriviaGamePublished,
		setTriviaGamePublished,
		submitAllTriviaAnswers,
		getTriviaAnswer,
		getTriviaAnswersForUser
	} from '$lib/stores/tripGames.js';

	let { data }: { data: PageData } = $props();

	const tripId = $derived(data.trip?.id ?? '');
	const userId = $derived(data.user?.id ?? '');
	const canRemoveGames = $derived(data.canRemoveGames ?? false);
	const tabParam = $derived(data.tabParam ?? null);
	const checkOutDate = $derived(data.trip?.checkOutDate ?? null);

	// Reactive state - re-read from sessionStorage when component mounts or when we trigger refresh
	let tripGames = $state<TripGame[]>([]);
	let joinedIds = $state<Set<string>>(new Set());
	let understoodIds = $state<Set<string>>(new Set());

	function refresh() {
		tripGames = getTripGames(tripId);
		joinedIds = getJoinedGames(tripId, userId);
		understoodIds = getUnderstoodGames(tripId, userId);
	}

	$effect(() => {
		if (tripId && userId) refresh();
	});

	// When trip has ended, purge sessionStorage for any games that were removed from this trip
	$effect(() => {
		if (tripId && checkOutDate) purgeRemovedGamesDataIfTripEnded(tripId, checkOutDate);
	});

	// Sync active tab from URL (?tab=tripGameId)
	$effect(() => {
		if (!tabParam || !tripGames.length) return;
		const match = tripGames.find((g) => g.id === tabParam);
		if (match) activeTabId = match.id;
	});

	// When no tab selected but we have games, default to first
	$effect(() => {
		if (tripGames.length > 0 && !activeTabId) activeTabId = tripGames[0].id;
	});

	// Modals
	let addConfirmGame = $state<{ gameId: GameId; name: string } | null>(null);
	let joinConfirmGame = $state<TripGame | null>(null);
	let instructionsGame = $state<TripGame | null>(null);

	// Carousel / active tab
	let activeTabId = $state<string | null>(null);

	// Alphabet Hunt: progress = number of letters completed (0 = next is A, 26 = all done). Persisted per trip/game/user.
	const ALPHABET_STORAGE_KEY = (tId: string, tgId: string, uId: string) =>
		`trip-games-alphabet-${tId}-${tgId}-${uId}`;
	function getAlphabetProgress(tId: string, tgId: string, uId: string): number {
		if (typeof window === 'undefined') return 0;
		const raw = sessionStorage.getItem(ALPHABET_STORAGE_KEY(tId, tgId, uId));
		const n = raw ? parseInt(raw, 10) : 0;
		return Number.isFinite(n) && n >= 0 && n <= 26 ? n : 0;
	}
	function setAlphabetProgress(tId: string, tgId: string, uId: string, value: number) {
		if (typeof window === 'undefined') return;
		sessionStorage.setItem(ALPHABET_STORAGE_KEY(tId, tgId, uId), String(Math.max(0, Math.min(26, value))));
	}

	let alphabetProgress = $state(0);
	$effect(() => {
		if (activeTabId && userId && tripId) {
			const game = tripGames.find((g) => g.id === activeTabId);
			if (game?.gameId === 'alphabet-hunt') {
				alphabetProgress = getAlphabetProgress(tripId, game.id, userId);
			}
		}
	});
	function advanceAlphabetLetter() {
		if (!activeTabId || !userId || !tripId) return;
		const game = tripGames.find((g) => g.id === activeTabId);
		if (game?.gameId !== 'alphabet-hunt' || alphabetProgress >= 26) return;
		alphabetProgress += 1;
		setAlphabetProgress(tripId, game.id, userId, alphabetProgress);
	}

	// Daily Trivia: left = question list (reorderable until someone submits), right = Q&A carousel; submit all at once
	let triviaQuestions = $state<TriviaQuestion[]>([]);
	let triviaAnswers = $state<Record<string, { answerIndex: number; correct: boolean }>>({});
	let triviaForm = $state({ question: '', options: ['', ''], correctIndex: 0 });
	let triviaEditState = $state<Record<string, { question: string; options: string[]; correctIndex: number }>>({});
	let triviaCarouselIndex = $state(0);
	let triviaPendingAnswers = $state<Record<string, number>>({});
	let triviaDraggedIndex = $state<number | null>(null);
	let triviaShowAddForm = $state(false);
	let triviaPublished = $state(false);
	let previousActiveTabId = $state<string | null>(null);

	$effect(() => {
		if (tripId && activeTabId && userId) {
			const game = tripGames.find((g) => g.id === activeTabId);
			const prevGame = previousActiveTabId ? tripGames.find((g) => g.id === previousActiveTabId) : null;
			if (prevGame?.gameId === 'daily-trivia' && previousActiveTabId !== activeTabId) {
				saveTriviaQuestionForGame(tripId, previousActiveTabId, triviaCarouselIndex);
			}
			previousActiveTabId = activeTabId;
			if (game?.gameId === 'daily-trivia') {
				triviaQuestions = getTriviaQuestions(tripId, game.id);
				triviaAnswers = getTriviaAnswersForUser(tripId, game.id, userId);
				triviaPublished = getTriviaGamePublished(tripId, game.id);
				triviaCarouselIndex = 0;
				triviaShowAddForm = false;
			}
		}
	});
	$effect(() => {
		const trip = tripId;
		const tab = activeTabId;
		const idx = triviaCarouselIndex;
		const state = triviaEditState;
		const games = tripGames;
		return () => {
			if (trip && tab && games) {
				const game = games.find((g) => g.id === tab);
				if (game?.gameId === 'daily-trivia') {
					const qs = getTriviaQuestions(trip, game.id);
					const q = qs[idx];
					if (q && state[q.id]) {
						const form = state[q.id];
						const opts = form.options
							.map((text: string, i: number) => ({ text: text.trim(), correct: i === form.correctIndex }))
							.filter((o) => o.text !== '');
						if (form.question.trim() !== '' && opts.length >= 2) {
							updateTriviaQuestion(trip, game.id, q.id, {
								question: form.question.trim(),
								options: opts
							});
						}
					}
				}
			}
		};
	});
	$effect(() => {
		const max = Math.max(0, triviaQuestions.length - 1);
		if (triviaCarouselIndex > max) triviaCarouselIndex = max;
	});
	$effect(() => {
		const qs = triviaQuestions;
		const next = { ...triviaEditState };
		let changed = false;
		for (const q of qs) {
			if (!(q.id in next)) {
				const optionTexts = q.options.map((o) => o.text);
				next[q.id] = {
					question: q.question,
					options: optionTexts.length >= 2 ? optionTexts : [...optionTexts, '', ''].slice(0, 2),
					correctIndex: Math.max(0, q.options.findIndex((o) => o.correct))
				};
				changed = true;
			}
		}
		if (changed) triviaEditState = next;
	});

	const isTriviaHost = $derived(
		!!(activeTabId && userId && tripGames.find((g) => g.id === activeTabId)?.addedByUserId === userId)
	);
	const triviaCanEdit = $derived(
		!!(tripId && activeTabId && !getTriviaGameHasSubmissions(tripId, tripGames.find((g) => g.id === activeTabId)?.id ?? ''))
	);
	const triviaScore = $derived(
		Object.values(triviaAnswers).filter((a) => a.correct).length
	);
	const triviaCurrentQuestion = $derived(triviaQuestions[triviaCarouselIndex] ?? null);
	const triviaCanSubmitAll = $derived(
		triviaQuestions.length > 0 &&
		triviaQuestions.every((q) => triviaPendingAnswers[q.id] !== undefined)
	);

	function refreshTriviaQuestions() {
		if (!tripId || !activeTabId) return;
		const game = tripGames.find((g) => g.id === activeTabId);
		if (game?.gameId === 'daily-trivia') {
			triviaQuestions = getTriviaQuestions(tripId, game.id);
			if (userId) triviaAnswers = getTriviaAnswersForUser(tripId, game.id, userId);
		}
	}

	function addTriviaQuestionSubmit() {
		if (!tripId || !activeTabId || !userId || !triviaCanEdit) return;
		const game = tripGames.find((g) => g.id === activeTabId);
		if (game?.gameId !== 'daily-trivia') return;
		const opts = triviaForm.options.map((t) => t.trim()).filter((t) => t !== '');
		if (triviaForm.question.trim() === '' || opts.length < 2) return;
		addTriviaQuestion(tripId, game.id, {
			question: triviaForm.question.trim(),
			options: triviaForm.options
				.map((text, i) => ({ text: text.trim(), correct: i === triviaForm.correctIndex }))
				.filter((o) => o.text !== '')
		});
		triviaForm = { question: '', options: ['', ''], correctIndex: 0 };
		triviaShowAddForm = false;
		refreshTriviaQuestions();
	}
	function saveTriviaQuestion(questionId: string) {
		if (!tripId || !activeTabId || !triviaCanEdit) return;
		const game = tripGames.find((g) => g.id === activeTabId);
		if (game?.gameId !== 'daily-trivia') return;
		const form = triviaEditState[questionId];
		if (!form) return;
		const opts = form.options
			.map((text, i) => ({ text: text.trim(), correct: i === form.correctIndex }))
			.filter((o) => o.text !== '');
		if (form.question.trim() === '' || opts.length < 2) return;
		updateTriviaQuestion(tripId, game.id, questionId, {
			question: form.question.trim(),
			options: opts
		});
	}
	function saveCurrentTriviaQuestion() {
		if (!isTriviaHost || !triviaCanEdit || triviaQuestions.length === 0) return;
		const q = triviaQuestions[triviaCarouselIndex];
		if (q) saveTriviaQuestion(q.id);
	}
	function saveTriviaQuestionForGame(tripIdParam: string, gameId: string, carouselIndex: number) {
		const qs = getTriviaQuestions(tripIdParam, gameId);
		const q = qs[carouselIndex];
		if (!q) return;
		const form = triviaEditState[q.id];
		if (!form) return;
		const opts = form.options
			.map((text, i) => ({ text: text.trim(), correct: i === form.correctIndex }))
			.filter((o) => o.text !== '');
		if (form.question.trim() === '' || opts.length < 2) return;
		updateTriviaQuestion(tripIdParam, gameId, q.id, {
			question: form.question.trim(),
			options: opts
		});
	}
	function triviaPublish() {
		if (!tripId || !activeTabId || !isTriviaHost) return;
		const game = tripGames.find((g) => g.id === activeTabId);
		if (game?.gameId !== 'daily-trivia') return;
		setTriviaGamePublished(tripId, game.id);
		triviaPublished = true;
	}

	function triviaCarouselPrev() {
		saveCurrentTriviaQuestion();
		if (triviaCarouselIndex > 0) triviaCarouselIndex -= 1;
	}
	function triviaCarouselNext() {
		saveCurrentTriviaQuestion();
		if (triviaCarouselIndex < triviaQuestions.length) triviaCarouselIndex += 1;
	}
	function triviaSetPending(questionId: string, optionIndex: number) {
		triviaPendingAnswers = { ...triviaPendingAnswers, [questionId]: optionIndex };
	}
	function triviaSubmitAll() {
		if (!tripId || !activeTabId || !userId || !triviaCanSubmitAll) return;
		const game = tripGames.find((g) => g.id === activeTabId);
		if (game?.gameId !== 'daily-trivia') return;
		submitAllTriviaAnswers(tripId, game.id, userId, triviaPendingAnswers);
		triviaAnswers = getTriviaAnswersForUser(tripId, game.id, userId);
		triviaPendingAnswers = {};
		refreshTriviaQuestions();
	}

	function triviaDragStart(e: DragEvent, index: number) {
		triviaDraggedIndex = index;
		if (e.dataTransfer) {
			e.dataTransfer.effectAllowed = 'move';
			e.dataTransfer.setData('text/plain', String(index));
		}
	}
	function triviaDragOver(e: DragEvent) {
		e.preventDefault();
		if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
	}
	function triviaDrop(e: DragEvent, toIndex: number) {
		e.preventDefault();
		const fromIndex = triviaDraggedIndex ?? (e.dataTransfer?.getData('text/plain') ? parseInt(e.dataTransfer.getData('text/plain'), 10) : null);
		triviaDraggedIndex = null;
		if (fromIndex === null || fromIndex === toIndex) return;
		const game = tripGames.find((g) => g.id === activeTabId);
		if (!tripId || !game || game.gameId !== 'daily-trivia' || !triviaCanEdit) return;
		const ids = triviaQuestions.map((q) => q.id);
		const [removed] = ids.splice(fromIndex, 1);
		ids.splice(toIndex, 0, removed);
		reorderTriviaQuestions(tripId, game.id, ids);
		triviaQuestions = getTriviaQuestions(tripId, game.id);
		triviaCarouselIndex = toIndex;
	}
	function triviaDragEnd() {
		triviaDraggedIndex = null;
	}

	const unjoinedGames = $derived(tripGames.filter((g) => !joinedIds.has(g.id)));
	const unjoinedByOthers = $derived(unjoinedGames.filter((g) => g.addedByUserId !== userId));

	// When user lands on page with unjoined games (added by others), prompt to join the first one
	let hasShownJoinPrompt = $state(false);
	$effect(() => {
		if (hasShownJoinPrompt || !unjoinedByOthers.length || joinConfirmGame || instructionsGame) return;
		joinConfirmGame = unjoinedByOthers[0] ?? null;
		hasShownJoinPrompt = true;
	});

	function getGameDef(gameId: GameId) {
		return GAME_DEFS.find((d) => d.id === gameId) ?? GAME_DEFS[0];
	}

	function handleAddGame(gameId: GameId) {
		const def = getGameDef(gameId);
		addConfirmGame = { gameId, name: def.name };
	}

	function confirmAddGame() {
		if (!addConfirmGame || !userId) return;
		const def = getGameDef(addConfirmGame.gameId);
		const added = addTripGame(tripId, {
			gameId: addConfirmGame.gameId,
			name: def.name,
			addedByUserId: userId
		});
		joinGame(tripId, userId, added.id); // adder auto-joins
		refresh();
		addConfirmGame = null;
		setActiveTabAndUrl(added.id);
	}

	function cancelAddGame() {
		addConfirmGame = null;
	}

	function confirmJoinGameAction() {
		const g = joinConfirmGame;
		if (!g) return;
		joinGame(tripId, userId, g.id);
		refresh();
		joinConfirmGame = null;
		activeTabId = g.id;
		if (tripId) goto(`/trips/${tripId}/games?tab=${g.id}`, { replaceState: true });
		instructionsGame = g;
	}

	function cancelJoinGame() {
		joinConfirmGame = null;
	}

	function confirmUnderstand() {
		if (!instructionsGame) return;
		markUnderstood(tripId, userId, instructionsGame.id);
		refresh();
		instructionsGame = null;
	}

	function setActiveTabAndUrl(tgId: string) {
		activeTabId = tgId;
		if (tripId) goto(`/trips/${tripId}/games?tab=${tgId}`, { replaceState: true });
	}

	function handleTabClick(tg: TripGame) {
		if (!joinedIds.has(tg.id)) {
			joinConfirmGame = tg;
			return;
		}
		if (!understoodIds.has(tg.id)) {
			instructionsGame = tg;
			return;
		}
		setActiveTabAndUrl(tg.id);
	}

	/** When user clicks an already-added game card, show that game in the viewer (or prompt join/instructions). */
	function openGameInViewer(tg: TripGame) {
		handleTabClick(tg);
		// Scroll to viewer so they see the game (after a tick so content has updated)
		setTimeout(() => document.getElementById('game-viewer')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150);
	}

	function handleRemoveGame(e: Event, tg: TripGame) {
		e.stopPropagation();
		if (!canRemoveGames) return;
		const message = `Remove ${tg.name} from the trip? Game data will be permanently deleted after the trip ends. If you remove it by accident, you can add the game again before the trip is over.`;
		if (confirm(message)) {
			removeTripGame(tripId, tg.id);
			refresh();
			const next = getTripGames(tripId)[0];
			if (activeTabId === tg.id) {
				activeTabId = next?.id ?? null;
				if (tripId) goto(next ? `/trips/${tripId}/games?tab=${next.id}` : `/trips/${tripId}/games`, { replaceState: true });
			}
		}
	}

	// Scavenger bingo placeholder squares (fake for now - you'll provide the real list)
	const BINGO_SQUARES = [
		'Sunset selfie',
		'Pool float',
		'Beach towel',
		'Someone napping',
		'Local snack',
		'Palm tree',
		'Souvenir shop',
		'Someone dancing',
		'Hotel key card',
		'Empty suitcase',
		'Room key',
		'View from balcony',
		'Breakfast buffet',
		'Beach umbrella',
		'Flip flops',
		'Someone snorkeling',
		'Cocktail with umbrella',
		'Flight boarding pass',
		'Sunburn',
		'Group selfie',
		'Local wildlife',
		'Street sign',
		'Sunrise',
		'Packed luggage',
		'Vacation mode'
	];
</script>

<div class="page">
	<!-- Game selection grid (available to add) -->
	<section class="section">
		<h2 class="section-title">Add a game</h2>
		<p class="section-subtitle">Click a game to add it to the trip. All attendees will be notified.</p>
		<div class="games-grid">
			{#each GAME_DEFS as def}
				{@const tripGame = tripGames.find((g) => g.gameId === def.id)}
				{@const alreadyAdded = !!tripGame}
				<button
					type="button"
					class="game-card"
					class:is-added={alreadyAdded}
					disabled={false}
					onclick={() => alreadyAdded && tripGame ? openGameInViewer(tripGame) : handleAddGame(def.id)}
					title={alreadyAdded ? `View ${def.name}` : `Add ${def.name}`}
				>
					{#if alreadyAdded}
						<span class="game-added">Added</span>
						{#if canRemoveGames && tripGame}
							<button
								type="button"
								class="game-card-remove"
								aria-label="Remove {def.name} from trip"
								onclick={(e) => { e.stopPropagation(); handleRemoveGame(e, tripGame); }}
							>
								<svg class="trash-icon" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
							</button>
						{/if}
					{/if}
					<span class="game-icon">{def.icon}</span>
					<span class="game-name">{def.name}</span>
					<span class="game-desc">{def.description}</span>
				</button>
			{/each}
		</div>
	</section>

	<!-- Game viewer: full-width content below (tab from URL or first game) -->
	{#if tripGames.length > 0}
		<section class="section game-viewer-section" id="game-viewer">
			<div class="game-viewer">
				<div class="game-viewer-pages">
					{#if activeTabId}
						{@const activeGame = tripGames.find((g) => g.id === activeTabId)}
						{#if activeGame}
							{@const canView = joinedIds.has(activeGame.id) && understoodIds.has(activeGame.id)}
							{#if canView}
								<div class="game-page" role="tabpanel">
									{#if !(activeGame.gameId === 'daily-trivia' && isTriviaHost && !triviaPublished)}
										<!-- Leaderboard (placeholder until we have real data) -->
										<div class="game-leaderboard">
											<h3 class="game-section-title">Leaderboard</h3>
											<ul class="leaderboard-list">
												<li class="leaderboard-row"><span class="rank">1</span><span class="name">—</span><span class="score">—</span></li>
												<li class="leaderboard-row"><span class="rank">2</span><span class="name">—</span><span class="score">—</span></li>
												<li class="leaderboard-row"><span class="rank">3</span><span class="name">—</span><span class="score">—</span></li>
											</ul>
											<p class="leaderboard-empty">No scores yet. Play to get on the board!</p>
										</div>
									{/if}

									<!-- Game options + main content (Daily Trivia: left = questions list, right = carousel) -->
									<div class="game-options-and-content {activeGame.gameId === 'daily-trivia' ? 'trivia-layout' : ''}">
										<div class="game-options {activeGame.gameId === 'daily-trivia' ? 'trivia-questions-sidebar' : ''}">
											{#if activeGame.gameId === 'daily-trivia'}
												<h3 class="game-section-title">Questions | drag to reorder</h3>
												{#if triviaQuestions.length > 0}
													<div class="trivia-q-list">
														{#each triviaQuestions as q, i}
															<div
																class="trivia-q-item trivia-q-card"
																class:draggable={triviaCanEdit}
																class:dragging={triviaDraggedIndex === i}
																draggable={triviaCanEdit}
																role="button"
																tabindex="0"
																onclick={() => triviaCarouselIndex = i}
																ondragstart={(e) => triviaDragStart(e, i)}
																ondragover={triviaDragOver}
																ondrop={(e) => triviaDrop(e, i)}
																ondragend={triviaDragEnd}
															>
																{#if triviaCanEdit}
																	<span class="trivia-q-drag" aria-hidden="true">&#8942;&#8942;</span>
																{/if}
																<span class="trivia-q-text">{q.question}</span>
															</div>
														{/each}
													</div>
												{:else}
													<p class="game-option-hint">No questions yet. Add one in the panel to the right.</p>
												{/if}
												{#if isTriviaHost && !triviaCanEdit}
													<p class="game-option-hint">Someone has submitted — questions are locked.</p>
												{/if}
												{#if !isTriviaHost && triviaQuestions.length > 0 && Object.keys(triviaAnswers).length > 0}
													<p class="game-option-hint trivia-score">You got <strong>{triviaScore}</strong> of <strong>{triviaQuestions.length}</strong> correct.</p>
												{/if}
											{:else}
												<h3 class="game-section-title">What you can do</h3>
												{#if activeGame.gameId === 'scavenger-bingo'}
												<button type="button" class="game-action-btn" disabled>Add a photo to a square</button>
												<p class="game-option-hint">Snap a photo that matches a square, then tap the square to attach it.</p>
											{:else if activeGame.gameId === 'caption-this'}
												<button type="button" class="game-action-btn" disabled>Add a photo to start a round</button>
												<button type="button" class="game-action-btn secondary" disabled>Submit a caption</button>
												<button type="button" class="game-action-btn secondary" disabled>Vote on captions</button>
											{:else if activeGame.gameId === 'alphabet-hunt'}
												{@const nextLetter = alphabetProgress >= 26 ? null : 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[alphabetProgress]}
												{#if nextLetter}
													<p class="game-option-hint game-option-next">Next letter: <strong>{nextLetter}</strong></p>
													<button type="button" class="game-action-btn" disabled>Add a photo for {nextLetter}</button>
													<button type="button" class="game-action-btn secondary" onclick={advanceAlphabetLetter}>Mark “{nextLetter}” done (demo)</button>
												{:else}
													<p class="game-option-hint">You’ve completed A–Z! 🎉</p>
												{/if}
												<p class="game-option-hint">You must complete letters in order. No skipping ahead!</p>
											{/if}
											{/if}
										</div>

										<div class="game-main-content {activeGame.gameId === 'daily-trivia' ? 'trivia-carousel-wrap' : ''}">
											{#if activeGame.gameId === 'scavenger-bingo'}
												<h2 class="game-page-title">Your Bingo Board</h2>
												<p class="game-page-hint">Snap photos that match each square. Get 5 in a row to win!</p>
												<div class="bingo-grid">
													{#each BINGO_SQUARES as sq}
														<div class="bingo-cell">
															<span class="bingo-label">{sq}</span>
															<span class="bingo-status">—</span>
														</div>
													{/each}
												</div>
											{:else if activeGame.gameId === 'caption-this'}
												<h2 class="game-page-title">Caption This</h2>
												<p class="game-page-hint">Upload a photo or wait for one. Submit and vote on captions!</p>
												<div class="placeholder-game">Photo and caption area (coming soon)</div>
											{:else if activeGame.gameId === 'alphabet-hunt'}
												<h2 class="game-page-title">Alphabet Hunt</h2>
												<p class="game-page-hint">Find things A–Z in order. You must complete each letter before the next. Furthest by trip end wins!</p>
												<div class="alpha-track">
													{#each 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('') as letter, i}
														{@const done = i < alphabetProgress}
														{@const current = i === alphabetProgress}
														{@const locked = i > alphabetProgress}
														<span
															class="alpha-letter"
															class:done={done}
															class:current={current}
															class:locked={locked}
															title={done ? `${letter} completed` : current ? `Next: ${letter}` : locked ? `Complete ${'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[i - 1]} first` : ''}
														>
															{#if done}✓{:else}{letter}{/if}
														</span>
													{/each}
												</div>
											{:else if activeGame.gameId === 'daily-trivia'}
												{#if !isTriviaHost && !triviaPublished}
													<div class="trivia-carousel-inner">
														<div class="trivia-slide">
															<p class="game-option-hint">The host hasn't published this quiz yet. Check back later!</p>
														</div>
													</div>
												{:else}
												<div class="trivia-carousel">
													<button type="button" class="trivia-carousel-nav trivia-carousel-prev" aria-label="Previous" disabled={triviaCarouselIndex <= 0 || triviaShowAddForm} onclick={triviaCarouselPrev}>‹</button>
													<div class="trivia-carousel-inner">
														{#if isTriviaHost && triviaCanEdit && triviaShowAddForm}
															<div class="trivia-slide">
																<div class="trivia-host-form">
																	<label class="trivia-label">Question</label>
																	<textarea class="trivia-question-input" placeholder="e.g. What year did the first iPhone launch?" bind:value={triviaForm.question} rows="2"></textarea>
																	<label class="trivia-label">Choices (choose the correct one)</label>
																	{#each triviaForm.options as _, i}
																		<label class="trivia-choice-row">
																			<input type="radio" name="trivia-correct" checked={triviaForm.correctIndex === i} onchange={() => triviaForm.correctIndex = i} />
																			<input type="text" class="trivia-option-input" placeholder="Option {i + 1}" bind:value={triviaForm.options[i]} />
																			{#if triviaForm.options.length > 2}
																				<button type="button" class="trivia-option-remove" aria-label="Remove option" onclick={() => { triviaForm.options = triviaForm.options.filter((_, idx) => idx !== i); if (triviaForm.correctIndex >= triviaForm.options.length) triviaForm.correctIndex = Math.max(0, triviaForm.options.length - 1); else if (i < triviaForm.correctIndex) triviaForm.correctIndex -= 1; }}>×</button>
																			{/if}
																		</label>
																	{/each}
																	<button type="button" class="trivia-option-add" onclick={() => { triviaForm.options = [...triviaForm.options, '']; }}>+ Add option</button>
																	<div class="trivia-form-actions">
																		<button type="button" class="game-action-btn" onclick={addTriviaQuestionSubmit}>Add question</button>
																		<button type="button" class="btn-secondary" onclick={() => triviaShowAddForm = false}>Cancel</button>
																	</div>
																</div>
															</div>
														{:else if isTriviaHost && triviaCanEdit}
															{#if triviaQuestions.length === 0}
																<div class="trivia-slide">
																	<p class="game-option-hint">Click + to add your first question.</p>
																</div>
															{:else}
																{@const q = triviaQuestions[triviaCarouselIndex]}
																{#if q && triviaEditState[q.id]}
																	{@const form = triviaEditState[q.id]}
																	<div class="trivia-slide">
																		<div class="trivia-host-form">
																			<label class="trivia-label">Question</label>
																			<textarea class="trivia-question-input" rows="2" bind:value={form.question} placeholder="Question text"></textarea>
																			<label class="trivia-label">Choices (choose the correct one)</label>
																			{#each form.options as _, j}
																				<label class="trivia-choice-row">
																					<input type="radio" name="trivia-correct-carousel-{q.id}" checked={form.correctIndex === j} onchange={() => form.correctIndex = j} />
																					<input type="text" class="trivia-option-input" placeholder="Option {j + 1}" bind:value={form.options[j]} />
																					{#if form.options.length > 2}
																						<button type="button" class="trivia-option-remove" aria-label="Remove option" onclick={() => { form.options = form.options.filter((_, idx) => idx !== j); if (form.correctIndex >= form.options.length) form.correctIndex = Math.max(0, form.options.length - 1); else if (j < form.correctIndex) form.correctIndex -= 1; }}>×</button>
																					{/if}
																				</label>
																			{/each}
																			<button type="button" class="trivia-option-add" onclick={() => { form.options = [...form.options, '']; }}>+ Add option</button>
																		</div>
																	</div>
																{/if}
															{/if}
														{:else if isTriviaHost && !triviaCanEdit}
															{@const q = triviaQuestions[triviaCarouselIndex]}
															{#if q}
																<div class="trivia-slide">
																	<p class="trivia-question-text">{q.question}</p>
																</div>
															{:else}
																<div class="trivia-slide"><p class="game-option-hint">No questions.</p></div>
															{/if}
														{:else}
															<!-- Guest: one slide per question; select answer then Submit all -->
															{#if triviaQuestions.length > 0}
																{@const q = triviaQuestions[triviaCarouselIndex]}
																{#if q}
																	<div class="trivia-slide">
																		<p class="trivia-question-text">{q.question}</p>
																		{#if triviaAnswers[q.id] !== undefined}
																			<p class="trivia-result {triviaAnswers[q.id].correct ? 'trivia-correct' : 'trivia-wrong'}">
																				{triviaAnswers[q.id].correct ? '✓ Correct!' : 'Wrong.'}
																			</p>
																		{:else}
																			<div class="trivia-options">
																				{#each q.options as opt, i}
																					<button
																						type="button"
																						class="trivia-option-btn"
																						class:selected={triviaPendingAnswers[q.id] === i}
																						onclick={() => triviaSetPending(q.id, i)}
																					>
																						{opt.text}
																					</button>
																				{/each}
																			</div>
																		{/if}
																	</div>
																{:else}
																	<div class="trivia-slide trivia-slide-submit">
																		<p class="game-page-hint">You got <strong>{triviaScore}</strong> of <strong>{triviaQuestions.length}</strong> correct.</p>
																	</div>
																{/if}
															{:else}
																<div class="trivia-slide">
																	<div class="placeholder-game">No questions yet. The host will add some soon!</div>
																</div>
															{/if}
														{/if}
													</div>
													{#if isTriviaHost && triviaCanEdit && (triviaQuestions.length === 0 || triviaCarouselIndex >= triviaQuestions.length - 1) && !triviaShowAddForm}
														<button type="button" class="trivia-carousel-nav trivia-carousel-plus" aria-label="Add question" onclick={() => { saveCurrentTriviaQuestion(); triviaShowAddForm = true; }}>+</button>
													{:else}
														<button type="button" class="trivia-carousel-nav trivia-carousel-next" aria-label="Next" disabled={triviaCarouselIndex >= Math.max(0, triviaQuestions.length - 1) || triviaShowAddForm} onclick={triviaCarouselNext}>›</button>
													{/if}
												</div>
												{#if isTriviaHost && triviaCanEdit && !triviaPublished && triviaQuestions.length > 0}
													<div class="trivia-publish-row">
														<button type="button" class="trivia-publish-btn-small" onclick={triviaPublish}>Publish</button>
													</div>
												{/if}
												{#if isTriviaHost && triviaPublished}
													<p class="game-option-hint trivia-published-badge">Published — guests can play.</p>
												{/if}
												{#if !isTriviaHost && triviaPublished && triviaQuestions.length > 0 && Object.keys(triviaAnswers).length === 0}
													<div class="trivia-submit-row">
														<button type="button" class="game-action-btn" disabled={!triviaCanSubmitAll} onclick={triviaSubmitAll}>Submit all answers</button>
														{#if !triviaCanSubmitAll}
															<p class="game-option-hint">Answer every question above, then submit.</p>
														{/if}
													</div>
												{/if}
												{/if}
											{/if}
										</div>
									</div>
								</div>
							{:else}
								<div class="game-viewer-empty">Join this game or view instructions to play.</div>
							{/if}
						{/if}
					{:else}
						<div class="game-viewer-empty">Click an added game above to view it here.</div>
					{/if}
				</div>
			</div>
		</section>
	{/if}
</div>

<!-- Add game confirmation (Daily Trivia requires host agreement) -->
{#if addConfirmGame}
	<div class="modal-backdrop" role="presentation" onclick={cancelAddGame}></div>
	<div class="modal {addConfirmGame.gameId === 'daily-trivia' ? 'modal-daily-trivia' : ''}" role="dialog" aria-labelledby="add-modal-title">
		<h2 id="add-modal-title">Add {addConfirmGame.name}?</h2>
		{#if addConfirmGame.gameId === 'daily-trivia'}
			<p class="modal-host-agreement">As the person who adds this game, you'll be the <strong>host</strong>. You'll add a list of multiple-choice questions for guests to answer each day. Do you agree to host?</p>
			<div class="modal-actions">
				<button type="button" class="btn-secondary" onclick={cancelAddGame}>Cancel</button>
				<button type="button" class="btn-primary" onclick={confirmAddGame}>I'll host & add game</button>
			</div>
		{:else}
			<p>This will alert all attendees that a game has been added to the trip.</p>
			<div class="modal-actions">
				<button type="button" class="btn-secondary" onclick={cancelAddGame}>Cancel</button>
				<button type="button" class="btn-primary" onclick={confirmAddGame}>Add game</button>
			</div>
		{/if}
	</div>
{/if}

<!-- Join game confirmation -->
{#if joinConfirmGame}
	<div class="modal-backdrop" role="presentation" onclick={cancelJoinGame}></div>
	<div class="modal" role="dialog" aria-labelledby="join-modal-title">
		<h2 id="join-modal-title">Join trip game: {joinConfirmGame.name}?</h2>
		<p>Do you want to join this game?</p>
		<div class="modal-actions">
			<button type="button" class="btn-secondary" onclick={cancelJoinGame}>Not now</button>
			<button type="button" class="btn-primary" onclick={confirmJoinGameAction}>Yes, join</button>
		</div>
	</div>
{/if}

<!-- Instructions modal (shown first time you open a game) -->
{#if instructionsGame}
	{@const def = getGameDef(instructionsGame.gameId)}
	<div class="modal-backdrop" role="presentation"></div>
	<div class="modal modal-wide modal-instructions" role="dialog" aria-labelledby="instr-modal-title">
		<div class="instructions-header">
			<span class="instructions-icon" aria-hidden="true">{def.icon}</span>
			<h2 id="instr-modal-title">How to play: {def.name}</h2>
		</div>
		<div class="instructions-body">
			<p class="instructions-label">How it works</p>
			<p class="instructions-text">{def.instructions}</p>
			<p class="instructions-label">What the winner gets</p>
			<p class="instructions-text instructions-prize">🏆 {def.prize}</p>
		</div>
		<div class="modal-actions">
			<button type="button" class="btn-primary btn-instructions" onclick={confirmUnderstand}>Got it, let's play!</button>
		</div>
	</div>
{/if}

<style>
	.page {
		padding: 0;
		max-width: 90rem;
		margin: 0 auto;
		text-align: center;
	}
	.page-header {
		margin-bottom: 1.5rem;
	}
	.page-header h1 {
		font-size: 1.5rem;
		font-weight: 600;
		margin: 0 0 0.25rem 0;
	}
	.subtitle {
		font-size: 0.875rem;
		color: var(--muted);
		margin: 0;
	}

	.section {
		margin-bottom: 2rem;
		display: flex;
		flex-direction: column;
		align-items: center;
	}
	.section-title {
		font-size: 1.125rem;
		font-weight: 600;
		margin: 0 0 0.5rem 0;
		color: var(--text);
	}
	.section-subtitle {
		font-size: 0.875rem;
		color: var(--muted);
		margin: 0 0 1rem 0;
	}

	.games-grid {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 1rem;
		max-width: 90rem;
		margin: 0 auto;
		width: 100%;
	}
	@media (max-width: 640px) {
		.games-grid {
			grid-template-columns: repeat(2, 1fr);
		}
	}
	.game-card {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		padding: 1rem 0.85rem;
		min-height: 0;
		aspect-ratio: 2.4;
		background: var(--surface);
		border: 2px solid var(--border);
		border-radius: var(--radius-md);
		cursor: pointer;
		transition: border-color 0.15s, background 0.15s;
		font: inherit;
		color: inherit;
	}
	.game-card:hover:not(:disabled) {
		border-color: var(--primary, #e85d04);
		background: rgba(232, 93, 4, 0.04);
	}
	.game-card.is-added {
		cursor: pointer;
	}
	.game-card:disabled {
		opacity: 0.7;
		cursor: default;
	}
	.game-icon {
		font-size: 1.75rem;
		margin-bottom: 0.4rem;
	}
	.game-name {
		font-weight: 600;
		font-size: 0.9375rem;
		margin-bottom: 0.2rem;
	}
	.game-desc {
		font-size: 0.75rem;
		color: var(--muted);
		line-height: 1.3;
	}
	.game-added {
		position: absolute;
		top: 0.5rem;
		right: 0.5rem;
		font-size: 0.6875rem;
		font-weight: 600;
		text-transform: uppercase;
		color: var(--success, #16a34a);
	}
	.game-card-remove {
		position: absolute;
		top: 0.5rem;
		left: 0.5rem;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1.25rem;
		height: 1.25rem;
		padding: 0;
		background: transparent;
		border: none;
		border-radius: var(--radius-sm);
		cursor: pointer;
		color: var(--danger, #dc2626);
		transition: background 0.15s, color 0.15s;
	}
	.game-card-remove:hover {
		background: rgba(220, 38, 38, 0.15);
		color: var(--danger, #dc2626);
	}
	.trash-icon {
		display: block;
	}

	.game-viewer-section {
		width: 100%;
		max-width: 90rem;
		margin-left: auto;
		margin-right: auto;
	}
	.game-viewer-section .game-viewer {
		align-self: stretch;
	}

	.game-viewer {
		width: 100%;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		overflow: hidden;
	}

	.game-viewer-pages {
		min-height: min(60vh, 32rem);
		padding: 1.5rem 1.5rem;
		width: 100%;
	}

	.game-page {
		width: 100%;
		max-width: none;
		text-align: left;
	}

	.game-page-title {
		font-size: 1.5rem;
		font-weight: 600;
		margin: 0 0 0.5rem 0;
		color: var(--text);
	}
	.game-page-hint {
		font-size: 0.9375rem;
		color: var(--muted);
		margin: 0 0 1.5rem 0;
	}

	.game-leaderboard {
		margin-bottom: 1.5rem;
		padding: 1rem;
		background: var(--surface2);
		border-radius: var(--radius-md);
	}
	.game-section-title {
		font-size: 0.875rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.03em;
		color: var(--muted);
		margin: 0 0 0.75rem 0;
	}
	.leaderboard-list {
		list-style: none;
		padding: 0;
		margin: 0 0 0.5rem 0;
	}
	.leaderboard-row {
		display: grid;
		grid-template-columns: 2rem 1fr auto;
		gap: 0.5rem;
		align-items: center;
		padding: 0.35rem 0;
		font-size: 0.875rem;
		border-bottom: 1px solid var(--border);
	}
	.leaderboard-row:last-child {
		border-bottom: none;
	}
	.leaderboard-row .rank {
		font-weight: 600;
		color: var(--muted);
	}
	.leaderboard-row .name {
		color: var(--text);
	}
	.leaderboard-row .score {
		color: var(--muted);
		font-size: 0.8125rem;
	}
	.leaderboard-empty {
		font-size: 0.8125rem;
		color: var(--muted);
		margin: 0;
	}

	.game-options-and-content {
		display: grid;
		grid-template-columns: minmax(0, 18rem) 1fr;
		gap: 2rem;
		align-items: start;
	}
	@media (max-width: 768px) {
		.game-options-and-content {
			grid-template-columns: 1fr;
		}
	}
	.game-options {
		padding: 1rem;
		background: var(--surface2);
		border-radius: var(--radius-md);
	}
	.game-options .game-section-title {
		margin-bottom: 0.75rem;
	}
	.game-action-btn {
		display: block;
		width: 100%;
		margin-bottom: 0.5rem;
		padding: 0.6rem 0.85rem;
		font-size: 0.875rem;
		font-weight: 500;
		background: var(--primary, #e85d04);
		color: white;
		border: none;
		border-radius: var(--radius-md);
		cursor: pointer;
		transition: opacity 0.15s;
	}
	.game-action-btn:hover:not(:disabled) {
		opacity: 0.9;
	}
	.game-action-btn:disabled {
		opacity: 0.7;
		cursor: not-allowed;
	}
	.game-action-btn.secondary {
		background: var(--surface);
		border: 1px solid var(--border);
		color: var(--text);
	}
	.game-option-hint {
		font-size: 0.8125rem;
		color: var(--muted);
		margin: 0.5rem 0 0 0;
		line-height: 1.4;
	}
	.game-main-content {
		min-width: 0;
	}
	.trivia-question-placeholder {
		margin-top: 0.75rem;
	}
	.trivia-label {
		display: block;
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
		color: var(--muted);
		margin-bottom: 0.35rem;
	}
	.trivia-question-text {
		font-size: 0.9375rem;
		color: var(--text);
		margin: 0 0 0.75rem 0;
		padding: 0.75rem;
		background: var(--surface);
		border-radius: var(--radius-md);
		border: 1px solid var(--border);
	}
	.trivia-answer-input {
		display: block;
		width: 100%;
		margin-bottom: 0.5rem;
		padding: 0.6rem 0.85rem;
		font-size: 0.875rem;
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		background: var(--surface);
		color: var(--text);
	}
	.trivia-answer-input:disabled {
		opacity: 0.7;
		cursor: not-allowed;
	}

	.trivia-host-form {
		text-align: left;
		margin-bottom: 1.5rem;
	}
	.trivia-host-form .trivia-label {
		margin-top: 0.75rem;
		margin-bottom: 0.35rem;
	}
	.trivia-host-form .trivia-label:first-child {
		margin-top: 0;
	}
	.trivia-question-input {
		display: block;
		width: 100%;
		padding: 0.6rem 0.85rem;
		font-size: 0.9375rem;
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		background: var(--surface);
		color: var(--text);
		margin-bottom: 0.5rem;
		resize: vertical;
		font-family: inherit;
	}
	.trivia-choice-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 0.5rem;
	}
	.trivia-choice-row input[type="radio"] {
		flex-shrink: 0;
	}
	.trivia-option-input {
		flex: 1;
		min-width: 0;
		padding: 0.5rem 0.75rem;
		font-size: 0.875rem;
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		background: var(--surface);
		color: var(--text);
	}
	.trivia-option-remove {
		flex-shrink: 0;
		width: 1.75rem;
		height: 1.75rem;
		padding: 0;
		border: none;
		border-radius: var(--radius-md);
		background: var(--surface2);
		color: var(--muted);
		font-size: 1.25rem;
		line-height: 1;
		cursor: pointer;
	}
	.trivia-option-remove:hover {
		background: #fecaca;
		color: #b91c1c;
	}
	.trivia-option-add {
		margin-top: 0.25rem;
		padding: 0.35rem 0.5rem;
		font-size: 0.8125rem;
		background: var(--surface2);
		border: 1px dashed var(--border);
		border-radius: var(--radius-md);
		color: var(--muted);
		cursor: pointer;
	}
	.trivia-option-add:hover {
		border-color: var(--primary, #e85d04);
		color: var(--text);
	}
	.trivia-host-form .game-action-btn {
		margin-top: 1rem;
	}
	.trivia-form-actions {
		display: flex;
		gap: 0.75rem;
		align-items: center;
		margin-top: 1rem;
	}
	.trivia-form-actions .game-action-btn {
		margin-top: 0;
	}
	.trivia-carousel-plus {
		background: #dcfce7 !important;
		border-color: #22c55e !important;
		color: #166534 !important;
		font-size: 1.5rem;
		font-weight: 300;
		line-height: 1;
	}
	.trivia-carousel-plus:hover {
		background: #bbf7d0 !important;
		border-color: #16a34a !important;
		color: #14532d !important;
	}
	.trivia-publish-row {
		margin-top: 1rem;
		padding-top: 1rem;
		border-top: 1px solid var(--border);
		display: flex;
		justify-content: flex-end;
	}
	.trivia-publish-btn-small {
		padding: 0.35rem 0.75rem;
		font-size: 0.8125rem;
		background: #1e3a5f;
		border: 1px solid #152a47;
		border-radius: var(--radius-md);
		color: #fff;
		cursor: pointer;
		font-weight: 500;
	}
	.trivia-publish-btn-small:hover {
		background: #152a47;
		border-color: #0f1f33;
		color: #fff;
	}
	.trivia-publish-row .game-action-btn {
		margin-bottom: 0.35rem;
	}
	.trivia-publish-btn {
		background: #dcfce7;
		border-color: #22c55e;
		color: #166534;
	}
	.trivia-publish-btn:hover {
		background: #bbf7d0;
		border-color: #16a34a;
		color: #14532d;
	}
	.trivia-published-badge {
		margin-top: 0.75rem;
		color: var(--success, #16a34a);
		font-weight: 500;
	}
	.trivia-list {
		list-style: none;
		padding: 0;
		margin: 0.5rem 0 0 0;
		text-align: left;
	}
	.trivia-list-item {
		padding: 0.5rem 0;
		border-bottom: 1px solid var(--border);
		font-size: 0.875rem;
	}
	.trivia-list-question {
		color: var(--text);
	}
	.trivia-score {
		margin-bottom: 0.25rem;
	}
	.trivia-guest-list {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}
	.trivia-guest-block {
		padding: 1rem;
		background: var(--surface2);
		border-radius: var(--radius-md);
		border: 1px solid var(--border);
	}
	.trivia-guest-block .trivia-question-text {
		margin-bottom: 0.75rem;
	}
	.trivia-play {
		text-align: left;
	}
	.trivia-play .trivia-question-text {
		margin-bottom: 1rem;
	}
	.trivia-options {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.trivia-option-btn {
		display: block;
		width: 100%;
		text-align: left;
		padding: 0.75rem 1rem;
		font-size: 0.9375rem;
		background: var(--surface);
		border: 2px solid var(--border);
		border-radius: var(--radius-md);
		color: var(--text);
		cursor: pointer;
		transition: border-color 0.15s, background 0.15s;
	}
	.trivia-option-btn:hover {
		border-color: var(--primary, #e85d04);
		background: rgba(232, 93, 4, 0.06);
	}
	.trivia-result {
		font-weight: 600;
		margin: 0.5rem 0 0 0;
		padding: 0.5rem 0;
	}
	.trivia-correct {
		color: var(--success, #16a34a);
	}
	.trivia-wrong {
		color: var(--danger, #dc2626);
	}

	.trivia-layout .trivia-questions-sidebar {
		min-width: 14rem;
	}
	.trivia-q-list {
		list-style: none;
		padding: 0;
		margin: 0 0 0.75rem 0;
	}
	.trivia-q-item {
		display: flex;
		align-items: flex-start;
		gap: 0.5rem;
		padding: 0.5rem 0.6rem;
		margin-bottom: 0.5rem;
		background: var(--surface);
		border-radius: var(--radius-md);
		border: 1px solid var(--border);
		transition: background 0.15s, border-color 0.15s;
	}
	.trivia-q-item.trivia-q-card {
		cursor: pointer;
		align-items: stretch;
	}
	.trivia-q-card .trivia-edit-card {
		flex: 1;
		min-width: 0;
	}
	.trivia-question-only .trivia-question-input {
		margin-bottom: 0.5rem;
	}
	.trivia-q-item:hover {
		background: var(--surface2);
		border-color: var(--primary, #e85d04);
	}
	.trivia-q-item.dragging {
		opacity: 0.6;
	}
	.trivia-q-drag {
		flex-shrink: 0;
		color: var(--muted);
		font-size: 0.875rem;
		cursor: grab;
	}
	.trivia-q-item:active .trivia-q-drag {
		cursor: grabbing;
	}
	.trivia-q-text {
		font-size: 0.8125rem;
		color: var(--text);
		line-height: 1.35;
		flex: 1;
		min-width: 0;
	}
	.trivia-edit-hint {
		font-size: 0.75rem !important;
		margin-top: 0.25rem !important;
	}
	.trivia-carousel-wrap {
		min-width: 0;
	}
	.trivia-carousel {
		display: flex;
		align-items: stretch;
		gap: 0.75rem;
	}
	.trivia-carousel-nav {
		flex-shrink: 0;
		width: 2.5rem;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 1.5rem;
		line-height: 1;
		background: var(--surface2);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		color: var(--text);
		cursor: pointer;
		transition: background 0.15s, border-color 0.15s;
	}
	.trivia-carousel-nav:hover:not(:disabled) {
		background: var(--primary, #e85d04);
		border-color: var(--primary);
		color: white;
	}
	.trivia-carousel-nav:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}
	.trivia-carousel-inner {
		flex: 1;
		min-width: 0;
		padding: 1rem;
		background: var(--surface2);
		border-radius: var(--radius-md);
		border: 1px solid var(--border);
	}
	.trivia-slide {
		min-height: 8rem;
	}
	.trivia-slide-num {
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
		color: var(--muted);
		margin: 0 0 0.5rem 0;
	}
	.trivia-slide .trivia-question-text {
		margin-bottom: 1rem;
	}
	.trivia-options-list {
		list-style: disc;
		padding-left: 1.25rem;
		margin: 0;
		font-size: 0.9375rem;
		color: var(--text);
	}
	.trivia-option-btn.selected {
		border-color: var(--primary, #e85d04);
		background: rgba(232, 93, 4, 0.12);
	}
	.trivia-submit-row {
		margin-top: 1rem;
		padding-top: 1rem;
		border-top: 1px solid var(--border);
	}
	.trivia-submit-row .game-action-btn {
		margin-bottom: 0.35rem;
	}

	.game-viewer-empty {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 16rem;
		color: var(--muted);
		font-size: 0.9375rem;
		opacity: 0.85;
	}

	.bingo-grid {
		display: grid;
		grid-template-columns: repeat(5, 1fr);
		gap: 0.5rem;
	}
	.bingo-cell {
		aspect-ratio: 1;
		border: 2px solid var(--border);
		border-radius: var(--radius-md);
		padding: 0.5rem;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		text-align: center;
	}
	.bingo-label {
		font-size: 0.7rem;
		font-weight: 500;
	}
	.bingo-status {
		font-size: 0.65rem;
		color: var(--muted);
		margin-top: 0.25rem;
	}
	.alpha-track {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem;
	}
	.alpha-letter {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 2rem;
		height: 2rem;
		background: var(--surface2);
		border-radius: var(--radius-sm);
		font-size: 0.8125rem;
		font-weight: 600;
		color: var(--text);
	}
	.alpha-letter.done {
		background: var(--success, #16a34a);
		color: white;
	}
	.alpha-letter.current {
		background: var(--primary, #e85d04);
		color: white;
		border: 2px solid var(--primary);
		box-shadow: 0 0 0 2px rgba(232, 93, 4, 0.3);
	}
	.alpha-letter.locked {
		opacity: 0.5;
		color: var(--muted);
	}
	.game-option-next {
		margin-bottom: 0.25rem;
	}
	.placeholder-game {
		padding: 2rem;
		text-align: center;
		background: var(--surface2);
		border-radius: var(--radius-md);
		color: var(--muted);
		font-size: 0.875rem;
	}

	.modal-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.4);
		z-index: 9998;
	}
	.modal {
		position: fixed;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		background: var(--surface);
		border-radius: var(--radius-lg);
		box-shadow: 0 20px 50px rgba(0, 0, 0, 0.2);
		padding: 1.5rem;
		z-index: 9999;
		max-width: 24rem;
	}
	.modal-wide {
		max-width: 32rem;
	}
	.modal-host-agreement {
		margin: 0 0 1rem 0;
		font-size: 0.9375rem;
		color: var(--text);
		line-height: 1.5;
	}
	.modal h2 {
		margin: 0 0 0.75rem 0;
		font-size: 1.125rem;
	}
	.modal p {
		margin: 0 0 1rem 0;
		font-size: 0.9375rem;
		color: var(--muted);
	}
	/* Cute instructions modal (first time you open a game) */
	.modal-instructions {
		border-radius: 1rem;
		overflow: hidden;
		box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.15);
	}
	.modal-instructions .instructions-header {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		margin-bottom: 1rem;
		padding-bottom: 0.75rem;
		border-bottom: 1px solid var(--border);
	}
	.modal-instructions .instructions-icon {
		font-size: 2.5rem;
		line-height: 1;
		filter: drop-shadow(0 2px 4px rgba(0,0,0,0.08));
	}
	.modal-instructions h2 {
		margin: 0;
		font-size: 1.25rem;
		font-weight: 600;
		color: var(--text);
	}
	.instructions-body {
		margin-bottom: 0.5rem;
	}
	.instructions-label {
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--primary, #e85d04);
		margin: 0 0 0.35rem 0;
	}
	.instructions-text {
		font-size: 0.9375rem;
		color: var(--text);
		line-height: 1.5;
		margin: 0 0 1rem 0;
	}
	.instructions-prize {
		background: linear-gradient(135deg, rgba(232, 93, 4, 0.08) 0%, rgba(232, 93, 4, 0.04) 100%);
		padding: 0.65rem 0.85rem;
		border-radius: var(--radius-md);
		border: 1px solid rgba(232, 93, 4, 0.2);
	}
	.btn-instructions {
		font-weight: 600;
		padding: 0.65rem 1.25rem;
		border-radius: var(--radius-md);
	}
	.instructions-body p {
		margin-bottom: 0.75rem;
	}
	.modal-actions {
		display: flex;
		gap: 0.75rem;
		justify-content: flex-end;
		margin-top: 1rem;
	}
	.btn-primary {
		padding: 0.5rem 1rem;
		background: var(--primary, #e85d04);
		color: white;
		border: none;
		border-radius: var(--radius-md);
		font-weight: 500;
		cursor: pointer;
	}
	.btn-secondary {
		padding: 0.5rem 1rem;
		background: var(--surface2);
		color: var(--text);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		font-weight: 500;
		cursor: pointer;
	}
</style>
