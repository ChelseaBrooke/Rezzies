import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { prisma } from '$lib/server/prisma.js';
import { mobileAuthCorsHeaders } from '$lib/server/mobile-cors.js';

export const OPTIONS: RequestHandler = async ({ request }) => {
	return new Response(null, { status: 204, headers: mobileAuthCorsHeaders(request) });
};

// POST /api/mobile/auth/logout , Authorization: Bearer <token>
export const POST: RequestHandler = async ({ request }) => {
	const h = mobileAuthCorsHeaders(request);
	const auth = request.headers.get('Authorization') ?? '';
	const token = auth.replace(/^Bearer\s+/i, '').trim();

	if (token) {
		await prisma.session.deleteMany({ where: { token } }).catch(() => null);
	}

	return json({ ok: true }, { status: 200, headers: h });
};
