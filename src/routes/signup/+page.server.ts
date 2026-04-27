import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { createUser } from '$lib/server/user-auth.js';
import { createSession } from '$lib/server/session.js';
import { AUTH_RATE, isRateLimited } from '$lib/server/rate-limit.js';
import { linkPendingInvitesForUser } from '$lib/server/invite-service.js';
import {
	HOUSEHOLD_CLAIM_COOKIE,
	mergeHouseholdProxyToUser,
	type HouseholdClaimPayload
} from '$lib/server/household-claim.js';
import { TRAVEL_STYLE_OPTIONS, isValidTravelStyle } from '$lib/travel-style.js';
import { z } from 'zod';

const signupSchema = z.object({
	email: z.string().email('Invalid email address'),
	password: z.string().min(8, 'Password must be at least 8 characters'),
	name: z.string().optional(),
	travelStyle: z.union([z.enum(TRAVEL_STYLE_OPTIONS), z.literal('')]).optional()
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
	default: async ({ request, cookies, url, getClientAddress }) => {
		const clientIp = getClientAddress();
		const rl = isRateLimited(`signup:${clientIp}`, AUTH_RATE.max, AUTH_RATE.windowMs);
		if (rl.limited) {
			return fail(429, {
				error: `Too many sign-up attempts. Try again in about ${rl.retryAfterSec} seconds.`
			});
		}

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

			const claimRaw = cookies.get(HOUSEHOLD_CLAIM_COOKIE);
			if (claimRaw) {
				try {
					const parsed = JSON.parse(claimRaw) as HouseholdClaimPayload;
					if (parsed.v === 1 && parsed.householdMemberId) {
						await mergeHouseholdProxyToUser({
							householdMemberId: parsed.householdMemberId,
							userId: user.id,
							userName: user.name
						});
					}
				} catch {
					// ignore bad cookie
				}
				cookies.delete(HOUSEHOLD_CLAIM_COOKIE, { path: '/' });
			}

			const raw = url.searchParams.get('redirect') ?? '';
			const redirectTo =
				raw.startsWith('/') && !raw.startsWith('//') && !raw.includes(':')
					? raw
					: '/trips';
			throw redirect(303, redirectTo);
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
