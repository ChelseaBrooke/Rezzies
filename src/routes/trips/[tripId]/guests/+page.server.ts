import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { getSessionUser } from '$lib/server/session.js';
import { isTripHost } from '$lib/server/trip-access.js';
import { prisma } from '$lib/server/prisma.js';
import { z } from 'zod';

export const load: PageServerLoad = async ({ parent }) => {
	const parentData = await parent();
	const tripId = parentData.trip?.id;
	const invites = tripId
		? await prisma.invite.findMany({
				where: { tripId },
				orderBy: { createdAt: 'desc' }
			})
		: [];
	return {
		trip: parentData.trip,
		members: parentData.trip?.members ?? [],
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

		const token = crypto.randomUUID();
		await prisma.invite.create({
			data: {
				tripId,
				token,
				invitedByUserId: user.id,
				channel: 'email',
				recipientEmail: email,
				recipientPhone: null,
				expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
			}
		});

		return { createInviteSuccess: true };
	}
};
