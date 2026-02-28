import type { PageServerLoad } from './$types';
import { getSessionUser } from '$lib/server/session.js';
import { redirect } from '@sveltejs/kit';
import { prisma } from '$lib/server/prisma.js';

export const load: PageServerLoad = async ({ parent, cookies, params }) => {
	const parentData = await parent();
	const user = await getSessionUser(cookies);
	if (!user) throw redirect(303, '/login');

	const { tripId } = params;

	const tripFiles = await prisma.tripFile.findMany({
		where: { tripId },
		include: {
			uploadedBy: { select: { id: true, name: true } },
			mealSlot: { select: { id: true, mealType: true, date: true, title: true } }
		},
		orderBy: { createdAt: 'desc' }
	});

	return {
		trip: parentData.trip,
		user,
		tripFiles
	};
};
