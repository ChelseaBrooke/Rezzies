import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
	const code = url.searchParams.get('code');
	if (code) {
		throw redirect(303, `/trip/${code.toUpperCase()}`);
	}
	throw redirect(303, '/');
};
