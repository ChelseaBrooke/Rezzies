import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

// Invite codes have been removed. Trips are accessed directly via /trips/[tripId].
export const load: PageServerLoad = async () => {
	throw error(410, 'Invite codes are no longer supported. Ask your host for the trip link.');
};
