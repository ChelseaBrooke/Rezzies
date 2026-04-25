<!-- Guest dashboard. Edit this file for guest-only layout and features. -->
<script lang="ts">
	import { getContext } from 'svelte';
	import type { PageData } from './$types';
	import TripHero from '$lib/components/trips/dashboard/TripHero.svelte';
	import TripDashboardGrid from '$lib/components/trips/dashboard/TripDashboardGrid.svelte';
	import VacationModeView from '$lib/components/trips/dashboard/VacationModeView.svelte';
	import PollCardContainer from '$lib/components/trips/polls/PollCardContainer.svelte';
	import RecapModeView from '$lib/components/trips/dashboard/RecapModeView.svelte';
	import InviteeTripPreview from '$lib/components/trips/dashboard/InviteeTripPreview.svelte';
	import { dashboardModeByTripId } from '$lib/stores/dashboardMode.js';
	import type { DashboardMode } from '$lib/stores/dashboardMode.js';
	import { formatHostedByLine } from '$lib/format-hosted-by.js';
	import { page } from '$app/stores';

	let { data }: { data: PageData } = $props();

	const quickActions = getContext<{ onInvite: () => void; showToast: (msg: string) => void }>('tripQuickActions');

	const trip = $derived(data.trip);
	const modeFromDate = $derived.by((): DashboardMode => {
		const checkIn = trip?.checkInDate ? new Date(trip.checkInDate) : null;
		const checkOut = trip?.checkOutDate ? new Date(trip.checkOutDate) : null;
		if (!checkIn || !checkOut) return 'planning';
		const today = new Date();
		today.setHours(0, 0, 0, 0);
		const start = new Date(checkIn);
		start.setHours(0, 0, 0, 0);
		const end = new Date(checkOut);
		end.setHours(23, 59, 59, 999);
		if (today < start) return 'planning';
		if (today >= start && today <= end) return 'vacation';
		return 'recap';
	});
	const dashboardMode = $derived(($dashboardModeByTripId)[trip?.id ?? ''] ?? modeFromDate);
	const user = $derived(data.user);
	const userRsvp = $derived(data.userRsvp);

	let householdWelcomeShown = $state(false);
	$effect(() => {
		if (householdWelcomeShown) return;
		if ($page.url.searchParams.get('householdWelcome') !== '1') return;
		if (!trip?.name) return;
		householdWelcomeShown = true;
		const first = user?.name?.split(/\s+/)[0] ?? 'there';
		quickActions?.showToast?.(`Welcome to ${trip.name}, ${first}! 🎉`);
		if (typeof window !== 'undefined') {
			const url = new URL(window.location.href);
			url.searchParams.delete('householdWelcome');
			history.replaceState({}, '', url);
		}
	});
	const userInvoices = $derived(data.userInvoices ?? []);

	const members = $derived(trip?.members ?? []);
	const rsvps = $derived(trip?.rsvps ?? []);
	// Prefer page-loaded assignments (same as host dash) so room/bed picks stay fresh after RSVP or nav
	const roomAssignments = $derived(
		Array.isArray(data.roomAssignments) ? data.roomAssignments : (trip?.roomAssignments ?? [])
	);
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

	const roomsTotal = $derived(rooms.length);
	const roomsFilled = $derived(new Set(roomAssignments.map((a) => a.roomId)).size);
	const roomsPct = $derived(roomsTotal > 0 ? Math.round((roomsFilled / roomsTotal) * 100) : 0);

	// Committed = sum of yes-RSVPs' current expected cost (their reserved beds/rooms/slots), not the estimate range
	const committedFunds = $derived(
		data.committedFundsFromYesRsvps ?? (trip?.invoices ?? []).reduce((s, i) => s + (i.status === 'paid' ? i.totalAmount : 0), 0)
	);
	const fundingPct = $derived(totalCost > 0 ? Math.round((committedFunds / totalCost) * 100) : 0);

	const guestPreviewList = $derived(members.slice(0, 8));

	const hostMember = $derived((trip?.members ?? []).find((m: { role?: string }) => m.role === 'host'));
	const hostName = $derived(hostMember?.user?.name ?? hostMember?.user?.email ?? 'Host');
	const hostedByLine = $derived(formatHostedByLine(trip?.members ?? []));

	const myAssignments = $derived.by(() => {
		if (!user) return [];
		const g = data.guestRoomAssignments;
		if (Array.isArray(g) && g.length > 0) return g;
		return roomAssignments.filter((a) => a.userId === user.id);
	});
	const myAssignment = $derived(user ? (myAssignments[0] ?? null) : null);
	const myPaidTotal = $derived(
		userInvoices.filter((i) => i.status === 'paid').reduce((s, i) => s + i.totalAmount, 0)
	);
	const myDueTotal = $derived(
		userInvoices.filter((i) => i.status === 'due').reduce((s, i) => s + i.totalAmount, 0)
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

	/** Google Maps search URL for destination (full address when available). */
	const mapsUrl = $derived.by(() => {
		const addr = (trip?.fullAddress ?? trip?.location)?.trim();
		return addr ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr)}` : null;
	});

	const tripInfoContent = $derived.by(() => {
		const lines: string[] = [];
		const checkInTime = trip?.checkInTime?.trim();
		const checkOutTime = trip?.checkOutTime?.trim();
		const parkingNotes = trip?.parkingNotes?.trim();
		const houseRules = trip?.houseRules?.trim();
		if (checkInTime || checkOutTime) {
			lines.push(
				[
					checkInTime ? `Check-in: ${checkInTime}` : null,
					checkOutTime ? `Check-out: ${checkOutTime}` : null
				]
					.filter(Boolean)
					.join(' • ')
			);
		}
		if (parkingNotes) lines.push(`Parking: ${parkingNotes}`);
		if (houseRules) lines.push(`House rules: ${houseRules}`);
		return lines.join('\n\n');
	});
	
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

	// Show big RSVP button when guest hasn't responded yet (Accepted or Invited, no yes/no)
	const showRsvpButton = $derived(
		data.userRsvp?.status !== 'yes' && data.userRsvp?.status !== 'no'
	);
</script>

{#if trip}
	{#if data.invitePreview && data.inviteToken && data.previewCounts != null && data.previewHostName != null}
		<InviteeTripPreview
			tripId={trip.id}
			inviteToken={data.inviteToken}
			inviteStatus={data.inviteStatus ?? 'sent'}
			{trip}
			previewHostName={data.previewHostName}
			goingMembers={trip.members ?? []}
			counts={data.previewCounts}
		/>
	{:else if dashboardMode === 'vacation'}
		<VacationModeView
			tripId={trip.id}
			isHost={false}
			hostName={hostName}
			trip={{
				fullAddress: trip.fullAddress,
				location: trip.location,
				parkingNotes: trip.parkingNotes,
				houseRules: trip.houseRules,
				description: trip.description,
				listingCoverPhoto: trip.listingCoverPhoto,
				checkInTime: trip.checkInTime,
				checkOutTime: trip.checkOutTime,
				wifiName: trip.wifiName,
				wifiPassword: trip.wifiPassword
			}}
			tripName={trip.name ?? ''}
			tripLocation={trip.location ?? ''}
			checkInDate={trip.checkInDate ?? ''}
			checkOutDate={trip.checkOutDate ?? ''}
			currentUserName={user?.name ?? ''}
			userRsvp={userRsvp ? { adultsCount: userRsvp.adultsCount, kidsCount: userRsvp.kidsCount } : null}
			{activities}
			{mealSlots}
			{roomAssignments}
			{rsvps}
			{members}
			{myAssignment}
			{myAssignments}
			stayRoomLookup={(rooms ?? []).map((r) => ({
				id: r.id,
				name: r.name ?? null,
				roomType: r.roomType ?? null
			}))}
			serverStayRoomLabel={data.vacationStayRoomLabel ?? null}
		/>
		{:else if dashboardMode === 'recap'}
		<RecapModeView
			tripId={trip.id}
			isHost={false}
			{hostedByLine}
			trip={{
				name: trip.name,
				checkInDate: trip.checkInDate,
				checkOutDate: trip.checkOutDate,
				listingCoverPhoto: trip.listingCoverPhoto,
				location: trip.location,
				description: trip.description
			}}
			{activities}
			{mealSlots}
			{members}
			userInvoices={userInvoices}
			totalCost={totalCost}
			costSharingEnabled={trip.costSharingEnabled ?? false}
			{rsvps}
			tripGalleryFiles={data.tripGalleryFiles ?? []}
		/>
		{:else}
		<div class="planning-hero-wrap">
			<TripHero
			trip={{
				id: trip.id,
				name: trip.name,
				location: trip.location,
				locationCity: trip.locationCity,
				fullAddress: trip.fullAddress,
				listingCoverPhoto: trip.listingCoverPhoto,
				description: trip.description
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
		checkInDate={trip.checkInDate ?? ''}
			checkOutDate={trip.checkOutDate ?? ''}
			{activities}
			{mealSlots}
			selectedMode={dashboardMode}
			itineraryHref={trip ? `/trips/${trip.id}/itinerary` : ''}
			gamesHref={trip ? `/trips/${trip.id}/games` : ''}
			gamesCount={data.tripGames?.length ?? 0}
			{hostedByLine}
			canHostShare={data.canHostShare ?? false}
			householdShare={data.householdShare ?? null}
		/>
			<PollCardContainer tripId={trip.id} placement="hero" isHost={false} />
		</div>
		{#if user}
			<TripDashboardGrid
				isHost={false}
				tripId={trip.id}
				showToast={quickActions?.showToast}
				currentUserId={user.id}
				{members}
				{rsvps}
				{guestPreviewList}
				{pendingRsvpCount}
				{userRsvp}
				{myAssignment}
				userReservationPrice={data.userReservationPrice ?? null}
				platformFeePerPerson={trip.platformFeePerPerson ?? 0}
				{myAssignments}
				{myDueTotal}
				{myPaidTotal}
				{nextUpcomingItem}
				rsvpCurrent={acceptedCount}
				rsvpTotal={members.length}
				{rsvpPct}
				bedsCurrent={claimedSlots}
				bedsTotal={totalBedSlots}
				{bedsPct}
				roomsFilled={roomsFilled}
				roomsTotal={roomsTotal}
				roomsPct={roomsPct}
				fundingCurrent={Math.round(committedFunds)}
				fundingTotal={Math.round(totalCost)}
				{fundingPct}
				fundingDisplay={totalCost > 0 ? `$${committedFunds.toFixed(0)} / $${totalCost.toFixed(0)}` : 'Not set'}
				guestsHref={`/trips/${trip.id}/guests`}
				roomsHref={`/trips/${trip.id}/rooms`}
				paymentsHref={`/trips/${trip.id}/guests`}
				{checklistStats}
				tripDescription={trip?.description ?? null}
				extraCostRules={trip?.extraCostRules ?? []}
				itineraryHref={trip ? `/trips/${trip.id}/itinerary` : ''}
				tripInfo={{
					description: trip?.description,
					checkInTime: trip?.checkInTime,
					checkOutTime: trip?.checkOutTime,
					fullAddress: trip?.fullAddress ?? trip?.location,
					parkingNotes: trip?.parkingNotes,
					houseRules: trip?.houseRules
				}}
				tripCheckInDate={trip?.checkInDate ? String(trip.checkInDate) : ''}
				costSharingEnabled={trip.costSharingEnabled ?? false}
				recentActivities={activities.map((a) => ({ title: a.title, createdAt: String(a.createdAt) }))}
				recentMealSlots={mealSlots.map((m) => ({
					mealType: m.mealType,
					title: m.title ?? null,
					createdAt: String(m.createdAt)
				}))}
				recentGames={data.tripGames ?? []}
				recentPolls={data.recentPolls ?? []}
			/>
		{/if}
		{/if}
{/if}

<style>
	.planning-hero-wrap {
		position: relative;
	}
</style>
