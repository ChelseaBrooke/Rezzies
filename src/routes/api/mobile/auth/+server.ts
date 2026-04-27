import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { verifyUser, createUser } from '$lib/server/user-auth.js';
import { prisma } from '$lib/server/prisma.js';
import { mobileAuthCorsHeaders } from '$lib/server/mobile-cors.js';
import { AUTH_RATE, isRateLimited } from '$lib/server/rate-limit.js';

const SESSION_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 90; // 90 days for mobile

export const OPTIONS: RequestHandler = async ({ request }) => {
	return new Response(null, { status: 204, headers: mobileAuthCorsHeaders(request) });
};

// POST /api/mobile/auth  { action: 'login' | 'register', email, password, name? }
export const POST: RequestHandler = async ({ request, getClientAddress }) => {
	const h = () => mobileAuthCorsHeaders(request);
	const clientIp = getClientAddress();
	const rl = isRateLimited(`mobile-auth:${clientIp}`, AUTH_RATE.max, AUTH_RATE.windowMs);
	if (rl.limited) {
		return json(
			{ error: `Too many attempts. Try again in about ${rl.retryAfterSec} seconds.` },
			{ status: 429, headers: h() }
		);
	}

	let body: { action?: string; email?: string; password?: string; name?: string };
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Invalid JSON' }, { status: 400, headers: h() });
	}

	const { action, email, password, name } = body;

	if (!email || !password) {
		return json({ error: 'Email and password are required' }, { status: 400, headers: h() });
	}

	if (action === 'register') {
		if (!name?.trim()) {
			return json({ error: 'Name is required' }, { status: 400, headers: h() });
		}
		try {
			await createUser(email, password, { name: name.trim() });
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : 'Registration failed';
			return json({ error: msg }, { status: 400, headers: h() });
		}
	}

	// Verify credentials (works for both login and post-register)
	const user = await verifyUser(email, password);
	if (!user) {
		return json({ error: 'Invalid email or password' }, { status: 401, headers: h() });
	}

	// Fetch full user profile
	const profile = await prisma.user.findUnique({
		where: { id: user.id },
		select: { id: true, email: true, name: true, avatarUrl: true, phone: true }
	});

	// Create a long-lived session token for mobile
	const token = crypto.randomUUID();
	const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_MS);
	await prisma.session.create({
		data: { userId: user.id, token, expiresAt }
	});

	return json({ token, user: profile }, { status: 200, headers: h() });
};
