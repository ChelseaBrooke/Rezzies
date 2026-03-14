import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSessionUser } from '$lib/server/session.js';
import { prisma } from '$lib/server/prisma.js';

export const GET: RequestHandler = async ({ cookies }) => {
	const user = await getSessionUser(cookies);
	if (!user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	// Backfill: ensure pending friend requests have a notification (for requests created before we added notification creation)
	const pendingRequests = await prisma.friendRequest.findMany({
		where: { toUserId: user.id, status: 'pending' },
		include: { fromUser: { select: { id: true, name: true } } }
	});
	for (const req of pendingRequests) {
		const existing = await prisma.notification.findFirst({
			where: {
				userId: user.id,
				type: 'friend_request',
				relatedEntityId: req.fromUserId
			}
		});
		if (!existing) {
			const senderName = req.fromUser?.name?.trim() || 'Someone';
			await prisma.notification.create({
				data: {
					userId: user.id,
					type: 'friend_request',
					title: 'Friend request',
					message: `${senderName} wants to be your friend.`,
					relatedEntityId: req.fromUserId
				}
			});
		}
	}

	const notifications = await prisma.notification.findMany({
		where: { userId: user.id },
		orderBy: { createdAt: 'desc' },
		take: 50
	});

	const unreadCount = notifications.filter((n) => !n.read).length;

	return json({
		notifications: notifications.map((n) => ({
			id: n.id,
			type: n.type,
			title: n.title,
			message: n.message,
			relatedTripId: n.relatedTripId,
			relatedEntityId: n.relatedEntityId,
			read: n.read,
			createdAt: n.createdAt.toISOString()
		})),
		unreadCount
	});
};
