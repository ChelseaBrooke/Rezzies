import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getSessionUser } from '$lib/server/session.js';
import { isTripMember } from '$lib/server/trip-access.js';
import { prisma } from '$lib/server/prisma.js';

export const load: PageServerLoad = async ({ params, cookies }) => {
	const user = await getSessionUser(cookies);
	
	if (!user) {
		throw redirect(303, `/login?redirect=/trips/${params.tripId}/itinerary`);
	}

	const tripId = params.tripId;

	// Check if user is a member
	const member = await isTripMember(tripId, user.id);
	if (!member) {
		throw error(403, 'You do not have access to this trip');
	}

	// Get trip with itinerary data
	const trip = await prisma.trip.findUnique({
		where: { id: tripId },
		include: {
			members: {
				include: {
					user: {
						select: {
							id: true,
							name: true,
							email: true
						}
					}
				}
			},
			rsvps: {
				include: {
					user: {
						select: {
							id: true,
							name: true
						}
					}
				}
			},
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
			}
		}
	});

	if (!trip) {
		throw error(404, 'Trip not found');
	}

	// Group events by date
	const eventsByDate: Record<string, any[]> = {};

	// Add arrivals/departures from RSVPs
	trip.rsvps.forEach(rsvp => {
		if (rsvp.arrivalDatetime) {
			const date = rsvp.arrivalDatetime.toISOString().split('T')[0];
			if (!eventsByDate[date]) eventsByDate[date] = [];
			eventsByDate[date].push({
				type: 'arrival',
				user: rsvp.user,
				time: rsvp.arrivalDatetime
			});
		}
		if (rsvp.departureDatetime) {
			const date = rsvp.departureDatetime.toISOString().split('T')[0];
			if (!eventsByDate[date]) eventsByDate[date] = [];
			eventsByDate[date].push({
				type: 'departure',
				user: rsvp.user,
				time: rsvp.departureDatetime
			});
		}
	});

	// Add meal slots
	trip.mealSlots.forEach(slot => {
		const date = slot.date.toISOString().split('T')[0];
		if (!eventsByDate[date]) eventsByDate[date] = [];
		eventsByDate[date].push({
			type: 'meal',
			mealType: slot.mealType,
			time: slot.time,
			assignedUser: slot.assignedUser,
			menuText: slot.menuText,
			notes: slot.notes
		});
	});

	// Add activities
	trip.activities.forEach(activity => {
		const date = activity.date.toISOString().split('T')[0];
		if (!eventsByDate[date]) eventsByDate[date] = [];
		eventsByDate[date].push({
			type: 'activity',
			title: activity.title,
			time: activity.time,
			location: activity.location,
			participants: activity.participants.map(p => p.user),
			pricePerPerson: activity.pricePerPerson
		});
	});

	// Sort events within each date
	Object.keys(eventsByDate).forEach(date => {
		eventsByDate[date].sort((a, b) => {
			const timeA = a.time ? new Date(a.time).getTime() : 0;
			const timeB = b.time ? new Date(b.time).getTime() : 0;
			return timeA - timeB;
		});
	});

	return {
		user,
		trip,
		eventsByDate
	};
};
