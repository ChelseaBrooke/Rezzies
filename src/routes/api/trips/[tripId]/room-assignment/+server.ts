import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSessionUser } from '$lib/server/session.js';
import { isTripHost } from '$lib/server/trip-access.js';
import { prisma } from '$lib/server/prisma.js';

export const PATCH: RequestHandler = async ({ request, cookies, params }) => {
	const user = await getSessionUser(cookies);
	if (!user) return json({ error: 'Unauthorized' }, 401);

	const tripId = params.tripId;
	const isHost = await isTripHost(tripId, user.id);
	if (!isHost) return json({ error: 'Forbidden' }, 403);

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Invalid JSON' }, 400);
	}

	const d = body as Record<string, unknown>;
	const userId = typeof d.userId === 'string' ? d.userId.trim() : '';
	const roomId = typeof d.roomId === 'number' ? d.roomId : null;
	const bedType = typeof d.bedType === 'string' ? d.bedType.trim() || null : null;
	const partySize = typeof d.partySize === 'number' && d.partySize >= 1 ? d.partySize : 1;

	if (!userId) return json({ error: 'userId required' }, 400);

	const existing = await prisma.roomAssignment.findFirst({
		where: { tripId, userId }
	});

	if (roomId == null) {
		if (existing) await prisma.roomAssignment.delete({ where: { id: existing.id } });
		return json({ success: true });
	}

	const room = await prisma.room.findFirst({
		where: { id: roomId, tripId }
	});
	if (!room) return json({ error: 'Room not found' }, 404);

	if (existing) {
		await prisma.roomAssignment.update({
			where: { id: existing.id },
			data: { roomId, bedType, partySize }
		});
	} else {
		await prisma.roomAssignment.create({
			data: { tripId, userId, roomId, bedType, partySize }
		});
	}

	return json({ success: true });
};
