import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent }) => {
	const d = await parent();
	if (!d.isHost) {
		throw redirect(303, `/trips/${d.trip.id}`);
	}
	if (d.trip.isPublished) {
		throw redirect(303, `/trips/${d.trip.id}`);
	}
	return {};
};
