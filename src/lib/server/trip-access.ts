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
	return membership?.inviteStatus === 'accepted';
}

export async function getUserTrips(userId: string) {
	try {
		// Get trips where user is a member
		const memberships = await prisma.tripMember.findMany({
			where: {
				userId,
				inviteStatus: 'accepted'
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
