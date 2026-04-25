<script lang="ts">
	import { browser } from '$app/environment';
	import PollCard from '$lib/components/trips/polls/PollCard.svelte';
	import OnboardingTooltip from '$lib/components/ui/OnboardingTooltip.svelte';
	import { getTooltip } from '$lib/config/onboardingTooltips.js';

	type UnansweredPollItem = {
		id: string;
		title: string;
		pollType: string;
		options: Array<{ id: string; label: string }>;
	};

	const FADE_MS = 260;

	let { tripId, isHost = false }: { tripId: string; isHost?: boolean } = $props();

	const pollsTip = $derived(getTooltip(isHost ? 'host_polls' : 'guest_polls'));

	let queue = $state<UnansweredPollItem[]>([]);
	let carouselIndex = $state(0);
	let everHadPolls = $state(false);
	let votingOptionId = $state<string | null>(null);
	let pollExiting = $state(false);
	let playWrapExit = $state(false);
	let dismissed = $state(false);

	const currentPoll = $derived(queue[carouselIndex] ?? null);
	const outerVisible = $derived(!dismissed && (queue.length > 0 || playWrapExit));

	$effect(() => {
		if (queue.length > 0) everHadPolls = true;
	});

	$effect(() => {
		if (carouselIndex >= queue.length) carouselIndex = Math.max(0, queue.length - 1);
	});

	async function fetchUnanswered() {
		if (!tripId) return;
		try {
			const res = await fetch(`/trips/${tripId}/polls/unanswered`);
			const data = await res.json().catch(() => ({ polls: [] }));
			const next = Array.isArray(data.polls) ? data.polls : [];
			queue = next;
			if (next.length > 0) everHadPolls = true;
		} catch {
			queue = [];
		}
	}

	$effect(() => {
		if (!browser || !tripId) return;
		fetchUnanswered();
	});

	async function submitVote(pollId: string, optionId: string) {
		const formData = new FormData();
		formData.set('pollId', pollId);
		formData.set('optionIds', optionId);
		await fetch(`/trips/${tripId}/polls?/vote`, { method: 'POST', body: formData }).catch(() => {});
	}

	function handleVote(optionId: string) {
		const poll = currentPoll;
		if (!poll || votingOptionId !== null) return;

		votingOptionId = optionId;
		pollExiting = true;
		submitVote(poll.id, optionId);

		setTimeout(() => {
			const hadMultiple = queue.length > 1;
			const next = queue.filter((_, i) => i !== carouselIndex);
			votingOptionId = null;
			pollExiting = false;
			queue = next;
			if (hadMultiple && carouselIndex >= next.length) {
				carouselIndex = Math.max(0, next.length - 1);
			}
			if (next.length === 0 && everHadPolls) {
				playWrapExit = true;
			}
		}, FADE_MS);
	}

	function prev() {
		if (queue.length < 2) return;
		carouselIndex = (carouselIndex - 1 + queue.length) % queue.length;
	}

	function next() {
		if (queue.length < 2) return;
		carouselIndex = (carouselIndex + 1) % queue.length;
	}

	function onWrapAnimEnd(e: AnimationEvent) {
		if (e.target !== e.currentTarget) return;
		if (e.animationName !== 'vac-polls-blink-away') return;
		dismissed = true;
		playWrapExit = false;
	}
</script>

