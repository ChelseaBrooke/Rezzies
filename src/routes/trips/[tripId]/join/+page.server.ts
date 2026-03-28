import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { getSessionUser } from '$lib/server/session.js';
import { prisma } from '$lib/server/prisma.js';

export const load: PageServerLoad = async ({ params, cookies }) => {
	const user = await getSessionUser(cookies);

	if (!user) {
		throw redirect(303, `/login?redirect=/trips/${params.tripId}/join`);
	}

	const tripId = params.tripId;

	// Check if already a member
	const existing = await prisma.tripMember.findUnique({
		where: { tripId_userId: { tripId, userId: user.id } }
	});

	if (existing) {
		if (existing.inviteStatus === 'approved') throw redirect(303, `/trips/${tripId}`);
		if (existing.inviteStatus === 'pending') throw redirect(303, `/trips/${tripId}/pending`);
		if (existing.inviteStatus === 'denied') throw redirect(303, `/trips/${tripId}/denied`);
	}

	const trip = await prisma.trip.findUnique({
		where: { id: tripId },
		select: {
			id: true,
			name: true,
			checkInDate: true,
			checkOutDate: true,
			isPublished: true,
			listingCoverPhoto: true,
			locationCity: true,
			inviteMode: true
		}
	});

	if (!trip || !trip.isPublished) {
		throw error(404, 'Trip not found');
	}

	return { trip, user };
};

export const actions: Actions = {
	join: async ({ params, cookies }) => {
		const user = await getSessionUser(cookies);
		if (!user) {
			throw redirect(303, `/login?redirect=/trips/${params.tripId}/join`);
		}

		const tripId = params.tripId;
		const trip = await prisma.trip.findUnique({
			where: { id: tripId },
			select: { id: true, isPublished: true, inviteMode: true }
		});

		if (!trip || !trip.isPublished) {
			throw error(404, 'Trip not found');
		}

		const status = trip.inviteMode === 'open' ? 'approved' : 'pending';

		await prisma.tripMember.upsert({
			where: { tripId_userId: { tripId, userId: user.id } },
			create: { tripId, userId: user.id, role: 'guest', inviteStatus: status },
			update: {}
		});

		if (status === 'approved') {
			throw redirect(303, `/trips/${tripId}`);
		} else {
			throw redirect(303, `/trips/${tripId}/pending`);
		}
	}
};
