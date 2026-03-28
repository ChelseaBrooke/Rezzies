import { prisma } from './prisma.js';

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

/** Display state for a user on a trip. */
export type MemberTripState = 'pending' | 'approved' | 'rsvp_yes' | 'rsvp_no' | 'denied';

export function getMemberTripState(
	member: { inviteStatus: string },
	rsvp: { status: string } | null
): MemberTripState {
	if (member.inviteStatus === 'denied') return 'denied';
	if (member.inviteStatus === 'pending') return 'pending';
	if (rsvp?.status === 'yes') return 'rsvp_yes';
	if (rsvp?.status === 'no') return 'rsvp_no';
	return 'approved'; // approved + no yes/no RSVP yet
}

/** Returns the membership row only for **approved** members. */
export async function isApprovedMember(
	tripId: string,
	userId: string
): Promise<boolean> {
	const membership = await prisma.tripMember.findUnique({
		where: { tripId_userId: { tripId, userId } },
		select: { inviteStatus: true }
	});
	return membership?.inviteStatus === 'approved';
}

/** Returns true if the user has a pending join request. */
export async function isPendingMember(tripId: string, userId: string): Promise<boolean> {
	const membership = await prisma.tripMember.findUnique({
		where: { tripId_userId: { tripId, userId } },
		select: { inviteStatus: true }
	});
	return membership?.inviteStatus === 'pending';
}

/** Legacy helper, now only returns true for approved members. */
export async function isTripMember(tripId: string, userId: string): Promise<boolean> {
	return isApprovedMember(tripId, userId);
}

/**
 * Backfill TripMember rows for a user who has Reservations by email but no membership.
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
			create: { tripId, userId, role: 'guest', inviteStatus: 'approved' },
			update: {}
		});
	}
}

export async function getUserTrips(userId: string) {
	try {
		const memberships = await prisma.tripMember.findMany({
			where: {
				userId,
				inviteStatus: { in: ['approved', 'pending'] }
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
						location: true
					}
				}
			},
			orderBy: { createdAt: 'desc' }
		});

		memberships.sort((a, b) => b.trip.checkInDate.getTime() - a.trip.checkInDate.getTime());

		const ownedTrips = memberships.filter((m) => m.role === 'host').map((m) => m.trip);
		const invitedTrips = memberships
			.filter((m) => m.role !== 'host' && m.inviteStatus === 'approved')
			.map((m) => m.trip);

		return {
			ownedTrips,
			invitedTrips,
			allTrips: memberships.map((m) => ({ trip: m.trip, membership: m }))
		};
	} catch (err) {
		console.error('Error in getUserTrips:', err);
		return { ownedTrips: [], invitedTrips: [], allTrips: [] };
	}
}
