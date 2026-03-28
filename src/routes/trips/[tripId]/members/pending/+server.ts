import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSessionUser } from '$lib/server/session.js';
import { isTripHostOrCoHost } from '$lib/server/trip-access.js';
import { prisma } from '$lib/server/prisma.js';

export const GET: RequestHandler = async ({ params, cookies }) => {
	const user = await getSessionUser(cookies);
	if (!user) return json({ error: 'Unauthorized' }, { status: 401 });

	const isHostOrCoHost = await isTripHostOrCoHost(params.tripId, user.id);
	if (!isHostOrCoHost) return json({ error: 'Forbidden' }, { status: 403 });

	const pendingMembers = await prisma.tripMember.findMany({
		where: { tripId: params.tripId, inviteStatus: 'pending' },
		include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
		orderBy: { createdAt: 'asc' }
	});

	return json({
		members: pendingMembers.map((m) => ({
			memberId: m.id,
			userId: m.user.id,
			name: m.user.name ?? m.user.email,
			email: m.user.email,
			avatarUrl: m.user.avatarUrl,
			requestedAt: m.createdAt.toISOString()
		}))
	});
};
