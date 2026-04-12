/**
 * Cron: /api/cron/polls
 *
 * Closes polls past endAt (globally) and creates itinerary activities when
 * Discover activity polls resolve to "Add to itinerary".
 *
 * Protect with CRON_SECRET (Bearer token), same as /api/cron/waitlist.
 * Schedule: see vercel.json (daily on Hobby; Pro allows more frequent runs).
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { cronAuthDenied } from '$lib/server/cron-auth.js';
import { maintainAllPolls } from '$lib/server/poll-maintenance.js';

export const GET: RequestHandler = async ({ request }) => {
	const denied = cronAuthDenied(request);
	if (denied) return denied;

	try {
		const { expiredClosed } = await maintainAllPolls();
		return json({ ok: true, expiredClosed });
	} catch (err) {
		console.error('[cron/polls]', err);
		return json({ ok: false, error: String(err) }, { status: 500 });
	}
};
