// Cron endpoint: GET /api/cron/waitlist
//
// Dissolves waitlists for trips whose check-in date is today (day-1 rule).
// Moves all waitlisted guests to "no" so the roster is clean at trip start.
//
// Protect with CRON_SECRET (Bearer). Schedule: see vercel.json (Hobby = daily only).
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { cronAuthDenied } from '$lib/server/cron-auth.js';
import { dissolveWaitlistsForTodayTrips } from '$lib/server/waitlist-service.js';

export const GET: RequestHandler = async ({ request }) => {
	const denied = cronAuthDenied(request);
	if (denied) return denied;

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
