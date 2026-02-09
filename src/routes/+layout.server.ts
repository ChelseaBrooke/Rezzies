import type { LayoutServerLoad } from './$types';
import { getSessionUser } from '$lib/server/session.js';

export const load: LayoutServerLoad = async ({ cookies }) => {
	const user = await getSessionUser(cookies);
	
	return {
		user
	};
};

