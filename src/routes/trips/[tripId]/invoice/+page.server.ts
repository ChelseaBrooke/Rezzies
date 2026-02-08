import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

/** Invoice is now a pop-up on the payments page. Redirect so old links work. */
export const load: PageServerLoad = async ({ params }) => {
	throw redirect(303, `/trips/${params.tripId}/payments?invoice=1`);
};
