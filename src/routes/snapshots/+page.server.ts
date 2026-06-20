import type { PageServerLoad } from './$types';
import { prisma } from '$lib/server/prisma.js';
import { getSessionUser } from '$lib/server/session.js';
import { getUserTrips } from '$lib/server/trip-access.js';

export type SnapshotEntry = {
	label: string;
	group: string;
	/** Resolved URL to load in an iframe, or null when sample data is unavailable. */
	url: string | null;
	/** Caveat shown under the card (e.g. why it could not be resolved). */
	note?: string;
};

export type PopupEntry = {
	label: string;
	group: string;
	url: string;
};

export const load: PageServerLoad = async ({ cookies }) => {
	const user = await getSessionUser(cookies);

	// ── Resolve sample data so [param] routes render with real content ──────────
	let tripId: string | null = null;
	let tripName: string | null = null;
	let householdId: string | null = null;
	let confirmationId: string | null = null;

	if (user) {
		const { ownedTrips, allTrips } = await getUserTrips(user.id);
		const sampleTrip = ownedTrips[0] ?? allTrips[0]?.trip ?? null;
		if (sampleTrip) {
			tripId = sampleTrip.id;
			tripName = sampleTrip.name;

			const household = await prisma.household.findFirst({
				where: { tripId },
				select: { id: true }
			});
			householdId = household?.id ?? null;
		}

		// Confirmation/reservation pages 403 unless the row's email matches the
		// logged-in user, so only pick a row belonging to this user.
		const reservation = await prisma.reservation.findFirst({
			where: { email: { equals: user.email, mode: 'insensitive' } },
			select: { id: true },
			orderBy: { submittedAt: 'desc' }
		});
		if (reservation) {
			confirmationId = reservation.id;
		} else {
			const submission = await prisma.guestSubmission.findFirst({
				where: { email: { equals: user.email, mode: 'insensitive' } },
				select: { id: true },
				orderBy: { submittedAt: 'desc' }
			});
			confirmationId = submission?.id ?? null;
		}
	}

	const tripUrl = (suffix: string): SnapshotEntry['url'] =>
		tripId ? `/trips/${tripId}${suffix}` : null;
	const needsTrip = tripId ? undefined : 'No accessible trip found for the logged-in user.';

	const pages: SnapshotEntry[] = [
		// Marketing / auth
		{ label: 'Home / landing', group: 'Marketing & auth', url: '/' },
		{ label: 'Our services', group: 'Marketing & auth', url: '/our-services' },
		{ label: 'Site map', group: 'Marketing & auth', url: '/sitemap' },
		{ label: 'Sign up', group: 'Marketing & auth', url: '/signup' },
		{ label: 'Log in', group: 'Marketing & auth', url: '/login' },

		// Account
		{ label: 'My trips', group: 'Account', url: '/trips' },
		{ label: 'Account settings', group: 'Account', url: '/settings' },
		{ label: 'Messages', group: 'Account', url: '/messages' },

		// Trip creation wizard
		{ label: 'Host a trip (start)', group: 'Trip creation', url: '/trips/new' },
		{ label: 'New trip wizard — step 1', group: 'Trip creation', url: '/trips/new/step/1' },

		// Trip dashboard + sub-pages
		{ label: 'Trip dashboard', group: 'Trip dashboard', url: tripUrl(''), note: needsTrip },
		{ label: 'Guests', group: 'Trip dashboard', url: tripUrl('/guests'), note: needsTrip },
		{ label: 'Rooms', group: 'Trip dashboard', url: tripUrl('/rooms'), note: needsTrip },
		{ label: 'RSVP', group: 'Trip dashboard', url: tripUrl('/rsvp'), note: needsTrip },
		{ label: 'Itinerary', group: 'Trip dashboard', url: tripUrl('/itinerary'), note: needsTrip },
		{ label: 'Activities', group: 'Trip dashboard', url: tripUrl('/activities'), note: needsTrip },
		{ label: 'Polls', group: 'Trip dashboard', url: tripUrl('/polls'), note: needsTrip },
		{ label: 'Files', group: 'Trip dashboard', url: tripUrl('/files'), note: needsTrip },
		{ label: 'Games', group: 'Trip dashboard', url: tripUrl('/games'), note: needsTrip },
		{ label: 'Games — Caption This', group: 'Trip dashboard', url: tripUrl('/games/caption-this'), note: needsTrip },
		{ label: 'Settings', group: 'Trip dashboard', url: tripUrl('/settings'), note: needsTrip },
		{ label: 'Settings — step 1', group: 'Trip dashboard', url: tripUrl('/settings/step/1'), note: needsTrip },
		{ label: 'Publish', group: 'Trip dashboard', url: tripUrl('/publish'), note: needsTrip },

		// Membership states
		{ label: 'Pending approval', group: 'Membership states', url: tripUrl('/pending'), note: needsTrip },
		{ label: 'Denied', group: 'Membership states', url: tripUrl('/denied'), note: needsTrip },
		{ label: 'Join trip', group: 'Membership states', url: tripUrl('/join'), note: needsTrip },
		{
			label: 'Join household',
			group: 'Membership states',
			url: tripId && householdId ? `/trips/${tripId}/join/household/${householdId}` : null,
			note: tripId
				? householdId
					? undefined
					: 'No household exists on the sample trip.'
				: needsTrip
		},

		// Guest confirmation
		{
			label: 'Reservation confirmation',
			group: 'Guest confirmation',
			url: confirmationId ? `/confirmation/${confirmationId}` : null,
			note: confirmationId
				? undefined
				: 'No reservation/submission found for the logged-in user.'
		},

		// Internal tools
		{ label: 'Pricing QC', group: 'Internal tools', url: '/qc' },
		{ label: 'Email template preview', group: 'Internal tools', url: '/email' }
	];

	// Popups/modals are rendered live (with sample props) by the harness route.
	const popups: PopupEntry[] = [
		{ label: 'Feature tour', group: 'Onboarding', url: '/snapshots/popup/feature-tour' },
		{ label: 'Edit profile', group: 'Profile', url: '/snapshots/popup/edit-profile' },
		{ label: 'Household share link', group: 'Guests', url: '/snapshots/popup/household-share' },
		{ label: 'Guest edit', group: 'Guests', url: '/snapshots/popup/guest-edit' },
		{ label: 'Guest invoice', group: 'Guests', url: '/snapshots/popup/guest-invoice' },
		{ label: 'Cost re-approval', group: 'Guests', url: '/snapshots/popup/cost-reapproval' },
		{ label: 'Activity log', group: 'Dashboard', url: '/snapshots/popup/activity-log' },
		{ label: 'Create poll', group: 'Polls', url: '/snapshots/popup/create-poll' },
		{ label: 'Poll detail', group: 'Polls', url: '/snapshots/popup/poll-detail' },
		{ label: 'Add meal', group: 'Meals', url: '/snapshots/popup/add-meal' },
		{ label: 'Meal detail', group: 'Meals', url: '/snapshots/popup/meal-detail' },
		{ label: 'Event details', group: 'Itinerary', url: '/snapshots/popup/event-details' },
		{ label: 'Publish payment', group: 'Trip creation', url: '/snapshots/popup/publish-payment' }
	];

	return {
		isLoggedIn: Boolean(user),
		sample: { tripId, tripName, householdId, confirmationId },
		pages,
		popups
	};
};
