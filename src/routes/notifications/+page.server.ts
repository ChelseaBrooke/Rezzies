import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	// Notifications are shown in the tray (bell icon); no dedicated page
	throw redirect(303, '/');
};
