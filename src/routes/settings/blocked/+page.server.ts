import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getSessionUser } from '$lib/server/session.js';

export const load: PageServerLoad = async ({ cookies }) => {
	const user = await getSessionUser(cookies);
	if (!user) throw redirect(303, '/login?redirect=/settings/blocked');
	return { blocked: [] };
};
