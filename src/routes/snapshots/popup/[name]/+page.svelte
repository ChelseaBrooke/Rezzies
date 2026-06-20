<script lang="ts">
	import { onMount } from 'svelte';
	import type { PageData } from './$types';

	import FeatureTourModal from '$lib/components/ui/FeatureTourModal.svelte';
	import EditProfileModal from '$lib/components/profile/EditProfileModal.svelte';
	import { openEditProfileModal } from '$lib/stores/profileOverlay.js';
	import HouseholdShareModal from '$lib/components/HouseholdShareModal.svelte';
	import GuestEditModal from '$lib/components/trips/GuestEditModal.svelte';
	import GuestInvoiceModal from '$lib/components/trips/GuestInvoiceModal.svelte';
	import CostReapprovalModal, {
		type CostReapprovalBlock
	} from '$lib/components/trips/CostReapprovalModal.svelte';
	import ActivityLogModal from '$lib/components/trips/dashboard/ActivityLogModal.svelte';
	import CreatePollModal from '$lib/components/trips/polls/CreatePollModal.svelte';
	import PollDetailModal from '$lib/components/trips/polls/PollDetailModal.svelte';
	import AddMealModal from '$lib/components/trips/meals/AddMealModal.svelte';
	import MealDetailDrawer from '$lib/components/trips/meals/MealDetailDrawer.svelte';
	import EventDetailsDrawer, {
		type DrawerEvent
	} from '$lib/components/itinerary/EventDetailsDrawer.svelte';
	import PublishPaymentModal from '$lib/components/wizard/PublishPaymentModal.svelte';

	import type { PollWithMeta } from '$lib/components/trips/polls/types.js';
	import type { Meal, MealGuest } from '$lib/components/trips/meals/types.js';
	import type { InvoiceBreakdown } from '$lib/server/invoice-calculator.js';

	let { data }: { data: PageData } = $props();

	const tripId = data.tripId;
	const userId = data.userId;
	const noop = () => {};
	const asyncNoop = async () => {};

	// ── Sample data shared across modals ────────────────────────────────────────
	const members: MealGuest[] = [
		{ id: 'u1', name: 'Jordan Lee' },
		{ id: 'u2', name: 'Sam Rivera' },
		{ id: 'u3', name: 'Alex Chen' }
	];

	const rooms = [
		{ id: 1, name: 'Master Bedroom', beds: [{ id: 'b1', bedType: 'queen' }, { id: 'b2', bedType: 'twin' }] },
		{ id: 2, name: 'Guest Room', beds: [{ id: 'b3', bedType: 'king' }] }
	];

	const poll: PollWithMeta = {
		id: 'p1',
		title: 'Which night for the group dinner?',
		description: 'Pick the night that works best for everyone.',
		category: 'Meals',
		pollType: 'single',
		status: 'open',
		statusDisplay: 'open',
		showResultsLive: true,
		startAt: new Date(),
		endAt: new Date(Date.now() + 2 * 86400000),
		createdAt: new Date(),
		updatedAt: new Date(),
		createdById: 'u1',
		createdBy: { id: 'u1', name: 'Jordan Lee', avatarUrl: null },
		options: [
			{ id: 'o1', label: 'Friday', sortOrder: 0, voteCount: 4 },
			{ id: 'o2', label: 'Saturday', sortOrder: 1, voteCount: 6 },
			{ id: 'o3', label: 'Sunday', sortOrder: 2, voteCount: 1 }
		],
		totalVotes: 11,
		userVoted: false,
		userOptionIds: [],
		timeLabel: 'Ends in 2d',
		allowAnonymous: false,
		userWatching: false,
		watcherCount: 2
	};

	const meal: Meal = {
		id: 'm1',
		tripId,
		title: 'Taco Night',
		mealType: 'dinner',
		startAt: new Date('2026-07-11T18:30:00'),
		time: '6:30 PM',
		description: 'Build-your-own tacos',
		notes: 'Vegetarian option available',
		tags: ['Mexican'],
		cookIds: ['u1'],
		cooks: [{ id: 'u1', name: 'Jordan Lee' }],
		attendance: [
			{ mealId: 'm1', guestId: 'u1', guest: { id: 'u1', name: 'Jordan Lee' }, optedOut: false },
			{ mealId: 'm1', guestId: 'u2', guest: { id: 'u2', name: 'Sam Rivera' }, optedOut: false },
			{ mealId: 'm1', guestId: 'u3', guest: { id: 'u3', name: 'Alex Chen' }, optedOut: true, optOutReason: 'eating_out' }
		],
		attendingCount: 2,
		optedOutCount: 1,
		allergySummary: { Peanuts: 1 }
	};

	const event: DrawerEvent = {
		id: 'a1',
		type: 'activity',
		date: '2026-07-11',
		time: '09:00',
		durationMinutes: 120,
		notes: 'Bring water and good shoes.',
		title: 'Morning Hike',
		location: 'Trailhead parking lot',
		participants: [
			{ id: 'u1', name: 'Jordan Lee', rsvpStatus: 'going' },
			{ id: 'u2', name: 'Sam Rivera', rsvpStatus: 'going' },
			{ id: 'u3', name: 'Alex Chen', rsvpStatus: 'skip' }
		],
		currentUserRsvp: 'going'
	};

	const invoiceBreakdown: InvoiceBreakdown = {
		rooms: [{ roomId: 1, roomName: 'Master Bedroom', bedType: 'queen', amount: 520, nights: 3 }],
		meals: [{ label: 'Taco Night', amount: 18, partySize: 2, perPerson: 9 }],
		activities: [{ activityId: 'a1', activityName: 'Morning Hike', amount: 0, participants: 2 }],
		extras: [{ ruleId: 'r1', label: 'Cleaning fee', amount: 40, quantity: 1 }],
		total: 578
	};

	const guestRow = {
		userId: 'u2',
		name: 'Sam Rivera',
		role: 'guest',
		rsvpStatus: 'yes',
		partySize: 2,
		priceApproved: true,
		invoicePaid: false,
		assignedBedIds: ['b1'],
		arrivalDate: '2026-07-10',
		departureDate: '2026-07-13',
		toPayTotal: 578
	};

	const reapprovalBlock: CostReapprovalBlock = {
		tripName: 'Lake House Weekend',
		originalRangeMinCents: 45000,
		originalRangeMaxCents: 60000,
		currentShareCents: 72000,
		reasonLine: 'Two guests dropped out, so the per-person cost went up.',
		reApprovalDeadline: new Date(Date.now() + 2 * 86400000).toISOString(),
		breakdown: { rooms: [{ amount: 720, nights: 3 }] }
	};

	const activityLogItems = [
		{ text: 'Jordan claimed Master Bedroom', at: new Date(Date.now() - 3600000).toISOString() },
		{ text: 'Sam submitted RSVP (Going)', at: new Date(Date.now() - 7200000).toISOString() },
		{ text: 'Activity "Morning Hike" added (Jul 11)', at: new Date(Date.now() - 86400000).toISOString() }
	];

	const tripDays = [
		{ value: '2026-07-10', label: 'Fri, Jul 10' },
		{ value: '2026-07-11', label: 'Sat, Jul 11' },
		{ value: '2026-07-12', label: 'Sun, Jul 12' }
	];

	onMount(() => {
		if (data.name === 'edit-profile') openEditProfileModal();
	});
