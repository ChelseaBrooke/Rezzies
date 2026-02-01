import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getSessionUser } from '$lib/server/session.js';
import { prisma } from '$lib/server/prisma.js';

export const load: PageServerLoad = async ({ cookies }) => {
	const user = await getSessionUser(cookies);
	if (!user) {
		throw redirect(303, '/login?redirect=/invites');
	}

	const pending = await prisma.invite.findMany({
		where: { recipientUserId: user.id, status: 'sent' },
		include: { trip: { select: { name: true, id: true } } }
	});

	return { pending };
};
