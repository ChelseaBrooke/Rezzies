<!-- Guest dashboard. Edit this file for guest-only layout and features. -->
<script lang="ts">
	import { getContext } from 'svelte';
	import type { PageData } from './$types';
	import TripHero from '$lib/components/trips/dashboard/TripHero.svelte';
	import TripDashboardGrid from '$lib/components/trips/dashboard/TripDashboardGrid.svelte';
	import { buildTripActivityLog } from '$lib/trip-activity-log.js';

	let { data }: { data: PageData } = $props();

	const quickActions = getContext<{ onInvite: () => void; showToast: (msg: string) => void }>('tripQuickActions');

	const trip = $derived(data.trip);
	const user = $derived(data.user);
	const userRsvp = $derived(data.userRsvp);
	const userProfile = $derived(data.userProfile);
	const userInvoices = $derived(data.userInvoices ?? []);

	const members = $derived(trip?.members ?? []);
	const rsvps = $derived(trip?.rsvps ?? []);
	const roomAssignments = $derived(trip?.roomAssignments ?? []);
	const rooms = $derived(trip?.rooms ?? []);
	const activities = $derived(trip?.activities ?? []);
	const mealSlots = $derived(trip?.mealSlots ?? []);
	const totalCost = $derived(trip?.totalCost ?? 0);

	const acceptedCount = $derived(rsvps.filter((r) => r.status === 'yes').length);
	const declinedCount = $derived(rsvps.filter((r) => r.status === 'no').length);
	const pendingRsvpCount = $derived(members.length - acceptedCount - declinedCount);
	const rsvpPct = $derived(members.length > 0 ? Math.round((acceptedCount / members.length) * 100) : 0);

	const totalBedSlots = $derived(
		rooms.reduce((sum, r) => sum + (r.beds?.reduce((s, b) => s + (b.capacitySlots ?? 1), 0) ?? 0), 0)
	);
	const claimedSlots = $derived(roomAssignments.reduce((sum, a) => sum + (a.partySize ?? 1), 0));
	const bedsPct = $derived(totalBedSlots > 0 ? Math.round((claimedSlots / totalBedSlots) * 100) : 0);

	const committedFunds = $derived(
		(trip?.invoices ?? []).reduce((s, i) => s + (i.status === 'paid' ? i.totalAmount : 0), 0)
	);
	const fundingPct = $derived(totalCost > 0 ? Math.round((committedFunds / totalCost) * 100) : 0);

	const guestPreviewList = $derived(members.slice(0, 8));

	const myAssignment = $derived(user ? roomAssignments.find((a) => a.userId === user.id) : null);
	const myPaidTotal = $derived(
		userInvoices.filter((i) => i.status === 'paid').reduce((s, i) => s + i.totalAmount, 0)
	);
	const myDueTotal = $derived(
		userInvoices.filter((i) => i.status === 'due').reduce((s, i) => s + i.totalAmount, 0)
	);

	const allActivityEntries = $derived(buildTripActivityLog(trip));
	const allActivityItems = $derived(
		allActivityEntries.map((item) => ({ text: item.text, at: item.at.toISOString() }))
	);
	const recentActivityItems = $derived(
		allActivityEntries.slice(0, 8).map((item) => ({ text: item.text }))
	);

	const nextUpcomingItem = $derived(
		activities.slice().sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0]
	);

	function formatTripDateRange(start: Date | string, end: Date | string): string {
		const s = typeof start === 'string' ? new Date(start) : start;
		const e = typeof end === 'string' ? new Date(end) : end;
		return `${s.toLocaleDateString(undefined, { month: 'long', day: 'numeric' })} – ${e.toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}, ${e.getFullYear()}`;
	}

	const dateRange = $derived(
		trip?.checkInDate && trip?.checkOutDate
			? formatTripDateRange(trip.checkInDate, trip.checkOutDate)
			: trip?.checkInDate
				? new Date(trip.checkInDate).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })
				: '—'
	);

	function initials(name: string | null | undefined): string {
		if (!name?.trim()) return '?';
		const parts = name.trim().split(/\s+/);
		return parts.length >= 2 ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase() : name.slice(0, 2).toUpperCase();
	}

	/** Google Calendar "Add event" URL for trip dates (all-day). */
	const calendarAddUrl = $derived.by(() => {
		if (!trip?.checkInDate || !trip?.checkOutDate) return null;
		const start = new Date(trip.checkInDate);
		const end = new Date(trip.checkOutDate);
		const pad = (n: number) => String(n).padStart(2, '0');
		const startStr = `${start.getFullYear()}${pad(start.getMonth() + 1)}${pad(start.getDate())}`;
		const endStr = `${end.getFullYear()}${pad(end.getMonth() + 1)}${pad(end.getDate())}`;
		const text = encodeURIComponent(trip?.name ?? 'Trip');
		return `https://www.google.com/calendar/render?action=TEMPLATE&text=${text}&dates=${startStr}/${endStr}`;
	});

	/** Google Maps search URL for destination. */
	const mapsUrl = $derived(
		trip?.location?.trim()
			? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(trip.location)}`
			: null
	);

	const tripInfoContent = $derived(
		'Check-in is 4pm. Keys at the lockbox — code in your confirmation.\n\n' +
		'Wi‑Fi, Check-in, and Rules are in the itinerary.'
	);
	
	// Compute guest checklist stats
	const guestMealsContributed = $derived(
		mealSlots.filter(m => m.assignedUserId === user?.id).length
	);
	
	const guestActivitiesContributed = $derived(
		activities.filter(a => 
			a.participants?.some(p => p.userId === user?.id)
		).length
	);
	
	const checklistStats = $derived({
		current_user_rsvp_status: userRsvp?.status ?? null,
		guest_meals_contributed: guestMealsContributed,
		guest_activities_contributed: guestActivitiesContributed
	});

	// Show big RSVP button for guests who are invited (not yet accepted)
	const showRsvpButton = $derived(data.membership?.inviteStatus === 'invited');
</script>

{#if trip}
	<TripHero
			trip={{
				id: trip.id,
				name: trip.name,
				location: trip.location,
				listingCoverPhoto: trip.listingCoverPhoto
			}}
			{dateRange}
			{calendarAddUrl}
			{mapsUrl}
			quickActions={{
				onInvite: quickActions?.onInvite ?? (() => {}),
				showToast: quickActions?.showToast ?? (() => {})
			}}
			{tripInfoContent}
			isHost={false}
			rsvpUrl={showRsvpButton ? `/trips/${trip.id}/rsvp` : null}
			inviteCode={trip.inviteCode}
			checkInDate={trip.checkInDate ?? ''}
			checkOutDate={trip.checkOutDate ?? ''}
			{activities}
			{mealSlots}
		/>
		<TripDashboardGrid
			isHost={false}
			tripId={trip.id}
			inviteCode={trip.inviteCode}
			showToast={quickActions?.showToast}
			currentUserId={user.id}
			{members}
			{rsvps}
			{guestPreviewList}
			{pendingRsvpCount}
			{recentActivityItems}
			{allActivityItems}
			{userRsvp}
			{userProfile}
			{myAssignment}
			{myDueTotal}
			{myPaidTotal}
			{nextUpcomingItem}
			rsvpCurrent={acceptedCount}
			rsvpTotal={members.length}
			{rsvpPct}
			bedsCurrent={claimedSlots}
			bedsTotal={totalBedSlots}
			{bedsPct}
			fundingCurrent={Math.round(committedFunds)}
			fundingTotal={Math.round(totalCost)}
			{fundingPct}
			fundingDisplay={totalCost > 0 ? `$${committedFunds.toFixed(0)} / $${totalCost.toFixed(0)}` : 'Not set'}
			guestsHref="/trips/{trip.id}/guests"
			roomsHref="/trips/{trip.id}/rooms"
			paymentsHref="/trips/{trip.id}/payments"
			{checklistStats}
		/>
{/if}
