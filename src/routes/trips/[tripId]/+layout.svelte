<script lang="ts">
	import type { LayoutData } from './$types';
	import RezziesHeader from '$lib/components/layout/RezziesHeader.svelte';
	import TripLayoutShell from '$lib/components/trips/TripLayoutShell.svelte';

	let { data, children }: { data: LayoutData; children: import('svelte').Snippet } = $props();

	// Serialized dates from server come back as strings; ensure trip options have usable dates
	const allTrips = $derived(
		(data.allTrips ?? []).map((t: { id: string; name: string; checkInDate: Date | string; checkOutDate: Date | string }) => ({
			id: t.id,
			name: t.name,
			checkInDate: typeof t.checkInDate === 'string' ? new Date(t.checkInDate) : t.checkInDate,
			checkOutDate: typeof t.checkOutDate === 'string' ? new Date(t.checkOutDate) : t.checkOutDate
		}))
	);

	let inviteModalOpen = $state(false);

	function handleInvite() {
		inviteModalOpen = true;
		// Child pages (e.g. guests) can handle modal; for now just navigate to guests
		import('$app/navigation').then(({ goto }) => goto(`/trips/${data.trip.id}/guests?invite=1`));
	}
</script>

<div class="trip-portal">
	<RezziesHeader />
	<TripLayoutShell
		trip={data.trip}
		allTrips={allTrips}
		onInvite={handleInvite}
	>
		{@render children()}
	</TripLayoutShell>
</div>

<style>
	.trip-portal {
		min-height: 100vh;
		display: flex;
		flex-direction: column;
	}

	.trip-portal :global(.rezzies-header) {
		flex-shrink: 0;
	}

	.trip-portal :global(.shell) {
		flex: 1;
		min-height: 0;
	}
</style>
