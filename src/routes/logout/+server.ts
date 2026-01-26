import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { destroySession } from '$lib/server/session.js';

export const POST: RequestHandler = async ({ cookies }) => {
	await destroySession(cookies);
	throw redirect(303, '/');
};
