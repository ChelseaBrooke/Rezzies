import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent }) => {
	const parentData = await parent();
	return {
		trip: parentData.trip,
		invoices: parentData.trip?.invoices ?? []
	};
};
