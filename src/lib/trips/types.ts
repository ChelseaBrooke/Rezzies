/**
 * Trip portal types.
 * Align with Prisma Trip + relations; use for sidebar and badge computations.
 */

export type TripStatus = 'draft' | 'live' | 'locked';

export interface TripForSidebar {
	id: string;
	name: string;
	checkInDate: Date;
	checkOutDate: Date;
	location: string | null;
	listingCoverPhoto: string | null;
	isPublished: boolean;
	rooms?: { id: number; beds: { id: string }[] }[];
	members?: { id: string }[];
	mealPlan?: { id: string } | null;
	mealSlots?: { id: string; assignedUserId: string | null }[];
	activities?: { id: string }[];
	invoices?: { id: string; status: string }[];
	reservations?: { id: string }[];
}

export interface TripListItem {
	id: string;
	name: string;
	checkInDate: Date;
	checkOutDate: Date;
}

export function getTripStatus(trip: { isPublished: boolean }): TripStatus {
	// TODO: add locked when backend supports it
	return trip.isPublished ? 'live' : 'draft';
}
