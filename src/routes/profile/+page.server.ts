import { redirect, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { getSessionUser } from '$lib/server/session.js';
import { prisma } from '$lib/server/prisma.js';
import { z } from 'zod';

const hexColorRe = /^#[0-9A-Fa-f]{6}$/;
const updateProfileSchema = z.object({
	name: z.string().max(200).optional(),
	avatarUrl: z.union([z.string().url(), z.literal('')]).optional(),
	chatBubbleColor: z.union([z.string().regex(hexColorRe), z.literal('')]).optional()
});

export const load: PageServerLoad = async ({ cookies }) => {
	const user = await getSessionUser(cookies);
	if (!user) {
		throw redirect(303, '/login?redirect=/profile');
	}

	const userRow = await prisma.user.findUnique({
		where: { id: user.id },
		select: {
			id: true,
			email: true,
			name: true,
			phone: true,
			avatarUrl: true,
			chatBubbleColor: true,
			createdAt: true
		}
	});
	const userData = userRow ?? null;

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
		const chatBubbleColorRaw = (formData.get('chatBubbleColor') as string)?.trim() || '';
		const chatBubbleColor = chatBubbleColorRaw === '' ? null : chatBubbleColorRaw;

		const parsed = updateProfileSchema.safeParse({
			name,
			avatarUrl: avatarUrl ?? '',
			chatBubbleColor: chatBubbleColor ?? ''
		});
		if (!parsed.success) {
			return fail(400, { updateProfileError: 'Invalid name, avatar URL, or chat color.' });
		}

		const updateData: { name?: string | null; avatarUrl?: string | null; chatBubbleColor?: string | null } = {
			name: parsed.data.name ?? undefined
		};
		if (parsed.data.avatarUrl !== undefined && parsed.data.avatarUrl !== '') {
			updateData.avatarUrl = parsed.data.avatarUrl;
		} else if (parsed.data.avatarUrl === '') {
			updateData.avatarUrl = null;
		}
		if (parsed.data.chatBubbleColor !== undefined && parsed.data.chatBubbleColor !== '') {
			updateData.chatBubbleColor = parsed.data.chatBubbleColor;
		} else if (parsed.data.chatBubbleColor === '') {
			updateData.chatBubbleColor = null;
		}
		await prisma.user.update({
			where: { id: user.id },
			data: updateData
		});
		return { updateProfileSuccess: true };
	}
};
