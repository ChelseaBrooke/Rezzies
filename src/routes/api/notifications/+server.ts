import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSessionUser } from '$lib/server/session.js';
import { prisma } from '$lib/server/prisma.js';

export const GET: RequestHandler = async ({ cookies }) => {
	const user = await getSessionUser(cookies);
	if (!user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
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
			read: n.read,
			createdAt: n.createdAt.toISOString()
		})),
		unreadCount
	});
};
