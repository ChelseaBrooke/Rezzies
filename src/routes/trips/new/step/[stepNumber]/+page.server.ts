import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getSessionUser } from '$lib/server/session.js';

export const load: PageServerLoad = async ({ params, cookies, url }) => {
	const user = await getSessionUser(cookies);
	
	if (!user) {
		throw redirect(303, `/login?redirect=${encodeURIComponent(url.pathname)}`);
	}
	
	const stepNumber = parseInt(params.stepNumber || '1');
	
	if (stepNumber < 1 || stepNumber > 3) {
		throw redirect(303, '/trips/new/step/1');
	}
	
	return {
		user,
		stepNumber
	};
};
