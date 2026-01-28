<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { tripDraft } from '$lib/stores/tripDraft.js';
	import Step1 from './Step1.svelte';
	import Step2 from './Step2.svelte';
	import Step3 from './Step3.svelte';
	
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
		if (stepNumber() < 3) {
			goto(`/trips/new/step/${stepNumber() + 1}`);
		}
	}
	
	function prevStep() {
		if (stepNumber() > 1) {
			goto(`/trips/new/step/${stepNumber() - 1}`);
		}
	}
	
	function canProceed() {
		const step = stepNumber();
		if (step === 1) {
			return !!draft.name && !!draft.checkInDate && !!draft.checkOutDate && !!draft.coverPhoto && draft.rooms.length > 0 && !!draft.totalTripCost;
		}
		if (step === 2) {
			return true; // Meals & Activities is optional
		}
		return true;
	}
</script>

<!-- Step Content - only the form grid changes -->
{#if stepNumber() === 1}
	<Step1 bind:draft {autosave} />
{:else if stepNumber() === 2}
	<Step2 bind:draft {autosave} />
{:else if stepNumber() === 3}
	<Step3 bind:draft />
{/if}

<!-- Footer Actions -->
<div class="card-footer">
	<button type="button" class="btn-back" onclick={prevStep}>
		Back
	</button>
	<div class="footer-right">
		{#if stepNumber() < 3}
			<button type="button" class="btn-save-draft" onclick={() => tripDraft.save(draft)}>
				Save Draft
			</button>
			<button
				type="button"
				class="btn-next"
				onclick={nextStep}
				disabled={!canProceed()}
			>
				Next
			</button>
		{:else}
			<button type="button" class="btn-save-draft" onclick={() => tripDraft.save(draft)}>
				Save Draft
			</button>
			<button
				type="button"
				class="btn-publish"
				onclick={() => {
					console.log('Publishing trip:', draft);
					alert('Publish functionality coming soon!');
				}}
			>
				Publish
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
		gap: 0.75rem;
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
			flex-direction: column;
		}
		
		.btn-back,
		.btn-save-draft,
		.btn-next,
		.btn-publish {
			width: 100%;
		}
	}
</style>
