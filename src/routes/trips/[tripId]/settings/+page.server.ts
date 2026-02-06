import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { getSessionUser } from '$lib/server/session.js';
import { isTripHost } from '$lib/server/trip-access.js';
import { prisma } from '$lib/server/prisma.js';

export const load: PageServerLoad = async ({ parent }) => {
	const parentData = await parent();
	return { trip: parentData.trip, isHost: parentData.isHost };
};

export const actions: Actions = {
	updateBasics: async ({ request, params, cookies }) => {
		const user = await getSessionUser(cookies);
		if (!user) throw redirect(303, `/login?redirect=/trips/${params.tripId}/settings`);

		const tripId = params.tripId;
		const host = await isTripHost(tripId, user.id);
		if (!host) return { updateBasics: { error: 'Only the trip host can edit settings.' } };

		const formData = await request.formData();
		const name = (formData.get('name') as string)?.trim();
		const location = (formData.get('location') as string)?.trim() || null;
		const description = (formData.get('description') as string)?.trim() || null;
		const checkInDate = formData.get('checkInDate') as string | null;
		const checkOutDate = formData.get('checkOutDate') as string | null;
		const listingUrl = (formData.get('listingUrl') as string)?.trim() || null;
		const listingTitle = (formData.get('listingTitle') as string)?.trim() || null;
		const listingCoverPhoto = (formData.get('listingCoverPhoto') as string)?.trim() || null;
		const totalCost = formData.get('totalCost') ? parseFloat(formData.get('totalCost') as string) : null;
		const pricingModel = (formData.get('pricingModel') as string) || null;
		const allowPartialStays = formData.get('allowPartialStays') === 'true' || formData.get('allowPartialStays') === 'on';

		if (!name) {
			return { updateBasics: { error: 'Trip name is required' } };
		}

		const updateData: any = {
			name,
			location,
			description,
			allowPartialStays
		};

		if (checkInDate) {
			updateData.checkInDate = new Date(checkInDate);
		}
		if (checkOutDate) {
			updateData.checkOutDate = new Date(checkOutDate);
		}
		if (listingUrl !== null) {
			updateData.listingUrl = listingUrl;
		}
		if (listingTitle !== null) {
			updateData.listingTitle = listingTitle;
		}
		if (listingCoverPhoto !== null) {
			updateData.listingCoverPhoto = listingCoverPhoto;
		}
		if (totalCost !== null && !isNaN(totalCost)) {
			updateData.totalCost = totalCost;
		}
		if (pricingModel) {
			updateData.pricingModel = pricingModel;
		}

		await prisma.trip.update({
			where: { id: tripId },
			data: updateData
		});

		return { updateBasics: { success: true } };
	}
};
