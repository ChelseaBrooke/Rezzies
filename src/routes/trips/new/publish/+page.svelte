<script lang="ts">
	import { goto } from '$app/navigation';
	import { tripDraft } from '$lib/stores/tripDraft.js';
	import PublishTripPaymentPanel from '$lib/components/wizard/PublishTripPaymentPanel.svelte';

	const DISCOUNT_CODE = 'BearsBestFriend#1';

	let draft = $state({ ...$tripDraft });

	$effect(() => {
		const unsubscribe = tripDraft.subscribe((value) => {
			draft = { ...value };
		});
		return unsubscribe;
	});

	async function handlePublish(opts: {
		splitCost: boolean;
		discountWaived: boolean;
		paymentIntentId?: string;
	}) {
		const res = await fetch('/api/trips/publish', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				...draft,
				isPublished: true,
				splitCost: opts.splitCost,
				...(opts.discountWaived ? { discountCode: DISCOUNT_CODE } : {}),
				...(opts.paymentIntentId ? { paymentIntentId: opts.paymentIntentId } : {})
			})
		});
		const data = await res.json().catch(() => ({}));
		if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
		if (!data.tripId) throw new Error(data.error || 'Failed to create trip');
		tripDraft.clear();
		goto(`/trips/${data.tripId}`);
	}

	async function handleSaveDraft(opts: { splitCost: boolean }) {
		const res = await fetch('/api/trips/publish', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				...draft,
				isPublished: false,
				splitCost: opts.splitCost
			})
		});
		const data = await res.json().catch(() => ({}));
		if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
		if (!data.tripId) throw new Error(data.error || 'Failed to save draft');
		tripDraft.clear();
		goto(`/trips/${data.tripId}`);
	}
</script>

<PublishTripPaymentPanel
	expectedGuests={Math.max(1, draft.expectedGuestCount || 1)}
	showSaveAsDraft={true}
	onPublish={handlePublish}
	onSaveDraft={handleSaveDraft}
/>
