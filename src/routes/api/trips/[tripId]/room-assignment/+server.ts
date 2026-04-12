import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSessionUser } from '$lib/server/session.js';
import { isTripHostOrCoHost } from '$lib/server/trip-access.js';
import { prisma } from '$lib/server/prisma.js';

export const PATCH: RequestHandler = async ({ request, cookies, params }) => {
	const user = await getSessionUser(cookies);
	if (!user) return json({ error: 'Unauthorized' }, { status: 401 });

	const tripId = params.tripId;
	const canManage = await isTripHostOrCoHost(tripId, user.id);
	if (!canManage) return json({ error: 'Forbidden' }, { status: 403 });

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Invalid JSON' }, { status: 400 });
	}

	const d = body as Record<string, unknown>;
	const userId = typeof d.userId === 'string' ? d.userId.trim() : '';
	const roomIdRaw = d.roomId;
	const roomId =
		typeof roomIdRaw === 'number' && Number.isInteger(roomIdRaw)
			? roomIdRaw
			: typeof roomIdRaw === 'string' && roomIdRaw.trim() !== ''
				? parseInt(roomIdRaw.trim(), 10)
				: null;
	const roomIdFinal = roomId != null && !Number.isNaN(roomId) ? roomId : null;
	const bedType = typeof d.bedType === 'string' ? d.bedType.trim() || null : null;
	const partySize = typeof d.partySize === 'number' && d.partySize >= 1 ? d.partySize : 1;

	if (!userId) return json({ error: 'userId required' }, { status: 400 });

	const existing = await prisma.roomAssignment.findFirst({
		where: { tripId, userId }
	});

	// Only allow clearing (delete) when client explicitly confirms (stops dropdown/hydration from wiping)
	const confirmClear = request.headers.get('x-confirm-clear-room') === 'true';
	if (roomIdFinal == null) {
		if (existing && confirmClear) {
			await prisma.roomAssignment.delete({ where: { id: existing.id } });
			console.log('[room-assignment] Deleted assignment', { userId, tripId });
		}
		return json({ success: true });
	}

	const room = await prisma.room.findFirst({
		where: { id: roomIdFinal, tripId }
	});
	if (!room) {
		console.warn('[room-assignment] Room not found', { roomId: roomIdFinal, tripId });
		return json({ error: 'Room not found' }, { status: 404 });
	}

	if (existing) {
		await prisma.roomAssignment.update({
			where: { id: existing.id },
			data: { roomId: roomIdFinal, bedType, partySize }
		});
		// Read back to confirm persistence (and rule out caching)
		const readBack = await prisma.roomAssignment.findUnique({
			where: { id: existing.id },
			select: { id: true, roomId: true, userId: true, tripId: true }
		});
		console.log('[room-assignment] Updated', { userId, roomId: roomIdFinal, roomName: room.name, readBack });
	} else {
		const created = await prisma.roomAssignment.create({
			data: { tripId, userId, roomId: roomIdFinal, bedType, partySize }
		});
		console.log('[room-assignment] Created', { userId, roomId: roomIdFinal, roomName: room.name, id: created.id });
	}

	return json({ success: true });
};
