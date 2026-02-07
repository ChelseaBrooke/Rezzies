<script lang="ts">
	import { goto } from '$app/navigation';
	import { tripToDraft } from '$lib/stores/tripDraft.js';
	import type { TripDraft } from '$lib/stores/tripDraft.js';
	import Step1 from '../../../../new/step/[stepNumber]/Step1.svelte';
	import PricingStep from '../../../../new/step/[stepNumber]/PricingStep.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// Reactive so content and nav update when navigating between step/1, step/2, etc.
	const tripId = $derived(data.trip?.id ?? '');
	const stepNumber = $derived(data.stepNumber ?? 1);
	const editMode = true;

	// Draft from trip (edit mode) – initialize once so edits aren’t overwritten
	let draft = $state<TripDraft>(tripToDraft(data.trip));

	function autosave() {
		// No-op for edit mode; save only on "Save changes"
	}

	function nextStep() {
		if (stepNumber < 2) {
			goto(`/trips/${tripId}/settings/step/${stepNumber + 1}`);
		}
	}

	function prevStep() {
		if (stepNumber > 1) {
			goto(`/trips/${tripId}/settings/step/${stepNumber - 1}`);
		}
	}

	let validationError = $state<string | null>(null);

	function checkCanProceed(): boolean {
		if (stepNumber === 1) {
			if (!draft.name || !draft.checkInDate || !draft.checkOutDate || draft.rooms.length === 0 || !draft.totalTripCost) {
				return false;
			}
			// In edit mode, allow proceeding without photos
			if (!editMode) {
				const hasPhotos =
					(draft.galleryPhotos && draft.galleryPhotos.length > 0) ||
					draft.rooms.some((room) => room.photos && room.photos.length > 0);
				if (!hasPhotos) return false;
			}
			return true;
		}
		return true;
	}

	const canProceed = $derived(checkCanProceed());

	$effect(() => {
		if (stepNumber === 1) {
			if (!canProceed) {
				if (!draft.name || !draft.checkInDate || !draft.checkOutDate || draft.rooms.length === 0 || !draft.totalTripCost) {
					validationError = null;
				} else if (!editMode) {
					const hasPhotos =
						(draft.galleryPhotos && draft.galleryPhotos.length > 0) ||
						draft.rooms.some((room) => room.photos && room.photos.length > 0);
					validationError = hasPhotos ? null : 'Please upload at least one photo as the main event photo before continuing.';
				} else {
					validationError = null;
				}
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

	let isSaving = $state(false);
	let saveError = $state<string | null>(null);

	async function handleSave() {
		saveError = null;
		isSaving = true;
		try {
			const res = await fetch(`/api/trips/${tripId}/update`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(draft)
			});
			const result = await res.json().catch(() => ({}));
			if (!res.ok) {
				saveError = result.error || `Save failed (${res.status})`;
				return;
			}
			goto(`/trips/${tripId}`);
		} catch (e) {
			saveError = e instanceof Error ? e.message : 'Failed to save trip';
		} finally {
			isSaving = false;
		}
	}
</script>

{#if stepNumber === 1 && validationError}
	<div class="validation-error">{validationError}</div>
{/if}
{#if stepNumber === 1}
	<Step1 bind:draft {autosave} {prevStep} handleNextStep={handleNextStep} {canProceed} />
{:else if stepNumber === 2}
	<PricingStep bind:draft {autosave} />
{/if}

{#if validationError}
	<div class="validation-error">{validationError}</div>
{/if}
{#if stepNumber === 2 && saveError}
	<div class="validation-error">{saveError}</div>
{/if}
<div class="card-footer">
	<button type="button" class="btn-back" onclick={prevStep} disabled={stepNumber === 1}>
		Back
	</button>
	<div class="footer-right">
		{#if stepNumber < 2}
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
				onclick={handleSave}
				disabled={isSaving}
			>
				{isSaving ? 'Saving…' : 'Save changes'}
			</button>
		{/if}
	</div>
</div>

<style>
	.card-footer {
		margin-top: auto;
		padding-top: 2rem;
		border-top: 1px solid var(--border);
		display: flex;
		justify-content: space-between;
		align-items: center;
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

	.btn-back:hover:not(:disabled) {
		color: var(--text);
	}

	.btn-back:disabled {
		opacity: 0.5;
		cursor: default;
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

	.btn-next:disabled,
	.btn-publish:disabled {
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
