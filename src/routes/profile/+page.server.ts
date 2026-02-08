import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

/** Profile is no longer a page; all profile viewing/editing is via overlays. Redirect to trips. */
export const load: PageServerLoad = async () => {
	throw redirect(303, '/trips');
};
