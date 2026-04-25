<script lang="ts">
	interface GameCard {
		id: string;
		name: string;
		description: string;
		icon: string;
		color: string;
		colorBg: string;
		colorPattern: string;
		statusLine: string;
	}

	interface Props {
		onNavigate: (gameId: string) => void;
		activityItems?: ActivityItem[];
		/** Dashboard widget: shorter cards, no page header / activity strip, no descriptions */
		compact?: boolean;
		/** When set, only these games (in this order). Omit for full lobby. */
		allowedGameIds?: string[] | null;
		/** Per-game one-line status for compact mode (e.g. "Round 2 in progress") */
		gameStatusLines?: Record<string, string> | null;
	}

	interface ActivityItem {
		initials: string;
		name: string;
		action: string;
	}

	let {
		onNavigate,
		activityItems = [],
		compact = false,
		allowedGameIds = null,
		gameStatusLines = null
	}: Props = $props();

	const visibleCards = $derived.by((): GameCard[] => {
		if (!allowedGameIds?.length) return GAME_CARDS;
		const byId = new Map(GAME_CARDS.map((c) => [c.id, c]));
		return allowedGameIds.map((id) => byId.get(id)).filter((c): c is GameCard => Boolean(c));
	});

	function statusFor(cardId: string, fallback: string): string {
		const custom = gameStatusLines?.[cardId]?.trim();
		return custom || fallback;
	}

	const GAME_CARDS: GameCard[] = [
		{
			id: 'scavenger-bingo',
			name: 'Scavenger Hunt Bingo',
			description: 'Fill your board with trip photos. Complete a row to win.',
			icon: '🎯',
			color: '#1D9E75',
			colorBg: 'rgba(29,158,117,0.12)',
			colorPattern: '#178a63',
			statusLine: 'Photo bingo for the whole group',
		},
		{
			id: 'caption-this',
			name: 'Caption This',
			description: 'Post a photo. The group captions it. The funniest wins.',
			icon: '💬',
			color: '#CE5612',
			colorBg: 'rgba(206,86,18,0.1)',
			colorPattern: '#b34b10',
			statusLine: 'Anonymous captions, group voting',
		},
		{
			id: 'alphabet-hunt',
			name: 'Alphabet Hunt',
			description: 'Find something for every letter, A to Z. Furthest wins.',
			icon: '🔤',
			color: '#7850b4',
			colorBg: 'rgba(120,80,180,0.1)',
			colorPattern: '#6840a0',
			statusLine: 'A → Z photo race',
		},
		{
			id: 'daily-trivia',
			name: 'Daily Trivia',
			description: 'Answer questions about your crew. Most right answers wins.',
			icon: '❓',
			color: '#c08820',
			colorBg: 'rgba(192,136,32,0.1)',
			colorPattern: '#a87818',
			statusLine: 'Host-led trivia for the group',
		},
	];
</script>

