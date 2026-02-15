import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent }) => {
	const parentData = await parent();
	const trip = parentData.trip;
	const user = parentData.user;
	const membership = parentData.membership;

	const isHost = membership?.role === 'host';
	const isCoHost = membership?.role === 'co-host';
	const canRemoveGames = isHost;

	return {
		trip,
		user,
		isHost,
		isCoHost,
		canRemoveGames
	};
};
