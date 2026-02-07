import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { getSessionUser } from '$lib/server/session.js';
import { isTripHost } from '$lib/server/trip-access.js';
import { prisma } from '$lib/server/prisma.js';
import { notifyExistingUserOfInvite } from '$lib/server/invite-service.js';
import { z } from 'zod';

const PENDING_INVITE_STATUSES = ['sent', 'opened'];

export type GuestRow = {
	type: 'member' | 'invite';
	userId?: string;
	inviteId?: string;
	name: string;
	email: string;
	avatarUrl?: string | null;
	rsvpStatus: 'yes' | 'no' | 'maybe' | null;
	rsvpUpdatedAt: string | null;
	partySize: number;
	roomName: string | null;
	bedType: string | null;
	roomId: number | null;
	assignmentId: string | null;
	arrivalDate: string | null;
	departureDate: string | null;
	hasDietaryFlags: boolean;
	dietaryRestrictions: string | null;
	allergies: string | null;
	/** Total amount due for this guest (from invoices for this trip). Members only. */
	toPayTotal: number | null;
};

export const load: PageServerLoad = async ({ parent }) => {
	const parentData = await parent();
	const tripId = parentData.trip?.id;
	const trip = parentData.trip;
	const members = parentData.trip?.members ?? [];
	const rsvps = parentData.trip?.rsvps ?? [];
	const roomAssignments = parentData.trip?.roomAssignments ?? [];
	const isHost = parentData.isHost ?? false;

	const memberEmails = new Set(
		members.map((m) => m.user?.email?.trim()?.toLowerCase()).filter(Boolean)
	);
	const memberUserIds = new Set(members.map((m) => m.user?.id).filter(Boolean));

	const allInvites =
		tripId &&
		(await prisma.invite.findMany({
			where: { tripId, status: { in: PENDING_INVITE_STATUSES } },
			orderBy: { createdAt: 'desc' }
		}));

	const invites = (allInvites ?? []).filter((inv) => {
		const email = inv.recipientEmail?.trim()?.toLowerCase();
		if (email && memberEmails.has(email)) return false;
		if (inv.recipientUserId && memberUserIds.has(inv.recipientUserId)) return false;
		return true;
	});

	const guestProfiles =
		tripId &&
		(await prisma.guestProfile.findMany({
			where: { tripId },
			select: { userId: true, dietaryRestrictions: true, allergies: true }
		}));
	const profileByUserId = new Map(
		(guestProfiles ?? []).map((p) => [p.userId, { dietaryRestrictions: p.dietaryRestrictions, allergies: p.allergies }])
	);

	const invoices =
		tripId &&
		(await prisma.invoice.findMany({
			where: { tripId },
			select: { userId: true, totalAmount: true, status: true }
		}));
	// Per-user total to pay: sum of totalAmount for invoices with status 'due'
	const toPayByUserId = new Map<string, number>();
	for (const inv of invoices ?? []) {
		if (inv.status === 'due') {
			const cur = toPayByUserId.get(inv.userId) ?? 0;
			toPayByUserId.set(inv.userId, cur + inv.totalAmount);
		}
	}

	const rsvpByUserId = new Map(rsvps.map((r) => [r.userId, r]));
	const assignmentByUserId = new Map(roomAssignments.map((a) => [a.userId, a]));

	let goingCount = 0;
	let goingPartySize = 0;
	let notGoingCount = 0;
	let unrespondedCount = 0;

	const guestRows: GuestRow[] = [];

	for (const member of members) {
		const uid = member.user?.id;
		const rsvp = uid ? rsvpByUserId.get(uid) : null;
		const assignment = uid ? assignmentByUserId.get(uid) : null;
		const profile = uid ? profileByUserId.get(uid) : null;
		const status = rsvp?.status ?? null;
		if (status === 'yes') {
			goingCount++;
			goingPartySize += assignment?.partySize ?? rsvp?.adultsCount ?? 1;
		} else if (status === 'no') notGoingCount++;
		else unrespondedCount++;

		const hasDietary =
			!!(profile?.dietaryRestrictions?.trim() || profile?.allergies?.trim());

		const toPayTotal = uid ? (toPayByUserId.get(uid) ?? null) : null;
		guestRows.push({
			type: 'member',
			userId: uid,
			name: member.user?.name ?? '—',
			email: member.user?.email ?? '—',
			avatarUrl: member.user?.avatarUrl,
			rsvpStatus: status,
			rsvpUpdatedAt: rsvp?.updatedAt ? rsvp.updatedAt.toISOString() : null,
			partySize: assignment?.partySize ?? (status === 'yes' ? (rsvp?.adultsCount ?? 1) + (rsvp?.kidsCount ?? 0) : 0),
			roomName: assignment?.room?.name ?? null,
			bedType: assignment?.bedType ?? null,
			roomId: assignment?.roomId ?? null,
			assignmentId: assignment?.id ?? null,
			arrivalDate: assignment?.startDate
				? new Date(assignment.startDate).toISOString().slice(0, 10)
				: rsvp?.arrivalDatetime
					? new Date(rsvp.arrivalDatetime).toISOString().slice(0, 10)
					: null,
			departureDate: assignment?.endDate
				? new Date(assignment.endDate).toISOString().slice(0, 10)
				: rsvp?.departureDatetime
					? new Date(rsvp.departureDatetime).toISOString().slice(0, 10)
					: null,
			hasDietaryFlags: hasDietary,
			dietaryRestrictions: profile?.dietaryRestrictions ?? null,
			allergies: profile?.allergies ?? null,
			toPayTotal: toPayTotal !== null && toPayTotal > 0 ? toPayTotal : null
		});
	}

	for (const inv of invites) {
		unrespondedCount++;
		const email = inv.recipientEmail ?? inv.recipientPhone ?? '—';
		const name = inv.recipient?.name ?? email;
		guestRows.push({
			type: 'invite',
			inviteId: inv.id,
			name,
			email,
			avatarUrl: null,
			rsvpStatus: null,
			rsvpUpdatedAt: null,
			partySize: 0,
			roomName: null,
			bedType: null,
			roomId: null,
			assignmentId: null,
			arrivalDate: null,
			departureDate: null,
			hasDietaryFlags: false,
			dietaryRestrictions: null,
			allergies: null,
			toPayTotal: null
		});
	}

	const totalInvited = guestRows.length;
	const rooms =
		trip?.rooms?.map((r) => ({
			id: r.id,
			name: r.name,
			beds: (r.beds ?? []).map((b) => ({ id: b.id, bedType: b.bedType }))
		})) ?? [];

	return {
		trip: trip
			? {
					id: trip.id,
					name: trip.name,
					rsvpByDate: trip.rsvpByDate ? trip.rsvpByDate.toISOString().slice(0, 10) : null,
					allowPartialStays: trip.allowPartialStays ?? false,
					inviteCode: trip.inviteCode
				}
			: null,
		guestRows,
		summary: {
			totalInvited,
			goingCount,
			goingPartySize,
			notGoingCount,
			unrespondedCount
		},
		rooms,
		invites,
		isHost
	};
};

