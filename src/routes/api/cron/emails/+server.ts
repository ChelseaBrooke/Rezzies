/**
 * Cron endpoint: /api/cron/emails
 *
 * Runs all time-based transactional email jobs in one sweep.
 * Every job is idempotent, already-sent emails are skipped via EmailLog.
 *
 * Protect with CRON_SECRET (same secret as /api/cron/waitlist).
 * Add to vercel.json:
 *   { "path": "/api/cron/emails", "schedule": "0 12 * * *" }   ← 12:00 UTC = 7 AM EST
 *
 * Jobs run:
 *   - Invitation reminders (33% / 66% / 99% of time-to-trip)
 *   - Trip starting soon   (7-day and 3-day notices)
 *   - Day-of trip email
 *   - Daily itinerary digest
 *   - Trip recap           (day after check-out)
 *   - Feedback request     (7 days after check-out)
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { cronAuthDenied } from '$lib/server/cron-auth.js';
import {
	sendInvitationReminders,
	sendTripStartingSoonEmails,
	sendDayOfTripEmails,
	sendDailyDigestEmails,
	sendTripRecapEmails,
	sendFeedbackRequestEmails,
	sendCostReapprovalReminderEmails,
	sendCostReapprovalOverdueHostEmails
} from '$lib/server/cron-email-service.js';

export const GET: RequestHandler = async ({ request }) => {
	const denied = cronAuthDenied(request);
	if (denied) return denied;

	const results: Record<string, unknown> = {};

	const jobs: Array<{ name: string; fn: () => Promise<{ sent: number; skipped: number }> }> = [
		{ name: 'invitationReminders', fn: sendInvitationReminders },
		{ name: 'tripStartingSoon', fn: sendTripStartingSoonEmails },
		{ name: 'dayOfTrip', fn: sendDayOfTripEmails },
		{ name: 'dailyDigest', fn: sendDailyDigestEmails },
		{ name: 'tripRecap', fn: sendTripRecapEmails },
		{ name: 'feedbackRequest', fn: sendFeedbackRequestEmails },
		{ name: 'costReapprovalReminders', fn: sendCostReapprovalReminderEmails },
		{ name: 'costReapprovalOverdueHosts', fn: sendCostReapprovalOverdueHostEmails }
	];

	for (const job of jobs) {
		try {
			results[job.name] = { ok: true, ...(await job.fn()) };
		} catch (err) {
			results[job.name] = { ok: false, error: String(err) };
		}
	}

	return json({ ok: true, ...results });
};
