<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { tripDraft } from '$lib/stores/tripDraft.js';
	import Step1 from './Step1.svelte';
	import Step2 from './Step2.svelte';
	import ActivitiesStep from './ActivitiesStep.svelte';
	import Step3 from './Step3.svelte';
	import Step4 from './Step4.svelte';
	
	let { data } = $props();
	
	const stepNumber = $derived(() => {
		const match = $page.url.pathname.match(/\/step\/(\d+)/);
		return match ? parseInt(match[1]) : 1;
	});
	
	let draft = $state({ ...tripDraft });
	
	// Load draft from store on mount
	$effect(() => {
		const unsubscribe = tripDraft.subscribe((value) => {
			draft = { ...value };
		});
		return unsubscribe;
	});
	
	// Autosave function with debounce
	let autosaveTimeout: ReturnType<typeof setTimeout> | null = null;
	function autosave() {
		if (autosaveTimeout) clearTimeout(autosaveTimeout);
		autosaveTimeout = setTimeout(() => {
			tripDraft.save(draft);
		}, 500);
	}
	
	function nextStep() {
		if (stepNumber() < 5) {
			goto(`/trips/new/step/${stepNumber() + 1}`);
		}
	}
	
	function prevStep() {
		if (stepNumber() > 1) {
			goto(`/trips/new/step/${stepNumber() - 1}`);
		}
	}
	
	let validationError = $state<string | null>(null);
	
	// Pure function that checks if we can proceed (doesn't update state)
	function checkCanProceed(): boolean {
		const step = stepNumber();
		if (step === 1) {
			// Check for required fields
			if (!draft.name || !draft.checkInDate || !draft.checkOutDate || draft.rooms.length === 0 || !draft.totalTripCost) {
				return false;
			}
			// Check for at least one photo
			const hasPhotos = (draft.galleryPhotos && draft.galleryPhotos.length > 0) || 
			                  draft.rooms.some(room => room.photos && room.photos.length > 0);
			if (!hasPhotos) {
				return false;
			}
			return true;
		}
		if (step === 2) {
			return true; // Meals & Activities is optional
		}
		return true;
	}
	
	// Derived value for whether we can proceed
	const canProceed = $derived(checkCanProceed());
	
	// Update validation error based on canProceed state
	$effect(() => {
		const step = stepNumber();
		if (step === 1) {
			if (!canProceed) {
				// Check what's missing
				if (!draft.name || !draft.checkInDate || !draft.checkOutDate || draft.rooms.length === 0 || !draft.totalTripCost) {
					validationError = null; // Don't show error for basic fields, just disable button
				} else {
					const hasPhotos = (draft.galleryPhotos && draft.galleryPhotos.length > 0) || 
					                  draft.rooms.some(room => room.photos && room.photos.length > 0);
					if (!hasPhotos) {
						validationError = 'Please upload at least one photo as the main event photo before continuing.';
					} else {
						validationError = null;
					}
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

	let isPublishing = $state(false);
	let publishError = $state<string | null>(null);

	async function handlePublish() {
		publishError = null;
		isPublishing = true;
		try {
			const res = await fetch('/api/trips/publish', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(draft)
			});
			const data = await res.json().catch(() => ({}));
			if (!res.ok) {
				publishError = data.error || `Publish failed (${res.status})`;
				return;
			}
			if (data.inviteCode) {
				tripDraft.clear();
				goto(`/trip/${data.inviteCode}`);
			} else {
				publishError = data.error || 'Publish failed';
			}
		} catch (e) {
			publishError = e instanceof Error ? e.message : 'Failed to publish trip';
		} finally {
			isPublishing = false;
		}
	}
</script>

<!-- Step Content - only the form grid changes -->
{#if stepNumber() === 1}
	{#if validationError}
		<div class="validation-error">{validationError}</div>
	{/if}
	<Step1 bind:draft {autosave} {prevStep} {handleNextStep} {canProceed} />
{:else if stepNumber() === 2}
	<Step2 bind:draft {autosave} />
{:else if stepNumber() === 3}
	<ActivitiesStep bind:draft {autosave} />
{:else if stepNumber() === 4}
	<Step3 bind:draft {autosave} />
{:else if stepNumber() === 5}
	<Step4 bind:draft />
{/if}

<!-- Footer Actions (for steps 2+) -->
{#if stepNumber() > 1}
	{#if validationError}
		<div class="validation-error">{validationError}</div>
	{/if}
	{#if stepNumber() === 5 && publishError}
		<div class="validation-error">{publishError}</div>
	{/if}
	<div class="card-footer">
		<button type="button" class="btn-back" onclick={prevStep}>
			Back
		</button>
		<div class="footer-right">
			{#if stepNumber() < 5}
				<button type="button" class="btn-save-draft" onclick={() => tripDraft.save(draft)}>
					Save Draft
				</button>
				<button
					type="button"
					class="btn-next"
					onclick={handleNextStep}
					disabled={!canProceed}
				>
					Next
				</button>
			{:else}
				<button type="button" class="btn-save-draft" onclick={() => tripDraft.save(draft)} disabled={isPublishing}>
					Save Draft
				</button>
				<button
					type="button"
					class="btn-publish"
					onclick={handlePublish}
					disabled={isPublishing}
				>
					{isPublishing ? 'Publishing…' : 'Publish'}
				</button>
			{/if}
		</div>
	</div>
{/if}

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
		flex-direction: column;
		align-items: flex-end;
		gap: 0.5rem;
	}
	
	.validation-error {
		color: #ef4444;
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
	
	.btn-next:disabled,
	.btn-publish:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	
	@media (max-width: 768px) {
		.card-footer {
			flex-direction: column;
			gap: 1rem;
		}
		
		.footer-right {
			width: 100%;
			flex-direction: row;
			justify-content: flex-end;
		}
		
		.btn-back {
			width: 100%;
		}
		
		.btn-save-draft,
		.btn-next,
		.btn-publish {
			flex: 1;
		}
	}
</style>
