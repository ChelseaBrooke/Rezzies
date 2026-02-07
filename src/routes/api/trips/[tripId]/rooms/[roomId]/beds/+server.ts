import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSessionUser } from '$lib/server/session.js';
import { isTripHost } from '$lib/server/trip-access.js';
import { prisma } from '$lib/server/prisma.js';

const roomIdNum = (id: string) => {
	const n = parseInt(id, 10);
	return Number.isNaN(n) ? null : n;
};

const BED_TYPES = ['king', 'queen', 'twin', 'bunk', 'sofa_bed', 'full', 'other'];

export const POST: RequestHandler = async ({ request, cookies, params }) => {
	const user = await getSessionUser(cookies);
	if (!user) return json({ error: 'Unauthorized' }, 401);

	const tripId = params.tripId;
	const roomId = roomIdNum(params.roomId);
	if (roomId == null) return json({ error: 'Invalid room id' }, 400);

	const isHost = await isTripHost(tripId, user.id);
	if (!isHost) return json({ error: 'Forbidden' }, 403);

	const room = await prisma.room.findFirst({
		where: { id: roomId, tripId }
	});
	if (!room) return json({ error: 'Room not found' }, 404);

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Invalid JSON' }, 400);
	}

	const d = body as Record<string, unknown>;
	let bedType = typeof d.bedType === 'string' ? d.bedType.trim().toLowerCase().replace(/\s+/g, '_') : 'queen';
	if (!BED_TYPES.includes(bedType)) bedType = 'other';

	const bed = await prisma.bed.create({
		data: {
			roomId,
			bedType,
			capacity: 1,
			capacitySlots: 1,
			isAvailable: true
		}
	});

	return json(bed);
};
