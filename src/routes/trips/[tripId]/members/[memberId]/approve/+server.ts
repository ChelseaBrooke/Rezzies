import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSessionUser } from '$lib/server/session.js';
import { isTripHostOrCoHost } from '$lib/server/trip-access.js';
import { prisma } from '$lib/server/prisma.js';

export const POST: RequestHandler = async ({ params, cookies }) => {
	const user = await getSessionUser(cookies);
	if (!user) return json({ error: 'Unauthorized' }, { status: 401 });

	const isHostOrCoHost = await isTripHostOrCoHost(params.tripId, user.id);
	if (!isHostOrCoHost) return json({ error: 'Forbidden' }, { status: 403 });

	await prisma.tripMember.update({
		where: { id: params.memberId, tripId: params.tripId },
		data: { inviteStatus: 'approved' }
	});

	return json({ success: true });
};
