import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getSessionUser } from '$lib/server/session.js';
import { getUserTrips } from '$lib/server/trip-access.js';

export const load: PageServerLoad = async ({ cookies }) => {
	const user = await getSessionUser(cookies);
	
	if (!user) {
		throw redirect(303, '/login?redirect=/trips');
	}

	try {
		const { ownedTrips, invitedTrips, allTrips } = await getUserTrips(user.id);

		return {
			user,
			ownedTrips,
			invitedTrips,
			allTrips
		};
	} catch (error) {
		console.error('Error loading trips:', error);
		// Return empty arrays if there's an error
		return {
			user,
			ownedTrips: [],
			invitedTrips: [],
			allTrips: []
		};
	}
};