</script>

<svelte:head>
	<title>Popup: {data.name}</title>
</svelte:head>

<div class="harness">
	{#if data.name === 'feature-tour'}
		<FeatureTourModal variant="first-trip" />
	{:else if data.name === 'edit-profile'}
		<EditProfileModal />
	{:else if data.name === 'household-share'}
		<HouseholdShareModal
			open={true}
			{tripId}
			householdId="sample-household"
			unclaimedFirstNames={['Alex', 'Sam']}
			primaryLabel="Jordan"
		/>
	{:else if data.name === 'guest-edit'}
		<GuestEditModal
			open={true}
			row={guestRow}
			{rooms}
			{tripId}
			isHostViewer={true}
			checkInDate="2026-07-10"
			checkOutDate="2026-07-13"
			allowPartialStays={true}
			onClose={noop}
			onRemove={noop}
		/>
	{:else if data.name === 'guest-invoice'}
		<GuestInvoiceModal
			open={true}
			guestName="Sam Rivera"
			breakdown={invoiceBreakdown}
			total={invoiceBreakdown.total}
			{tripId}
			userId="u2"
			canMarkAsPaid={true}
			onClose={noop}
		/>
	{:else if data.name === 'cost-reapproval'}
		<CostReapprovalModal {tripId} block={reapprovalBlock} />
	{:else if data.name === 'activity-log'}
		<ActivityLogModal open={true} items={activityLogItems} onClose={noop} />
	{:else if data.name === 'create-poll'}
		<CreatePollModal open={true} onClose={noop} formAction={`/trips/${tripId}/polls?/create`} />
	{:else if data.name === 'poll-detail'}
		<PollDetailModal open={true} {poll} onClose={noop} onVote={noop} canManage={true} />
	{:else if data.name === 'add-meal'}
		<AddMealModal open={true} {members} {tripDays} onClose={noop} onSuccess={noop} />
	{:else if data.name === 'meal-detail'}
		<MealDetailDrawer {meal} open={true} currentUserId={userId} isHost={true} onClose={noop} onUpdate={noop} />
	{:else if data.name === 'event-details'}
		<EventDetailsDrawer
			{event}
			currentUserId={userId}
			isHost={true}
			{tripId}
			onClose={noop}
			onLocalRsvpUpdate={noop}
			onEdit={noop}
		/>
	{:else if data.name === 'publish-payment'}
		<PublishPaymentModal open={true} expectedGuests={6} {tripId} onPublish={asyncNoop} onClose={noop} />
	{:else}
		<div class="unknown">Unknown popup: <code>{data.name}</code></div>
	{/if}
</div>

<style>
	.harness {
		min-height: 100vh;
		background: #e9eef0;
		background-image: radial-gradient(circle at 20% 20%, rgba(0, 0, 0, 0.05), transparent 60%);
	}
	.unknown {
		padding: 2rem;
		font-family: system-ui, sans-serif;
		color: #444;
	}
</style>
