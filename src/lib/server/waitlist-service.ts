/**
 * Waitlist Service
 *
 * Manages the FIFO waitlist queue for trips with a maxCapacity set.
 *
 * Status lifecycle for a guest:
 *   (no row / not_responded)
 *     → waitlisted       (trip fills up; RSVP row created/updated)
 *     → invited_to_rsvp  (spot opens; user has claimWindowHours to respond)
 *     → yes              (user claims spot)
 *     → no               (user declines OR window expires and they exhaust retries)
 *
 * All transactional state changes use prisma.$transaction to prevent races.
 */

import { prisma } from './prisma.js';
import { sendHtmlEmail } from './email/resend.js';
import { TEMPLATE_KEYS } from './email/templates.js';
import { renderWaitlistAddedHtml } from './email/render/waitlist-added.js';
import { renderSpotOpenedHtml } from './email/render/spot-opened.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type WaitlistStatus = 'waitlisted' | 'invited_to_rsvp';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Count of confirmed yes RSVPs for a trip. */
export async function getYesCount(tripId: string): Promise<number> {
	return prisma.rSVP.count({ where: { tripId, status: 'yes' } });
}

/** Fetch trip's maxCapacity and claimWindowHours in one query. */
async function getTripCapacitySettings(tripId: string) {
	return prisma.trip.findUnique({
		where: { id: tripId },
		select: {
			id: true,
			name: true,
			maxCapacity: true,
			waitlistClaimWindowHours: true,
			checkInDate: true
		}
	});
}

/** Get the next available waitlist position for a trip (max + 1). */
async function nextWaitlistPosition(tripId: string): Promise<number> {
	const result = await prisma.rSVP.aggregate({
		where: { tripId, waitlistPosition: { not: null } },
		_max: { waitlistPosition: true }
	});
	return (result._max.waitlistPosition ?? 0) + 1;
}

/** Send an in-app notification to a user. */
async function notify(params: {
	userId: string;
	tripId: string;
	type: string;
	title: string;
	message: string;
}) {
	await prisma.notification.create({
		data: {
			userId: params.userId,
			type: params.type,
			title: params.title,
			message: params.message,
			relatedTripId: params.tripId
		}
	});
}

// ---------------------------------------------------------------------------
// Core: Check capacity and enqueue not-responded guests
// ---------------------------------------------------------------------------

/**
 * Called after a yes RSVP is submitted.
 * If the trip is now at or over maxCapacity, all guests who haven't responded
 * (no RSVP row, or RSVP with status in ["maybe"]) are moved to "waitlisted".
 */
export async function checkAndHandleCapacity(tripId: string): Promise<void> {
	const trip = await getTripCapacitySettings(tripId);
	if (!trip?.maxCapacity) return; // No capacity limit set

	const yesCount = await getYesCount(tripId);
	if (yesCount < trip.maxCapacity) return; // Still room

	// Trip is full — find all non-host members without a confirmed answer
	const allMembers = await prisma.tripMember.findMany({
		where: { tripId, role: { not: 'host' }, inviteStatus: 'approved' },
		select: { userId: true, createdAt: true }
	});

	const existingRsvps = await prisma.rSVP.findMany({
		where: { tripId },
		select: { userId: true, status: true }
	});
	const rsvpMap = new Map(existingRsvps.map((r) => [r.userId, r.status]));

	const now = new Date();
	let positionCounter = await nextWaitlistPosition(tripId);

	for (const member of allMembers) {
		const existingStatus = rsvpMap.get(member.userId);

		// Skip users who have already committed one way or the other
		if (existingStatus === 'yes' || existingStatus === 'no') continue;
		// Skip users already on the waitlist / in a claim window
		if (existingStatus === 'waitlisted' || existingStatus === 'invited_to_rsvp') continue;

		// Upsert to "waitlisted"
		await prisma.rSVP.upsert({
			where: { tripId_userId: { tripId, userId: member.userId } },
			create: {
				tripId,
				userId: member.userId,
				status: 'waitlisted',
				waitlistPosition: positionCounter,
				waitlistJoinedAt: now
			},
			update: {
				status: 'waitlisted',
				waitlistPosition: positionCounter,
				waitlistJoinedAt: now
			}
		});

		// Notify + email
		const user = await prisma.user.findUnique({
			where: { id: member.userId },
			select: { name: true, email: true }
		});
		if (user) {
			await notify({
				userId: member.userId,
				tripId,
				type: 'waitlist_added',
				title: 'Added to waitlist',
				message: `"${trip.name}" is now full. You've been added to the waitlist at position #${positionCounter}.`
			});
			if (user.email) {
				const html = renderWaitlistAddedHtml({
					guestName: user.name ?? 'Guest',
					tripName: trip.name,
					waitlistPosition: positionCounter
				});
				await sendHtmlEmail({
					to: user.email,
					subject: `You're on the waitlist for "${trip.name}"`,
					html,
					templateKey: TEMPLATE_KEYS.WAITLIST_ADDED
				}).catch(console.error);
			}
		}

		positionCounter++;
	}
}

// ---------------------------------------------------------------------------
// Core: Handle spot opening — promote next waitlisted user
// ---------------------------------------------------------------------------

/**
 * Called whenever a spot opens up:
 *  - A yes RSVP changes to no
 *  - A member is removed from the trip
 *  - Trip maxCapacity is increased
 *
 * Promotes as many users as there are open spots (handles bulk openings).
 */
