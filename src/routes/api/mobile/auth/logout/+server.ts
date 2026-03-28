import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { prisma } from '$lib/server/prisma.js';

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

// POST /api/mobile/auth/logout , Authorization: Bearer <token>
export const POST: RequestHandler = async ({ request }) => {
	const auth = request.headers.get('Authorization') ?? '';
	const token = auth.replace(/^Bearer\s+/i, '').trim();

	if (token) {
		await prisma.session.deleteMany({ where: { token } }).catch(() => null);
	}

	return json({ ok: true }, { status: 200, headers: corsHeaders() });
};
