<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { tripDraft } from '$lib/stores/tripDraft.js';
	import FocusStep1 from './FocusStep1.svelte';
	import CostStep from './CostStep.svelte';
	import FocusShell from '$lib/components/wizard/FocusShell.svelte';
	import RoomBedPicker from '$lib/components/wizard/RoomBedPicker.svelte';
	import PublishPaymentModal from '$lib/components/wizard/PublishPaymentModal.svelte';

	let { data } = $props();

	const stepNumber = $derived(() => {
		const match = $page.url.pathname.match(/\/step\/(\d+)/);
		return match ? parseInt(match[1]) : 1;
	});

	let draft = $state({ ...$tripDraft });
	let publishModalOpen = $state(false);

	$effect(() => {
		const unsubscribe = tripDraft.subscribe((value) => {
			draft = { ...value };
		});
		return unsubscribe;
	});

	/* ── Redirect old steps 4 and 5 to step 3 ── */
	$effect(() => {
		const s = stepNumber();
		if (s === 4 || s === 5) goto('/trips/new/step/3', { replaceState: true });
	});

	/* ── Autosave with debounce ── */
	let autosaveTimeout: ReturnType<typeof setTimeout> | null = null;
	function autosave() {
		if (autosaveTimeout) clearTimeout(autosaveTimeout);
		autosaveTimeout = setTimeout(() => tripDraft.save(draft), 500);
	}

	function prevStep() {
		const s = stepNumber();
		if (s <= 1) { goto('/trips'); return; }
		goto(`/trips/new/step/${s - 1}`);
	}

	function handleNextStep() {
		const s = stepNumber();
		if (s < 3) goto(`/trips/new/step/${s + 1}`);
	}

	/* ── Publish modal handlers ── */
	function openPublishModal() {
		tripDraft.save(draft);
		publishModalOpen = true;
	}

	async function handlePublish(opts: {
		splitCost: boolean;
		discountWaived: boolean;
		discountCode?: string;
		paymentIntentId?: string;
	}) {
		const res = await fetch('/api/trips/publish', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				...draft,
				isPublished: true,
				splitCost: opts.splitCost,
				...(opts.discountCode ? { discountCode: opts.discountCode } : {}),
				...(opts.paymentIntentId ? { paymentIntentId: opts.paymentIntentId } : {})
			})
		});
		const result = await res.json().catch(() => ({}));
		if (!res.ok) throw new Error(result.error || `Request failed (${res.status})`);
		if (!result.tripId) throw new Error(result.error || 'Failed to create trip');
		tripDraft.clear();
		goto(`/trips/${result.tripId}`);
	}

	async function handleSaveDraft(opts: { splitCost: boolean }) {
		const res = await fetch('/api/trips/publish', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				...draft,
				isPublished: false,
				splitCost: opts.splitCost
			})
		});
		const result = await res.json().catch(() => ({}));
		if (!res.ok) throw new Error(result.error || `Request failed (${res.status})`);
		if (!result.tripId) throw new Error(result.error || 'Failed to save draft');
		tripDraft.clear();
		goto(`/trips/${result.tripId}`);
	}

	/* ── Step 2 rooms validation ── */
	const roomsCanContinue = $derived(
		draft.rooms.length > 0 &&
		draft.rooms.every((r) => r.beds && r.beds.length > 0)
	);
</script>

{#if stepNumber() === 1}
	<FocusStep1 bind:draft {autosave} {handleNextStep} />

{:else if stepNumber() === 2}
	<!-- Rooms page: FocusShell wraps the content at this level -->
	<FocusShell progressPercent={80} stepLabel="Rooms" onBack={prevStep}>
		<div class="rooms-page">
			<!-- Header block -->
			<header class="rooms-header">
				<div class="rooms-accent" aria-hidden="true"></div>
				<p class="rooms-eyebrow">Rooms</p>
				<h1 class="rooms-heading">Add a card for each bedroom.</h1>
				<p class="rooms-sub">One card per bedroom. Photo at the top so guests know what they're getting.</p>
			</header>

			<!-- Room cards via RoomBedPicker -->
			<RoomBedPicker bind:draft {autosave} />


			<!-- Sticky footer -->
			<footer class="rooms-footer">
				<button type="button" class="rooms-btn-back" onclick={prevStep}>Back</button>
				<button
					type="button"
					class="rooms-btn-continue"
					onclick={handleNextStep}
					disabled={!roomsCanContinue}
					title={!roomsCanContinue ? 'Add at least one room with beds to continue' : ''}
				>
					Rooms look good. Continue →
				</button>
			</footer>
		</div>
	</FocusShell>

{:else if stepNumber() === 3}
	<CostStep
		bind:draft
		{autosave}
		{prevStep}
		{openPublishModal}
		{handleSaveDraft}
	/>
{/if}

<PublishPaymentModal
	open={publishModalOpen}
	expectedGuests={Math.max(1, draft.expectedGuestCount || 1)}
	showSaveAsDraft={true}
	onPublish={handlePublish}
	onSaveDraft={handleSaveDraft}
	onClose={() => (publishModalOpen = false)}
/>

<style>
	/* ── Rooms page layout ────────────────────────────────── */
	.rooms-page {
		width: 100%;
		max-width: 640px;
		margin: 0 auto;
		padding-bottom: 6rem;
	}

	/* ── Header block ─────────────────────────────────────── */
	.rooms-header {
		margin-bottom: 24px;
	}

	.rooms-accent {
		width: 36px;
		height: 3px;
		border-radius: 2px;
		background: var(--sand);
		margin-bottom: 14px;
	}

	.rooms-eyebrow {
		font-size: 0.625rem;
		font-weight: 700;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--muted);
		margin: 0 0 10px;
	}

	.rooms-heading {
		font-family: 'Fraunces', Georgia, serif;
		font-size: 1.625rem;
		font-weight: 600;
		color: var(--text);
		margin: 0 0 6px;
		letter-spacing: -0.02em;
	}

	.rooms-sub {
		font-size: 0.8125rem;
		color: var(--muted);
		margin: 0;
		line-height: 1.5;
	}

	/* ── Sticky footer ────────────────────────────────────── */
	.rooms-footer {
		position: fixed;
		bottom: 0;
		left: 0;
		right: 0;
		z-index: 50;
		background: white;
		border-top: 1px solid var(--border);
		padding: 14px 24px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
	}

	.rooms-btn-back {
		background: none;
		border: none;
		font-family: inherit;
		font-size: 0.875rem;
		color: var(--muted);
		cursor: pointer;
		padding: 0 8px;
	}

	.rooms-btn-back:hover {
		color: var(--text);
	}

	.rooms-btn-continue {
		height: 44px;
		padding: 0 24px;
		border-radius: 10px;
		font-family: inherit;
		font-size: 0.875rem;
		font-weight: 600;
		color: white;
		background: var(--navy);
		border: none;
		cursor: pointer;
		transition: opacity 150ms ease, transform 100ms ease;
	}

	.rooms-btn-continue:hover:not(:disabled) {
		opacity: 0.92;
		transform: translateY(-1px);
	}

	.rooms-btn-continue:disabled {
		opacity: 0.4;
		cursor: not-allowed;
		transform: none;
	}

	/* ── Mobile ───────────────────────────────────────────── */
	@media (max-width: 480px) {
		.rooms-footer {
			padding: 12px 16px;
		}

		.rooms-btn-continue {
			flex: 1;
			font-size: 0.8125rem;
		}
	}
</style>
