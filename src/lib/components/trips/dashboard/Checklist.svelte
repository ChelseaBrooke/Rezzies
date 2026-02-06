<script lang="ts">
	import ChecklistItem from './ChecklistItem.svelte';

	interface ChecklistStats {
		rsvp_pending?: number;
		payment_pending?: number;
		trip_meals_total?: number;
		trip_activities_total?: number;
		missing_trip_details_count?: number;
		missing_trip_details_summary?: string;
		current_user_rsvp_status?: string | null;
		guest_meals_contributed?: number;
		guest_activities_contributed?: number;
	}

	interface Props {
		role: 'host' | 'guest';
		tripId: string;
		currentUserId: string;
		computedStats: ChecklistStats;
	}

	let { role, tripId, currentUserId, computedStats }: Props = $props();

	// Host/Co-host checklist items
	const hostChecklistItems = $derived.by(() => {
		const items: Array<{ key: string; label: string; href: string; isComplete: boolean }> = [];

		// 1. Receive all RSVPs
		const rsvpPending = computedStats.rsvp_pending ?? 0;
		items.push({
			key: 'host_receive_rsvps',
			label: `Receive all RSVPs (${rsvpPending} pending)`,
			href: `/trips/${tripId}/guests?filter=not_rsvped`,
			isComplete: rsvpPending === 0
		});

		// 2. Receive all payments
		const paymentPending = computedStats.payment_pending ?? 0;
		items.push({
			key: 'host_receive_payments',
			label: `Receive all payments (${paymentPending} pending confirmation)`,
			href: `/trips/${tripId}/payments?filter=pending`,
			isComplete: paymentPending === 0
		});

		// 3. Add 1+ meals
		const mealsTotal = computedStats.trip_meals_total ?? 0;
		items.push({
			key: 'host_add_meals',
			label: 'Add 1+ meals for your trip',
			href: `/trips/${tripId}/itinerary?tab=meals`,
			isComplete: mealsTotal >= 1
		});

		// 4. Add 1+ activities
		const activitiesTotal = computedStats.trip_activities_total ?? 0;
		items.push({
			key: 'host_add_activities',
			label: 'Add 1+ activities for your trip',
			href: `/trips/${tripId}/itinerary?tab=activities`,
			isComplete: activitiesTotal >= 1
		});

		// 5. Finalize trip details
		const missingCount = computedStats.missing_trip_details_count ?? 0;
		const missingSummary = computedStats.missing_trip_details_summary ?? 'complete';
		items.push({
			key: 'host_finalize_trip_details',
			label: `Finalize trip details (${missingSummary})`,
			href: `/trips/${tripId}/settings`,
			isComplete: missingCount === 0
		});

		return items;
	});

	// Guest checklist items
	const guestChecklistItems = $derived.by(() => {
		const items: Array<{ key: string; label: string; href: string; isComplete: boolean }> = [];

		// 1. RSVP
		const rsvpStatus = computedStats.current_user_rsvp_status;
		items.push({
			key: 'guest_rsvp',
			label: 'RSVP',
			href: `/trips/${tripId}/rsvp`,
			isComplete: rsvpStatus != null && rsvpStatus.trim() !== ''
		});

		// 2. Add 1+ meals
		const mealsContributed = computedStats.guest_meals_contributed ?? 0;
		items.push({
			key: 'guest_add_meals',
			label: 'Add 1+ meals for your trip',
			href: `/trips/${tripId}/itinerary?tab=meals`,
			isComplete: mealsContributed >= 1
		});

		// 3. Add 1+ activities
		const activitiesContributed = computedStats.guest_activities_contributed ?? 0;
		items.push({
			key: 'guest_add_activities',
			label: 'Add 1+ activities for your trip',
			href: `/trips/${tripId}/itinerary?tab=activities`,
			isComplete: activitiesContributed >= 1
		});

		return items;
	});

	const checklistItems = $derived(role === 'host' ? hostChecklistItems : guestChecklistItems);
</script>

<div class="checklist">
	{#each checklistItems as item}
		<ChecklistItem label={item.label} isComplete={item.isComplete} href={item.href} />
	{/each}
</div>

<style>
	.checklist {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}
</style>
