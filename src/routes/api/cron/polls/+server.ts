/**
 * Cron: /api/cron/polls
 *
 * Closes polls past endAt (globally) and creates itinerary activities when
 * Discover activity polls resolve to "Add to itinerary".
 *
 * Protect with CRON_SECRET (Bearer token), same as /api/cron/waitlist.
 * Schedule: see vercel.json (every 15 minutes). Avoid star-slash in block comments.
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import { maintainAllPolls } from '$lib/server/poll-maintenance.js';

export const GET: RequestHandler = async ({ request }) => {
	const secret = env.CRON_SECRET;
	if (secret) {
		const authHeader = request.headers.get('authorization');
		if (authHeader !== `Bearer ${secret}`) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}
	}

	try {
		const { expiredClosed } = await maintainAllPolls();
		return json({ ok: true, expiredClosed });
	} catch (err) {
		console.error('[cron/polls]', err);
		return json({ ok: false, error: String(err) }, { status: 500 });
	}
};
