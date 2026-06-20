import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';
import { error } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

/**
 * Dev-only internal tool: a contact sheet of every page and popup in the app.
 * Hidden in production unless SNAPSHOTS_ENABLED is truthy (same pattern as /qc).
 */
export const load: LayoutServerLoad = async () => {
	if (!dev) {
		const enabled = env.SNAPSHOTS_ENABLED?.trim().toLowerCase();
		const allowed = enabled === '1' || enabled === 'true' || enabled === 'yes';
		if (!allowed) {
			throw error(404, 'Not found');
		}
	}
	return {};
};
