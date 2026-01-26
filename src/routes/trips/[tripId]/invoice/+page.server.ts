import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { getSessionUser } from '$lib/server/session.js';
import { isTripMember } from '$lib/server/trip-access.js';
import { prisma } from '$lib/server/prisma.js';
import { createInvoiceForUser, calculateInvoiceForUser } from '$lib/server/invoice-calculator.js';

export const load: PageServerLoad = async ({ params, cookies }) => {
	const user = await getSessionUser(cookies);
	
	if (!user) {
		throw redirect(303, `/login?redirect=/trips/${params.tripId}/invoice`);
	}

	const tripId = params.tripId;

	// Check if user is a member
	const member = await isTripMember(tripId, user.id);
	if (!member) {
		throw error(403, 'You must be a member of this trip');
	}

	// Get or create invoice
	const invoice = await createInvoiceForUser(tripId, user.id);
	const breakdown = await calculateInvoiceForUser(tripId, user.id);

	return {
		user,
		invoice,
		breakdown
	};
};

export const actions: Actions = {
	refreshInvoice: async ({ params, cookies }) => {
		const user = await getSessionUser(cookies);
		if (!user) throw redirect(303, '/login');

		const tripId = params.tripId;
		const invoice = await createInvoiceForUser(tripId, user.id);
		const breakdown = await calculateInvoiceForUser(tripId, user.id);

		return { success: true, invoice, breakdown };
	}
};
