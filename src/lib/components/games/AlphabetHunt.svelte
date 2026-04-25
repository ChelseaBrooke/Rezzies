<script lang="ts">
	import PhotoPicker from './PhotoPicker.svelte';
	import GameLeaderboard from './GameLeaderboard.svelte';
	import type { LeaderboardPlayer } from './GameLeaderboard.svelte';

	interface Props {
		tripId: string;
		tripGameId: string;
		userId: string;
		userName: string | null;
		userInitials: string;
		players: LeaderboardPlayer[];
	}

	let { tripId, tripGameId, userId, userName, userInitials, players }: Props = $props();

	const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

	const PROGRESS_KEY = `trip-games-alphabet-${tripId}-${tripGameId}-${userId}`;
	const PHOTOS_KEY   = `trip-games-alphabet-photos-${tripId}-${tripGameId}-${userId}`;

	function loadProgress(): number {
		if (typeof window === 'undefined') return 0;
		const raw = sessionStorage.getItem(PROGRESS_KEY);
		const n = raw ? parseInt(raw, 10) : 0;
		return Number.isFinite(n) && n >= 0 && n <= 26 ? n : 0;
	}

	function saveProgress(val: number) {
		if (typeof window === 'undefined') return;
		sessionStorage.setItem(PROGRESS_KEY, String(Math.max(0, Math.min(26, val))));
	}

	function loadPhotos(): Record<number, string> {
		if (typeof window === 'undefined') return {};
		try {
			const raw = sessionStorage.getItem(PHOTOS_KEY);
			const parsed = raw ? JSON.parse(raw) as Record<string, string> : {};
			return Object.fromEntries(
				Object.entries(parsed).map(([k, v]) => [parseInt(k, 10), v]).filter(([k]) => !isNaN(k))
			);
		} catch { return {}; }
	}

	function savePhoto(idx: number, dataUrl: string) {
		if (typeof window === 'undefined') return;
		const prev = loadPhotos();
		sessionStorage.setItem(PHOTOS_KEY, JSON.stringify({ ...prev, [idx]: dataUrl }));
	}

	let progress = $state(0);
	let photos = $state<Record<number, string>>({});
	let pickerOpen = $state(false);
	let flipIndex = $state<number | null>(null);

	$effect(() => {
		if (typeof window !== 'undefined') {
			progress = loadProgress();
			photos = loadPhotos();
		}
	});

	const progressPct = $derived(Math.round((progress / 26) * 100));
	const currentLetter = $derived(progress < 26 ? LETTERS[progress] : null);

	function openPicker() {
		if (progress >= 26) return;
		pickerOpen = true;
	}

	function handlePhotoSelected(dataUrl: string) {
		if (progress >= 26) return;
		const idx = progress;
		savePhoto(idx, dataUrl);
		photos = loadPhotos();
		pickerOpen = false;
		// Advance
		const next = idx + 1;
		saveProgress(next);
		progress = next;
		flipIndex = idx;
		setTimeout(() => { flipIndex = null; }, 400);
	}

	function markDone() {
		if (progress >= 26) return;
		const next = progress + 1;
		saveProgress(next);
		const prev = progress;
		progress = next;
		flipIndex = prev;
		setTimeout(() => { flipIndex = null; }, 400);
	}

	function closePicker() {
		pickerOpen = false;
	}
</script>

