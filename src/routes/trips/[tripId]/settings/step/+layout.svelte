<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import CreateTripShell from '$lib/components/wizard/CreateTripShell.svelte';
	import type { LayoutData } from './$types';

	const SETTINGS_STEPS = [
		{ number: 1, label: 'Basics & Rooms' },
		{ number: 2, label: 'Pricing' }
	];

	let { data, children }: { data: LayoutData; children: import('svelte').Snippet } = $props();

	const stepMatch = $derived($page.url.pathname.match(/\/settings\/step\/(\d+)/));
	const stepNumber = $derived(stepMatch ? parseInt(stepMatch[1]) : 1);
	const currentStep = $derived(Math.max(0, Math.min(stepNumber - 1, 1))); // 0–1 for 2 steps

	const tripId = $derived($page.params.tripId);

	function onBack() {
		if (currentStep <= 0) {
			goto(`/trips/${tripId}`);
		} else {
			goto(`/trips/${tripId}/settings/step/${currentStep}`);
		}
	}
</script>

<CreateTripShell
	currentStep={currentStep}
	previewLabel="Edit trip"
	steps={SETTINGS_STEPS}
	onBack={onBack}
>
	{@render children()}
</CreateTripShell>
