import { error, redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { getUserTripMembership, getUserTrips } from '$lib/server/trip-access.js';
import { prisma } from '$lib/server/prisma.js';
import { computeCommittedFundsFromYesRsvps } from '$lib/server/pricing-canonical.js';

export const load: LayoutServerLoad = async ({ params, cookies, locals }) => {
	// Re-use the user attached by hooks.server.ts — avoids a second DB session lookup.
	const user = locals.user;

	if (!user) {
		throw redirect(303, `/login?redirect=/trips/${params.tripId}`);
	}

	const tripId = params.tripId;
	// Single membership query — replaces the previous isTripMember() + getUserTripMembership() double-hit
	let membership = await getUserTripMembership(tripId, user.id);
	const ACTIVE_STATUSES = ['invited', 'accepted'];
	if (!membership || !ACTIVE_STATUSES.includes(membership.inviteStatus)) {
		throw error(403, 'You do not have access to this trip');
	}

	// When user is in "invited" state, fetch the pending invite token BEFORE
	// upgrading the status so the "Accept invite" link can still be shown.
	let pendingInviteToken: string | null = null;
	if (membership?.inviteStatus === 'invited') {
		const pendingInvite = await prisma.invite.findFirst({
			where: { tripId, recipientUserId: user.id, status: 'sent' },
			select: { token: true }
		});
		pendingInviteToken = pendingInvite?.token ?? null;

		// Mark as accepted now that the user has visited the trip page.
		await prisma.tripMember.update({
			where: { tripId_userId: { tripId, userId: user.id } },
			data: { inviteStatus: 'accepted' }
		});
		membership = { ...membership, inviteStatus: 'accepted' };
	}

	const [trip, , tripsResult, userRsvp, committedFunds] = await Promise.all([
		prisma.trip.findUnique({
			where: { id: tripId },
			include: {
				rooms: { include: { beds: true } },
				members: { include: { user: { select: { id: true, email: true, name: true, avatarUrl: true } } } },
				mealPlan: true,
				mealSlots: { include: { assignedUser: { select: { id: true, name: true } } } },
				activities: {
					include: {
						participants: { include: { user: { select: { id: true, name: true } } } }
					}
				},
				invoices: true,
				reservations: true,
				rsvps: { include: { user: { select: { id: true, name: true } } } },
				roomAssignments: {
					include: {
						room: { select: { id: true, name: true, photoUrls: true } },
						bed: { select: { id: true, bedType: true } },
						user: { select: { id: true, name: true } }
					}
				},
				invites: {
					include: {
						invitedBy: { select: { id: true, name: true } },
						recipient: { select: { id: true, name: true } }
					}
				},
				// Limit to latest 50 — prevents full table scans on active trips
				tripActivities: { orderBy: { createdAt: 'desc' }, take: 50 },
				extraCostRules: true
			}
		}),
		Promise.resolve(membership),
		getUserTrips(user.id),
		prisma.rSVP.findUnique({
			where: { tripId_userId: { tripId, userId: user.id } }
		}),
		// Runs in parallel with trip fetch instead of serially after
		computeCommittedFundsFromYesRsvps(tripId)
	]);

	if (!trip) {
		throw error(404, 'Trip not found');
	}

	const allTrips = tripsResult.allTrips.map((m) => m.trip);

	const tripGamesRows = await prisma.tripGame.findMany({
		where: { tripId },
		orderBy: { createdAt: 'asc' }
	});
	const tripGames = tripGamesRows.map((g) => ({
		id: g.id,
		gameId: g.gameId,
		name: g.name,
		addedByUserId: g.addedByUserId,
		addedAt: g.createdAt.toISOString()
	}));

	// committedFunds already resolved from the parallel Promise.all above

	// Badge: only show when a new poll was added since last visit (hidden when on polls page)
	let pollsBadgeCount = 0;
	if (user) {
		const lastVisitRaw = cookies.get(`polls_visit_${tripId}`);
		const lastVisit = lastVisitRaw ? new Date(lastVisitRaw).getTime() : 0;

		if (lastVisit > 0) {
			pollsBadgeCount = await prisma.poll.count({
				where: {
					tripId,
					createdAt: { gt: new Date(lastVisit) }
				}
			});
		}
	}

	return {
		user,
		trip,
		allTrips,
		membership,
		isHost: membership?.role === 'host',
		userRsvp,
		canChat: userRsvp?.status === 'yes' || membership?.role === 'host',
		pendingInviteToken,
		committedFundsFromYesRsvps: committedFunds,
		pollsBadgeCount,
		tripGames
	};
};
