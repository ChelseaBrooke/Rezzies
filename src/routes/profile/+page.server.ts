import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getSessionUser } from '$lib/server/session.js';
import { prisma } from '$lib/server/prisma.js';

export const load: PageServerLoad = async ({ cookies }) => {
	const user = await getSessionUser(cookies);
	if (!user) {
		throw redirect(303, '/login?redirect=/profile');
	}

	const userData = await prisma.user.findUnique({
		where: { id: user.id },
		select: {
			id: true,
			email: true,
			name: true,
			phone: true,
			createdAt: true
		}
	});

	// Counts for quick stats (mock-friendly; real counts from DB)
	const [tripsHosted, tripsJoined, rsvpCount, inviteCount, notifCount] = await Promise.all([
		prisma.trip.count({ where: { hostId: user.id } }),
		prisma.tripMember.count({ where: { userId: user.id } }),
		prisma.rSVP.count({ where: { userId: user.id, status: 'yes' } }),
		prisma.invite.count({ where: { recipientUserId: user.id, status: 'sent' } }).catch(() => 0),
		prisma.notification.count({ where: { userId: user.id, read: false } }).catch(() => 0)
	]);

	return {
		user: userData,
		stats: {
			tripsHosted,
			tripsJoined,
			upcomingTrips: rsvpCount,
			pendingInvites: inviteCount,
			pendingRsvps: 0,
			unreadNotifications: notifCount
		}
	};
};
