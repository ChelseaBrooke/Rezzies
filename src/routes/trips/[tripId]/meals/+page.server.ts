import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent, params }) => {
	const parentData = await parent();
	const trip = parentData.trip;
	if (!trip?.mealPlan) {
		throw redirect(303, '/trips/' + params.tripId);
	}
	return {
		trip,
		mealPlan: trip.mealPlan,
		mealSlots: trip.mealSlots ?? []
	};
};
