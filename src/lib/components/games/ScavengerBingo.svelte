<script lang="ts">
	import PhotoPicker from './PhotoPicker.svelte';
	import GameLeaderboard from './GameLeaderboard.svelte';
	import type { LeaderboardPlayer } from './GameLeaderboard.svelte';
	import { SCAVENGER_BINGO_ITEMS } from '$lib/games/scavengerBingoItems.js';
	import { seededShuffle } from '$lib/utils/seededShuffle.js';

	interface Props {
		tripId: string;
		tripGameId: string;
		userId: string;
		userName: string | null;
		userInitials: string;
		players: LeaderboardPlayer[];
	}

	let { tripId, tripGameId, userId, userName, userInitials, players }: Props = $props();

	// ── Persistent storage helpers ────────────────────────────────────────────
	const STORAGE_KEY = `trip-games-bingo-photos-${tripId}-${tripGameId}-${userId}`;

	function loadPhotos(): Record<number, string> {
		if (typeof window === 'undefined') return {};
		try {
			const raw = sessionStorage.getItem(STORAGE_KEY);
			const parsed = raw ? (JSON.parse(raw) as Record<string, string>) : {};
			return Object.fromEntries(
				Object.entries(parsed).map(([k, v]) => [parseInt(k, 10), v]).filter(([k]) => !Number.isNaN(k))
			);
		} catch { return {}; }
	}

	function savePhoto(squareIndex: number, dataUrl: string) {
		if (typeof window === 'undefined') return;
		const prev = loadPhotos();
		sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ ...prev, [squareIndex]: dataUrl }));
	}

	// ── Board (seeded shuffle unique per user) ────────────────────────────────
	// The FREE SPACE is always the center (index 12 in 0-based 5×5)
	const FREE_INDEX = 12;
	const board = $derived(seededShuffle(SCAVENGER_BINGO_ITEMS, `${userId}-${tripGameId}`));

	// ── State ─────────────────────────────────────────────────────────────────
	let photos = $state<Record<number, string>>({});
	let pickerOpen = $state(false);
	let pickerSquareIndex = $state<number | null>(null);
	let newlyFilledIndex = $state<number | null>(null); // for pop animation

	$effect(() => {
		if (typeof window !== 'undefined') photos = loadPhotos();
	});

	// ── Computed ──────────────────────────────────────────────────────────────
	// Filled = photo present OR free space
	const filled = $derived(
		new Set([FREE_INDEX, ...Object.keys(photos).map(Number).filter((n) => !isNaN(n))])
	);

	const filledCount = $derived(filled.size - 1); // exclude free space

	const hasBingo = $derived.by(() => {
		const f = filled;
		// Rows
		for (let r = 0; r < 5; r++) {
			if ([0,1,2,3,4].every((c) => f.has(r * 5 + c))) return true;
		}
		// Cols
		for (let c = 0; c < 5; c++) {
			if ([0,1,2,3,4].every((r) => f.has(r * 5 + c))) return true;
		}
		// Diagonals
		if ([0,6,12,18,24].every((i) => f.has(i))) return true;
		if ([4,8,12,16,20].every((i) => f.has(i))) return true;
		return false;
	});

	const progressPct = $derived(Math.round((filledCount / 24) * 100));

	// ── Actions ───────────────────────────────────────────────────────────────
	function openPicker(idx: number) {
		if (idx === FREE_INDEX) return;
		pickerSquareIndex = idx;
		pickerOpen = true;
	}

	function handlePhotoSelected(dataUrl: string) {
		if (pickerSquareIndex === null) return;
		const idx = pickerSquareIndex;
		savePhoto(idx, dataUrl);
		photos = loadPhotos();
		pickerOpen = false;
		pickerSquareIndex = null;
		// Trigger pop animation
		newlyFilledIndex = idx;
		setTimeout(() => { newlyFilledIndex = null; }, 300);
	}

	function closePicker() {
		pickerOpen = false;
		pickerSquareIndex = null;
	}

	const COLS = ['B', 'I', 'N', 'G', 'O'];
