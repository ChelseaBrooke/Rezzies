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

export async function isTripMember(tripId: string, userId: string): Promise<boolean> {
	const membership = await getUserTripMembership(tripId, userId);
	// Allow access for both invited (pending) and accepted so they can view the guest portal
	return membership?.inviteStatus === 'accepted' || membership?.inviteStatus === 'invited';
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

		// Get trips where user is a member (accepted or invited so they can see and open the guest portal)
		const memberships = await prisma.tripMember.findMany({
			where: {
				userId,
				inviteStatus: { in: ['accepted', 'invited'] }
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

		// Sort trips by checkInDate manually
		memberships.sort((a, b) => {
			const dateA = a.trip.checkInDate.getTime();
			const dateB = b.trip.checkInDate.getTime();
			return dateB - dateA; // Descending order
		});

		// Separate owned and invited trips
		const ownedTrips = memberships.filter(m => m.role === 'host').map(m => m.trip);
		const invitedTrips = memberships.filter(m => m.role === 'guest').map(m => m.trip);

		return {
			ownedTrips,
			invitedTrips,
			allTrips: memberships.map(m => ({
				trip: m.trip,
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
