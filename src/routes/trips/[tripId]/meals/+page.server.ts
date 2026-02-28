import { redirect } from '@sveltejs/kit';

// Meals page has been consolidated into the Itinerary page.
export const load = async ({ params }) => {
	throw redirect(302, `/trips/${params.tripId}/itinerary`);
};
