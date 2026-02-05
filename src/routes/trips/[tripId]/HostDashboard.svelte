<!-- Host / co-host dashboard. Edit this file for host-only layout and features. -->
<script lang="ts">
	import { getContext } from 'svelte';
	import type { PageData } from './$types';
	import AppShell from '$lib/components/trips/dashboard/AppShell.svelte';
	import TripHero from '$lib/components/trips/dashboard/TripHero.svelte';
	import TripDashboardGrid from '$lib/components/trips/dashboard/TripDashboardGrid.svelte';

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

	type ActivityItem = { type: 'room' | 'rsvp'; text: string; at: Date };
	const recentActivityItems = $derived(
		(() => {
			const items: ActivityItem[] = [];
			roomAssignments.forEach((a) => {
				items.push({
					type: 'room',
					text: `${a.user?.name ?? 'Someone'} claimed ${a.room?.name ?? 'room'}`,
					at: new Date(a.updatedAt)
				});
			});
			rsvps.forEach((r) => {
				if (r.status === 'yes')
					items.push({ type: 'rsvp', text: `${r.user?.name ?? 'Someone'} accepted`, at: new Date(r.updatedAt) });
			});
			items.sort((a, b) => b.at.getTime() - a.at.getTime());
			return items.slice(0, 5);
		})()
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

	function nudgePending() {
		quickActions?.showToast?.('Nudge sent to pending guests');
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

	const pendingPaymentTotal = $derived(Math.max(0, totalCost - committedFunds));
	const mealSlotsCount = $derived(mealSlots.length);
	const activitiesCount = $derived(activities.length);
	const tripInfoEmptyCount = $derived(
		[trip?.description, trip?.location, trip?.listingUrl, trip?.listingTitle].filter(
			(v) => v == null || String(v).trim() === ''
		).length
	);
</script>

{#if trip}
	<AppShell tripId={trip.id} user={user}>
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
			isHost={true}
			inviteCode={trip.inviteCode}
			checkInDate={trip.checkInDate ?? ''}
			checkOutDate={trip.checkOutDate ?? ''}
			{activities}
			{mealSlots}
		/>
		<TripDashboardGrid
			isHost={true}
			tripId={trip.id}
			{members}
			{rsvps}
			{guestPreviewList}
			{pendingRsvpCount}
			{recentActivityItems}
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
			{nudgePending}
			{pendingPaymentTotal}
			{mealSlotsCount}
			{activitiesCount}
			pollPendingCount={0}
			{tripInfoEmptyCount}
		/>
	</AppShell>
{/if}
