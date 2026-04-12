/**
 * Cron endpoint: /api/cron/waitlist
 *
 * Dissolves waitlists for trips whose check-in date is today (day-1 rule).
 * Moves all waitlisted guests to "no" so the roster is clean at trip start.
 *
 * Protect with a shared secret via the CRON_SECRET env var.
 * Call this daily from your scheduler (Vercel Cron, Railway Cron, etc.).
 *
 * Schedule is defined in vercel.json (every 15 minutes). Do not put cron
 * expressions containing star-slash here inside a block comment — that
 * sequence ends the comment and breaks the build.
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { dissolveWaitlistsForTodayTrips } from '$lib/server/waitlist-service.js';
import { env } from '$env/dynamic/private';

export const GET: RequestHandler = async ({ request }) => {
	// Validate cron secret to prevent unauthorised triggering
	const secret = env.CRON_SECRET;
	if (secret) {
		const authHeader = request.headers.get('authorization');
		if (authHeader !== `Bearer ${secret}`) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}
	}

	const results: Record<string, unknown> = {};

	// Dissolve waitlists for trips starting today
	try {
		const dissolvedTripIds = await dissolveWaitlistsForTodayTrips();
		results.dayOneDissolved = { ok: true, affectedTrips: dissolvedTripIds };
	} catch (err) {
		results.dayOneDissolved = { ok: false, error: String(err) };
	}

	return json({ ok: true, ...results });
};
