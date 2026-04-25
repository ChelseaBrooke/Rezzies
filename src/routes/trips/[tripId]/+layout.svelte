<script lang="ts">
	import type { LayoutData } from './$types';
	import type { Snippet } from 'svelte';
	import AppShell from '$lib/components/trips/dashboard/AppShell.svelte';
	import TripChat from '$lib/components/trips/TripChat.svelte';
	import FeatureTourModal from '$lib/components/ui/FeatureTourModal.svelte';
	import CostReapprovalModal from '$lib/components/trips/CostReapprovalModal.svelte';
	let { data, children }: { data: LayoutData; children: Snippet } = $props();

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

{#if data.publicHouseholdClaim}
	{#if safeChildren}
		{@render safeChildren()}
	{/if}
{:else}
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
		activitiesEnabled={true}
		gamesEnabled={true}
		invitePreviewMode={data.invitePreview === true}
		inviteToken={data.inviteToken}
	>
	{#snippet children()}
		{#if safeChildren}
			{@render safeChildren()}
		{/if}
	{/snippet}
</AppShell>
	{#if data.costReapprovalBlock}
		<CostReapprovalModal tripId={data.trip.id} block={data.costReapprovalBlock} />
	{/if}
{/if}

{#if !data.publicHouseholdClaim && data.featureTourVariant}
	<FeatureTourModal variant={data.featureTourVariant} />
{/if}

{#if !data.publicHouseholdClaim && data.canChat && data.user}
	<TripChat tripId={data.trip.id} userId={data.user.id} />
{/if}

