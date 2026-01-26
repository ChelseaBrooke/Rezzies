import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { getSessionUser } from '$lib/server/session.js';

export const load: LayoutServerLoad = async ({ cookies, url }) => {
	const user = await getSessionUser(cookies);
	
	if (!user) {
		// Redirect to login with return URL
		throw redirect(303, `/login?redirect=${encodeURIComponent(url.pathname)}`);
	}

	return {
		user
	};
};
