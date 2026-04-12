import { error } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';
import type { PageServerLoad } from './$types';
import { buildEmailPreviews } from './build-email-previews.js';

function emailPreviewAllowed(): boolean {
	if (dev) return true;
	const v = env.EMAIL_PREVIEW_ENABLED?.trim().toLowerCase();
	return v === '1' || v === 'true' || v === 'yes';
}

export const load: PageServerLoad = async () => {
	if (!emailPreviewAllowed()) {
		throw error(404, 'Not found');
	}
	return {
		previews: buildEmailPreviews()
	};
};
