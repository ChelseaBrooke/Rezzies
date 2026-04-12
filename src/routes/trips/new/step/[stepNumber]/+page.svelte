<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { tripDraft } from '$lib/stores/tripDraft.js';
	import Step1 from './Step1.svelte';
	import AddOnsStep from './AddOnsStep.svelte';
	import Step4 from './Step4.svelte';
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
	
	// Autosave with debounce
	let autosaveTimeout: ReturnType<typeof setTimeout> | null = null;
	function autosave() {
		if (autosaveTimeout) clearTimeout(autosaveTimeout);
		autosaveTimeout = setTimeout(() => {
			tripDraft.save(draft);
		}, 500);
	}
	
	function nextStep() {
		if (stepNumber() < 3) {
			goto(`/trips/new/step/${stepNumber() + 1}`);
		}
	}
	
	function prevStep() {
		if (stepNumber() === 1) {
			goto('/trips');
			return;
		}
		goto(`/trips/new/step/${stepNumber() - 1}`);
	}
	
	let validationError = $state<string | null>(null);
	
	function checkCanProceed(): boolean {
		const step = stepNumber();
		if (step === 1) {
			if (!draft.name || !draft.checkInDate || !draft.checkOutDate || draft.rooms.length === 0) {
				return false;
			}
			if (!(Number(draft.expectedGuestCount) >= 1)) {
				return false;
			}
			const hasPhotos =
				(draft.galleryPhotos && draft.galleryPhotos.length > 0) ||
				draft.rooms.some((room) => room.photos && room.photos.length > 0);
			if (!hasPhotos) return false;
			return true;
		}
		// Steps 2 and 3 are always progressable
		return true;
	}
	
	const canProceed = $derived(checkCanProceed());
	
	$effect(() => {
		const step = stepNumber();
		if (step === 1 && !canProceed) {
			const hasPhotos =
				(draft.galleryPhotos && draft.galleryPhotos.length > 0) ||
				draft.rooms.some((room) => room.photos && room.photos.length > 0);
			if (
				draft.name &&
				draft.checkInDate &&
				draft.checkOutDate &&
				draft.rooms.length > 0 &&
				!(Number(draft.expectedGuestCount) >= 1)
			) {
				validationError = 'Please enter a minimum headcount (realistic low).';
			} else if (draft.name && draft.checkInDate && draft.checkOutDate && draft.rooms.length > 0 && !hasPhotos) {
				validationError = 'Please upload at least one photo before continuing.';
			} else {
				validationError = null;
			}
		} else {
			validationError = null;
		}
	});
	
	function handleNextStep() {
		if (canProceed) {
			validationError = null;
			nextStep();
		}
	}

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
		const data = await res.json().catch(() => ({}));
		if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
		if (!data.tripId) throw new Error(data.error || 'Failed to create trip');
		tripDraft.clear();
		goto(`/trips/${data.tripId}`);
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
		const data = await res.json().catch(() => ({}));
		if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
		if (!data.tripId) throw new Error(data.error || 'Failed to save draft');
		tripDraft.clear();
		goto(`/trips/${data.tripId}`);
	}
</script>

<!-- Step Content -->
<div class="step-wrapper" class:step-wrapper--grow={stepNumber() === 1}>
	{#if stepNumber() === 1}
		{#if validationError}
			<div class="validation-error">{validationError}</div>
		{/if}
		<Step1 bind:draft {autosave} {prevStep} {handleNextStep} {canProceed} />
	{:else if stepNumber() === 2}
		<AddOnsStep bind:draft {autosave} />
	{:else if stepNumber() === 3}
		<Step4 {draft} />
	{/if}
</div>

<!-- Footer Actions -->
{#if validationError}
	<div class="validation-error">{validationError}</div>
{/if}
<div class="card-footer" class:card-footer--addons={stepNumber() === 2}>
	<button type="button" class="btn-back" onclick={prevStep}>
		Back
	</button>
	<div class="footer-right">
		<button type="button" class="btn-save-draft" onclick={() => tripDraft.save(draft)}>
			Save Draft
		</button>
		{#if stepNumber() < 3}
			<button
				type="button"
				class="btn-next"
				onclick={handleNextStep}
				disabled={!canProceed}
			>
				Next
			</button>
	{:else}
		<button
			type="button"
			class="btn-publish"
			onclick={openPublishModal}
		>
			Publish
		</button>
	{/if}
	</div>
</div>

<PublishPaymentModal
	open={publishModalOpen}
	expectedGuests={Math.max(1, draft.expectedGuestCount || 1)}
	showSaveAsDraft={true}
	onPublish={handlePublish}
	onSaveDraft={handleSaveDraft}
	onClose={() => (publishModalOpen = false)}
/>

<style>
	.step-wrapper {
		display: flex;
		flex-direction: column;
	}

	.step-wrapper--grow {
		flex: 1;
		min-height: 0;
	}

	.card-footer {
		position: sticky;
		bottom: 0;
		z-index: 10;
		margin-top: auto;
		padding: 1rem 0 1.25rem;
		border-top: 1px solid var(--border);
		background: white;
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	/* Trip Add-Ons (step 2): no divider line; sit closer to grid */
	.card-footer--addons {
		border-top: none;
		padding-top: 0.5rem;
	}
	
	.footer-right {
		display: flex;
		flex-direction: row;
		align-items: center;
		gap: 0.75rem;
	}
	
	.validation-error {
		color: var(--danger);
		font-size: 0.875rem;
		margin: 0;
		text-align: right;
	}
	
	.btn-back,
	.btn-save-draft,
	.btn-next,
	.btn-publish {
		padding: 0.75rem 1.5rem;
		border-radius: 0.5rem;
		font-size: 0.9375rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s ease;
		border: none;
		font-family: inherit;
	}
	
	.btn-back {
		background: transparent;
		color: var(--muted);
	}
	
	.btn-back:hover {
		color: var(--text);
	}
	
	.btn-save-draft {
		background: white;
		color: var(--text);
		border: 1px solid var(--border);
	}
	
	.btn-save-draft:hover {
		background: var(--bg);
	}
	
	.btn-next,
	.btn-publish {
		background: var(--primary);
		color: white;
	}
	
	.btn-next:hover:not(:disabled),
	.btn-publish:hover:not(:disabled) {
		background: var(--primary-dark);
	}
	
	.btn-next:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	
	@media (max-width: 768px) {
		.card-footer {
			flex-wrap: wrap;
			gap: 0.75rem;
		}
		
		.footer-right {
			width: 100%;
			justify-content: flex-end;
		}
	}
</style>
