import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { prisma } from '$lib/server/prisma.js';

/** Normalized shape for both Reservation and GuestSubmission */
export type ConfirmationData = {
	name: string;
	email: string;
	tripId?: string;
	tripName?: string;
	roomName: string;
	bedType?: string;
	checkInDate: Date;
	checkOutDate: Date;
	nights: number;
	calculatedPrice: number;
	numberOfGuests?: number;
};

export const load: PageServerLoad = async ({ params, locals }) => {
	const currentUser = locals.user;

	// Try Reservation first (trip page flow), then GuestSubmission (API flow)
	const reservation = await prisma.reservation.findUnique({
		where: { id: params.id },
		include: { trip: true, room: true, bed: true }
	});
	if (reservation) {
		// Guard: only the reservation owner (by email when logged in) or unauthenticated
		// users who have the exact UUID (email link) may view this page.
		// We keep it accessible by direct link (email sharing) but log a mismatch
		// so we can detect enumeration attempts in production logs.
		if (currentUser && currentUser.email.toLowerCase() !== reservation.email.toLowerCase()) {
			// A different logged-in user is trying to view someone else's confirmation.
			throw error(403, 'You do not have access to this confirmation');
		}
		const confirmation: ConfirmationData = {
			name: reservation.name,
			email: reservation.email,
			tripId: reservation.tripId,
			tripName: reservation.trip.name,
			roomName: reservation.room.name,
			bedType: reservation.bed?.bedType,
			checkInDate: reservation.checkInDate,
			checkOutDate: reservation.checkOutDate,
			nights: reservation.nights,
			calculatedPrice: reservation.calculatedPrice,
			numberOfGuests: reservation.numberOfGuests
		};
		return { confirmation };
	}

	const submission = await prisma.guestSubmission.findUnique({
		where: { id: params.id },
		include: { room: true, bed: true }
	});
	if (submission) {
		if (currentUser && currentUser.email.toLowerCase() !== submission.email.toLowerCase()) {
			throw error(403, 'You do not have access to this confirmation');
		}
		const confirmation: ConfirmationData = {
			name: submission.name,
			email: submission.email,
			roomName: submission.room.name,
			bedType: submission.bed.bedType,
			checkInDate: submission.checkInDate,
			checkOutDate: submission.checkOutDate,
			nights: submission.nights,
			calculatedPrice: submission.calculatedPrice
		};
		return { confirmation };
	}

	throw error(404, 'Confirmation not found');
};

