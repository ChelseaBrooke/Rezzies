<script lang="ts">
	import type { LayoutData } from './$types';
	import AppShell from '$lib/components/trips/dashboard/AppShell.svelte';
	import TripChat from '$lib/components/trips/TripChat.svelte';

	let { data, children }: { data: LayoutData; children: import('svelte').Snippet } = $props();

	function handleInvite() {
		import('$app/navigation').then(({ goto }) => goto(`/trips/${data.trip.id}/guests?invite=1`));
	}
</script>

<AppShell tripId={data.trip.id} user={data.user} onInvite={handleInvite}>
	{#snippet children()}
		{@render children()}
	{/snippet}
</AppShell>

{#if data.canChat && data.user}
	<TripChat tripId={data.trip.id} userId={data.user.id} />
{/if}
