import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { verifyUser } from '$lib/server/user-auth.js';
import { createSession } from '$lib/server/session.js';
import { z } from 'zod';

const loginSchema = z.object({
	email: z.string().email('Invalid email address'),
	password: z.string().min(1, 'Password is required')
});

export const load: PageServerLoad = async ({ cookies }) => {
	// If already logged in, redirect to trips
	const sessionToken = cookies.get('user_session');
	if (sessionToken) {
		throw redirect(303, '/trips');
	}
	return {};
};

export const actions: Actions = {
	login: async ({ request, cookies, url }) => {
		const formData = await request.formData();
		const email = formData.get('email');
		const password = formData.get('password');

		// Validate required fields are present
		if (!email || typeof email !== 'string') {
			return fail(400, {
				error: 'Email is required'
			});
		}

		if (!password || typeof password !== 'string') {
			return fail(400, {
				error: 'Password is required'
			});
		}

		const validationResult = loginSchema.safeParse({ email, password });
		if (!validationResult.success) {
			return fail(400, {
				error: 'Invalid email or password format'
			});
		}

		const user = await verifyUser(email, password);
		if (!user) {
			return fail(401, {
				error: 'Invalid email or password'
			});
		}

		try {
			// Create session
			await createSession(cookies, user.id);

			// Redirect to trips page or return URL
			const redirectTo = url.searchParams.get('redirect') || '/trips';
			throw redirect(303, redirectTo);
		} catch (error) {
			// Re-throw redirects (they're special errors in SvelteKit)
			if (error && typeof error === 'object' && 'status' in error && error.status === 303) {
				throw error;
			}
			
			console.error('Login error:', error);
			return fail(500, {
				error: 'Failed to create session. Please try again.'
			});
		}
	}
};
