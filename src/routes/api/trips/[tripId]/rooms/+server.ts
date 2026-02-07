import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSessionUser } from '$lib/server/session.js';
import { isTripHost } from '$lib/server/trip-access.js';
import { prisma } from '$lib/server/prisma.js';

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

	const room = await prisma.room.create({
		data: {
			tripId,
			name,
			maxOccupancy,
			photoUrls,
			beds: undefined
		},
		include: { beds: true }
	});

	return json(room);
};
