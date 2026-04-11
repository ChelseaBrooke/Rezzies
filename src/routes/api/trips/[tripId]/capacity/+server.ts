/**
 * PATCH /api/trips/:tripId/capacity
 * Update maxCapacity for a trip.
 * Host-only. When capacity is increased, immediately notifies all waitlisted guests.
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSessionUser } from '$lib/server/session.js';
import { isTripHostOrCoHost } from '$lib/server/trip-access.js';
import { prisma } from '$lib/server/prisma.js';
import { handleSpotOpened } from '$lib/server/waitlist-service.js';

export const PATCH: RequestHandler = async ({ request, cookies, params }) => {
	const user = await getSessionUser(cookies);
	if (!user) return json({ error: 'Unauthorized' }, { status: 401 });

	const tripId = params.tripId;
	const canManage = await isTripHostOrCoHost(tripId, user.id);
	if (!canManage) return json({ error: 'Only the host or co-host can update capacity settings' }, { status: 403 });

	let body: unknown;
	try { body = await request.json(); } catch {
		return json({ error: 'Invalid JSON body' }, { status: 400 });
	}

	const d = body as Record<string, unknown>;
	const maxCapacity =
		d.maxCapacity === null ? null :
		typeof d.maxCapacity === 'number' && d.maxCapacity > 0 ? Math.floor(d.maxCapacity) :
		undefined;

	if (maxCapacity === undefined) {
		return json({ error: 'No fields to update' }, { status: 400 });
	}

	const prev = await prisma.trip.findUnique({
		where: { id: tripId },
		select: { maxCapacity: true }
	});

	await prisma.trip.update({
		where: { id: tripId },
		data: { maxCapacity: maxCapacity ?? null }
	});

	// If capacity increased, notify all waitlisted guests immediately
	const newCap = maxCapacity;
	const oldCap = prev?.maxCapacity;
	if (newCap && (!oldCap || newCap > oldCap)) {
		await handleSpotOpened(tripId).catch(console.error);
	}

	return json({ ok: true });
};
