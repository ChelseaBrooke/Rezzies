<script lang="ts">
	import CreateTripShell from '$lib/components/wizard/CreateTripShell.svelte';
	import { page } from '$app/stores';
	
	let { children, data } = $props();
	
	const currentStep = $derived(() => {
		const stepMatch = $page.url.pathname.match(/\/step\/(\d+)/);
		return stepMatch ? parseInt(stepMatch[1]) - 1 : 0;
	});
</script>

<CreateTripShell currentStep={currentStep()} {data} hideStepperBack>
	{@render children()}
</CreateTripShell>
