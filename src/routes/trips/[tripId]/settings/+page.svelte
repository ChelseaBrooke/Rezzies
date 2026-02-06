<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import type { PageData } from './$types';
	import Stepper from '$lib/components/wizard/Stepper.svelte';
	import Step1 from './steps/Step1.svelte';
	import Step2 from './steps/Step2.svelte';
	import Step3 from './steps/Step3.svelte';
	import Step4 from './steps/Step4.svelte';

	let { data, form }: { data: PageData; form: import('./$types').ActionData } = $props();

	type Step = 'basics' | 'rooms' | 'pricing-policies' | 'review';

	const stepParam = $derived($page.url.searchParams.get('step') || 'basics');
	const currentStep = $derived((['basics', 'rooms', 'pricing-policies', 'review'].includes(stepParam) ? stepParam : 'basics') as Step);

	const steps = [
		{ number: 1, label: 'Trip Basics' },
		{ number: 2, label: 'Rooms' },
		{ number: 3, label: 'Pricing & Policies' },
		{ number: 4, label: 'Review' }
	];

	const currentStepIndex = $derived(['basics', 'rooms', 'pricing-policies', 'review'].indexOf(currentStep));

	// Form data initialized from trip
	let formData = $state({
		name: data.trip?.name ?? '',
		description: data.trip?.description ?? '',
		location: data.trip?.location ?? '',
		checkInDate: data.trip?.checkInDate ? new Date(data.trip.checkInDate).toISOString().split('T')[0] : '',
		checkOutDate: data.trip?.checkOutDate ? new Date(data.trip.checkOutDate).toISOString().split('T')[0] : '',
		listingUrl: data.trip?.listingUrl ?? '',
		listingTitle: data.trip?.listingTitle ?? '',
		listingCoverPhoto: data.trip?.listingCoverPhoto ?? '',
		totalCost: data.trip?.totalCost ? String(data.trip.totalCost) : '',
		pricingModel: data.trip?.pricingModel ?? 'PER_PERSON',
		allowPartialStays: data.trip?.allowPartialStays ?? false,
		// Rooms will be handled separately
		rooms: data.trip?.rooms ?? []
	});

	// Sync when data changes
	$effect(() => {
		if (data.trip) {
			formData.name = data.trip.name ?? '';
			formData.description = data.trip.description ?? '';
			formData.location = data.trip.location ?? '';
			formData.checkInDate = data.trip.checkInDate ? new Date(data.trip.checkInDate).toISOString().split('T')[0] : '';
			formData.checkOutDate = data.trip.checkOutDate ? new Date(data.trip.checkOutDate).toISOString().split('T')[0] : '';
			formData.listingUrl = data.trip.listingUrl ?? '';
			formData.listingTitle = data.trip.listingTitle ?? '';
			formData.listingCoverPhoto = data.trip.listingCoverPhoto ?? '';
			formData.totalCost = data.trip.totalCost ? String(data.trip.totalCost) : '';
			formData.pricingModel = data.trip.pricingModel ?? 'PER_PERSON';
			formData.allowPartialStays = data.trip.allowPartialStays ?? false;
			formData.rooms = data.trip.rooms ?? [];
		}
	});

	function goToStep(step: Step) {
		goto(`/trips/${data.trip?.id}/settings?step=${step}`);
	}

	function nextStep() {
		const stepOrder: Step[] = ['basics', 'rooms', 'pricing-policies', 'review'];
		const currentIdx = stepOrder.indexOf(currentStep);
		if (currentIdx < stepOrder.length - 1) {
			goToStep(stepOrder[currentIdx + 1]);
		}
	}

	function prevStep() {
		const stepOrder: Step[] = ['basics', 'rooms', 'pricing-policies', 'review'];
		const currentIdx = stepOrder.indexOf(currentStep);
		if (currentIdx > 0) {
			goToStep(stepOrder[currentIdx - 1]);
		} else {
			goto(`/trips/${data.trip?.id}`);
		}
	}

	const numberOfNights = $derived(() => {
		if (!formData.checkInDate || !formData.checkOutDate) return 0;
		const checkIn = new Date(formData.checkInDate);
		const checkOut = new Date(formData.checkOutDate);
		const diffTime = checkOut.getTime() - checkIn.getTime();
		const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
		return diffDays > 0 ? diffDays : 0;
	});

	// Redirect non-hosts
	$effect(() => {
		if (!data.isHost && data.trip?.id) {
			goto(`/trips/${data.trip.id}`);
		}
	});
