<script lang="ts">
	import type { PageData } from './$types';
	import type { GameId, TripGame } from '$lib/stores/tripGames.js';
	import {
		GAME_DEFS,
		getTripGames,
		addTripGame,
		removeTripGame,
		getJoinedGames,
		joinGame,
		getUnderstoodGames,
		markUnderstood
	} from '$lib/stores/tripGames.js';

	let { data }: { data: PageData } = $props();

	const tripId = $derived(data.trip?.id ?? '');
	const userId = $derived(data.user?.id ?? '');
	const canRemoveGames = $derived(data.canRemoveGames ?? false);

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

	// Modals
	let addConfirmGame = $state<{ gameId: GameId; name: string } | null>(null);
	let joinConfirmGame = $state<TripGame | null>(null);
	let instructionsGame = $state<TripGame | null>(null);

	// Carousel / active tab
	let activeTabId = $state<string | null>(null);

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
		activeTabId = added.id;
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

	function handleTabClick(tg: TripGame) {
		if (!joinedIds.has(tg.id)) {
			joinConfirmGame = tg;
			return;
		}
		if (!understoodIds.has(tg.id)) {
			instructionsGame = tg;
			return;
		}
		activeTabId = tg.id;
	}

	function handleRemoveGame(e: Event, tg: TripGame) {
		e.stopPropagation();
		if (!canRemoveGames) return;
		if (confirm(`Remove ${tg.name} from the trip?`)) {
			removeTripGame(tripId, tg.id);
			refresh();
			if (activeTabId === tg.id) activeTabId = tripGames[0]?.id ?? null;
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
	<div class="page-header">
		<h1>Games</h1>
		<p class="subtitle">Add fun games to your trip. Everyone can play!</p>
	</div>

	<!-- Game selection grid (available to add) -->
	<section class="section">
		<h2 class="section-title">Add a game</h2>
		<p class="section-subtitle">Click a game to add it to the trip. All attendees will be notified.</p>
		<div class="games-grid">
			{#each GAME_DEFS as def}
				{@const alreadyAdded = tripGames.some((g) => g.gameId === def.id)}
				<button
					type="button"
					class="game-card"
					disabled={alreadyAdded}
					onclick={() => !alreadyAdded && handleAddGame(def.id)}
					title={alreadyAdded ? 'Already added' : `Add ${def.name}`}
				>
					<span class="game-icon">{def.icon}</span>
					<span class="game-name">{def.name}</span>
					<span class="game-desc">{def.description}</span>
					{#if alreadyAdded}
						<span class="game-added">Added</span>
					{/if}
				</button>
			{/each}
		</div>
	</section>

	<!-- Game viewer: tabs + mini-page content -->
	{#if tripGames.length > 0}
		<section class="section game-viewer-section">
			<div class="game-viewer">
				<div class="game-viewer-tabs">
					{#each tripGames as tg}
						{@const isJoined = joinedIds.has(tg.id)}
						{@const isUnderstood = understoodIds.has(tg.id)}
						{@const canView = isJoined && isUnderstood}
						<button
							type="button"
							class="tab-pill"
							class:active={activeTabId === tg.id}
							class:locked={!canView}
							onclick={() => handleTabClick(tg)}
						>
							<span class="tab-name">{tg.name}</span>
							{#if canRemoveGames}
								<span
									class="tab-remove"
									role="button"
									tabindex="-1"
									onclick={(e) => handleRemoveGame(e, tg)}
									aria-label="Remove {tg.name}"
								>
									×
								</span>
							{/if}
						</button>
					{/each}
				</div>

				<div class="game-viewer-content">
					{#if activeTabId}
						{@const activeGame = tripGames.find((g) => g.id === activeTabId)}
						{#if activeGame}
							{@const canView = joinedIds.has(activeGame.id) && understoodIds.has(activeGame.id)}
							{#if canView}
								<div class="game-mini-page">
								{#if activeGame.gameId === 'scavenger-bingo'}
									<h3>Your Bingo Board</h3>
									<p class="game-hint">Snap photos that match each square. Get 5 in a row to win!</p>
									<div class="bingo-grid">
										{#each BINGO_SQUARES as sq, i}
											<div class="bingo-cell">
												<span class="bingo-label">{sq}</span>
												<span class="bingo-status">—</span>
											</div>
										{/each}
									</div>
								{:else if activeGame.gameId === 'caption-this'}
									<h3>Caption This</h3>
									<p class="game-hint">Upload a photo or wait for one. Submit and vote on captions!</p>
									<div class="placeholder-game">Photo and caption area (coming soon)</div>
								{:else if activeGame.gameId === 'alphabet-hunt'}
									<h3>Alphabet Hunt</h3>
									<p class="game-hint">Find things A–Z. Furthest by trip end wins!</p>
									<div class="alpha-track">
										{#each 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('') as letter}
											<span class="alpha-letter"> {letter} </span>
										{/each}
									</div>
								{:else if activeGame.gameId === 'daily-trivia'}
									<h3>Daily Trivia</h3>
									<p class="game-hint">A game master posts a question each day. First correct answer wins!</p>
									<div class="placeholder-game">Trivia questions (coming soon)</div>
								{/if}
								</div>
							{/if}
						{/if}
					{:else}
						<div class="game-viewer-empty">Select a game tab above</div>
					{/if}
				</div>
			</div>
		</section>
	{/if}
</div>

<!-- Add game confirmation -->
{#if addConfirmGame}
	<div class="modal-backdrop" role="presentation" onclick={cancelAddGame}></div>
	<div class="modal" role="dialog" aria-labelledby="add-modal-title">
		<h2 id="add-modal-title">Add {addConfirmGame.name}?</h2>
		<p>This will alert all attendees that a game has been added to the trip.</p>
		<div class="modal-actions">
			<button type="button" class="btn-secondary" onclick={cancelAddGame}>Cancel</button>
			<button type="button" class="btn-primary" onclick={confirmAddGame}>Add game</button>
		</div>
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

<!-- Instructions modal -->
{#if instructionsGame}
	{@const def = getGameDef(instructionsGame.gameId)}
	<div class="modal-backdrop" role="presentation"></div>
	<div class="modal modal-wide" role="dialog" aria-labelledby="instr-modal-title">
		<h2 id="instr-modal-title">How to play: {def.name}</h2>
		<div class="instructions-body">
			<p><strong>How it works:</strong></p>
			<p>{def.instructions}</p>
			<p><strong>What the winner gets:</strong></p>
			<p>{def.prize}</p>
		</div>
		<div class="modal-actions">
			<button type="button" class="btn-primary" onclick={confirmUnderstand}>I understand</button>
		</div>
	</div>
{/if}

<style>
	.page {
		padding: 0;
		max-width: 56rem;
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
		grid-template-columns: repeat(2, 1fr);
		gap: 1.5rem;
		max-width: 40rem;
		margin: 0 auto;
	}
	.game-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		padding: 2.5rem 1.5rem;
		min-height: 12rem;
		background: var(--surface);
		border: 2px solid var(--border);
		border-radius: var(--radius-lg);
		cursor: pointer;
		transition: border-color 0.15s, background 0.15s;
		font: inherit;
		color: inherit;
	}
	.game-card:hover:not(:disabled) {
		border-color: var(--primary, #e85d04);
		background: rgba(232, 93, 4, 0.04);
	}
	.game-card:disabled {
		opacity: 0.7;
		cursor: default;
	}
	.game-icon {
		font-size: 3rem;
		margin-bottom: 0.75rem;
	}
	.game-name {
		font-weight: 600;
		font-size: 1.125rem;
		margin-bottom: 0.35rem;
	}
	.game-desc {
		font-size: 0.875rem;
		color: var(--muted);
		line-height: 1.4;
	}
	.game-added {
		margin-top: 0.75rem;
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
		color: var(--success, #16a34a);
	}

	.game-viewer-section {
		width: 100%;
		max-width: 52rem;
		margin-left: auto;
		margin-right: auto;
	}

	.game-viewer {
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		overflow: hidden;
	}

	.game-viewer-tabs {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		padding: 0.75rem 1rem;
		background: var(--surface2);
		border-bottom: 1px solid var(--border);
	}

	.game-viewer-content {
		min-height: 20rem;
		padding: 1.5rem;
	}

	.game-mini-page {
		/* Each game's content fills this area */
	}

	.game-viewer-empty {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 16rem;
		color: var(--muted);
		font-size: 0.9375rem;
	}
	.tab-pill {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.5rem 0.75rem;
		background: var(--surface2);
		border: 1px solid var(--border);
		border-radius: 9999px;
		cursor: pointer;
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--text);
		transition: all 0.15s;
	}
	.tab-pill:hover {
		background: var(--focusRing);
	}
	.tab-pill.active {
		background: var(--primary, #e85d04);
		border-color: var(--primary);
		color: white;
	}
	.tab-pill.locked {
		opacity: 0.85;
	}
	.tab-remove {
		margin-left: 0.25rem;
		padding: 0 0.2rem;
		font-size: 1rem;
		opacity: 0.7;
	}
	.tab-pill .tab-remove:hover {
		opacity: 1;
	}

	.game-mini-page h3 {
		margin: 0 0 0.5rem 0;
		font-size: 1.125rem;
		text-align: left;
	}
	.game-mini-page .game-hint {
		font-size: 0.875rem;
		color: var(--muted);
		margin: 0 0 1rem 0;
		text-align: left;
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
	.modal h2 {
		margin: 0 0 0.75rem 0;
		font-size: 1.125rem;
	}
	.modal p {
		margin: 0 0 1rem 0;
		font-size: 0.9375rem;
		color: var(--muted);
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