const inviteSchema = z.object({
	email: z.string().email('Please enter a valid email address')
});

export const actions: Actions = {
	createInvite: async ({ request, params, cookies }) => {
		const user = await getSessionUser(cookies);
		if (!user) throw redirect(303, '/login');

		const tripId = params.tripId;
		const host = await isTripHost(tripId, user.id);
		if (!host) throw error(403, 'Only the trip host can invite guests');

		const formData = await request.formData();
		const email = (formData.get('email') as string)?.trim() ?? '';

		const validation = inviteSchema.safeParse({ email });
		if (!validation.success) {
			const message = validation.error.errors[0]?.message ?? 'Invalid email';
			return { createInviteError: message };
		}

		const emailTrimmed = email.trim().toLowerCase();
		const existingUser = await prisma.user.findFirst({
			where: { email: { equals: email.trim(), mode: 'insensitive' } },
			select: { id: true }
		});

		if (existingUser) {
			const alreadyMember = await prisma.tripMember.findUnique({
				where: {
					tripId_userId: { tripId, userId: existingUser.id }
				}
			});
			if (alreadyMember) {
				return { createInviteError: 'This person is already a guest.' };
			}
		} else {
			const existingPendingByEmail = await prisma.invite.findFirst({
				where: {
					tripId,
					recipientEmail: { equals: emailTrimmed, mode: 'insensitive' },
					status: { in: PENDING_INVITE_STATUSES }
				}
			});
			if (existingPendingByEmail) {
				return { createInviteError: 'A pending invite has already been sent to this email.' };
			}
		}

		const token = crypto.randomUUID();
		const invite = await prisma.invite.create({
			data: {
				tripId,
				token,
				invitedByUserId: user.id,
				channel: 'email',
				recipientEmail: email,
				recipientPhone: null,
				recipientUserId: existingUser?.id ?? null,
				expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
			}
		});

		if (existingUser) {
			const trip = await prisma.trip.findUnique({
				where: { id: tripId },
				select: { name: true }
			});
			if (trip) {
				await notifyExistingUserOfInvite({
					inviteId: invite.id,
					tripId,
					tripName: trip.name,
					recipientUserId: existingUser.id
				});
			}
		}

		return { createInviteSuccess: true };
	},

	removeGuest: async ({ request, params, cookies }) => {
		const user = await getSessionUser(cookies);
		if (!user) throw redirect(303, '/login');
		const tripId = params.tripId;
		const host = await isTripHost(tripId, user.id);
		if (!host) throw error(403, 'Only the trip host can remove guests');

		const formData = await request.formData();
		const userId = (formData.get('userId') as string)?.trim();
		if (!userId) return { removeGuestError: 'Missing user' };

		await prisma.tripMember.deleteMany({
			where: { tripId, userId }
		});
		return { removeGuestSuccess: true };
	},

	nudgeUnresponded: async ({ request, params, cookies }) => {
		const user = await getSessionUser(cookies);
		if (!user) throw redirect(303, '/login');
		const tripId = params.tripId;
		const host = await isTripHost(tripId, user.id);
		if (!host) throw error(403, 'Only the trip host can nudge guests');
		const formData = await request.formData();
		const _userId = (formData.get('userId') as string)?.trim();
		// Nudge is not tracked in activity feed per request
		return { nudgeUnrespondedSuccess: true };
	},

	nudgeAllPending: async ({ params, cookies }) => {
		const user = await getSessionUser(cookies);
		if (!user) throw redirect(303, '/login');
		const tripId = params.tripId;
		const host = await isTripHost(tripId, user.id);
		if (!host) throw error(403, 'Only the trip host can nudge guests');
		// Get all members who have not responded (no yes/no RSVP)
		const rsvps = await prisma.rsvp.findMany({
			where: { tripId },
			select: { userId: true, status: true }
		});
		const respondedUserIds = new Set(rsvps.filter((r) => r.status === 'yes' || r.status === 'no').map((r) => r.userId));
		const members = await prisma.tripMember.findMany({
			where: { tripId },
			select: { userId: true }
		});
		const _unrespondedUserIds = members.map((m) => m.userId).filter((uid) => !respondedUserIds.has(uid));
		// TODO: send nudge notification to each unresponded user
		return { nudgeAllPendingSuccess: true };
	}
};
