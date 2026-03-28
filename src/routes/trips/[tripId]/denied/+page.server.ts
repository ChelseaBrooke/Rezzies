import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getSessionUser } from '$lib/server/session.js';
import { prisma } from '$lib/server/prisma.js';

export const load: PageServerLoad = async ({ params, cookies }) => {
	const user = await getSessionUser(cookies);

	if (!user) {
		throw redirect(303, `/login?redirect=/trips/${params.tripId}/denied`);
	}

	const tripId = params.tripId;

	const membership = await prisma.tripMember.findUnique({
		where: { tripId_userId: { tripId, userId: user.id } },
		select: { inviteStatus: true }
	});

	if (!membership) {
		throw redirect(303, `/trips/${tripId}/join`);
	}
	if (membership.inviteStatus === 'approved') {
		throw redirect(303, `/trips/${tripId}`);
	}
	if (membership.inviteStatus === 'pending') {
		throw redirect(303, `/trips/${tripId}/pending`);
	}

	const trip = await prisma.trip.findUnique({
		where: { id: tripId },
		select: { id: true, name: true }
	});

	return { trip, user };
};
