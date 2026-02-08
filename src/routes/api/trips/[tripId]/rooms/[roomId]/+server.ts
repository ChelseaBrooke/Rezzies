import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSessionUser } from '$lib/server/session.js';
import { isTripHost } from '$lib/server/trip-access.js';
import { prisma } from '$lib/server/prisma.js';

const roomIdNum = (id: string) => {
	const n = parseInt(id, 10);
	return Number.isNaN(n) ? null : n;
};

export const PATCH: RequestHandler = async ({ request, cookies, params }) => {
	const user = await getSessionUser(cookies);
	if (!user) return json({ error: 'Unauthorized' }, 401);

	const tripId = params.tripId;
	const roomId = roomIdNum(params.roomId);
	if (roomId == null) return json({ error: 'Invalid room id' }, 400);

	const isHost = await isTripHost(tripId, user.id);
	if (!isHost) return json({ error: 'Forbidden' }, 403);

	const existing = await prisma.room.findFirst({
		where: { id: roomId, tripId }
	});
	if (!existing) return json({ error: 'Room not found' }, 404);

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Invalid JSON' }, 400);
	}

	const d = body as Record<string, unknown>;
	const name = typeof d.name === 'string' ? d.name.trim() : undefined;
	const maxOccupancy =
		d.maxOccupancy === null || d.maxOccupancy === undefined
			? undefined
			: typeof d.maxOccupancy === 'number' && d.maxOccupancy > 0
				? d.maxOccupancy
				: undefined;
	const photoUrls = Array.isArray(d.photoUrls) ? (d.photoUrls as string[]).filter((u) => typeof u === 'string') : undefined;
	const privacyFactor =
		d.privacyFactor !== undefined && typeof d.privacyFactor === 'number' && d.privacyFactor >= 1 && d.privacyFactor <= 2
			? d.privacyFactor
			: undefined;

	const room = await prisma.room.update({
		where: { id: roomId },
		data: {
			...(name !== undefined && { name }),
			...(maxOccupancy !== undefined && { maxOccupancy }),
			...(photoUrls !== undefined && { photoUrls }),
			...(privacyFactor !== undefined && { privacyFactor })
		},
		include: { beds: true }
	});

	return json(room);
};

export const DELETE: RequestHandler = async ({ cookies, params }) => {
	const user = await getSessionUser(cookies);
	if (!user) return json({ error: 'Unauthorized' }, 401);

	const tripId = params.tripId;
	const roomId = roomIdNum(params.roomId);
	if (roomId == null) return json({ error: 'Invalid room id' }, 400);

	const isHost = await isTripHost(tripId, user.id);
	if (!isHost) return json({ error: 'Forbidden' }, 403);

	const existing = await prisma.room.findFirst({
		where: { id: roomId, tripId }
	});
	if (!existing) return json({ error: 'Room not found' }, 404);

	await prisma.room.delete({ where: { id: roomId } });
	return json({ success: true });
};
