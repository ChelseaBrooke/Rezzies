import { error, redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { getSessionUser } from '$lib/server/session.js';
import { getUserTripMembership, isTripMember, getUserTrips } from '$lib/server/trip-access.js';
import { prisma } from '$lib/server/prisma.js';
import { computeCommittedFundsFromYesRsvps } from '$lib/server/pricing-canonical.js';

export const load: LayoutServerLoad = async ({ params, cookies }) => {
	const user = await getSessionUser(cookies);

	if (!user) {
		throw redirect(303, `/login?redirect=/trips/${params.tripId}`);
	}

	const tripId = params.tripId;
	const isMember = await isTripMember(tripId, user.id);
	if (!isMember) {
		throw error(403, 'You do not have access to this trip');
	}

	// First visit: if user was "invited" (hadn't visited trip page yet), mark as "accepted"
	let membership = await getUserTripMembership(tripId, user.id);
	if (membership?.inviteStatus === 'invited') {
		await prisma.tripMember.update({
			where: { tripId_userId: { tripId, userId: user.id } },
			data: { inviteStatus: 'accepted' }
		});
		membership = { ...membership, inviteStatus: 'accepted' };
	}

	const [trip, , tripsResult, userRsvp] = await Promise.all([
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
						room: { select: { id: true, name: true } },
						user: { select: { id: true, name: true } }
					}
				},
				invites: {
					include: {
						invitedBy: { select: { id: true, name: true } },
						recipient: { select: { id: true, name: true } }
					}
				},
				tripActivities: { orderBy: { createdAt: 'desc' } },
				extraCostRules: true
			}
		}),
		Promise.resolve(membership),
		getUserTrips(user.id),
		prisma.rSVP.findUnique({
			where: {
				tripId_userId: {
					tripId,
					userId: user.id
				}
			}
		})
	]);

	if (!trip) {
		throw error(404, 'Trip not found');
	}

	const allTrips = tripsResult.allTrips.map((m) => m.trip);

	// When user is invited but hasn't accepted, get the invite token for the "Accept invite" link
	let pendingInviteToken: string | null = null;
	if (membership?.inviteStatus === 'invited') {
		const pendingInvite = await prisma.invite.findFirst({
			where: {
				tripId,
				recipientUserId: user.id,
				status: 'sent'
			},
			select: { token: true }
		});
		pendingInviteToken = pendingInvite?.token ?? null;
	}

	const committedFundsFromYesRsvps = await computeCommittedFundsFromYesRsvps(tripId);

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
		committedFundsFromYesRsvps,
		pollsBadgeCount
	};
};
