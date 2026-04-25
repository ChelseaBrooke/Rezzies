<script lang="ts">
	import { goto } from '$app/navigation';
	import type { PageData } from './$types';
	import type { GameId } from '$lib/stores/tripGames.js';
	import { GAME_DEFS } from '$lib/stores/tripGames.js';

	// New game components
	import GameLobby from '$lib/components/games/GameLobby.svelte';
	import GameShell from '$lib/components/games/GameShell.svelte';
	import ScavengerBingo from '$lib/components/games/ScavengerBingo.svelte';
	import AlphabetHunt from '$lib/components/games/AlphabetHunt.svelte';
	import DailyTrivia from '$lib/components/games/DailyTrivia.svelte';
	import type { LeaderboardPlayer } from '$lib/components/games/GameLeaderboard.svelte';

	// Caption This keeps its existing embed
	import CaptionThisEmbed from '$lib/components/games/caption-this/CaptionThisEmbed.svelte';

	let { data, form }: { data: PageData; form?: unknown } = $props();

	const tripId  = $derived(data.trip?.id ?? '');
	const userId  = $derived(data.user?.id ?? '');
	const tripGames = $derived(data.tripGames ?? []);

	// ── Active game: read from ?game= URL param ────────────────────────────────
	const activeGameId = $derived((data.gameParam as GameId | null) ?? null);

	const activeGame = $derived(
		activeGameId ? tripGames.find((g) => g.gameId === activeGameId) ?? null : null
	);

	// ── Navigation ────────────────────────────────────────────────────────────
	function navigateToGame(gameId: string) {
		goto(`/trips/${tripId}/games?game=${encodeURIComponent(gameId)}`, { replaceState: false });
	}

	function backToLobby() {
		goto(`/trips/${tripId}/games`, { replaceState: false });
	}

	// ── Helpers ───────────────────────────────────────────────────────────────
	function initials(name: string | null | undefined): string {
		if (!name?.trim()) return '?';
		const parts = name.trim().split(/\s+/);
		return parts.length >= 2
			? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
			: name.slice(0, 2).toUpperCase();
	}

	// Build players list for leaderboards
	// TODO: wire to real per-game score API so scores reflect actual progress
	const players = $derived<LeaderboardPlayer[]>(
		(data.members ?? []).map((m: { userId: string; name: string | null }) => ({
			userId: m.userId,
			name: m.name,
			initials: initials(m.name),
			score: 0,
			scoreLabel: '0',
			isCurrentUser: m.userId === userId,
		}))
	);

	// Current user info
	const currentUserName = $derived(data.user?.name ?? null);
	const currentUserInitials = $derived(initials(currentUserName));

	// For Daily Trivia: is the current user the one who "added" (hosts) this game?
	const isTriviaHost = $derived(
		!!(activeGame && activeGame.gameId === 'daily-trivia' && activeGame.addedByUserId === userId)
	);

	// ── Game config map ───────────────────────────────────────────────────────
	type GameColor = 'teal' | 'coral' | 'purple' | 'amber';
	const GAME_CONFIG: Record<string, { color: GameColor; icon: string; name: string }> = {
		'scavenger-bingo': { color: 'teal',   icon: '🎯', name: 'Scavenger Hunt Bingo' },
		'caption-this':    { color: 'coral',  icon: '💬', name: 'Caption This' },
		'alphabet-hunt':   { color: 'purple', icon: '🔤', name: 'Alphabet Hunt' },
		'daily-trivia':    { color: 'amber',  icon: '❓', name: 'Daily Trivia' },
	};

	const activeConfig = $derived(
		activeGameId ? (GAME_CONFIG[activeGameId] ?? GAME_CONFIG['scavenger-bingo']) : null
	);

	// ── Activity strip: placeholder — TODO wire to real activity/event API ────
	// Currently returns an empty array; swap in real data when endpoint is ready.
	const activityItems: Array<{ initials: string; name: string; action: string }> = [];
</script>

<div class="games-page">
	{#if activeGameId && activeGame && activeConfig}
		<!-- ── Individual game view ── -->
		<GameShell
			gameName={activeConfig.name}
			gameIcon={activeConfig.icon}
			gameColor={activeConfig.color}
			onBack={backToLobby}
		>
			{#if activeGameId === 'scavenger-bingo'}
				<ScavengerBingo
					{tripId}
					tripGameId={activeGame.id}
					{userId}
					userName={currentUserName}
					userInitials={currentUserInitials}
					{players}
				/>

			{:else if activeGameId === 'caption-this'}
				<CaptionThisEmbed
					round={data.captionThis?.round ?? null}
					leaderboard={data.captionThis?.leaderboard ?? []}
					pastRounds={data.captionThis?.pastRounds ?? []}
					currentUserId={data.captionThis?.currentUserId ?? null}
					tripTimezone={data.captionThis?.tripTimezone ?? 'UTC'}
					captionMaxLength={data.captionThis?.captionMaxLength ?? 120}
					eligibleCaptionCount={data.captionThis?.eligibleCaptionCount ?? 0}
					{form}
					activeTabId={activeGame.id}
				/>

			{:else if activeGameId === 'alphabet-hunt'}
				<AlphabetHunt
					{tripId}
					tripGameId={activeGame.id}
					{userId}
					userName={currentUserName}
					userInitials={currentUserInitials}
					{players}
				/>

			{:else if activeGameId === 'daily-trivia'}
				<DailyTrivia
					{tripId}
					tripGameId={activeGame.id}
					{userId}
					isHostOfGame={isTriviaHost}
					{players}
				/>
			{/if}
		</GameShell>

	{:else}
		<!-- ── Game lobby ── -->
		<GameLobby
			onNavigate={navigateToGame}
			{activityItems}
		/>
	{/if}
</div>

<style>
	.games-page {
		width: 100%;
		min-width: 0;
		padding: 0 0 2rem;
	}

	@media (max-width: 767px) {
		.games-page {
			padding: 0 16px 2rem;
		}
	}
</style>
