import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { createUser } from '$lib/server/user-auth.js';
import { createSession } from '$lib/server/session.js';
import { linkPendingInvitesForUser } from '$lib/server/invite-service.js';
import { TRAVEL_STYLE_OPTIONS, isValidTravelStyle } from '$lib/travel-style.js';
import { z } from 'zod';

const signupSchema = z.object({
	email: z.string().email('Invalid email address'),
	password: z.string().min(8, 'Password must be at least 8 characters'),
	name: z.string().optional(),
	travelStyle: z.union([z.enum(TRAVEL_STYLE_OPTIONS), z.literal('')]).optional()
}).refine((data) => data.password.length >= 8, {
	message: 'Password must be at least 8 characters',
	path: ['password']
});

export const load: PageServerLoad = async ({ cookies }) => {
	const sessionToken = cookies.get('user_session');
	if (sessionToken) {
		const { getSessionUser } = await import('$lib/server/session.js');
		const user = await getSessionUser(cookies);
		if (user) throw redirect(303, '/trips');
		cookies.delete('user_session', { path: '/' });
	}
	return {};
};

export const actions: Actions = {
	default: async ({ request, cookies }) => {
		const formData = await request.formData();
		const email = formData.get('email');
		const password = formData.get('password');
		const confirmPassword = formData.get('confirmPassword');
		const name = formData.get('name');
		const travelStyleRaw = (formData.get('travelStyle') as string)?.trim() || '';

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

		if (!confirmPassword || typeof confirmPassword !== 'string') {
			return fail(400, {
				error: 'Please confirm your password'
			});
		}

		// Check passwords match
		if (password !== confirmPassword) {
			return fail(400, {
				error: 'Passwords do not match'
			});
		}

		const travelStyle = travelStyleRaw === '' ? undefined : (isValidTravelStyle(travelStyleRaw) ? travelStyleRaw : undefined);
		const validationResult = signupSchema.safeParse({
			email,
			password,
			name: name && typeof name === 'string' ? name : undefined,
			travelStyle: travelStyle ?? ''
		});
		if (!validationResult.success) {
			return fail(400, {
				error: validationResult.error.errors[0]?.message || 'Invalid input'
			});
		}

		try {
			const user = await createUser(email, password, {
				name: validationResult.data.name || undefined,
				travelStyle: validationResult.data.travelStyle || null
			});

			// If they were invited before signing up, link those invites and create notifications
			await linkPendingInvitesForUser(user.id, email);

			// Create session
			await createSession(cookies, user.id);

			// Redirect to trips page
			throw redirect(303, '/trips');
		} catch (error) {
			// Re-throw redirects (they're special errors in SvelteKit)
			if (error && typeof error === 'object' && 'status' in error && error.status === 303) {
				throw error;
			}
			
			console.error('Signup error:', error);
			return fail(400, {
				error: error instanceof Error ? error.message : 'Failed to create account'
			});
		}
	}
};