</script>

{#if data.isHost}
<div class="settings-page">
	<div class="settings-card">
		<Stepper {steps} currentStep={currentStepIndex} onBack={prevStep} />
		
		<div class="settings-content">
			{#if currentStep === 'basics'}
				<Step1 {formData} tripId={data.trip?.id ?? ''} {numberOfNights} />
			{:else if currentStep === 'rooms'}
				<Step2 {formData} tripId={data.trip?.id ?? ''} />
			{:else if currentStep === 'pricing-policies'}
				<Step3 {formData} tripId={data.trip?.id ?? ''} />
			{:else if currentStep === 'review'}
				<Step4 {formData} tripId={data.trip?.id ?? ''} {numberOfNights} />
			{/if}
			
			<div class="step-actions">
				{#if currentStep !== 'basics'}
					<button type="button" class="btn-secondary" onclick={prevStep}>Back</button>
				{/if}
				{#if currentStep !== 'review'}
					<button type="button" class="btn-primary" onclick={nextStep}>Next</button>
				{:else}
					<form method="POST" action="?/updateBasics" use:enhance={() => {
						return async ({ result }) => {
							if (result.type === 'success') {
								await import('$app/navigation').then(({ invalidateAll }) => invalidateAll());
								goto(`/trips/${data.trip?.id}`);
							}
						};
					}}>
						<input type="hidden" name="name" value={formData.name} />
						<input type="hidden" name="location" value={formData.location} />
						<input type="hidden" name="description" value={formData.description} />
						<input type="hidden" name="checkInDate" value={formData.checkInDate} />
						<input type="hidden" name="checkOutDate" value={formData.checkOutDate} />
						<input type="hidden" name="listingUrl" value={formData.listingUrl} />
						<input type="hidden" name="listingTitle" value={formData.listingTitle} />
						<input type="hidden" name="listingCoverPhoto" value={formData.listingCoverPhoto} />
						<input type="hidden" name="totalCost" value={formData.totalCost} />
						<input type="hidden" name="pricingModel" value={formData.pricingModel} />
						<input type="hidden" name="allowPartialStays" value={formData.allowPartialStays ? 'true' : 'false'} />
						<button type="submit" class="btn-primary">Save Changes</button>
					</form>
				{/if}
			</div>
		</div>
	</div>
</div>

<style>
	.settings-page {
		min-height: 100%;
		padding: 0;
	}

	.settings-card {
		background: var(--surfaceSolid);
		border-radius: var(--radius-xl);
		border: 1px solid var(--border);
		box-shadow: var(--shadow-md);
		overflow: hidden;
		display: flex;
		flex-direction: column;
		min-height: 600px;
	}

	.settings-content {
		flex: 1;
		padding: 2rem;
		display: flex;
		flex-direction: column;
		gap: 2rem;
	}

	.step-actions {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		margin-top: auto;
		padding-top: 2rem;
		border-top: 1px solid var(--border);
	}

	.btn-primary,
	.btn-secondary {
		padding: 0.625rem 1.25rem;
		border-radius: var(--radius-md);
		font-size: 0.875rem;
		font-weight: 500;
		cursor: pointer;
		transition: all var(--transition-fast);
		border: none;
	}

	.btn-primary {
		background: var(--primary);
		color: white;
		margin-left: auto;
	}

	.btn-primary:hover {
		background: var(--primaryHover);
	}

	.btn-secondary {
		background: var(--surface2);
		color: var(--text);
		border: 1px solid var(--border);
	}

	.btn-secondary:hover {
		background: var(--border-soft);
	}

	.error-message {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 1rem;
		padding: 3rem;
		text-align: center;
		min-height: 400px;
	}

	.error-message p {
		font-size: 1rem;
		color: var(--text);
		margin: 0;
	}
</style>
{:else}
<div class="settings-page">
	<div class="error-message">
		<p>You don't have permission to edit trip settings. Only hosts can edit settings.</p>
		<a href="/trips/{data.trip?.id}" class="btn-primary">Back to Trip</a>
	</div>
</div>
{/if}
