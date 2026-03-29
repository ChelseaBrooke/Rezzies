<script lang="ts">
	import CreateTripShell from '$lib/components/wizard/CreateTripShell.svelte';

	let { children, data } = $props();
</script>

<CreateTripShell
	currentStep={0}
	steps={[]}
	hideTopBar
	hideStepIndicators
	backHref={`/trips/${data.trip.id}/settings/step/3`}
	backLabel="← Back to trip editor"
>
	{@render children()}
</CreateTripShell>
