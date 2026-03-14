import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSessionUser } from '$lib/server/session.js';
import { removeFriendship } from '$lib/server/friends.js';

export const POST: RequestHandler = async ({ request, cookies }) => {
	const user = await getSessionUser(cookies);
	if (!user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}
	const body = await request.json().catch(() => ({}));
	const friendUserId = typeof body.friendUserId === 'string' ? body.friendUserId.trim() : '';
	if (!friendUserId) {
		return json({ error: 'Missing friendUserId' }, { status: 400 });
	}
	const result = await removeFriendship(user.id, friendUserId);
	if (!result.ok) {
		return json({ error: result.error ?? 'Failed to unfriend' }, { status: 400 });
	}
	return json({ success: true });
};
