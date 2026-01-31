<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { tripToDraft } from '$lib/stores/tripDraft.js';
	import CreateTripShell from '$lib/components/wizard/CreateTripShell.svelte';
	import Step1 from '../../new/step/[stepNumber]/Step1.svelte';
	import Step2 from '../../new/step/[stepNumber]/Step2.svelte';
	import ActivitiesStep from '../../new/step/[stepNumber]/ActivitiesStep.svelte';
	import Step3 from '../../new/step/[stepNumber]/Step3.svelte';
	import Step4 from '../../new/step/[stepNumber]/Step4.svelte';
	import type { TripDraft } from '$lib/stores/tripDraft.js';

	let { data, form }: { data: import('./$types').PageData; form: import('./$types').ActionData } = $props();

	const saveResult = $derived(form?.saveTrip);

	let draft = $state<TripDraft>(tripToDraft(data?.trip ?? null));
	let currentStep = $state(0);

	$effect(() => {
		const trip = data?.trip ?? null;
		draft = tripToDraft(trip);
		currentStep = 0;
	});

	const tripId = $derived(data?.trip?.id ?? '');
	const tripName = $derived(data?.trip?.name ?? 'Trip');
	const previewLabel = $derived(`Preview: New trip form — ${tripName}`);

	function noop() {}
	function handleBack() {
		if (currentStep > 0) {
			currentStep -= 1;
		} else {
			goto(`/trips/${tripId}`);
		}
	}
	function handleNext() {
		if (currentStep < 4) {
			currentStep += 1;
		} else {
			goto(`/trips/${tripId}`);
		}
	}
</script>

<CreateTripShell
	{currentStep}
	{previewLabel}
	onBack={handleBack}
>
	{#snippet children()}
		{#if currentStep === 0}
			<Step1 bind:draft autosave={noop} prevStep={handleBack} handleNextStep={handleNext} canProceed={true} />
		{:else if currentStep === 1}
			<Step2 bind:draft autosave={noop} />
		{:else if currentStep === 2}
			<ActivitiesStep bind:draft autosave={noop} />
		{:else if currentStep === 3}
			<Step3 bind:draft autosave={noop} />
		{:else}
			<Step4 bind:draft />
		{/if}

		<div class="card-footer">
			<button type="button" class="btn-back" onclick={handleBack}>
				Back
			</button>
			<div class="footer-right">
				<form method="POST" action="?/saveTrip" use:enhance={() => {
					return async ({ result }) => {
						if (result.type === 'success' && result.data?.saveTrip?.success) {
							await import('$app/navigation').then(({ invalidateAll }) => invalidateAll());
						}
					};
				}} class="save-form">
					<input type="hidden" name="draft" value={JSON.stringify(draft)} />
					<button type="submit" class="btn-save">Save</button>
				</form>
				{#if saveResult?.error}
					<span class="footer-error">{saveResult.error}</span>
				{/if}
				{#if saveResult?.success}
					<span class="footer-success">Saved.</span>
				{/if}
				{#if currentStep < 4}
					<button type="button" class="btn-next" onclick={handleNext}>
						Next
					</button>
				{:else}
					<a href="/trips/{tripId}" class="btn-done">Done</a>
				{/if}
			</div>
		</div>
	{/snippet}
</CreateTripShell>

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
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
	}
	.save-form { display: inline-flex; align-items: center; }
	.btn-save {
		padding: 0.75rem 1.5rem;
		border-radius: 0.5rem;
		font-size: 0.9375rem;
		font-weight: 500;
		cursor: pointer;
		border: 1px solid var(--border-strong);
		background: var(--surface2);
		color: var(--text);
		font-family: inherit;
	}
	.btn-save:hover { background: var(--surface); }
	.footer-error { font-size: 0.8125rem; color: var(--danger); }
	.footer-success { font-size: 0.8125rem; color: var(--muted); }
	.btn-back,
	.btn-next,
	.btn-done {
		padding: 0.75rem 1.5rem;
		border-radius: 0.5rem;
		font-size: 0.9375rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s ease;
		border: none;
		font-family: inherit;
		text-decoration: none;
	}
	.btn-back {
		background: transparent;
		color: var(--muted);
	}
	.btn-back:hover {
		color: var(--text);
	}
	.btn-next,
	.btn-done {
		background: var(--primary);
		color: white;
	}
	.btn-next:hover,
	.btn-done:hover {
		background: var(--primary);
	}
</style>
