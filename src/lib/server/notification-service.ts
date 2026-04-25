/**
 * Notification Service
 *
 * Central dispatch layer for all transactional emails.
 * Each function is fire-and-forget (errors are logged, never thrown) so callers
 * don't need try/catch around every notification call.
 *
 * Wiring map (where each function is called from):
 *   sendRsvpConfirmedToGuest    , rsvp/+page.server.ts → updateRsvp (yes path)
 *   sendNewRsvpToHost           , rsvp/+page.server.ts → updateRsvp (yes path)
 *   sendRsvpUpdatedToGuest      , rsvp/+page.server.ts → updateRsvp (no/edit path)
 *   sendTripFillingUpToHost     , rsvp/+page.server.ts → updateRsvp (yes path, after capacity check)
 *   sendGuestJoinedEmail        , trips/[tripId]/join/+page.server.ts
 *   sendRemovedFromTripEmail    , guests/+page.server.ts → removeGuest
 *   sendTripCanceledEmails      , trips/+page.server.ts → deleteTrip
 *   sendWelcomeCoHostEmail      , (future: role-update endpoint)
 *   sendBedRemovedEmails        , bed-claims.ts → releaseBedClaimsAndNotify
 */

import { prisma } from './prisma.js';
import { sendHtmlEmail } from './email/resend.js';
import { TEMPLATE_KEYS } from './email/templates.js';

import { renderRsvpConfirmedHtml } from './email/render/rsvp-confirmed.js';
import { renderNewRsvpHostHtml } from './email/render/new-rsvp-host.js';
import { renderRsvpUpdatedHtml } from './email/render/rsvp-updated.js';
import { renderTripFillingUpHtml } from './email/render/trip-filling-up.js';
import { renderGuestJoinedHtml } from './email/render/guest-joined.js';
import { renderRemovedFromTripHtml } from './email/render/removed-from-trip.js';
import { renderTripCanceledHtml } from './email/render/trip-canceled.js';
import { renderWelcomeCoHostHtml } from './email/render/welcome-co-host.js';
import { renderBedRemovedHtml } from './email/render/bed-removed.js';
import {
	renderCostShareReapprovalGuestHtml,
	renderGuestApprovedCostShareHostHtml
} from './email/render/cost-share-reapproval.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function tripUrl(tripId: string): string {
	const base = process.env.APP_BASE_URL ?? 'http://localhost:5173';
	return `${base}/trips/${tripId}`;
}

function guestsUrl(tripId: string): string {
	return `${tripUrl(tripId)}/guests`;
}

function formatMoneyCents(cents: number): string {
	return new Intl.NumberFormat('en-US', {
		style: 'currency',
		currency: 'USD',
		minimumFractionDigits: 0,
		maximumFractionDigits: 0
	}).format(cents / 100);
}

function formatReapprovalDeadlineEmail(d: Date): string {
	return d.toLocaleString('en-US', {
		weekday: 'short',
		month: 'short',
		day: 'numeric',
		hour: 'numeric',
		minute: '2-digit',
		hour12: true
	});
}

async function getTrip(tripId: string) {
	return prisma.trip.findUnique({
		where: { id: tripId },
		select: {
			id: true,
			name: true,
			maxCapacity: true,
			checkInDate: true,
			checkOutDate: true
		}
	});
}

async function getTripHost(tripId: string) {
	return prisma.tripMember.findFirst({
		where: { tripId, role: 'host' },
		include: { user: { select: { id: true, name: true, email: true } } }
	});
}

async function getUser(userId: string) {
	return prisma.user.findUnique({
		where: { id: userId },
		select: { id: true, name: true, email: true }
	});
}

/** Returns true if we already sent a given template to a given address (deduplication). */
async function alreadySent(templateKey: string, to: string): Promise<boolean> {
	const count = await prisma.emailLog.count({
		where: { templateKey, to, status: 'sent' }
	});
	return count > 0;
}

// ---------------------------------------------------------------------------
// RSVP emails
// ---------------------------------------------------------------------------

/**
 * Send RSVP confirmation to the guest who just said yes.
 * Also looks up their bed assignment if one exists, for the email summary.
 */
