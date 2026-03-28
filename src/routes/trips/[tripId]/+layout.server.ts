import { error, redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { getUserTripMembership, getUserTrips } from '$lib/server/trip-access.js';
import { prisma } from '$lib/server/prisma.js';
import { computeCommittedFundsFromYesRsvps, getCostAtMaxParticipation } from '$lib/server/pricing-canonical.js';

export const load: LayoutServerLoad = async ({ params, cookies, locals }) => {
	const user = locals.user;

	if (!user) {
		throw redirect(303, `/login?redirect=/trips/${params.tripId}`);
	}

	const tripId = params.tripId;
	const membership = await getUserTripMembership(tripId, user.id);

	// Not a member at all: show the join page
	if (!membership) {
		throw redirect(303, `/trips/${tripId}/join`);
	}

	// Pending or denied: render slim shell (not full trip layout)
	if (membership.inviteStatus === 'pending') {
		throw redirect(303, `/trips/${tripId}/pending`);
	}
	if (membership.inviteStatus === 'denied') {
		throw redirect(303, `/trips/${tripId}/denied`);
	}

	// Only approved members reach here
	if (membership.inviteStatus !== 'approved') {
		throw error(403, 'You do not have access to this trip');
	}

	const isHost = membership.role === 'host';
	const [trip, , tripsResult, userRsvp, committedFunds, costAtMaxParticipation] = await Promise.all([
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
				rsvps: { include: { user: { select: { id: true, name: true, avatarUrl: true } } } },
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
				tripActivities: { orderBy: { createdAt: 'desc' }, take: 50 },
				extraCostRules: true
			}
		}),
		Promise.resolve(membership),
		getUserTrips(user.id),
		prisma.rSVP.findUnique({
			where: { tripId_userId: { tripId, userId: user.id } }
		}),
		computeCommittedFundsFromYesRsvps(tripId),
		isHost ? getCostAtMaxParticipation(tripId) : Promise.resolve(null)
	]);

	if (!trip) {
		throw error(404, 'Trip not found');
	}

	const allTrips = tripsResult.allTrips.map((m) => m.trip);

	const [tripGamesRows, recentPolls, tripGalleryFiles, pendingMemberCount] = await Promise.all([
		prisma.tripGame.findMany({
			where: { tripId },
			orderBy: { createdAt: 'asc' }
		}),
		prisma.poll.findMany({
			where: { tripId },
			orderBy: { createdAt: 'desc' },
			take: 30,
			select: {
				id: true,
				title: true,
				createdAt: true,
				createdById: true,
				createdBy: { select: { id: true, name: true } }
			}
		}),
		prisma.tripFile.findMany({
			where: {
				tripId,
				category: { not: 'receipt' },
				OR: [
					{ mimeType: { startsWith: 'image/' } },
					{ mimeType: { startsWith: 'video/' } }
				]
			},
			orderBy: { createdAt: 'desc' },
			select: { id: true, name: true, url: true, mimeType: true }
		}),
		isHost
			? prisma.tripMember.count({ where: { tripId, inviteStatus: 'pending' } })
			: Promise.resolve(0)
	]);

	const tripGames = tripGamesRows.map((g) => ({
		id: g.id,
		gameId: g.gameId,
		name: g.name,
		addedByUserId: g.addedByUserId,
		addedAt: g.createdAt.toISOString()
	}));

	let pollsBadgeCount = 0;
	if (user) {
		const lastVisitRaw = cookies.get(`polls_visit_${tripId}`);
		const lastVisit = lastVisitRaw ? new Date(lastVisitRaw).getTime() : 0;
		if (lastVisit > 0) {
			pollsBadgeCount = await prisma.poll.count({
				where: { tripId, createdAt: { gt: new Date(lastVisit) } }
			});
		}
	}

	return {
		user,
		trip,
		allTrips,
		membership,
		isHost,
		costAtMaxParticipation: costAtMaxParticipation ?? null,
		userRsvp,
		canChat: userRsvp?.status === 'yes' || membership?.role === 'host',
		pendingMemberCount,
		committedFundsFromYesRsvps: committedFunds,
		pollsBadgeCount,
		tripGames,
		recentPolls,
		tripGalleryFiles
	};
};
