/**
 * Cron endpoint: /api/cron/waitlist
 *
 * Runs two cleanup jobs:
 * 1. Expire lapsed "invited_to_rsvp" claim windows and promote next users.
 * 2. Dissolve waitlists for trips whose check-in date is today (day-1 rule).
 *
 * Protect with a shared secret via the CRON_SECRET env var.
 * Call this every 15 minutes from your scheduler (Vercel Cron, Railway Cron, etc.).
 *
 * Example Vercel cron entry (vercel.json):
 *   { "path": "/api/cron/waitlist", "schedule": "*/15 * * * *" }
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { expireClaimWindows, dissolveWaitlistsForTodayTrips } from '$lib/server/waitlist-service.js';
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

	// 1. Expire lapsed claim windows
	try {
		const expiredTripIds = await expireClaimWindows();
		results.expiredClaimWindows = { ok: true, affectedTrips: expiredTripIds };
	} catch (err) {
		results.expiredClaimWindows = { ok: false, error: String(err) };
	}

	// 2. Dissolve waitlists for trips starting today
	try {
		const dissolvedTripIds = await dissolveWaitlistsForTodayTrips();
		results.dayOneDissolved = { ok: true, affectedTrips: dissolvedTripIds };
	} catch (err) {
		results.dayOneDissolved = { ok: false, error: String(err) };
	}

	return json({ ok: true, ...results });
};
