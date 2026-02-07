import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent, params }) => {
	const parentData = await parent();
	if (!parentData.isHost) {
		return { trip: parentData.trip, isHost: false };
	}
	// Host: redirect to step 1 of the edit wizard (same UI as create trip)
	throw redirect(303, `/trips/${params.tripId}/settings/step/1`);
};
