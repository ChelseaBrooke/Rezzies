import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { getSessionUser } from '$lib/server/session.js';
import { isTripHost } from '$lib/server/trip-access.js';
import { prisma } from '$lib/server/prisma.js';

export const load: PageServerLoad = async ({ parent }) => {
	const parentData = await parent();
	return { trip: parentData.trip };
};

function draftPricingModelToDb(
	model: string
): 'per_room' | 'per_bed' | 'per_person' | 'per_person_per_night' {
	if (model === 'per-room') return 'per_room';
	if (model === 'per-bed') return 'per_bed';
	if (model === 'per-person') return 'per_person';
	return 'per_person_per_night';
}

export const actions: Actions = {
	saveTrip: async ({ request, params, cookies }) => {
		const user = await getSessionUser(cookies);
		if (!user) throw redirect(303, `/login?redirect=/trips/${params.tripId}/preview-new`);

		const tripId = params.tripId;
		const host = await isTripHost(tripId, user.id);
		if (!host) return { saveTrip: { error: 'Only the trip host can save changes.' } };

		const formData = await request.formData();
		const draftJson = formData.get('draft') as string | null;
		if (!draftJson) return { saveTrip: { error: 'Missing draft data.' } };

		let draft: {
			name?: string;
			description?: string;
			propertyAddress?: string;
			destinationCity?: string;
			checkInDate?: string;
			checkOutDate?: string;
			totalTripCost?: string;
			expectedGuestCount?: number;
			maxOccupancy?: number;
			partialStayAllowed?: boolean;
			pricingModel?: string;
		};
		try {
			draft = JSON.parse(draftJson);
		} catch {
			return { saveTrip: { error: 'Invalid draft data.' } };
		}

		const name = (draft.name ?? '').trim();
		if (!name) return { saveTrip: { error: 'Trip name is required.' } };

		const totalCost = draft.totalTripCost != null && draft.totalTripCost !== ''
			? parseFloat(String(draft.totalTripCost).replace(/[^0-9.-]/g, '')) || 0
			: undefined;

		const checkInDate = draft.checkInDate ? new Date(draft.checkInDate) : null;
		const checkOutDate = draft.checkOutDate ? new Date(draft.checkOutDate) : null;
		const location = (draft.propertyAddress || draft.destinationCity || '').trim() || null;

		const updateData: Record<string, unknown> = {
			name,
			description: (draft.description ?? '').trim() || null,
			location: location || null
		};
		if (checkInDate && !isNaN(checkInDate.getTime())) updateData.checkInDate = checkInDate;
		if (checkOutDate && !isNaN(checkOutDate.getTime())) updateData.checkOutDate = checkOutDate;
		if (typeof totalCost === 'number' && !isNaN(totalCost)) updateData.totalCost = totalCost;
		if (draft.expectedGuestCount != null) updateData.expectedPeopleCount = draft.expectedGuestCount;
		if (draft.maxOccupancy != null) updateData.maxGuests = draft.maxOccupancy;
		if (draft.partialStayAllowed != null) updateData.allowPartialStays = draft.partialStayAllowed;
		if (draft.pricingModel) updateData.pricingModel = draftPricingModelToDb(draft.pricingModel);

		await prisma.trip.update({
			where: { id: tripId },
			data: updateData as Parameters<typeof prisma.trip.update>[0]['data']
		});

		return { saveTrip: { success: true } };
	}
};
