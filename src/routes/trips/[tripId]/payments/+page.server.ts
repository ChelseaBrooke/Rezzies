import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

/** Payments removed: invoice is now on Guests tab. Redirect so old links work. */
export const load: PageServerLoad = async ({ params }) => {
	throw redirect(303, `/trips/${params.tripId}/guests`);
};