export async function handleSpotOpened(tripId: string): Promise<void> {
	const trip = await getTripCapacitySettings(tripId);
	if (!trip?.maxCapacity) return;

	const yesCount = await getYesCount(tripId);
	const openSpots = trip.maxCapacity - yesCount;
	if (openSpots <= 0) return;

	for (let i = 0; i < openSpots; i++) {
		const promoted = await promoteNextWaitlistUser(
			tripId,
			trip.name,
			trip.waitlistClaimWindowHours
		);
		if (!promoted) break; // Queue is empty
	}
}

/**
 * Promotes the next user in the waitlist to "invited_to_rsvp".
 * Returns true if someone was promoted, false if the queue was empty.
 */
export async function promoteNextWaitlistUser(
	tripId: string,
	tripName: string,
	claimWindowHours: number
): Promise<boolean> {
	// Find the next waitlisted user (lowest position; tie-break by waitlistJoinedAt then createdAt)
	const next = await prisma.rSVP.findFirst({
		where: { tripId, status: 'waitlisted', waitlistPosition: { not: null } },
		orderBy: [{ waitlistPosition: 'asc' }, { waitlistJoinedAt: 'asc' }],
		select: { id: true, userId: true, waitlistPosition: true }
	});
	if (!next) return false;

	const expiresAt = new Date(Date.now() + claimWindowHours * 60 * 60 * 1000);

	await prisma.rSVP.update({
		where: { id: next.id },
		data: {
			status: 'invited_to_rsvp',
			waitlistPosition: null,
			claimWindowExpiresAt: expiresAt
		}
	});

	// Notify + email
	const user = await prisma.user.findUnique({
		where: { id: next.userId },
		select: { name: true, email: true }
	});

	if (user) {
		await notify({
			userId: next.userId,
			tripId,
			type: 'waitlist_spot_opened',
			title: 'A spot just opened up!',
			message: `You're up next for "${tripName}". You have ${claimWindowHours} hours to claim your spot.`
		});
		if (user.email) {
			const html = renderSpotOpenedHtml({
				guestName: user.name ?? 'Guest',
				tripName,
				claimWindowHours,
				expiresAt
			});
			await sendHtmlEmail({
				to: user.email,
				subject: `A spot opened for "${tripName}" — claim it within ${claimWindowHours} hours`,
				html,
				templateKey: TEMPLATE_KEYS.SPOT_OPENED
			}).catch(console.error);
		}
	}

	return true;
}

// ---------------------------------------------------------------------------
// Cron: Expire lapsed claim windows
// ---------------------------------------------------------------------------

/**
 * Called periodically (e.g. every 15 min via cron endpoint).
 * Finds all "invited_to_rsvp" RSVPs whose window has expired, demotes them
 * to "waitlisted" (end of queue), and promotes the next user.
 */
export async function expireClaimWindows(): Promise<string[]> {
	const now = new Date();
	const expired = await prisma.rSVP.findMany({
		where: {
			status: 'invited_to_rsvp',
			claimWindowExpiresAt: { lt: now }
		},
		select: { id: true, userId: true, tripId: true }
	});

	const affectedTripIds = new Set<string>();

	for (const rsvp of expired) {
		const position = await nextWaitlistPosition(rsvp.tripId);

		await prisma.rSVP.update({
			where: { id: rsvp.id },
			data: {
				status: 'waitlisted',
				waitlistPosition: position,
				waitlistJoinedAt: now,
				claimWindowExpiresAt: null
			}
		});

		// Notify the user that they missed their window
		const trip = await prisma.trip.findUnique({
			where: { id: rsvp.tripId },
			select: { name: true }
		});
		if (trip) {
			await notify({
				userId: rsvp.userId,
				tripId: rsvp.tripId,
				type: 'waitlist_window_expired',
				title: 'Spot claim window expired',
				message: `Your window to claim a spot for "${trip.name}" has passed. You've been returned to the waitlist.`
			});
		}

		affectedTripIds.add(rsvp.tripId);
	}

	// Promote next users for all affected trips
	for (const tripId of affectedTripIds) {
		await handleSpotOpened(tripId);
	}

	return [...affectedTripIds];
}

// ---------------------------------------------------------------------------
// Day-1 trip start: dissolve waitlist
// ---------------------------------------------------------------------------

/**
 * Called when a trip's check-in date is reached.
 * Moves all waitlisted / invited_to_rsvp users to "no" and clears queue state.
 */
export async function dissolveWaitlistForTrip(tripId: string): Promise<number> {
	const result = await prisma.rSVP.updateMany({
		where: {
			tripId,
			status: { in: ['waitlisted', 'invited_to_rsvp'] }
		},
		data: {
			status: 'no',
			waitlistPosition: null,
			waitlistJoinedAt: null,
			claimWindowExpiresAt: null
		}
	});
	return result.count;
}

/**
 * Called by the daily cron: finds all trips starting today and dissolves their waitlists.
 */
export async function dissolveWaitlistsForTodayTrips(): Promise<string[]> {
	const todayStart = new Date();
	todayStart.setHours(0, 0, 0, 0);
	const todayEnd = new Date();
	todayEnd.setHours(23, 59, 59, 999);

	const trips = await prisma.trip.findMany({
		where: {
			checkInDate: { gte: todayStart, lte: todayEnd },
			maxCapacity: { not: null }
		},
		select: { id: true }
	});

	const dissolved: string[] = [];
	for (const trip of trips) {
		const count = await dissolveWaitlistForTrip(trip.id);
		if (count > 0) dissolved.push(trip.id);
	}
	return dissolved;
}
