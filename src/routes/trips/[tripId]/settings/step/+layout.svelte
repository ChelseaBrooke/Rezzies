<script lang="ts">
	import { page } from '$app/stores';
	import CreateTripShell from '$lib/components/wizard/CreateTripShell.svelte';
	import type { LayoutData } from './$types';

	const SETTINGS_STEPS = [
		{ number: 1, label: 'Basics & Rooms' },
	{ number: 2, label: 'Cost Sharing', optional: true },
		{ number: 3, label: 'Review & Save' }
	];

	let { data, children }: { data: LayoutData; children: import('svelte').Snippet } = $props();

	const stepMatch = $derived($page.url.pathname.match(/\/settings\/step\/(\d+)/));
	const stepNumber = $derived(stepMatch ? parseInt(stepMatch[1]) : 1);
	const currentStep = $derived(Math.max(0, Math.min(stepNumber - 1, 2))); // 0–2 for 3 steps
</script>

<CreateTripShell
	currentStep={currentStep}
	stepperInlineLabel="Edit Trip"
	steps={SETTINGS_STEPS}
>
	{@render children()}
</CreateTripShell>