export async function sendRsvpConfirmedToGuest(tripId: string, userId: string): Promise<void> {
	try {
		const [trip, user] = await Promise.all([getTrip(tripId), getUser(userId)]);
		if (!trip || !user?.email) return;

		const assignment = await prisma.roomAssignment.findFirst({
			where: { tripId, userId },
			include: { room: { select: { name: true } } }
		});
		const rsvp = await prisma.rSVP.findUnique({
			where: { tripId_userId: { tripId, userId } },
			select: { adultsCount: true, kidsCount: true }
		});

		const bedSummary =
			assignment
				? [assignment.bedType, assignment.room?.name].filter(Boolean).join(' · ')
				: undefined;
		const partySize = (rsvp?.adultsCount ?? 0) + (rsvp?.kidsCount ?? 0) || undefined;

		const html = renderRsvpConfirmedHtml({
			guestName: user.name ?? 'Guest',
			tripName: trip.name,
			bedSummary,
			partySize,
			tripUrl: tripUrl(tripId)
		});

		await sendHtmlEmail({
			to: user.email,
			subject: `You're going to "${trip.name}"`,
			html,
			templateKey: TEMPLATE_KEYS.RSVP_CONFIRMED,
			tags: [{ name: 'category', value: 'rsvp' }]
		});
	} catch (err) {
		console.error('[notification-service] sendRsvpConfirmedToGuest failed:', err);
	}
}

/** Notify the host when a guest RSVPs yes. */
export async function sendNewRsvpToHost(tripId: string, guestUserId: string): Promise<void> {
	try {
		const [trip, guest, hostMember] = await Promise.all([
			getTrip(tripId),
			getUser(guestUserId),
			getTripHost(tripId)
		]);
		if (!trip || !guest || !hostMember?.user?.email) return;
		// Don't email the host if they are the one who just RSVPd
		if (hostMember.user.id === guestUserId) return;

		const yesCount = await prisma.rSVP.count({ where: { tripId, status: 'yes' } });

		const html = renderNewRsvpHostHtml({
			hostName: hostMember.user.name ?? 'Host',
			guestName: guest.name ?? 'A guest',
			tripName: trip.name,
			yesCount,
			maxCapacity: trip.maxCapacity,
			tripUrl: guestsUrl(tripId)
		});

		await sendHtmlEmail({
			to: hostMember.user.email,
			subject: `${guest.name ?? 'Someone'} just RSVP'd to "${trip.name}"`,
			html,
			templateKey: TEMPLATE_KEYS.NEW_RSVP_HOST,
			tags: [{ name: 'category', value: 'rsvp' }]
		});
	} catch (err) {
		console.error('[notification-service] sendNewRsvpToHost failed:', err);
	}
}

/** Notify the guest that their RSVP was updated (no / edited). */
export async function sendRsvpUpdatedToGuest(tripId: string, userId: string): Promise<void> {
	try {
		const [trip, user] = await Promise.all([getTrip(tripId), getUser(userId)]);
		if (!trip || !user?.email) return;

		const html = renderRsvpUpdatedHtml({
			guestName: user.name ?? 'Guest',
			tripName: trip.name,
			tripUrl: tripUrl(tripId)
		});

		await sendHtmlEmail({
			to: user.email,
			subject: `Your RSVP for "${trip.name}" was updated`,
			html,
			templateKey: TEMPLATE_KEYS.RSVP_UPDATED,
			tags: [{ name: 'category', value: 'rsvp' }]
		});
	} catch (err) {
		console.error('[notification-service] sendRsvpUpdatedToGuest failed:', err);
	}
}

/**
 * Check if the trip just crossed a capacity threshold (50 / 75 / 90 %)
 * and email the host if so. Deduplicates via EmailLog so each threshold fires once.
 */
export async function sendTripFillingUpToHost(tripId: string): Promise<void> {
	try {
		const [trip, hostMember] = await Promise.all([getTrip(tripId), getTripHost(tripId)]);
		if (!trip?.maxCapacity || !hostMember?.user?.email) return;

		const yesCount = await prisma.rSVP.count({ where: { tripId, status: 'yes' } });
		const pct = (yesCount / trip.maxCapacity) * 100;

		const thresholds: Array<{ min: number; max: number; pct: 50 | 75 | 90; key: string }> = [
			{ min: 90, max: 100, pct: 90, key: TEMPLATE_KEYS.TRIP_FILLING_UP_90 },
			{ min: 75, max: 90, pct: 75, key: TEMPLATE_KEYS.TRIP_FILLING_UP_75 },
			{ min: 50, max: 75, pct: 50, key: TEMPLATE_KEYS.TRIP_FILLING_UP_50 }
		];

		for (const t of thresholds) {
			if (pct >= t.min && pct < t.max) {
				const sent = await alreadySent(t.key, hostMember.user.email);
				if (sent) break;

				const html = renderTripFillingUpHtml({
					hostName: hostMember.user.name ?? 'Host',
					tripName: trip.name,
					yesCount,
					maxCapacity: trip.maxCapacity,
					thresholdPercent: t.pct,
					tripUrl: guestsUrl(tripId)
				});

				await sendHtmlEmail({
					to: hostMember.user.email,
					subject: `"${trip.name}" is ${t.pct}% full`,
					html,
					templateKey: t.key as Parameters<typeof sendHtmlEmail>[0]['templateKey'],
					tags: [{ name: 'category', value: 'capacity' }]
				});
				break;
			}
		}
	} catch (err) {
		console.error('[notification-service] sendTripFillingUpToHost failed:', err);
	}
}

