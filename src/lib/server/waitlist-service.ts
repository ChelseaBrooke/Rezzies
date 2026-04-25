/**
 * Waitlist Service
 *
 * Manages the waitlist queue for trips with a maxCapacity set.
 *
 * Status lifecycle for a guest:
 *   (no row / not_responded)
 *     → waitlisted       (trip fills up; RSVP row created/updated)
 *     → yes              (spot opens and guest RSVPs yes first, first come, first served)
 *     → no               (trip starts and waitlist is dissolved, or guest explicitly declines)
 *
 * When a spot opens, ALL waitlisted guests are notified simultaneously.
 * Spots go to whoever RSVPs yes first, no claim windows, no promotion queue.
 */

import { prisma } from './prisma.js';
import { sendHtmlEmail } from './email/resend.js';
import { TEMPLATE_KEYS } from './email/templates.js';
import { renderWaitlistAddedHtml } from './email/render/waitlist-added.js';
import { renderSpotOpenedHtml } from './email/render/spot-opened.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type WaitlistStatus = 'waitlisted';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Count of confirmed yes RSVPs for a trip. */
export async function getYesCount(tripId: string): Promise<number> {
	return prisma.rSVP.count({ where: { tripId, status: 'yes' } });
}

/** Fetch trip's maxCapacity in one query. */
async function getTripCapacitySettings(tripId: string) {
	return prisma.trip.findUnique({
		where: { id: tripId },
		select: {
			id: true,
			name: true,
			maxCapacity: true,
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
 * (no RSVP row, or RSVP with status "maybe") are moved to "waitlisted".
 */
export async function checkAndHandleCapacity(tripId: string): Promise<void> {
	const trip = await getTripCapacitySettings(tripId);
	if (!trip?.maxCapacity) return; // No capacity limit set

	const yesCount = await getYesCount(tripId);
	if (yesCount < trip.maxCapacity) return; // Still room

	// Trip is full, find all non-host members without a confirmed answer
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
		// Skip users already on the waitlist
		if (existingStatus === 'waitlisted') continue;

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
// Core: Handle spot opening, notify all waitlisted guests (first come, first served)
// ---------------------------------------------------------------------------

/**
 * Called whenever a spot opens up:
 *  - A yes RSVP changes to no
 *  - A member is removed from the trip
 *  - Trip maxCapacity is increased
 *
 * Sends every waitlisted guest an email and in-app notification telling them
 * how many spots are open. Whoever RSVPs yes first gets the spot(s).
 * No promotion queue, no claim windows.
 */
export async function handleSpotOpened(tripId: string): Promise<void> {
	const trip = await getTripCapacitySettings(tripId);
	if (!trip?.maxCapacity) return;

	const yesCount = await getYesCount(tripId);
	const openSpots = trip.maxCapacity - yesCount;
	if (openSpots <= 0) return;

	// Find all waitlisted guests
	const waitlisted = await prisma.rSVP.findMany({
		where: { tripId, status: 'waitlisted' },
		orderBy: [{ waitlistPosition: 'asc' }, { waitlistJoinedAt: 'asc' }],
		select: { userId: true }
	});
	if (waitlisted.length === 0) return;

	// Notify everyone simultaneously, first to RSVP yes wins
	for (const entry of waitlisted) {
		const user = await prisma.user.findUnique({
			where: { id: entry.userId },
			select: { name: true, email: true }
		});
		if (!user) continue;

		await notify({
			userId: entry.userId,
			tripId,
			type: 'waitlist_spot_opened',
			title: openSpots === 1 ? 'A spot just opened!' : `${openSpots} spots just opened!`,
			message: `${openSpots === 1 ? 'A spot' : `${openSpots} spots`} just opened on "${trip.name}". It's first come, first served, go RSVP now!`
		}).catch(console.error);

		if (user.email) {
			const html = renderSpotOpenedHtml({
				guestName: user.name ?? 'Guest',
				tripName: trip.name,
				spotsAvailable: openSpots
			});
			await sendHtmlEmail({
				to: user.email,
				subject: `${openSpots === 1 ? 'A spot opened' : `${openSpots} spots opened`} on "${trip.name}", first come, first served`,
				html,
				templateKey: TEMPLATE_KEYS.SPOT_OPENED
			}).catch(console.error);
		}
	}
}

// ---------------------------------------------------------------------------
// Day-1 trip start: dissolve waitlist
// ---------------------------------------------------------------------------

/**
 * Called when a trip's check-in date is reached.
 * Moves all waitlisted users to "no" and clears queue state.
 */
export async function dissolveWaitlistForTrip(tripId: string): Promise<number> {
	const result = await prisma.rSVP.updateMany({
		where: {
			tripId,
			status: { in: ['waitlisted'] }
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
