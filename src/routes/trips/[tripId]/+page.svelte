<script lang="ts">
	import type { PageData } from './$types';
	import HostDashboard from './HostDashboard.svelte';
	import GuestDashboard from './GuestDashboard.svelte';

	let { data }: { data: PageData } = $props();

	const isHost = $derived(data.isHost ?? false);
</script>

{#if isHost}
	<HostDashboard data={data} />
{:else}
	<GuestDashboard data={data} />
{/if}
