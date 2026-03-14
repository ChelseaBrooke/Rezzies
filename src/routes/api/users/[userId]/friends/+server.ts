import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSessionUser } from '$lib/server/session.js';
import { prisma } from '$lib/server/prisma.js';
import { listFriends, canViewFriendsList } from '$lib/server/friends.js';

export const GET: RequestHandler = async ({ params, cookies }) => {
	const userId = params.userId;
	const sessionUser = await getSessionUser(cookies);

	const owner = await prisma.user.findUnique({
		where: { id: userId },
		select: { id: true, friendsListVisibility: true }
	});
	if (!owner) {
		return json({ error: 'User not found' }, { status: 404 });
	}

	const allowed = await canViewFriendsList(
		sessionUser?.id ?? null,
		owner.id,
		owner.friendsListVisibility ?? 'friends'
	);
	if (!allowed) {
		return json({ friends: [] });
	}
	const friends = await listFriends(owner.id);
	return json({ friends });
};
