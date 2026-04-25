<script lang="ts">
	import { browser } from '$app/environment';
	import PollCard from './PollCard.svelte';
	import OnboardingTooltip from '$lib/components/ui/OnboardingTooltip.svelte';
	import { getTooltip } from '$lib/config/onboardingTooltips.js';

	/** Matches GET /trips/[tripId]/polls/unanswered response item */
	type UnansweredPollItem = {
		id: string;
		title: string;
		pollType: string;
		options: Array<{ id: string; label: string }>;
	};

	const FADE_OUT_MS = 250;
	const FADE_IN_DELAY_MS = 80;

	let {
		tripId,
		/** 'hero' = upper-right of main photo (parent must be position: relative); 'sidebar-left' = left of vacation right sidebar; 'viewport' = fixed to viewport (default) */
		placement = 'viewport',
		isHost = false
	}: { tripId: string; placement?: 'viewport' | 'hero' | 'sidebar-left'; isHost?: boolean } = $props();

	const pollsTip = $derived(getTooltip(isHost ? 'host_polls' : 'guest_polls'));

	let queue = $state<UnansweredPollItem[]>([]);
	let loading = $state(true);
	let isExiting = $state(false);
	let isEntering = $state(true);
	let votingOptionId = $state<string | null>(null);

	const currentPoll = $derived(queue[0] ?? null);
	const showCard = $derived(queue.length > 0);

	async function fetchUnanswered() {
		if (!tripId) return;
		loading = true;
		try {
			const res = await fetch(`/trips/${tripId}/polls/unanswered`);
			const data = await res.json().catch(() => ({ polls: [] }));
			queue = Array.isArray(data.polls) ? data.polls : [];
			isEntering = true;
		} finally {
			loading = false;
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
		await fetch(`/trips/${tripId}/polls?/vote`, {
			method: 'POST',
			body: formData
		}).catch(() => {});
	}

	function handleVote(optionId: string) {
		const poll = currentPoll;
		if (!poll || votingOptionId !== null) return;

		votingOptionId = optionId;
		// Optimistic: fade out immediately
		isExiting = true;
		isEntering = false;

		// Submit in background (don't block UI)
		submitVote(poll.id, optionId);

		setTimeout(() => {
			queue = queue.slice(1);
			votingOptionId = null;
			isExiting = false;
			if (queue.length > 0) {
				isEntering = true;
			}
		}, FADE_OUT_MS);
	}
</script>

{#if showCard && currentPoll}
	<div
		class="poll-card-wrap"
		class:exiting={isExiting}
		class:entering={isEntering}
		class:placement-hero={placement === 'hero'}
		class:placement-sidebar={placement === 'sidebar-left'}
		role="region"
		aria-label="Unanswered poll"
	>
		<PollCard
			poll={currentPoll}
			onVote={handleVote}
			disabled={votingOptionId !== null}
		/>
		{#if pollsTip}
			<OnboardingTooltip
				key={pollsTip.key}
				title={pollsTip.title}
				body={pollsTip.body}
				position={pollsTip.position}
				align={pollsTip.align}
			/>
		{/if}
	</div>
{/if}

<style>
	.poll-card-wrap {
		position: fixed;
		top: 1rem;
		right: 1rem;
		z-index: 40;
		opacity: 1;
		transform: translateY(0);
		transition:
			opacity 0.25s ease,
			transform 0.25s ease;
	}

	/* Upper-right of main photo (parent must be position: relative) */
	.poll-card-wrap.placement-hero {
		position: absolute;
		top: 1rem;
		right: 1rem;
	}

	/* Left of vacation mode right sidebar (use inside .v where --v-right is set) */
	.poll-card-wrap.placement-sidebar {
		right: calc(var(--v-right, 360px) + 0.5rem);
	}

	.poll-card-wrap.entering {
		animation: poll-fade-in 0.28s ease forwards;
	}

	.poll-card-wrap.exiting {
		opacity: 0;
		transform: translateY(-6px);
		pointer-events: none;
	}

	@keyframes poll-fade-in {
		from {
			opacity: 0;
			transform: translateY(-6px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	@media (max-width: 640px) {
		.poll-card-wrap {
			top: 0.75rem;
			right: 0.75rem;
			left: 0.75rem;
			display: flex;
			justify-content: flex-end;
		}
		.poll-card-wrap :global(.poll-card) {
			max-width: 100%;
		}
	}
</style>