</script>

<div class="bingo-layout">
	<!-- Main: board -->
	<div class="bingo-main">
		{#if hasBingo}
			<div class="bingo-celebration" role="status" aria-live="polite">
				<div class="bingo-confetti" aria-hidden="true">
					{#each Array(16) as _, i}
						<span class="confetti-piece" style="--i:{i}; --hue:{(i * 23) % 360}deg; --delay:{(i * 0.09).toFixed(2)}s"></span>
					{/each}
				</div>
				<h2 class="bingo-celeb-title">You got Bingo! 🎉</h2>
				<p class="bingo-celeb-sub">A row, column, or diagonal is complete!</p>
			</div>
		{/if}

		<!-- Column headers -->
		<div class="bingo-board-frame">
			<div class="bingo-col-headers" aria-hidden="true">
				{#each COLS as col}
					<span class="bingo-col-letter">{col}</span>
				{/each}
			</div>

			<div class="bingo-board" role="grid" aria-label="Bingo board">
				{#each board as item, idx}
					{@const isFree = idx === FREE_INDEX}
					{@const hasPhoto = !!photos[idx]}
					{@const isPopped = newlyFilledIndex === idx}

					{#if isFree}
						<div class="bingo-cell bingo-cell--free" role="gridcell" aria-label="Free space">
							<span class="bingo-free-star" aria-hidden="true">⭐</span>
						</div>
					{:else}
						<button
							type="button"
							class="bingo-cell"
							class:bingo-cell--filled={hasPhoto}
							class:bingo-cell--pop={isPopped}
							role="gridcell"
							aria-label="{item.label}{hasPhoto ? ' — filled' : ' — tap to add photo'}"
							onclick={() => openPicker(idx)}
						>
							{#if hasPhoto}
								<img class="bingo-cell-photo" src={photos[idx]} alt="" />
								<span class="bingo-check" aria-hidden="true">✓</span>
							{:else}
								<span class="bingo-item-emoji" aria-hidden="true">{item.icon}</span>
								<span class="bingo-item-label">{item.label}</span>
							{/if}
						</button>
					{/if}
				{/each}
			</div>
		</div>

		<p class="bingo-hint">Tap any square to fill it with a photo. Complete a row, column, or diagonal to win.</p>
	</div>

	<!-- Sidebar -->
	<div class="bingo-sidebar">
		<!-- Your progress -->
		<div class="bingo-progress-card" class:bingo-progress-card--bingo={hasBingo}>
			{#if hasBingo}
				<div class="bingo-win-badge">🏆 Bingo!</div>
				<p class="bingo-win-sub">Complete row, column, or diagonal.</p>
			{:else}
				<div class="bp-top">
					<span class="bp-avatar" aria-hidden="true">{userInitials}</span>
					<span class="bp-name">{userName ?? 'You'}</span>
					<span class="bp-count">{filledCount} / 24 filled</span>
				</div>
				<div class="bp-bar-track" aria-label="{progressPct}% complete">
					<div class="bp-bar-fill" style="width: {progressPct}%"></div>
				</div>
			{/if}
		</div>

		<!-- Leaderboard (placeholder — TODO: wire to real multi-user progress) -->
		<GameLeaderboard
			title="Who's winning"
			{players}
			emptyText="No scores yet. Start filling your board!"
			collapsedOnMobile={true}
		/>

		<!-- How to play -->
		<details class="how-to-play">
			<summary class="htp-summary">
				<span>How to play</span>
				<span class="htp-icon" aria-hidden="true">+</span>
			</summary>
			<ul class="htp-list">
				<li>Everyone gets a unique board shuffled from the same prompts.</li>
				<li>Tap any square and take or choose a photo to fill it.</li>
				<li>Complete a full row, column, or diagonal to get Bingo.</li>
				<li>First person to get Bingo wins the round!</li>
			</ul>
		</details>
	</div>
</div>

<PhotoPicker
	open={pickerOpen}
	label={pickerSquareIndex !== null ? board[pickerSquareIndex]?.label ?? '' : ''}
	icon={pickerSquareIndex !== null ? board[pickerSquareIndex]?.icon ?? '📸' : '📸'}
	onSelect={handlePhotoSelected}
	onClose={closePicker}
/>

<style>
	/* ── Layout ── */
	.bingo-layout {
		display: grid;
		grid-template-columns: 1fr 280px;
		gap: 1.5rem;
		align-items: start;
		min-width: 0;
	}

	.bingo-main {
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	/* ── Board ── */
	.bingo-board-frame {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.bingo-col-headers {
		display: grid;
		grid-template-columns: repeat(5, 1fr);
		gap: 4px;
	}

	.bingo-col-letter {
		font-family: 'Fraunces', Georgia, serif;
		font-style: italic;
		font-size: clamp(18px, 3.5vw, 26px);
		font-weight: 700;
		color: #2f7778;
		text-align: center;
	}

	.bingo-board {
		display: grid;
		grid-template-columns: repeat(5, 1fr);
		gap: 4px;
	}

	.bingo-cell {
		aspect-ratio: 1;
		min-width: 0;
		border-radius: 10px;
		border: 1.5px solid #e2e8f0;
		background: white;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 3px;
		cursor: pointer;
		font: inherit;
		padding: 4px;
		position: relative;
		transition: border-color 0.12s, background 0.12s;
		overflow: hidden;
	}

	.bingo-cell:hover:not(.bingo-cell--filled):not(.bingo-cell--free) {
		border-color: #2f7778;
		background: rgba(47, 119, 120, 0.04);
	}

	.bingo-cell:focus-visible {
		outline: 2px solid #2f7778;
		outline-offset: 2px;
	}

	.bingo-cell--free {
		background: #2f7778;
		border-color: #2f7778;
		cursor: default;
	}

	.bingo-cell--filled {
		border-color: #2f7778;
	}

	.bingo-cell--pop {
		animation: cell-pop 0.25s ease-out;
	}

	@keyframes cell-pop {
		0%   { transform: scale(1); }
		50%  { transform: scale(1.08); }
		100% { transform: scale(1); }
	}

	.bingo-cell-photo {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.bingo-check {
		position: absolute;
		bottom: 4px;
		right: 4px;
		width: 18px;
		height: 18px;
		border-radius: 50%;
		background: #2f7778;
		color: white;
		font-size: 0.5625rem;
		font-weight: 700;
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1;
	}

	.bingo-free-star {
		font-size: clamp(18px, 3.5vw, 26px);
	}

	.bingo-item-emoji {
		font-size: clamp(18px, 3.5vw, 28px);
	}

	.bingo-item-label {
		font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
		font-size: clamp(7px, 1.4vw, 10px);
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: #64748b;
		text-align: center;
		line-height: 1.2;
	}

	.bingo-hint {
		font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
		font-size: 0.8125rem;
		color: #94a3b8;
		margin: 0;
	}

	/* ── Celebration ── */
	.bingo-celebration {
		position: relative;
		background: #2f7778;
		color: white;
		border-radius: 14px;
		padding: 1.25rem 1.5rem;
		text-align: center;
		overflow: hidden;
	}

	.bingo-celeb-title {
		font-family: 'Fraunces', Georgia, serif;
		font-size: 1.5rem;
		font-weight: 700;
		margin: 0 0 0.25rem;
		position: relative;
		z-index: 1;
	}

	.bingo-celeb-sub {
		font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
		font-size: 0.9375rem;
		margin: 0;
		opacity: 0.85;
		position: relative;
		z-index: 1;
	}

	/* Confetti */
	.bingo-confetti {
		position: absolute;
		inset: 0;
		pointer-events: none;
		overflow: hidden;
	}

	.confetti-piece {
		position: absolute;
		width: 8px;
		height: 12px;
		background: hsl(var(--hue), 80%, 65%);
		border-radius: 2px;
		top: 50%;
		left: 50%;
		animation: confetti-burst 1.5s var(--delay, 0s) ease-out both;
		transform-origin: center;
	}

	@keyframes confetti-burst {
		0% {
			transform: translate(-50%, -50%) rotate(0deg) scale(1);
			opacity: 1;
		}
		100% {
			transform:
				translate(
					calc(-50% + (var(--i, 0) * 24px - 180px)),
					calc(-50% + (var(--i, 0) * 18px - 130px))
				)
				rotate(calc(var(--i, 0) * 27deg))
				scale(0.6);
			opacity: 0;
		}
	}

	/* ── Sidebar ── */
	.bingo-sidebar {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		min-width: 0;
	}

	.bingo-progress-card {
		background: white;
		border: 1px solid #e2e8f0;
		border-radius: 14px;
		padding: 1rem 1.125rem;
		display: flex;
		flex-direction: column;
		gap: 0.625rem;
	}

	.bingo-progress-card--bingo {
		background: #2f7778;
		border-color: #2f7778;
		color: white;
		align-items: center;
		text-align: center;
	}

	.bingo-win-badge {
		font-family: 'Fraunces', Georgia, serif;
		font-size: 1.25rem;
		font-weight: 700;
	}

	.bingo-win-sub {
		font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
		font-size: 0.875rem;
		opacity: 0.85;
		margin: 0;
	}

	.bp-top {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.bp-avatar {
		width: 32px;
		height: 32px;
		border-radius: 50%;
		background: #2f7778;
		color: white;
		font-size: 0.625rem;
		font-weight: 700;
		font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.bp-name {
		font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
		font-size: 0.875rem;
		font-weight: 600;
		color: #1d4d4e;
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.bp-count {
		font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
		font-size: 0.75rem;
		color: #64748b;
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}

	.bp-bar-track {
		height: 5px;
		background: rgba(47, 119, 120, 0.1);
		border-radius: 999px;
		overflow: hidden;
	}

	.bp-bar-fill {
		height: 100%;
		background: #2f7778;
		border-radius: 999px;
		transition: width 0.5s cubic-bezier(0.4, 0, 0.2, 1);
	}

	/* ── How to play ── */
	.how-to-play {
		background: white;
		border: 1px solid #e2e8f0;
		border-radius: 14px;
		overflow: hidden;
	}

	.htp-summary {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.875rem 1.125rem;
		cursor: pointer;
		list-style: none;
		font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
		font-size: 0.875rem;
		font-weight: 600;
		color: #1d4d4e;
		user-select: none;
	}

	.htp-summary::-webkit-details-marker { display: none; }

	.htp-icon {
		font-size: 1.1rem;
		font-weight: 300;
		color: #64748b;
		transition: transform 0.2s;
	}

	details[open] .htp-icon {
		transform: rotate(45deg);
	}

	.htp-list {
		margin: 0;
		padding: 0 1.125rem 1rem 1.125rem;
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.htp-list li {
		font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
		font-size: 0.8125rem;
		color: #475569;
		padding-left: 1rem;
		position: relative;
		line-height: 1.5;
	}

	.htp-list li::before {
		content: '·';
		position: absolute;
		left: 0;
		color: #2f7778;
		font-weight: 700;
	}

	/* ── Mobile ── */
	@media (max-width: 767px) {
		.bingo-layout {
			grid-template-columns: 1fr;
		}

		.bingo-board {
			gap: 4px;
		}

		.bingo-cell {
			border-radius: 8px;
		}

		.bingo-item-label {
			display: none;
		}

		.bingo-sidebar {
			order: 1;
		}

		.bingo-main {
			order: 0;
		}
	}
</style>
