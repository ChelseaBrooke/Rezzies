import { redirect, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { getSessionUser } from '$lib/server/session.js';
import { prisma } from '$lib/server/prisma.js';
import { z } from 'zod';

const updateProfileSchema = z.object({
	name: z.string().max(200).optional(),
	avatarUrl: z.union([z.string().url(), z.literal('')]).optional()
});

export const load: PageServerLoad = async ({ cookies }) => {
	const user = await getSessionUser(cookies);
	if (!user) {
		throw redirect(303, '/login?redirect=/profile');
	}

	// Select without avatarUrl so profile works before migration has added the column
	const userRow = await prisma.user.findUnique({
		where: { id: user.id },
		select: {
			id: true,
			email: true,
			name: true,
			phone: true,
			createdAt: true
		}
	});
	const userData = userRow ? { ...userRow, avatarUrl: null as string | null } : null;

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

export const actions: Actions = {
	updateProfile: async ({ request, cookies }) => {
		const user = await getSessionUser(cookies);
		if (!user) throw redirect(303, '/login?redirect=/profile');

		const formData = await request.formData();
		const name = (formData.get('name') as string)?.trim() || null;
		const avatarUrlRaw = (formData.get('avatarUrl') as string)?.trim() || '';
		const avatarUrl = avatarUrlRaw === '' ? null : avatarUrlRaw;

		const parsed = updateProfileSchema.safeParse({ name, avatarUrl: avatarUrl ?? '' });
		if (!parsed.success) {
			return fail(400, { updateProfileError: 'Invalid name or avatar URL.' });
		}

		// Update name always; only update avatarUrl if the column exists (try/catch)
		const updateData: { name?: string | null; avatarUrl?: string | null } = {
			name: parsed.data.name ?? undefined
		};
		if (parsed.data.avatarUrl !== undefined && parsed.data.avatarUrl !== '') {
			updateData.avatarUrl = parsed.data.avatarUrl;
		} else if (parsed.data.avatarUrl === '') {
			updateData.avatarUrl = null;
		}
		try {
			await prisma.user.update({
				where: { id: user.id },
				data: updateData
			});
		} catch {
			// avatarUrl column may not exist yet; retry with name only
			await prisma.user.update({
				where: { id: user.id },
				data: { name: parsed.data.name ?? undefined }
			});
		}
		return { updateProfileSuccess: true };
	}
};
