import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSessionUser } from '$lib/server/session.js';
import { isTripHost } from '$lib/server/trip-access.js';
import { prisma } from '$lib/server/prisma.js';
import { normalizeRoomTypeFromWizard } from '$lib/room-type-display.js';

export const POST: RequestHandler = async ({ request, cookies, params }) => {
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
	const name = typeof d.name === 'string' ? d.name.trim() : 'New Room';
	const maxOccupancy =
		typeof d.maxOccupancy === 'number' && d.maxOccupancy > 0 ? d.maxOccupancy : null;
	const photoUrls = Array.isArray(d.photoUrls) ? (d.photoUrls as string[]).filter((u) => typeof u === 'string') : [];
	const privacyFactor =
		typeof d.privacyFactor === 'number' && d.privacyFactor >= 1 && d.privacyFactor <= 2
			? d.privacyFactor
			: 1.0;
	const roomType = normalizeRoomTypeFromWizard(d.roomType);

	const room = await prisma.room.create({
		data: {
			tripId,
			name,
			roomType,
			maxOccupancy,
			photoUrls,
			privacyFactor,
			beds: undefined
		},
		include: { beds: true }
	});

	return json(room);
};
