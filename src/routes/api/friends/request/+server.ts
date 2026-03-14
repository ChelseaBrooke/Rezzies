import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSessionUser } from '$lib/server/session.js';
import { createRequest } from '$lib/server/friends.js';

export const POST: RequestHandler = async ({ request, cookies }) => {
	const user = await getSessionUser(cookies);
	if (!user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}
	const body = await request.json().catch(() => ({}));
	const toUserId = typeof body.toUserId === 'string' ? body.toUserId.trim() : '';
	if (!toUserId) {
		return json({ error: 'Missing toUserId' }, { status: 400 });
	}
	const result = await createRequest(user.id, toUserId);
	if (!result.ok) {
		return json({ error: result.error ?? 'Failed to send request' }, { status: 400 });
	}
	return json({ success: true });
};
