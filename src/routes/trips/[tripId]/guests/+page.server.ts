import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { getSessionUser } from '$lib/server/session.js';
import { isTripHost } from '$lib/server/trip-access.js';
import { prisma } from '$lib/server/prisma.js';
import { notifyExistingUserOfInvite } from '$lib/server/invite-service.js';
import { z } from 'zod';

const PENDING_INVITE_STATUSES = ['sent', 'opened'];

export const load: PageServerLoad = async ({ parent }) => {
	const parentData = await parent();
	const tripId = parentData.trip?.id;
	const members = parentData.trip?.members ?? [];

	const memberEmails = new Set(
		members.map((m) => m.user?.email?.trim()?.toLowerCase()).filter(Boolean)
	);
	const memberUserIds = new Set(members.map((m) => m.user?.id).filter(Boolean));

	const allInvites =
		tripId &&
		(await prisma.invite.findMany({
			where: { tripId, status: { in: PENDING_INVITE_STATUSES } },
			orderBy: { createdAt: 'desc' }
		}));

	const invites = (allInvites ?? []).filter((inv) => {
		const email = inv.recipientEmail?.trim()?.toLowerCase();
		if (email && memberEmails.has(email)) return false;
		if (inv.recipientUserId && memberUserIds.has(inv.recipientUserId)) return false;
		return true;
	});

	return {
		trip: parentData.trip,
		members,
		invites
	};
};

const inviteSchema = z.object({
	email: z.string().email('Please enter a valid email address')
});

export const actions: Actions = {
	createInvite: async ({ request, params, cookies }) => {
		const user = await getSessionUser(cookies);
		if (!user) throw redirect(303, '/login');

		const tripId = params.tripId;
		const host = await isTripHost(tripId, user.id);
		if (!host) throw error(403, 'Only the trip host can invite guests');

		const formData = await request.formData();
		const email = (formData.get('email') as string)?.trim() ?? '';

		const validation = inviteSchema.safeParse({ email });
		if (!validation.success) {
			const message = validation.error.errors[0]?.message ?? 'Invalid email';
			return { createInviteError: message };
		}

		const emailTrimmed = email.trim().toLowerCase();
		const existingUser = await prisma.user.findFirst({
			where: { email: { equals: email.trim(), mode: 'insensitive' } },
			select: { id: true }
		});

		if (existingUser) {
			const alreadyMember = await prisma.tripMember.findUnique({
				where: {
					tripId_userId: { tripId, userId: existingUser.id }
				}
			});
			if (alreadyMember) {
				return { createInviteError: 'This person is already a guest.' };
			}
		} else {
			const existingPendingByEmail = await prisma.invite.findFirst({
				where: {
					tripId,
					recipientEmail: { equals: emailTrimmed, mode: 'insensitive' },
					status: { in: PENDING_INVITE_STATUSES }
				}
			});
			if (existingPendingByEmail) {
				return { createInviteError: 'A pending invite has already been sent to this email.' };
			}
		}

		const token = crypto.randomUUID();
		const invite = await prisma.invite.create({
			data: {
				tripId,
				token,
				invitedByUserId: user.id,
				channel: 'email',
				recipientEmail: email,
				recipientPhone: null,
				recipientUserId: existingUser?.id ?? null,
				expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
			}
		});

		if (existingUser) {
			const trip = await prisma.trip.findUnique({
				where: { id: tripId },
				select: { name: true }
			});
			if (trip) {
				await notifyExistingUserOfInvite({
					inviteId: invite.id,
					tripId,
					tripName: trip.name,
					recipientUserId: existingUser.id
				});
			}
		}

		return { createInviteSuccess: true };
	}
};
