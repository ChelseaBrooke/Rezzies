import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSessionUser } from '$lib/server/session.js';
import { listFriends } from '$lib/server/friends.js';

export const GET: RequestHandler = async ({ cookies }) => {
	const user = await getSessionUser(cookies);
	if (!user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}
	const friends = await listFriends(user.id);
	return json({ friends });
};
