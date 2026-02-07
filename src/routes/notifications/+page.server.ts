import { redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { getSessionUser } from '$lib/server/session.js';
import { prisma } from '$lib/server/prisma.js';
import { linkPendingInvitesForUser } from '$lib/server/invite-service.js';

export const load: PageServerLoad = async ({ cookies }) => {
	const user = await getSessionUser(cookies);

	if (!user) {
		throw redirect(303, '/login?redirect=/notifications');
	}

	// If they signed up with an email that was invited before they had an account, link those invites now
	await linkPendingInvitesForUser(user.id, user.email);

	// Get user's notifications
	const notifications = await prisma.notification.findMany({
		where: { userId: user.id },
		orderBy: { createdAt: 'desc' },
		take: 50
	});

	const unreadCount = notifications.filter((n) => !n.read).length;

	return {
		user,
		notifications,
		unreadCount
	};
};

export const actions: Actions = {
	/** Mark notification as read and redirect to the trip guest portal */
	markReadAndGo: async ({ request, cookies }) => {
		const user = await getSessionUser(cookies);
		if (!user) throw redirect(303, '/login?redirect=/notifications');

		const formData = await request.formData();
		const notificationId = formData.get('notificationId') as string | null;
		const tripId = formData.get('tripId') as string | null;

		if (!notificationId || !tripId) {
			return {};
		}

		await prisma.notification.updateMany({
			where: {
				id: notificationId,
				userId: user.id,
				relatedTripId: tripId
			},
			data: { read: true }
		});

		throw redirect(303, `/trips/${tripId}`);
	}
};
