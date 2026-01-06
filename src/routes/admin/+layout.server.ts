import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ cookies, url }) => {
	// Allow access to login page without auth
	if (url.pathname === '/admin/login') {
		return {};
	}

	// Check for admin session
	const session = cookies.get('admin_session');
	if (!session) {
		throw redirect(303, '/admin/login');
	}

	return {};
};

