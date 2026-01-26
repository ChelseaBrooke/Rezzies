import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getSessionUser } from '$lib/server/session.js';
import { prisma } from '$lib/server/prisma.js';

export const load: PageServerLoad = async ({ cookies }) => {
	const user = await getSessionUser(cookies);
	
	if (!user) {
		throw redirect(303, '/login?redirect=/notifications');
	}

	// Get user's notifications
	const notifications = await prisma.notification.findMany({
		where: { userId: user.id },
		orderBy: { createdAt: 'desc' },
		take: 50
	});

	const unreadCount = notifications.filter(n => !n.read).length;

	return {
		user,
		notifications,
		unreadCount
	};
};
