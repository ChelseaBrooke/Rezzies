import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSessionUser } from '$lib/server/session.js';
import { isTripHost } from '$lib/server/trip-access.js';
import { prisma } from '$lib/server/prisma.js';

const DISCOUNT_CODE = 'BearsBestFriend#1';
const PLATFORM_FEE = 25;

export const POST: RequestHandler = async ({ request, cookies, params }) => {
	const user = await getSessionUser(cookies);
	if (!user) {
		return json({ error: 'You must be logged in to publish a trip' }, 401);
	}

	const tripId = params.tripId;
	const host = await isTripHost(tripId, user.id);
	if (!host) {
		return json({ error: 'Only the trip host can publish this trip' }, 403);
	}

	let body: Record<string, unknown>;
	try {
		body = (await request.json()) as Record<string, unknown>;
	} catch {
		return json({ error: 'Invalid JSON body' }, 400);
	}

	const splitCost = body.splitCost === true;
	const discountCodeRaw = typeof body.discountCode === 'string' ? body.discountCode.trim() : '';
	const waivePlatformFee = discountCodeRaw === DISCOUNT_CODE;

	const trip = await prisma.trip.findUnique({
		where: { id: tripId },
		select: { isPublished: true, expectedPeopleCount: true }
	});

	if (!trip) {
		return json({ error: 'Trip not found' }, 404);
	}
	if (trip.isPublished) {
		return json({ error: 'Trip is already published' }, 400);
	}

	const expected = Math.max(1, trip.expectedPeopleCount ?? 1);
	const platformFeePerPerson = waivePlatformFee
		? 0
		: splitCost
			? PLATFORM_FEE / expected
			: 0;

	await prisma.trip.update({
		where: { id: tripId },
		data: {
			isPublished: true,
			platformFeePerPerson
		}
	});

	return json({ success: true, tripId });
};
