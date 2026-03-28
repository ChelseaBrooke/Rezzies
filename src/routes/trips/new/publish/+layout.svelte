<script lang="ts">
	import CreateTripShell from '$lib/components/wizard/CreateTripShell.svelte';

	let { children, data } = $props();

	const STEPS = [
		{ number: 1, label: 'Basics & Rooms' },
		{ number: 2, label: 'Trip Add-Ons', optional: true },
		{ number: 3, label: 'Review' },
		{ number: 4, label: 'Publish' }
	];
</script>

<CreateTripShell currentStep={3} steps={STEPS} {data}>
	{@render children()}
</CreateTripShell>
