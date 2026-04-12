import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { shouldWaivePlatformFee } from '$lib/server/platform-publish-fee.js';

export const POST: RequestHandler = async ({ request }) => {
	let body: Record<string, unknown>;
	try {
		body = await request.json();
	} catch {
		return json({ valid: false }, { status: 400 });
	}

	const code = typeof body.code === 'string' ? body.code.trim() : '';
	const valid = shouldWaivePlatformFee(code);
	return json({ valid });
};
