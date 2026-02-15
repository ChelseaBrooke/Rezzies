import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

/** Redirect to unified confirmation page (old links/emails) */
export const load: PageServerLoad = async ({ params }) => {
	throw redirect(303, `/confirmation/${params.id}`);
};
