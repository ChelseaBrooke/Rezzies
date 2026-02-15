import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { prisma } from '$lib/server/prisma.js';

/** Normalized shape for both Reservation and GuestSubmission */
export type ConfirmationData = {
	name: string;
	email: string;
	tripName?: string;
	roomName: string;
	bedType?: string;
	checkInDate: Date;
	checkOutDate: Date;
	nights: number;
	calculatedPrice: number;
	numberOfGuests?: number;
};

export const load: PageServerLoad = async ({ params }) => {
	// Try Reservation first (trip page flow), then GuestSubmission (API flow)
	const reservation = await prisma.reservation.findUnique({
		where: { id: params.id },
		include: { trip: true, room: true, bed: true }
	});
	if (reservation) {
		const confirmation: ConfirmationData = {
			name: reservation.name,
			email: reservation.email,
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

