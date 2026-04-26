import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSessionUser } from '$lib/server/session.js';
import { isTripHost } from '$lib/server/trip-access.js';
import { prisma } from '$lib/server/prisma.js';
import { releaseBedClaimsAndNotify } from '$lib/server/bed-claims.js';
import { effectiveSleepSlots } from '$lib/bed-spot-validation.js';
import { isPerBedPricingModel } from '$lib/server/per-bed-pricing-validate.js';

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

	const trip = await prisma.trip.findUnique({
		where: { id: tripId },
		select: { pricingModel: true, maxGuests: true }
	});
	const otherBeds = await prisma.bed.findMany({
		where: { room: { tripId }, id: { not: bedId } },
		select: { id: true, bedType: true, capacitySlots: true, capacity: true }
	});
	const spotsAfter = otherBeds.reduce((s, b) => s + effectiveSleepSlots(b), 0);
	const cap = trip?.maxGuests ?? null;
	if (
		trip &&
		isPerBedPricingModel(trip.pricingModel ?? '') &&
		cap != null &&
		cap >= 1 &&
		spotsAfter < cap
	) {
		return json(
			{
				error: `Removing this bed would leave ${spotsAfter} bed-spot(s), below your max capacity of ${cap}. Add another spot or lower max capacity first.`
			},
			{ status: 400 }
		);
	}

	await releaseBedClaimsAndNotify(bedId);
	await prisma.bed.delete({ where: { id: bedId } });
	return json({ success: true });
};
