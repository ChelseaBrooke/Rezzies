/**
 * Cron Email Service
 *
 * Functions called by scheduled jobs for time-based transactional emails.
 * Each function is idempotent — it checks EmailLog before sending so re-runs
 * (e.g. if the cron fires twice) do not produce duplicate emails.
 *
 * Schedule (all times in EST / America/New_York):
 *   sendInvitationReminders     — daily at 10 AM
 *   sendTripStartingSoonEmails  — daily at 10 AM (7 days and 3 days before check-in)
 *   sendDayOfTripEmails         — daily at 7 AM (on check-in day)
 *   sendDailyDigestEmails       — daily at 7 AM (each trip day after day 1)
 *   sendTripRecapEmails         — daily at 7 AM (day after check-out)
 *   sendFeedbackRequestEmails   — daily at 7 AM (7 days after check-out)
 */

import { prisma } from './prisma.js';
import { sendHtmlEmail } from './email/resend.js';
import { TEMPLATE_KEYS } from './email/templates.js';

import { renderInvitationReminderHtml } from './email/render/invitation-reminder.js';
import { renderTripStartingSoonHtml } from './email/render/trip-starting-soon.js';
import { renderDayOfTripHtml } from './email/render/day-of-trip.js';
import { renderDailyDigestHtml } from './email/render/daily-digest.js';
import { renderTripRecapHtml } from './email/render/trip-recap.js';
import { renderFeedbackRequestHtml } from './email/render/feedback-request.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function tripUrl(tripId: string): string {
	const base = process.env.APP_BASE_URL ?? 'http://localhost:5173';
	return `${base}/trips/${tripId}`;
}

function feedbackUrl(): string {
	const base = process.env.APP_BASE_URL ?? 'http://localhost:5173';
	return `${base}/feedback`;
}

/** True if an email with this key + a payload containing this tripId was already sent to this address. */
async function alreadySent(templateKey: string, to: string, tripId: string): Promise<boolean> {
	const count = await prisma.emailLog.count({
		where: {
			templateKey,
			to,
			status: 'sent',
			payloadJson: { contains: tripId }
		}
	});
	return count > 0;
}

