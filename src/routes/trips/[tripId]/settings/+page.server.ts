import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { getSessionUser } from '$lib/server/session.js';
import { isTripHost } from '$lib/server/trip-access.js';
import { prisma } from '$lib/server/prisma.js';

export const load: PageServerLoad = async ({ parent }) => {
	const parentData = await parent();
	return { trip: parentData.trip, isHost: parentData.isHost };
};

export const actions: Actions = {
	updateBasics: async ({ request, params, cookies }) => {
		const user = await getSessionUser(cookies);
		if (!user) throw redirect(303, `/login?redirect=/trips/${params.tripId}/settings`);

		const tripId = params.tripId;
		const host = await isTripHost(tripId, user.id);
		if (!host) return { updateBasics: { error: 'Only the trip host can edit settings.' } };

		const formData = await request.formData();
		const name = (formData.get('name') as string)?.trim();
		const location = (formData.get('location') as string)?.trim() || null;
		const description = (formData.get('description') as string)?.trim() || null;

		if (!name) {
			return { updateBasics: { error: 'Trip name is required' } };
		}

		await prisma.trip.update({
			where: { id: tripId },
			data: { name, location, description }
		});

		return { updateBasics: { success: true } };
	}
};
