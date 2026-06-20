import type { PageServerLoad } from './$types';
import { getSessionUser } from '$lib/server/session.js';
import { getUserTrips } from '$lib/server/trip-access.js';

/** Resolve best-effort sample ids so modal forms/links point somewhere real. */
export const load: PageServerLoad = async ({ params, cookies }) => {
	const user = await getSessionUser(cookies);
	let tripId = 'sample-trip';
	if (user) {
		const { ownedTrips, allTrips } = await getUserTrips(user.id);
		tripId = ownedTrips[0]?.id ?? allTrips[0]?.trip.id ?? tripId;
	}
	return {
		name: params.name,
		tripId,
		userId: user?.id ?? 'sample-user'
	};
};
