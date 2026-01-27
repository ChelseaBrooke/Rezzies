import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getSessionUser } from '$lib/server/session.js';

// Redirect to the new wizard page
export const load: PageServerLoad = async ({ cookies, url }) => {
	const user = await getSessionUser(cookies);
	if (!user) {
		throw redirect(303, `/login?redirect=${encodeURIComponent(url.pathname)}`);
	}
	// Redirect to the wizard
	throw redirect(303, '/trips/new');
};
