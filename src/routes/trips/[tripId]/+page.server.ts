import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getSessionUser } from '$lib/server/session.js';
import { getUserTripMembership, isTripMember } from '$lib/server/trip-access.js';
import { prisma } from '$lib/server/prisma.js';

export const load: PageServerLoad = async ({ params, cookies }) => {
	const user = await getSessionUser(cookies);
	
	if (!user) {
		throw redirect(303, `/login?redirect=/trips/${params.tripId}`);
	}

	const tripId = params.tripId;

	// Check if user is a member of this trip
	const isMember = await isTripMember(tripId, user.id);
	if (!isMember) {
		throw error(403, 'You do not have access to this trip');
	}

	// Get trip with all related data
	const trip = await prisma.trip.findUnique({
		where: { id: tripId },
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
			},
			mealPlan: true,
			mealSlots: {
				include: {
					assignedUser: {
						select: {
							id: true,
							name: true
						}
					}
				},
				orderBy: {
					date: 'asc'
				}
			},
			activities: {
				include: {
					participants: {
						include: {
							user: {
								select: {
									id: true,
									name: true
								}
							}
						}
					}
				},
				orderBy: {
					date: 'asc'
				}
			},
			extraCostRules: true,
			rsvps: {
				where: {
					userId: user.id
				}
			},
			guestProfiles: {
				where: {
					userId: user.id
				}
			},
			invoices: {
				where: {
					userId: user.id
				},
				orderBy: {
					createdAt: 'desc'
				}
			}
		}
	});

	if (!trip) {
		throw error(404, 'Trip not found');
	}

	// Get user's membership details
	const membership = await getUserTripMembership(tripId, user.id);
	const isHost = membership?.role === 'host';

	return {
		user,
		trip,
		membership,
		isHost,
		userRsvp: trip.rsvps[0] || null,
		userProfile: trip.guestProfiles[0] || null,
		userInvoices: trip.invoices
	};
};
