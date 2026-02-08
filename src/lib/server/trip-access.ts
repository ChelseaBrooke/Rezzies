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

export async function getUserTrips(userId: string) {
	try {
		// Backfill TripMember for any trip where this user has a Reservation (same email) but no membership
		// so guests who booked via /trip/CODE see the trip in their list
		const user = await prisma.user.findUnique({
			where: { id: userId },
			select: { email: true }
		});
		if (user?.email) {
			const reservationsByEmail = await prisma.reservation.findMany({
				where: { email: { equals: user.email, mode: 'insensitive' } },
				select: { tripId: true },
				distinct: ['tripId']
			});
			for (const { tripId } of reservationsByEmail) {
				await prisma.tripMember.upsert({
					where: {
						tripId_userId: { tripId, userId }
					},
					create: {
						tripId,
						userId,
						role: 'guest',
						inviteStatus: 'accepted'
					},
					update: {}
				});
			}
		}

		// Get trips where user is a member (accepted or invited). Exclude removed.
		const memberships = await prisma.tripMember.findMany({
			where: {
				userId,
				inviteStatus: { in: ACTIVE_INVITE_STATUSES }
			},
			include: {
				trip: {
					include: {
						rooms: {
							include: {
								beds: true
							}
						},
						members: {
							include: {
								user: {
									select: {
										id: true,
										email: true,
										name: true
									}
								}
							}
						}
					}
				}
			},
			orderBy: {
				createdAt: 'desc'
			}
		});

		// Sort trips by checkInDate manually (Prisma include types can be narrow)
		type MWithTrip = (typeof memberships)[number] & { trip: { checkInDate: Date } };
		memberships.sort((a, b) => {
			const dateA = (a as MWithTrip).trip.checkInDate.getTime();
			const dateB = (b as MWithTrip).trip.checkInDate.getTime();
			return dateB - dateA; // Descending order
		});

		// Separate owned and invited trips
		const ownedTrips = memberships.filter(m => m.role === 'host').map(m => (m as MWithTrip).trip);
		const invitedTrips = memberships.filter(m => m.role === 'guest').map(m => (m as MWithTrip).trip);

		return {
			ownedTrips,
			invitedTrips,
			allTrips: memberships.map(m => ({
				trip: (m as MWithTrip).trip,
				membership: m
			}))
		};
	} catch (error) {
		console.error('Error in getUserTrips:', error);
		// Return empty arrays on error
		return {
			ownedTrips: [],
			invitedTrips: [],
			allTrips: []
		};
	}
}
