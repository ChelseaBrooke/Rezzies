import { fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { verifyAdminUser } from '$lib/server/auth.js';
import { adminLoginSchema } from '$lib/server/validation.js';

export const load: PageServerLoad = async ({ cookies }) => {
	// If already logged in, redirect to dashboard
	if (cookies.get('admin_session')) {
		throw redirect(303, '/admin');
	}
	return {};
};

export const actions: Actions = {
	default: async ({ request, cookies }) => {
		const formData = await request.formData();
		const email = formData.get('email') as string;
		const password = formData.get('password') as string;

		const validationResult = adminLoginSchema.safeParse({ email, password });
		if (!validationResult.success) {
			return fail(400, {
				error: 'Invalid email or password format'
			});
		}

		const isValid = await verifyAdminUser(email, password);
		if (!isValid) {
			return fail(401, {
				error: 'Invalid email or password'
			});
		}

		// Set session cookie
		const sessionToken = crypto.randomUUID();
		cookies.set('admin_session', sessionToken, {
			path: '/',
			httpOnly: true,
			sameSite: 'strict',
			secure: process.env.NODE_ENV === 'production',
			maxAge: 60 * 60 * 24 * 7 // 7 days
		});

		// Store session in database (simplified - in production use a proper session store)
		// For now, we'll just check the cookie exists

		throw redirect(303, '/admin');
	}
};