<div class="alpha-layout">
	<!-- Main: grid -->
	<div class="alpha-main">
		<div class="alpha-grid" role="group" aria-label="Alphabet progress">
			{#each LETTERS as letter, i}
				{@const done = i < progress}
				{@const current = i === progress && progress < 26}
				{@const upcoming = i > progress}
				{@const isFlipping = flipIndex === i}

				<button
					type="button"
					class="alpha-cell"
					class:alpha-cell--done={done}
					class:alpha-cell--current={current}
					class:alpha-cell--upcoming={upcoming}
					class:alpha-cell--flip={isFlipping}
					onclick={() => { if (current) openPicker(); }}
					disabled={!current}
					aria-label="{letter}{done ? ' — complete' : current ? ' — your current letter' : ' — upcoming'}"
					aria-current={current ? 'true' : undefined}
				>
					{#if done && photos[i]}
						<span class="alpha-letter">{letter}</span>
						<img class="alpha-thumb" src={photos[i]} alt="" />
					{:else}
						<span class="alpha-letter">{letter}</span>
					{/if}
				</button>
			{/each}
		</div>

		{#if currentLetter}
			<div class="alpha-actions">
				<button type="button" class="alpha-btn alpha-btn-photo" onclick={openPicker}>
					📷 Take / choose photo for <strong>{currentLetter}</strong>
				</button>
				<button type="button" class="alpha-btn alpha-btn-mark" onclick={markDone}>
					Mark "{currentLetter}" done without photo
				</button>
			</div>
			<p class="alpha-hint">
				Find something whose name starts with <strong>{currentLetter}</strong>. Take a photo to advance.
			</p>
		{:else}
			<div class="alpha-complete-banner">
				<span>🎉 You completed the full alphabet!</span>
			</div>
		{/if}
	</div>

	<!-- Sidebar -->
	<div class="alpha-sidebar">
		<!-- Current letter display -->
		<div class="alpha-progress-card">
			{#if currentLetter}
				<div class="apc-letter-display" aria-hidden="true">{currentLetter}</div>
				<p class="apc-sub">Letter {progress + 1} of 26</p>
			{:else}
				<div class="apc-letter-display apc-done" aria-hidden="true">✓</div>
				<p class="apc-sub">All 26 letters complete!</p>
			{/if}
			<div class="apc-bar-track">
				<div class="apc-bar-fill" style="width: {progressPct}%"></div>
			</div>
			<span class="apc-pct">{progressPct}%</span>
		</div>

		<!-- Leaderboard -->
		<GameLeaderboard
			title="Who's furthest"
			{players}
			emptyText="No one's started yet. You could be first!"
			collapsedOnMobile={true}
		/>

		<!-- How to play -->
		<details class="how-to-play">
			<summary class="htp-summary">
				<span>How to play</span>
				<span class="htp-icon" aria-hidden="true">+</span>
			</summary>
			<ul class="htp-list">
				<li>Find real-world things for each letter in order, A → Z.</li>
				<li>Take a photo or tap "mark done" to advance to the next letter.</li>
				<li>Spelling counts — the thing must genuinely start with that letter.</li>
				<li>Whoever gets furthest through the alphabet by trip end wins. All 26 is a full run!</li>
			</ul>
		</details>
	</div>
</div>

<PhotoPicker
	open={pickerOpen}
	label={currentLetter ? `Something starting with ${currentLetter}` : ''}
	icon="🔤"
	onSelect={handlePhotoSelected}
	onClose={closePicker}
/>

<style>
	/* ── Layout ── */
	.alpha-layout {
		display: grid;
		grid-template-columns: 1fr 260px;
		gap: 1.5rem;
		align-items: start;
		min-width: 0;
	}

	.alpha-main {
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	/* ── Grid ── */
	.alpha-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(56px, 1fr));
		gap: 6px;
	}

	.alpha-cell {
		aspect-ratio: 1;
		border-radius: 10px;
		border: 2px solid #e2e8f0;
		background: #f8fafc;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		cursor: default;
		font: inherit;
		position: relative;
		overflow: hidden;
		transition: border-color 0.15s, background 0.15s;
	}

	.alpha-cell:focus-visible {
		outline: 2px solid #2f7778;
		outline-offset: 2px;
	}

	.alpha-cell--done {
		background: #2f7778;
		border-color: #2f7778;
	}

	.alpha-cell--current {
		background: white;
		border-color: #2f7778;
		border-width: 2px;
		cursor: pointer;
		animation: alpha-pulse 2s ease-in-out infinite;
	}

	@keyframes alpha-pulse {
		0%, 100% { border-color: #2f7778; }
		50%       { border-color: rgba(47,119,120,0.4); }
	}

	.alpha-cell--upcoming {
		opacity: 0.55;
	}

	.alpha-cell--flip {
		animation: alpha-flip 0.35s ease-in-out;
	}

	@keyframes alpha-flip {
		0%   { transform: rotateY(0deg); }
		45%  { transform: rotateY(90deg); background: #2f7778; }
		55%  { transform: rotateY(90deg); background: #2f7778; }
		100% { transform: rotateY(0deg); }
	}

	.alpha-letter {
		font-family: 'Fraunces', Georgia, serif;
		font-size: clamp(14px, 3.5vw, 20px);
		font-weight: 700;
		color: inherit;
		line-height: 1;
	}

	.alpha-cell--done .alpha-letter {
		color: white;
		font-size: clamp(10px, 2.5vw, 14px);
		position: absolute;
		top: 4px;
		left: 5px;
	}

	.alpha-cell--current .alpha-letter {
		color: #2f7778;
	}

	.alpha-cell--upcoming .alpha-letter {
		color: #94a3b8;
	}

	.alpha-thumb {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
		opacity: 0.65;
	}

	/* ── Actions ── */
	.alpha-actions {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.alpha-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 44px;
		padding: 0.625rem 1rem;
		border-radius: 10px;
		border: 1.5px solid #e2e8f0;
		background: white;
		cursor: pointer;
		font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
		font-size: 0.9375rem;
		transition: background 0.12s, border-color 0.12s;
		text-align: center;
	}

	.alpha-btn-photo {
		background: #2f7778;
		border-color: #2f7778;
		color: white;
		font-weight: 600;
	}

	.alpha-btn-photo:hover {
		background: #1d6566;
		border-color: #1d6566;
	}

	.alpha-btn-mark {
		color: #475569;
	}

	.alpha-btn-mark:hover {
		background: #f8fafc;
		border-color: #2f7778;
	}

	.alpha-hint {
		font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
		font-size: 0.8125rem;
		color: #94a3b8;
		margin: 0;
	}

	.alpha-complete-banner {
		background: #2f7778;
		color: white;
		border-radius: 12px;
		padding: 1rem 1.25rem;
		text-align: center;
		font-family: 'Fraunces', Georgia, serif;
		font-size: 1.25rem;
		font-weight: 700;
	}

	/* ── Sidebar ── */
	.alpha-sidebar {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		min-width: 0;
	}

	.alpha-progress-card {
		background: white;
		border: 1px solid #e2e8f0;
		border-radius: 14px;
		padding: 1.125rem;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.4rem;
		text-align: center;
	}

	.apc-letter-display {
		font-family: 'Fraunces', Georgia, serif;
		font-size: 3.5rem;
		font-weight: 900;
		color: #2f7778;
		line-height: 1;
		letter-spacing: -0.04em;
	}

	.apc-done {
		color: #1D9E75;
	}

	.apc-sub {
		font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
		font-size: 0.8125rem;
		color: #64748b;
		margin: 0;
	}

	.apc-bar-track {
		width: 100%;
		height: 5px;
		background: rgba(47, 119, 120, 0.1);
		border-radius: 999px;
		overflow: hidden;
		margin-top: 0.25rem;
	}

	.apc-bar-fill {
		height: 100%;
		background: #2f7778;
		border-radius: 999px;
		transition: width 0.5s cubic-bezier(0.4, 0, 0.2, 1);
	}

	.apc-pct {
		font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
		font-size: 0.75rem;
		font-weight: 700;
		color: #2f7778;
		font-variant-numeric: tabular-nums;
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
		.alpha-layout {
			grid-template-columns: 1fr;
		}

		.alpha-grid {
			grid-template-columns: repeat(auto-fill, minmax(48px, 1fr));
			gap: 5px;
		}

		.alpha-sidebar {
			order: 1;
		}

		.alpha-main {
			order: 0;
		}
	}
</style>