<div class="lobby" class:lobby--compact={compact}>
	{#if !compact}
		<!-- Page header -->
		<header class="lobby-header">
			<h1 class="lobby-title">Games</h1>
			<p class="lobby-sub">Play together, wherever you are. Bragging rights await.</p>
		</header>

		<!-- Activity strip -->
		<div class="activity-strip-wrap" aria-label="Recent game activity">
			<div class="activity-strip">
				{#if activityItems.length === 0}
					<div class="activity-pill activity-pill--empty">
						No activity yet — be the first to play
					</div>
				{:else}
					{#each activityItems.slice(0, 6) as item}
						<div class="activity-pill">
							<span class="ap-avatar" aria-hidden="true">{item.initials}</span>
							<span class="ap-text"><strong>{item.name}</strong> {item.action}</span>
						</div>
					{/each}
				{/if}
			</div>
		</div>
	{/if}

	<!-- Game cards 2×2 -->
	<div class="games-grid">
		{#each visibleCards as card}
			<button
				type="button"
				class="game-card"
				onclick={() => onNavigate(card.id)}
				aria-label="Play {card.name}"
			>
				<!-- Illustration zone -->
				<div class="card-art" style="background: {card.color};">
					<!-- CSS pattern circles -->
					<span class="card-art-circle card-art-circle--1" style="background: {card.colorPattern};" aria-hidden="true"></span>
					<span class="card-art-circle card-art-circle--2" style="background: {card.colorPattern};" aria-hidden="true"></span>
					<span class="card-art-circle card-art-circle--3" style="background: {card.colorPattern};" aria-hidden="true"></span>
					<span class="card-art-emoji" aria-hidden="true">{card.icon}</span>
				</div>

				<!-- Card body -->
				<div class="card-body">
					<div class="card-body-main">
						<h2 class="card-name">{card.name}</h2>
						{#if !compact}
							<p class="card-desc">{card.description}</p>
						{/if}
						<p class="card-status">{compact ? statusFor(card.id, 'Start playing →') : card.statusLine}</p>
					</div>
					<span class="card-chevron" aria-hidden="true">→</span>
				</div>
			</button>
		{/each}
	</div>
</div>

<style>
	.lobby {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
		min-width: 0;
	}

	/* ── Header ── */
	.lobby-header {
		padding-top: 1.5rem;
	}

	.lobby-title {
		font-family: 'Fraunces', Georgia, serif;
		font-size: clamp(1.5rem, 4vw, 1.875rem);
		font-weight: 700;
		color: #1d4d4e;
		margin: 0 0 0.3rem;
		letter-spacing: -0.025em;
	}

	.lobby-sub {
		font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
		font-size: 0.9375rem;
		color: #64748b;
		margin: 0;
	}

	/* ── Activity strip ── */
	.activity-strip-wrap {
		overflow: hidden;
	}

	.activity-strip {
		display: flex;
		gap: 0.5rem;
		overflow-x: auto;
		scroll-padding: 0 16px;
		padding: 0 2px 6px;
		scrollbar-width: none;
		-webkit-overflow-scrolling: touch;
	}

	.activity-strip::-webkit-scrollbar {
		display: none;
	}

	.activity-pill {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		background: rgba(47, 119, 120, 0.09);
		border-radius: 999px;
		padding: 0 12px 0 4px;
		height: 32px;
		white-space: nowrap;
		flex-shrink: 0;
		font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
		font-size: 0.8125rem;
		color: #1d4d4e;
	}

	.activity-pill--empty {
		color: #94a3b8;
		background: #f1f5f9;
		font-style: italic;
	}

	.ap-avatar {
		width: 24px;
		height: 24px;
		border-radius: 50%;
		background: #2f7778;
		color: white;
		font-size: 0.5625rem;
		font-weight: 700;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		letter-spacing: 0.02em;
	}

	/* ── Game grid ── */
	.games-grid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 1rem;
	}

	/* ── Game card ── */
	.game-card {
		display: flex;
		flex-direction: column;
		background: white;
		border-radius: 14px;
		border: 1.5px solid #e2e8f0;
		overflow: hidden;
		cursor: pointer;
		font: inherit;
		text-align: left;
		padding: 0;
		transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
		box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04), 0 0 0 0px rgba(47, 119, 120, 0);
	}

	.game-card:hover {
		transform: translateY(-3px);
		box-shadow: 0 6px 24px rgba(29, 77, 78, 0.13);
		border-color: #2f7778;
	}

	.game-card:focus-visible {
		outline: 2px solid #2f7778;
		outline-offset: 2px;
	}

	/* Illustration zone */
	.card-art {
		position: relative;
		height: 120px;
		overflow: hidden;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}
	.lobby--compact .card-art {
		height: 70px;
	}
	.lobby--compact .card-art-emoji {
		font-size: 1.85rem;
	}
	.lobby--compact .card-art-circle--1 {
		width: 72px;
		height: 72px;
		top: -24px;
		left: -16px;
	}
	.lobby--compact .card-art-circle--2 {
		width: 48px;
		height: 48px;
		bottom: -12px;
		right: -6px;
	}
	.lobby--compact .card-art-circle--3 {
		width: 32px;
		height: 32px;
		top: 6px;
		right: 18px;
	}

	.card-art-circle {
		position: absolute;
		border-radius: 50%;
		opacity: 0.45;
	}

	.card-art-circle--1 {
		width: 120px;
		height: 120px;
		top: -40px;
		left: -30px;
	}

	.card-art-circle--2 {
		width: 80px;
		height: 80px;
		bottom: -20px;
		right: -10px;
	}

	.card-art-circle--3 {
		width: 50px;
		height: 50px;
		top: 10px;
		right: 30px;
		opacity: 0.25;
	}

	.card-art-emoji {
		font-size: 2.75rem;
		position: relative;
		z-index: 1;
		filter: drop-shadow(0 2px 6px rgba(0,0,0,0.18));
	}

	/* Card body */
	.card-body {
		display: flex;
		align-items: flex-start;
		gap: 0.5rem;
		padding: 0.875rem 1rem;
		flex: 1;
	}

	.card-body-main {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
	}

	.card-name {
		font-family: 'Fraunces', Georgia, serif;
		font-size: 1.0625rem;
		font-weight: 700;
		color: #1d4d4e;
		margin: 0;
		letter-spacing: -0.015em;
		line-height: 1.25;
	}

	.card-desc {
		font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
		font-size: 0.8125rem;
		color: #475569;
		margin: 0;
		line-height: 1.4;
	}

	.card-status {
		font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
		font-size: 0.6875rem;
		color: #94a3b8;
		margin: 0.2rem 0 0;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		font-weight: 600;
	}
	.lobby--compact .card-status {
		font-size: 12px;
		text-transform: none;
		letter-spacing: normal;
		font-weight: 500;
		color: #64748b;
	}

	.card-chevron {
		color: #2f7778;
		font-size: 1.125rem;
		flex-shrink: 0;
		align-self: center;
		opacity: 0.7;
	}

	/* ── Mobile ── */
	@media (max-width: 767px) {
		.lobby-header {
			padding-top: 1.5rem;
		}

		.lobby-title {
			font-size: 1.5rem;
		}

		.lobby-sub {
			font-size: 0.8125rem;
		}

		.activity-strip {
			padding: 0 16px 6px;
			margin: 0 -16px;
		}

		.activity-pill {
			height: 36px;
		}

		.games-grid {
			grid-template-columns: 1fr;
			gap: 0.75rem;
		}

		.card-art {
			height: 100px;
		}

		.card-art-emoji {
			font-size: 2.25rem;
		}

		.card-art-circle--1 { width: 90px; height: 90px; }
		.card-art-circle--2 { width: 64px; height: 64px; }

		.card-body {
			align-items: center;
			padding: 0.75rem 1rem;
		}

		.card-name {
			font-size: 1rem;
		}

		.card-desc {
			font-size: 0.8125rem;
		}
	}
</style>
