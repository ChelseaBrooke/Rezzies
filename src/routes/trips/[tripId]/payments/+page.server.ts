import type { PageServerLoad } from './$types';
import { createInvoiceForUser } from '$lib/server/invoice-calculator.js';

export const load: PageServerLoad = async ({ parent }) => {
	const parentData = await parent();
	const tripId = parentData.trip?.id;
	const user = parentData.user;
	const myInvoice =
		tripId && user
			? await createInvoiceForUser(tripId, user.id)
			: null;
	return {
		trip: parentData.trip,
		invoices: parentData.trip?.invoices ?? [],
		myInvoice
	};
};
