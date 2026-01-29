/**
 * Badge and summary computations for trip sidebar.
 * Safe fallbacks when data is missing.
 */

import type { TripForSidebar } from './types.js';

export interface TripBadges {
	guests: string | null;
	rooms: string | null;
	payments: string | null;
	itinerary: string | null;
	meals: string | null;
	files: string | null;
}

export function getTripBadges(trip: TripForSidebar | null | undefined): TripBadges {
	if (!trip) {
		return { guests: null, rooms: null, payments: null, itinerary: null, meals: null, files: null };
	}

	const memberCount = trip.members?.length ?? 0;
	const totalBeds = trip.rooms?.reduce((sum, r) => sum + (r.beds?.length ?? 0), 0) ?? 0;
	const claimedBeds = trip.reservations?.length ?? 0;
	const unpaidCount = trip.invoices?.filter((i) => i.status === 'due').length ?? 0;
	const activityCount = trip.activities?.length ?? 0;
	const mealSlots = trip.mealSlots ?? [];
	const unclaimedSlots = mealSlots.filter((s) => !s.assignedUserId).length;

	return {
		guests: memberCount > 0 ? `${memberCount}` : null,
		rooms:
			totalBeds > 0
				? claimedBeds > 0
					? `${claimedBeds}/${totalBeds}`
					: `${totalBeds}`
				: null,
		payments: unpaidCount > 0 ? `${unpaidCount} unpaid` : null,
		itinerary: activityCount > 0 ? `${activityCount}` : null,
		meals: mealSlots.length > 0 && unclaimedSlots > 0 ? `${unclaimedSlots}` : null,
		files: null // placeholder until files count exists
	};
}
