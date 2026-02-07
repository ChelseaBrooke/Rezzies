import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent, params }) => {
	const parentData = await parent();
	if (!parentData.isHost) {
		throw redirect(303, `/trips/${params.tripId}/rooms`);
	}
	return {
		trip: parentData.trip,
		rooms: parentData.trip?.rooms ?? [],
		isHost: true
	};
};
