import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent, params }) => {
	const parentData = await parent();
	if (!parentData.isHost) {
		throw redirect(303, `/trips/${params.tripId}`);
	}

	let stepNumber = parseInt(params.stepNumber || '1');
	if (stepNumber < 1) {
		throw redirect(303, `/trips/${params.tripId}/settings/step/1`);
	}
	if (stepNumber > 3) {
		throw redirect(303, `/trips/${params.tripId}/settings/step/3`);
	}

	return {
		trip: parentData.trip,
		isHost: parentData.isHost,
		stepNumber
	};
};
