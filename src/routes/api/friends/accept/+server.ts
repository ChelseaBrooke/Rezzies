import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSessionUser } from '$lib/server/session.js';
import { acceptRequest } from '$lib/server/friends.js';

export const POST: RequestHandler = async ({ request, cookies }) => {
	const user = await getSessionUser(cookies);
	if (!user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}
	const body = await request.json().catch(() => ({}));
	const fromUserId = typeof body.fromUserId === 'string' ? body.fromUserId.trim() : '';
	if (!fromUserId) {
		return json({ error: 'Missing fromUserId' }, { status: 400 });
	}
	const result = await acceptRequest(user.id, fromUserId);
	if (!result.ok) {
		return json({ error: result.error ?? 'Failed to accept' }, { status: 400 });
	}
	return json({ success: true });
};