function formatDate(d: Date): string {
	return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDayLabel(d: Date): string {
	return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

function startOfDay(d: Date): Date {
	const r = new Date(d);
	r.setHours(0, 0, 0, 0);
	return r;
}

function endOfDay(d: Date): Date {
	const r = new Date(d);
	r.setHours(23, 59, 59, 999);
	return r;
}

function addDays(d: Date, n: number): Date {
	const r = new Date(d);
	r.setDate(r.getDate() + n);
	return r;
}

// ---------------------------------------------------------------------------
// Invitation reminder
// Sent at 33%, 66%, 99% of the time window between publishedAt and checkInDate.
// ---------------------------------------------------------------------------

export async function sendInvitationReminders(): Promise<{ sent: number; skipped: number }> {
	let sent = 0;
	let skipped = 0;
	const now = new Date();

	const trips = await prisma.trip.findMany({
		where: {
			isPublished: true,
			checkInDate: { gt: now }
		},
		select: {
			id: true,
			name: true,
			checkInDate: true,
			publishedAt: true,
			members: {
				where: { inviteStatus: 'approved', role: { not: 'host' } },
				include: { user: { select: { id: true, name: true, email: true } } }
			},
			host: { include: { user: { select: { name: true } } } }
		}
	});

	for (const trip of trips) {
		const publishedAt = (trip as { publishedAt?: Date | null }).publishedAt ?? trip.checkInDate;
		const window = trip.checkInDate.getTime() - publishedAt.getTime();
		if (window <= 0) continue;

		const elapsed = now.getTime() - publishedAt.getTime();
		const pct = elapsed / window;

		// Find the highest threshold crossed but not yet mailed
		let thresholdKey: string | null = null;
		if (pct >= 0.99) thresholdKey = `${TEMPLATE_KEYS.INVITATION_REMINDER}_99_${trip.id}`;
		else if (pct >= 0.66) thresholdKey = `${TEMPLATE_KEYS.INVITATION_REMINDER}_66_${trip.id}`;
		else if (pct >= 0.33) thresholdKey = `${TEMPLATE_KEYS.INVITATION_REMINDER}_33_${trip.id}`;
		if (!thresholdKey) continue;

		// Find all members who have NOT responded (no RSVP row, or status is null/not yes/no)
		const respondedIds = new Set(
			(
				await prisma.rSVP.findMany({
					where: { tripId: trip.id, status: { in: ['yes', 'no'] } },
					select: { userId: true }
				})
			).map((r) => r.userId)
		);

		const hostName =
			(trip as { host?: { user?: { name?: string | null } | null } | null }).host?.user?.name ??
			'The host';

		for (const member of trip.members) {
			if (!member.user?.email) continue;
			if (respondedIds.has(member.user.id)) { skipped++; continue; }

			const alreadyQueued = await alreadySent(thresholdKey, member.user.email, trip.id);
			if (alreadyQueued) { skipped++; continue; }

			const html = renderInvitationReminderHtml({
				recipientName: member.user.name ?? 'Guest',
				tripName: trip.name,
				hostName,
				tripUrl: tripUrl(trip.id)
			});

			await sendHtmlEmail({
				to: member.user.email,
				subject: `Reminder: you haven't responded to "${trip.name}" yet`,
				html,
				templateKey: thresholdKey as Parameters<typeof sendHtmlEmail>[0]['templateKey'],
				tags: [{ name: 'category', value: 'reminder' }]
			}).catch(console.error);
			sent++;
		}
	}

	return { sent, skipped };
}

// ---------------------------------------------------------------------------
// Trip Starting Soon (7 days and 3 days before check-in)
// ---------------------------------------------------------------------------

export async function sendTripStartingSoonEmails(): Promise<{ sent: number; skipped: number }> {
	let sent = 0;
	let skipped = 0;
	const now = new Date();

	for (const daysOut of [7, 3]) {
		const target = startOfDay(addDays(now, daysOut));
		const targetEnd = endOfDay(addDays(now, daysOut));
		const templateKey = `${TEMPLATE_KEYS.TRIP_STARTING_SOON}_${daysOut}d`;

		const trips = await prisma.trip.findMany({
			where: {
				isPublished: true,
				checkInDate: { gte: target, lte: targetEnd }
			},
			include: {
				members: {
					where: { inviteStatus: 'approved' },
					include: { user: { select: { name: true, email: true } } }
				}
			}
		});

		for (const trip of trips) {
			for (const member of trip.members) {
				if (!member.user?.email) continue;
				const already = await alreadySent(templateKey, member.user.email, trip.id);
				if (already) { skipped++; continue; }

				const html = renderTripStartingSoonHtml({
					recipientName: member.user.name ?? 'Guest',
					tripName: trip.name,
					daysUntilTrip: daysOut,
					checkInDate: formatDate(trip.checkInDate),
					checkOutDate: formatDate(trip.checkOutDate),
					tripUrl: tripUrl(trip.id)
				});

				await sendHtmlEmail({
					to: member.user.email,
					subject: `"${trip.name}" starts in ${daysOut} day${daysOut === 1 ? '' : 's'}`,
					html,
					templateKey: templateKey as Parameters<typeof sendHtmlEmail>[0]['templateKey'],
					tags: [{ name: 'category', value: 'pre-trip' }]
				}).catch(console.error);
				sent++;
			}
		}
	}

	return { sent, skipped };
}

// ---------------------------------------------------------------------------
// Day-of trip
// ---------------------------------------------------------------------------

export async function sendDayOfTripEmails(): Promise<{ sent: number; skipped: number }> {
	let sent = 0;
	let skipped = 0;
	const now = new Date();
	const todayStart = startOfDay(now);
	const todayEnd = endOfDay(now);

	const trips = await prisma.trip.findMany({
		where: {
			isPublished: true,
			checkInDate: { gte: todayStart, lte: todayEnd }
		},
		include: {
			members: {
				where: { inviteStatus: 'approved' },
				include: { user: { select: { name: true, email: true } } }
			}
		}
	});

	for (const trip of trips) {
		for (const member of trip.members) {
			if (!member.user?.email) continue;
			const already = await alreadySent(TEMPLATE_KEYS.DAY_OF_TRIP, member.user.email, trip.id);
			if (already) { skipped++; continue; }

			const html = renderDayOfTripHtml({
				recipientName: member.user.name ?? 'Guest',
				tripName: trip.name,
				tripUrl: tripUrl(trip.id)
			});

			await sendHtmlEmail({
				to: member.user.email,
				subject: `Today's the day — "${trip.name}" starts now`,
				html,
				templateKey: TEMPLATE_KEYS.DAY_OF_TRIP,
				tags: [{ name: 'category', value: 'trip-day' }]
			}).catch(console.error);
			sent++;
		}
	}

	return { sent, skipped };
}

// ---------------------------------------------------------------------------
// Daily digest (sent on each trip day after day 1)
// ---------------------------------------------------------------------------

export async function sendDailyDigestEmails(): Promise<{ sent: number; skipped: number }> {
	let sent = 0;
	let skipped = 0;
	const now = new Date();
	const todayStart = startOfDay(now);
	const todayEnd = endOfDay(now);
	const todayLabel = formatDayLabel(now);
	// Keyed by trip + date so it only fires once per trip per day
	const dailyKey = `${TEMPLATE_KEYS.DAILY_DIGEST}_${now.toISOString().slice(0, 10)}`;

	// Trips currently in progress (check-in < today, check-out >= today)
	const trips = await prisma.trip.findMany({
		where: {
			isPublished: true,
			checkInDate: { lt: todayStart },
			checkOutDate: { gte: todayStart }
		},
		include: {
			members: {
				where: { inviteStatus: 'approved' },
				include: { user: { select: { name: true, email: true } } }
			},
			activities: {
				where: {
					startDatetime: { gte: todayStart, lte: todayEnd }
				},
				select: { title: true, startDatetime: true },
				orderBy: { startDatetime: 'asc' }
			}
		}
	});

	for (const trip of trips) {
		const events = (trip.activities as { title: string }[]).map((a) => a.title);

		for (const member of trip.members) {
			if (!member.user?.email) continue;
			const already = await alreadySent(dailyKey, member.user.email, trip.id);
			if (already) { skipped++; continue; }

			const html = renderDailyDigestHtml({
				recipientName: member.user.name ?? 'Guest',
				tripName: trip.name,
				dateLabel: todayLabel,
				events,
				tripUrl: tripUrl(trip.id)
			});

			await sendHtmlEmail({
				to: member.user.email,
				subject: `Today's plan: ${trip.name}`,
				html,
				templateKey: dailyKey as Parameters<typeof sendHtmlEmail>[0]['templateKey'],
				tags: [{ name: 'category', value: 'digest' }]
			}).catch(console.error);
			sent++;
		}
	}

	return { sent, skipped };
}

// ---------------------------------------------------------------------------
// Trip recap (day after check-out)
// ---------------------------------------------------------------------------

export async function sendTripRecapEmails(): Promise<{ sent: number; skipped: number }> {
	let sent = 0;
	let skipped = 0;
	const now = new Date();
	const yesterdayStart = startOfDay(addDays(now, -1));
	const yesterdayEnd = endOfDay(addDays(now, -1));

	const trips = await prisma.trip.findMany({
		where: {
			isPublished: true,
			checkOutDate: { gte: yesterdayStart, lte: yesterdayEnd }
		},
		include: {
			members: {
				where: { inviteStatus: 'approved' },
				include: { user: { select: { name: true, email: true } } }
			}
		}
	});

	for (const trip of trips) {
		for (const member of trip.members) {
			if (!member.user?.email) continue;
			const already = await alreadySent(TEMPLATE_KEYS.TRIP_RECAP, member.user.email, trip.id);
			if (already) { skipped++; continue; }

			const html = renderTripRecapHtml({
				recipientName: member.user.name ?? 'Guest',
				tripName: trip.name,
				tripUrl: tripUrl(trip.id)
			});

			await sendHtmlEmail({
				to: member.user.email,
				subject: `Your trip recap: "${trip.name}"`,
				html,
				templateKey: TEMPLATE_KEYS.TRIP_RECAP,
				tags: [{ name: 'category', value: 'post-trip' }]
			}).catch(console.error);
			sent++;
		}
	}

	return { sent, skipped };
}

// ---------------------------------------------------------------------------
// Feedback request (7 days after check-out)
// ---------------------------------------------------------------------------

export async function sendFeedbackRequestEmails(): Promise<{ sent: number; skipped: number }> {
	let sent = 0;
	let skipped = 0;
	const now = new Date();
	const target = addDays(now, -7);
	const targetStart = startOfDay(target);
	const targetEnd = endOfDay(target);

	const trips = await prisma.trip.findMany({
		where: {
			isPublished: true,
			checkOutDate: { gte: targetStart, lte: targetEnd }
		},
		include: {
			members: {
				where: { inviteStatus: 'approved' },
				include: { user: { select: { name: true, email: true } } }
			}
		}
	});

	for (const trip of trips) {
		for (const member of trip.members) {
			if (!member.user?.email) continue;
			const already = await alreadySent(
				TEMPLATE_KEYS.FEEDBACK_REQUEST,
				member.user.email,
				trip.id
			);
			if (already) { skipped++; continue; }

			const html = renderFeedbackRequestHtml({
				recipientName: member.user.name ?? 'Guest',
				tripName: trip.name,
				feedbackUrl: feedbackUrl()
			});

			await sendHtmlEmail({
				to: member.user.email,
				subject: `How was "${trip.name}"?`,
				html,
				templateKey: TEMPLATE_KEYS.FEEDBACK_REQUEST,
				tags: [{ name: 'category', value: 'post-trip' }]
			}).catch(console.error);
			sent++;
		}
	}

	return { sent, skipped };
}
