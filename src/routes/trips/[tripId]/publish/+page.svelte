<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import PublishTripPaymentPanel from '$lib/components/wizard/PublishTripPaymentPanel.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const DISCOUNT_CODE = 'BearsBestFriend#1';

	const tripId = $derived(data.trip.id);
	const expectedGuests = $derived(Math.max(1, data.trip.expectedPeopleCount ?? 1));

	async function handlePublish(opts: {
		splitCost: boolean;
		discountWaived: boolean;
		paymentIntentId?: string;
	}) {
		const res = await fetch(`/api/trips/${tripId}/publish`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				splitCost: opts.splitCost,
				...(opts.discountWaived ? { discountCode: DISCOUNT_CODE } : {}),
				...(opts.paymentIntentId ? { paymentIntentId: opts.paymentIntentId } : {})
			})
		});
		const result = await res.json().catch(() => ({}));
		if (!res.ok) throw new Error(result.error || `Request failed (${res.status})`);
		await invalidateAll();
		goto(`/trips/${tripId}`);
	}
</script>

<PublishTripPaymentPanel
	expectedGuests={expectedGuests}
	showSaveAsDraft={false}
	tripId={tripId}
	onPublish={handlePublish}
/>
