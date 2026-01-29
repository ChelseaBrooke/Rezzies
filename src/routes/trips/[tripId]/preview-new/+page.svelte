<script lang="ts">
	import type { LayoutData } from '../$types';
	import Stepper from '$lib/components/wizard/Stepper.svelte';
	import Step1 from '../../new/step/[stepNumber]/Step1.svelte';
	import { getSampleDraft } from '$lib/stores/tripDraft.js';

	let { data }: { data: LayoutData } = $props();

	const tripId = $derived(data?.trip?.id ?? '');
	let sampleDraft = $state(getSampleDraft());

	const steps = [
		{ number: 1, label: 'Basics & Rooms' },
		{ number: 2, label: 'Meals', optional: true },
		{ number: 3, label: 'Activities' },
		{ number: 4, label: 'Invite People' },
		{ number: 5, label: 'Review & Publish' }
	];

	function noop() {}
</script>

<div class="preview-new">
	<div class="preview-card">
		<p class="preview-label">Preview: New trip form (all fields filled)</p>
		<Stepper {steps} currentStep={0} backHref={tripId ? `/trips/${tripId}` : undefined} />
		<div class="preview-content">
			<Step1
				bind:draft={sampleDraft}
				autosave={noop}
				prevStep={noop}
				handleNextStep={noop}
				canProceed={true}
			/>
		</div>
	</div>
</div>

<style>
	.preview-new {
		width: 100%;
		max-width: 100%;
		min-height: 0;
	}

	.preview-card {
		background: white;
		border-radius: 0.75rem;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
		overflow: hidden;
		display: flex;
		flex-direction: column;
	}

	.preview-label {
		margin: 0;
		padding: 0.75rem 1.5rem;
		font-size: 0.8125rem;
		color: var(--muted, #64748b);
		background: var(--bg, #f8fafc);
		border-bottom: 1px solid var(--border, #e2e8f0);
	}

	.preview-content {
		flex: 1;
		padding: 1rem 2rem 1.5rem;
		display: flex;
		flex-direction: column;
		min-width: 0;
	}

	@media (max-width: 768px) {
		.preview-content {
			padding: 1rem 1.5rem;
		}
	}
</style>
