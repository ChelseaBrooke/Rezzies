import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent, params }) => {
	const parentData = await parent();
	const checkOutDate = parentData.trip?.checkOutDate ? new Date(parentData.trip.checkOutDate) : null;
	if (checkOutDate) {
		checkOutDate.setHours(23, 59, 59, 999);
		if (Date.now() > checkOutDate.getTime()) {
			throw redirect(303, `/trips/${params.tripId}`);
		}
	}
	if (!parentData.isHost) {
		return { trip: parentData.trip, isHost: false };
	}
	// Host: redirect to step 1 of the edit wizard (same UI as create trip)
	throw redirect(303, `/trips/${params.tripId}/settings/step/1`);
};
