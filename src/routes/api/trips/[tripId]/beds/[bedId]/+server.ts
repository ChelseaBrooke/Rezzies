import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSessionUser } from '$lib/server/session.js';
import { isTripHost } from '$lib/server/trip-access.js';
import { prisma } from '$lib/server/prisma.js';
import { releaseBedClaimsAndNotify } from '$lib/server/bed-claims.js';

export const PATCH: RequestHandler = async ({ request, cookies, params }) => {
	const user = await getSessionUser(cookies);
	if (!user) return json({ error: 'Unauthorized' }, { status: 401 });

	const tripId = params.tripId;
	const bedId = params.bedId;
	if (!bedId) return json({ error: 'Invalid bed id' }, { status: 400 });

	const isHost = await isTripHost(tripId, user.id);
	if (!isHost) return json({ error: 'Forbidden' }, { status: 403 });

	const body = await request.json().catch(() => ({}));
	const bedType = typeof body.bedType === 'string' ? body.bedType.trim().toLowerCase().replace(/\s+/g, '_') || undefined : undefined;
	if (!bedType) return json({ error: 'bedType required' }, { status: 400 });

	const bed = await prisma.bed.findUnique({
		where: { id: bedId },
		include: { room: true }
	});
	if (!bed || bed.room.tripId !== tripId) return json({ error: 'Bed not found' }, { status: 404 });

	await prisma.bed.update({ where: { id: bedId }, data: { bedType } });
	return json({ success: true });
};

export const DELETE: RequestHandler = async ({ cookies, params }) => {
	const user = await getSessionUser(cookies);
	if (!user) return json({ error: 'Unauthorized' }, { status: 401 });

	const tripId = params.tripId;
	const bedId = params.bedId;
	if (!bedId) return json({ error: 'Invalid bed id' }, { status: 400 });

	const isHost = await isTripHost(tripId, user.id);
	if (!isHost) return json({ error: 'Forbidden' }, { status: 403 });

	const bed = await prisma.bed.findUnique({
		where: { id: bedId },
		include: { room: true }
	});
	if (!bed || bed.room.tripId !== tripId) return json({ error: 'Bed not found' }, { status: 404 });

	await releaseBedClaimsAndNotify(bedId);
	await prisma.bed.delete({ where: { id: bedId } });
	return json({ success: true });
};