// ---------------------------------------------------------------------------
// Membership / invite emails
// ---------------------------------------------------------------------------

/** Send "you've joined the trip" email to a guest. */
export async function sendGuestJoinedEmail(tripId: string, userId: string): Promise<void> {
	try {
		const [trip, user] = await Promise.all([getTrip(tripId), getUser(userId)]);
		if (!trip || !user?.email) return;

		const html = renderGuestJoinedHtml({
			guestName: user.name ?? 'Guest',
			tripName: trip.name,
			tripUrl: tripUrl(tripId)
		});

		await sendHtmlEmail({
			to: user.email,
			subject: `You've joined "${trip.name}"`,
			html,
			templateKey: TEMPLATE_KEYS.GUEST_JOINED,
			tags: [{ name: 'category', value: 'membership' }]
		});
	} catch (err) {
		console.error('[notification-service] sendGuestJoinedEmail failed:', err);
	}
}

/** Notify a guest they were removed from a trip. */
export async function sendRemovedFromTripEmail(
	tripId: string,
	userId: string,
	tripName: string
): Promise<void> {
	try {
		const user = await getUser(userId);
		if (!user?.email) return;

		const html = renderRemovedFromTripHtml({
			guestName: user.name ?? 'Guest',
			tripName
		});

		await sendHtmlEmail({
			to: user.email,
			subject: `Update on "${tripName}"`,
			html,
			templateKey: TEMPLATE_KEYS.REMOVED_FROM_TRIP,
			tags: [{ name: 'category', value: 'membership' }]
		});
	} catch (err) {
		console.error('[notification-service] sendRemovedFromTripEmail failed:', err);
	}
}

/**
 * Notify all approved members (except host) that a trip was canceled.
 * Fetches member list internally, call BEFORE deleting the trip.
 */
export async function sendTripCanceledEmails(tripId: string): Promise<void> {
	try {
		const trip = await prisma.trip.findUnique({
			where: { id: tripId },
			select: { name: true }
		});
		if (!trip) return;

		const members = await prisma.tripMember.findMany({
			where: { tripId, inviteStatus: 'approved' },
			include: { user: { select: { name: true, email: true } } }
		});

		await Promise.allSettled(
			members
				.filter((m) => m.user?.email)
				.map((m) => {
					const html = renderTripCanceledHtml({
						recipientName: m.user?.name ?? 'Guest',
						tripName: trip.name
					});
					return sendHtmlEmail({
						to: m.user!.email!,
						subject: `"${trip.name}" was canceled`,
						html,
						templateKey: TEMPLATE_KEYS.TRIP_CANCELED,
						tags: [{ name: 'category', value: 'system' }]
					});
				})
		);
	} catch (err) {
		console.error('[notification-service] sendTripCanceledEmails failed:', err);
	}
}

/** Send welcome co-host email. Call when a member's role is set to co-host. */
export async function sendWelcomeCoHostEmail(
	tripId: string,
	coHostUserId: string,
	hostName: string
): Promise<void> {
	try {
		const [trip, coHost] = await Promise.all([getTrip(tripId), getUser(coHostUserId)]);
		if (!trip || !coHost?.email) return;

		const html = renderWelcomeCoHostHtml({
			coHostName: coHost.name ?? 'Co-host',
			hostName,
			tripName: trip.name,
			tripUrl: tripUrl(tripId)
		});

		await sendHtmlEmail({
			to: coHost.email,
			subject: `You're a co-host of "${trip.name}"`,
			html,
			templateKey: TEMPLATE_KEYS.WELCOME_CO_HOST,
			tags: [{ name: 'category', value: 'membership' }]
		});
	} catch (err) {
		console.error('[notification-service] sendWelcomeCoHostEmail failed:', err);
	}
}

/**
 * Send bed-removed emails to all affected users.
 * `affectedUsers` is [{userId, email?, name?}], caller provides what they already fetched.
 */
