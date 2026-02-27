import { prisma } from './prisma.js';
import type { User } from '@prisma/client';

export async function getUserTripMembership(tripId: string, userId: string) {
	return prisma.tripMember.findUnique({
		where: {
			tripId_userId: {
				tripId,
				userId
			}
		},
		include: {
			trip: true,
			user: true
		}
	});
}

export async function isTripHost(tripId: string, userId: string): Promise<boolean> {
	const membership = await getUserTripMembership(tripId, userId);
	return membership?.role === 'host';
}

export async function isTripHostOrCoHost(tripId: string, userId: string): Promise<boolean> {
	const membership = await getUserTripMembership(tripId, userId);
	return membership?.role === 'host' || membership?.role === 'co-host';
}

/** Invite statuses that still have access to the trip. Removed = no access. */
const ACTIVE_INVITE_STATUSES: string[] = ['invited', 'accepted'];

/** Display state for a user on a trip: Invited → Accepted → RSVPyes | RSVPno; or Removed by host. */
export type MemberTripState = 'invited' | 'accepted' | 'rsvp_yes' | 'rsvp_no' | 'removed';

export function getMemberTripState(
	member: { inviteStatus: string },
	rsvp: { status: string } | null
): MemberTripState {
	if (member.inviteStatus === 'removed') return 'removed';
	if (member.inviteStatus === 'invited') return 'invited';
	if (rsvp?.status === 'yes') return 'rsvp_yes';
	if (rsvp?.status === 'no') return 'rsvp_no';
	return 'accepted'; // accepted + no yes/no RSVP (or maybe)
}

export async function isTripMember(tripId: string, userId: string): Promise<boolean> {
	const membership = await getUserTripMembership(tripId, userId);
	return membership != null && ACTIVE_INVITE_STATUSES.includes(membership.inviteStatus);
}

/**
 * Backfill TripMember rows for a user who has Reservations by email but no membership.
 * Call this explicitly from a one-time migration or a post-login hook — NOT on every page load.
 */
export async function backfillTripMembershipsForUser(userId: string): Promise<void> {
	const user = await prisma.user.findUnique({
		where: { id: userId },
		select: { email: true }
	});
	if (!user?.email) return;

	const reservationsByEmail = await prisma.reservation.findMany({
		where: { email: { equals: user.email, mode: 'insensitive' } },
		select: { tripId: true },
		distinct: ['tripId']
	});
	for (const { tripId } of reservationsByEmail) {
		await prisma.tripMember.upsert({
			where: { tripId_userId: { tripId, userId } },
			create: { tripId, userId, role: 'guest', inviteStatus: 'accepted' },
			update: {}
		});
	}
}

export async function getUserTrips(userId: string) {
	try {

		// Only select fields needed by the trips list page and sidebar — avoids loading
		// rooms/beds/members for every trip the user has ever joined.
		const memberships = await prisma.tripMember.findMany({
			where: {
				userId,
				inviteStatus: { in: ACTIVE_INVITE_STATUSES }
			},
			include: {
				trip: {
					select: {
						id: true,
						name: true,
						checkInDate: true,
						checkOutDate: true,
						isPublished: true,
						listingCoverPhoto: true,
						location: true,
						inviteCode: true
					}
				}
			},
			orderBy: { createdAt: 'desc' }
		});

		// Sort by checkInDate descending
		memberships.sort((a, b) => b.trip.checkInDate.getTime() - a.trip.checkInDate.getTime());

		const ownedTrips = memberships.filter(m => m.role === 'host').map(m => m.trip);
		const invitedTrips = memberships.filter(m => m.role === 'guest').map(m => m.trip);

		return {
			ownedTrips,
			invitedTrips,
			allTrips: memberships.map(m => ({ trip: m.trip, membership: m }))
		};
	} catch (err) {
		console.error('Error in getUserTrips:', err);
		return { ownedTrips: [], invitedTrips: [], allTrips: [] };
	}
}