{#if outerVisible}
	<div
		class="v-hero-polls"
		class:v-hero-polls--blink-out={playWrapExit && queue.length === 0}
		class:v-hero-polls--done-reposition={playWrapExit && queue.length === 0}
		onanimationend={onWrapAnimEnd}
		role="region"
		aria-label={playWrapExit ? 'All polls answered' : 'Open polls for you'}
	>
				{#if playWrapExit && queue.length === 0}
					<div class="v-hero-polls-done">
						<span class="v-hero-polls-done-emoji" aria-hidden="true">✨</span>
						<p class="v-hero-polls-done-text">All caught up!</p>
					</div>
				{:else if currentPoll}
					<div class="v-hero-polls-head">
						<span class="v-hero-polls-label">Your polls</span>
						{#if queue.length > 1}
							<span class="v-hero-polls-count">{carouselIndex + 1} / {queue.length}</span>
						{/if}
					</div>
					<div class="v-hero-polls-card-wrap" class:exiting={pollExiting}>
						<PollCard poll={currentPoll} onVote={handleVote} disabled={votingOptionId !== null} />
					</div>
					{#if queue.length > 1}
						<div class="v-hero-polls-nav">
							<button type="button" class="v-hero-polls-nav-btn" onclick={prev} aria-label="Previous poll">
								‹
							</button>
							<div class="v-hero-polls-dots" role="tablist" aria-label="Polls">
								{#each queue as _, i}
									<button
										type="button"
										class="v-hero-polls-dot"
										class:active={i === carouselIndex}
										onclick={() => (carouselIndex = i)}
										aria-label="Poll {i + 1}"
										aria-current={i === carouselIndex ? 'true' : undefined}
									></button>
								{/each}
							</div>
							<button type="button" class="v-hero-polls-nav-btn" onclick={next} aria-label="Next poll">
								›
							</button>
						</div>
					{/if}
					<a href="/trips/{tripId}/polls" class="v-hero-polls-all">All polls →</a>
					{#if pollsTip}
						<OnboardingTooltip
							key={pollsTip.key}
							title={pollsTip.title}
							body={pollsTip.body}
							position={pollsTip.position}
							align={pollsTip.align}
						/>
					{/if}
				{/if}
	</div>
{/if}

<style>
	.v-hero-polls {
		position: absolute;
		bottom: 6.75rem;
		right: calc(var(--v-right, min(360px, 32vw)) + 0.5rem);
		z-index: 11;
		width: min(300px, calc(100vw - var(--v-right, 360px) - 2.5rem));
		max-width: 300px;
		display: flex;
		flex-direction: column;
		align-items: stretch;
		gap: 0.5rem;
		pointer-events: auto;
	}

	.v-hero-polls-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
	}

	.v-hero-polls-label {
		font-size: 0.5625rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.12em;
		color: rgba(255, 255, 255, 0.88);
		text-shadow: 0 1px 6px rgba(0, 0, 0, 0.45);
	}

	.v-hero-polls-count {
		font-size: 0.6875rem;
		font-weight: 700;
		color: rgba(255, 255, 255, 0.75);
		text-shadow: 0 1px 4px rgba(0, 0, 0, 0.4);
	}

	.v-hero-polls-card-wrap {
		transition:
			opacity 0.26s ease,
			transform 0.26s ease;
	}
	.v-hero-polls-card-wrap.exiting {
		opacity: 0;
		transform: translateY(-6px);
		pointer-events: none;
	}

	.v-hero-polls-card-wrap :global(.poll-card) {
		width: 100%;
		max-width: 100%;
		min-height: 0;
		box-shadow: 0 12px 40px rgba(0, 0, 0, 0.22);
		border: 1px solid rgba(255, 255, 255, 0.35);
	}

	.v-hero-polls-nav {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.35rem;
	}

	.v-hero-polls-nav-btn {
		width: 2rem;
		height: 2rem;
		border-radius: 9999px;
		border: 1px solid rgba(255, 255, 255, 0.35);
		background: rgba(255, 255, 255, 0.16);
		backdrop-filter: blur(8px);
		color: #fff;
		font-size: 1.25rem;
		line-height: 1;
		cursor: pointer;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding-bottom: 2px;
		transition: background 0.15s ease;
	}
	.v-hero-polls-nav-btn:hover {
		background: rgba(255, 255, 255, 0.28);
	}

	.v-hero-polls-dots {
		display: flex;
		align-items: center;
		gap: 0.35rem;
	}

	.v-hero-polls-dot {
		width: 7px;
		height: 7px;
		border-radius: 9999px;
		border: none;
		padding: 0;
		background: rgba(255, 255, 255, 0.35);
		cursor: pointer;
		transition:
			transform 0.15s ease,
			background 0.15s ease;
	}
	.v-hero-polls-dot.active {
		background: #fff;
		transform: scale(1.15);
	}

	.v-hero-polls-all {
		font-size: 0.75rem;
		font-weight: 600;
		color: rgba(255, 255, 255, 0.92);
		text-decoration: none;
		text-shadow: 0 1px 4px rgba(0, 0, 0, 0.35);
		align-self: flex-end;
	}
	.v-hero-polls-all:hover {
		text-decoration: underline;
		text-underline-offset: 2px;
	}

	.v-hero-polls-done {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.35rem;
		padding: 1.25rem 1rem;
		border-radius: var(--radius-xl, 16px);
		background: rgba(255, 255, 255, 0.95);
		box-shadow: 0 12px 40px rgba(0, 0, 0, 0.2);
		border: 1px solid rgba(255, 255, 255, 0.5);
		min-height: 120px;
	}

	.v-hero-polls-done-emoji {
		font-size: 1.6rem;
		line-height: 1;
	}

	.v-hero-polls-done-text {
		margin: 0;
		font-size: 0.9375rem;
		font-weight: 700;
		color: var(--text, #152a2c);
	}

	.v-hero-polls--blink-out {
		animation: vac-polls-blink-away 0.75s ease forwards;
	}

	/* Nudge the “all caught up” state slightly higher in the hero than active polls */
	.v-hero-polls--done-reposition {
		bottom: 8.9rem;
	}

	@keyframes vac-polls-blink-away {
		0% {
			opacity: 1;
			transform: scale(1) translateY(0);
		}
		14% {
			opacity: 0.22;
			transform: scale(0.99) translateY(0);
		}
		100% {
			opacity: 0;
			transform: scale(0.9) translateY(-16px);
		}
	}

	@media (max-width: 1100px) {
		.v-hero-polls {
			right: 1.25rem;
			width: min(300px, calc(100% - 2.5rem));
		}
		.v-hero-polls--done-reposition {
			bottom: 7.4rem;
		}
	}

	@media (max-width: 640px) {
		.v-hero-polls {
			bottom: 5.5rem;
			right: 1rem;
			width: min(280px, calc(100vw - 2rem));
			max-width: none;
		}
		.v-hero-polls--done-reposition {
			bottom: 7.1rem;
		}
	}
</style>