export async function sendBedRemovedEmails(
	tripId: string,
	tripName: string,
	affectedUsers: Array<{ userId: string; email?: string | null; name?: string | null }>
): Promise<void> {
	try {
		await Promise.allSettled(
			affectedUsers
				.filter((u) => u.email)
				.map((u) => {
					const html = renderBedRemovedHtml({
						guestName: u.name ?? 'Guest',
						tripName,
						tripUrl: tripUrl(tripId)
					});
					return sendHtmlEmail({
						to: u.email!,
						subject: `Action needed: your bed on "${tripName}" was removed`,
						html,
						templateKey: TEMPLATE_KEYS.BED_REMOVED,
						tags: [{ name: 'category', value: 'assignment' }]
					});
				})
		);
	} catch (err) {
		console.error('[notification-service] sendBedRemovedEmails failed:', err);
	}
}

// ---------------------------------------------------------------------------
// Cost re-approval (share increased beyond agreed ceiling)
// ---------------------------------------------------------------------------

export type CostShareReapprovalEmailParams = {
	tripId: string;
	userId: string;
	tripName: string;
	originalLowCents: number;
	originalHighCents: number;
	newShareCents: number;
	reason: string;
	deadline: Date;
	reminder: boolean;
};

/**
 * Guest email for cost re-approval.
 * TODO: Wire native mobile push using the same copy as the in-app notification.
 */
export async function sendCostShareReapprovalToGuest(p: CostShareReapprovalEmailParams): Promise<void> {
	try {
		const user = await getUser(p.userId);
		if (!user?.email) return;

		const guestName = user.name ?? 'Guest';
		const deadlineFormatted = formatReapprovalDeadlineEmail(p.deadline);
		const html = renderCostShareReapprovalGuestHtml({
			guestName,
			tripName: p.tripName,
			tripUrl: tripUrl(p.tripId),
			originalLowCents: p.originalLowCents,
			originalHighCents: p.originalHighCents,
			newShareCents: p.newShareCents,
			reason: p.reason,
			deadlineFormatted,
			reminder: p.reminder
		});

		const baseSubject = `Your cost share for "${p.tripName}" has increased, action needed`;
		const subject = p.reminder ? `Reminder: ${baseSubject}` : baseSubject;

		await sendHtmlEmail({
			to: user.email,
			subject,
			html,
			templateKey: p.reminder
				? TEMPLATE_KEYS.COST_SHARE_REAPPROVAL_GUEST_REMINDER
				: TEMPLATE_KEYS.COST_SHARE_REAPPROVAL_GUEST,
			tags: [{ name: 'category', value: 'billing' }]
		});
	} catch (err) {
		console.error('[notification-service] sendCostShareReapprovalToGuest failed:', err);
	}
}

/** In-app + email to hosts when a guest self-approves a higher share. */
export async function sendGuestApprovedCostShareToHosts(params: {
	tripId: string;
	guestUserId: string;
	amountCents: number;
}): Promise<void> {
	try {
		const [trip, guest] = await Promise.all([getTrip(params.tripId), getUser(params.guestUserId)]);
		if (!trip) return;
		const guestName = guest?.name ?? 'A guest';
		const amountFormatted = formatMoneyCents(params.amountCents);

		const hosts = await prisma.tripMember.findMany({
			where: { tripId: params.tripId, inviteStatus: 'approved', role: { in: ['host', 'co-host'] } },
			include: { user: { select: { id: true, name: true, email: true } } }
		});

		for (const m of hosts) {
			if (!m.user?.id || m.userId === params.guestUserId) continue;
			await prisma.notification.create({
				data: {
					userId: m.user.id,
					type: 'cost_share_guest_approved',
					title: 'Guest confirmed cost share',
					message: `${guestName} approved their updated cost share of ${amountFormatted} for "${trip.name}".`,
					relatedTripId: params.tripId
				}
			});
			if (!m.user.email) continue;
			const html = renderGuestApprovedCostShareHostHtml({
				hostName: m.user.name ?? 'Host',
				guestName,
				tripName: trip.name,
				tripGuestsUrl: guestsUrl(params.tripId),
				amountFormatted
			});
			await sendHtmlEmail({
				to: m.user.email,
				subject: `${guestName} confirmed their updated share for "${trip.name}"`,
				html,
				templateKey: TEMPLATE_KEYS.GUEST_APPROVED_NEW_COST_SHARE,
				tags: [{ name: 'category', value: 'billing' }]
			});
		}
	} catch (err) {
		console.error('[notification-service] sendGuestApprovedCostShareToHosts failed:', err);
	}
}
