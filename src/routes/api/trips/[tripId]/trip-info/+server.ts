import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSessionUser } from '$lib/server/session.js';
import { isTripHost } from '$lib/server/trip-access.js';
import { prisma } from '$lib/server/prisma.js';

/** PATCH: Update trip info / house rules fields only */
export const PATCH: RequestHandler = async ({ request, cookies, params }) => {
	const user = await getSessionUser(cookies);
	if (!user) {
		return json({ error: 'You must be logged in to update trip info' }, { status: 401 });
	}

	const tripId = params.tripId;
	const isHost = await isTripHost(tripId, user.id);
	if (!isHost) {
		return json({ error: 'Only the trip host can update trip info' }, { status: 403 });
	}

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Invalid JSON body' }, { status: 400 });
	}

	const d = body as Record<string, unknown>;
	const description = typeof d.description === 'string' ? d.description.trim() || null : undefined;
	const fullAddress = typeof d.fullAddress === 'string' ? d.fullAddress.trim() || null : undefined;
	const locationCity = typeof d.locationCity === 'string' ? d.locationCity.trim() || null : undefined;
	const checkInTime = typeof d.checkInTime === 'string' ? d.checkInTime.trim() || null : undefined;
	const checkOutTime = typeof d.checkOutTime === 'string' ? d.checkOutTime.trim() || null : undefined;
	const parkingNotes = typeof d.parkingNotes === 'string' ? d.parkingNotes.trim() || null : undefined;
	const houseRules = typeof d.houseRules === 'string' ? d.houseRules.trim() || null : undefined;

	const hasUpdates =
		description !== undefined ||
		fullAddress !== undefined ||
		locationCity !== undefined ||
		checkInTime !== undefined ||
		checkOutTime !== undefined ||
		parkingNotes !== undefined ||
		houseRules !== undefined;

	if (!hasUpdates) {
		return json({ error: 'No fields to update' }, { status: 400 });
	}

	try {
		await prisma.trip.update({
			where: { id: tripId },
			data: {
				...(description !== undefined && { description }),
				...(fullAddress !== undefined && { fullAddress }),
				...(locationCity !== undefined && { locationCity }),
				...(checkInTime !== undefined && { checkInTime }),
				...(checkOutTime !== undefined && { checkOutTime }),
				...(parkingNotes !== undefined && { parkingNotes }),
				...(houseRules !== undefined && { houseRules }),
				tripInfoEditedAt: new Date()
			}
		});
		return json({ success: true });
	} catch (err) {
		console.error('Update trip info error:', err);
		return json(
		{ error: err instanceof Error ? err.message : 'Failed to update trip info' },
		{ status: 500 }
		);
	}
};
