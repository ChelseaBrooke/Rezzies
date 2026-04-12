<script lang="ts">
	import type { LayoutData } from './$types';
	import type { Snippet } from 'svelte';
	import { onMount } from 'svelte';
	import AppShell from '$lib/components/trips/dashboard/AppShell.svelte';
	import TripChat from '$lib/components/trips/TripChat.svelte';
	import { onboardingStore } from '$lib/stores/onboarding.js';
	let { data, children }: { data: LayoutData; children: Snippet } = $props();

	onMount(() => { onboardingStore.init(data.isHost); });

	// Trip is in recap (past checkout), disable editing (e.g. hide Settings)
	const tripLockedForRecap = $derived.by(() => {
		const out = data.trip?.checkOutDate;
		if (!out) return false;
		const checkout = new Date(out);
		const today = new Date();
		today.setHours(0, 0, 0, 0);
		checkout.setHours(0, 0, 0, 0);
		return checkout < today;
	});

	// Only treat as callable when it's actually a function (avoids "undefined is not a function" on refresh)
	const safeChildren = $derived(
		typeof children === 'function' ? (children as () => unknown) : null
	);

	function handleInvite() {
		import('$app/navigation').then(({ goto }) => goto(`/trips/${data.trip.id}/guests?invite=1`));
	}
</script>

<AppShell
		tripId={data.trip.id}
		user={data.user}
		onInvite={handleInvite}
		isHost={data.isHost}
		showGuestsTab={data.isHost || data.membership?.role === 'co-host'}
		pollsBadgeCount={data.pollsBadgeCount ?? 0}
		tripLockedForRecap={tripLockedForRecap}
		checkInDate={data.trip?.checkInDate ?? null}
		checkOutDate={data.trip?.checkOutDate ?? null}
		activitiesEnabled={data.trip?.activitiesEnabled ?? true}
		gamesEnabled={data.trip?.gamesEnabled ?? true}
	>
	{#snippet children()}
		{#if safeChildren}
			{@render safeChildren()}
		{/if}
	{/snippet}
</AppShell>

{#if data.canChat && data.user}
	<TripChat tripId={data.trip.id} userId={data.user.id} />
{/if}

