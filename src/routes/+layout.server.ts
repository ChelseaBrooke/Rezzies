import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ cookies }) => {
	// Check for admin session
	const session = cookies.get('admin_session');
	
	// For now, just return if there's a session (user is logged in)
	// In a real app, you'd decode the session and get user details
	return {
		user: session ? { email: 'user@example.com' } : null
	};
};

