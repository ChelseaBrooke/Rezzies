/**
 * GET minimal profile for tooltip (trip-agnostic).
 * Public fields only for other users; full minimal set for self.
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSessionUser } from '$lib/server/session.js';
import { prisma } from '$lib/server/prisma.js';
import { getFriendshipStatus } from '$lib/server/friends.js';

export const GET: RequestHandler = async ({ params, cookies }) => {
	const userId = params.userId;
	const sessionUser = await getSessionUser(cookies);

	const user = await prisma.user.findUnique({
		where: { id: userId },
		select: {
			id: true,
			name: true,
			avatarUrl: true,
			travelStyle: true,
			homeCity: true
		}
	});

	if (!user) {
		return json({ error: 'User not found' }, { status: 404 });
	}

	const isSelf = sessionUser?.id === userId;
	let friendshipStatus: 'self' | 'none' | 'friends' | 'pending_sent' | 'pending_received' = isSelf ? 'self' : 'none';
	if (!isSelf && sessionUser?.id) {
		const friendship = await getFriendshipStatus(sessionUser.id, userId);
		friendshipStatus = friendship.status;
	}

	return json({
		displayName: user.name || 'Traveler',
		avatarUrl: user.avatarUrl,
		travelStyle: user.travelStyle,
		homeCity: user.homeCity,
		isSelf,
		friendshipStatus
	});
};
