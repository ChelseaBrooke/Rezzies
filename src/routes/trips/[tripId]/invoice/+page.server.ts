import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

/** Invoice is now on Guests tab (click amount to view). Redirect so old links work. */
export const load: PageServerLoad = async ({ params }) => {
	throw redirect(303, `/trips/${params.tripId}/guests`);
};
