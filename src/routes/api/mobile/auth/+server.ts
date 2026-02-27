import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { verifyUser, createUser } from '$lib/server/user-auth.js';
import { prisma } from '$lib/server/prisma.js';

const SESSION_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 90; // 90 days for mobile

function corsHeaders() {
	return {
		'Access-Control-Allow-Origin': '*',
		'Access-Control-Allow-Methods': 'POST, OPTIONS',
		'Access-Control-Allow-Headers': 'Content-Type, Authorization'
	};
}

export const OPTIONS: RequestHandler = async () => {
	return new Response(null, { status: 204, headers: corsHeaders() });
};

// POST /api/mobile/auth  { action: 'login' | 'register', email, password, name? }
export const POST: RequestHandler = async ({ request }) => {
	let body: { action?: string; email?: string; password?: string; name?: string };
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Invalid JSON' }, { status: 400, headers: corsHeaders() });
	}

	const { action, email, password, name } = body;

	if (!email || !password) {
		return json({ error: 'Email and password are required' }, { status: 400, headers: corsHeaders() });
	}

	if (action === 'register') {
		if (!name?.trim()) {
			return json({ error: 'Name is required' }, { status: 400, headers: corsHeaders() });
		}
		try {
			await createUser(email.toLowerCase().trim(), password, { name: name.trim() });
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : 'Registration failed';
			return json({ error: msg }, { status: 400, headers: corsHeaders() });
		}
	}

	// Verify credentials (works for both login and post-register)
	const user = await verifyUser(email.toLowerCase().trim(), password);
	if (!user) {
		return json({ error: 'Invalid email or password' }, { status: 401, headers: corsHeaders() });
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

	return json(
		{ token, user: profile },
		{ status: 200, headers: corsHeaders() }
	);
};
