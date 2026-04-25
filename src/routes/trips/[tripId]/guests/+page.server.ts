import { error, fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { getSessionUser } from '$lib/server/session.js';
import { isTripHost, isTripHostOrCoHost, getMemberTripState, type MemberTripState } from '$lib/server/trip-access.js';
import type { InvoiceBreakdown } from '$lib/server/invoice-calculator.js';
import { prisma } from '$lib/server/prisma.js';
import { ROOM_BEDS_ORDER_BY } from '$lib/server/trip-room-order.js';
import { notifyExistingUserOfInvite } from '$lib/server/invite-service.js';
import { createInvoiceForUser } from '$lib/server/invoice-calculator.js';
import { hashPassword } from '$lib/server/auth.js';
import { checkAndSetReconfirmRequired } from '$lib/server/guest-estimate.js';
import { handleSpotOpened } from '$lib/server/waitlist-service.js';
import { sendRemovedFromTripEmail, sendWelcomeCoHostEmail } from '$lib/server/notification-service.js';
import { z } from 'zod';
import {
	applyBedAssignments,
	parseTripDatesFromForm,
	type WaitlistEntry
} from './guests.helpers.js';

const PENDING_INVITE_STATUSES = ['sent', 'opened'];

export type GuestRow = {
	type: 'member' | 'invite';
	userId?: string;
	inviteId?: string;
	/** For invite rows: recipient user id when they have an account */
	recipientUserId?: string | null;
	name: string;
	email: string;
	avatarUrl?: string | null;
	rsvpStatus: 'yes' | 'no' | 'waitlisted' | null;
	rsvpUpdatedAt: string | null;
	yesSubstatus: 'confirmed' | 'reconfirm_required' | null;
	reconfirmDeadlineAt: string | null;
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
	/** Price approved: either within original RSVP range (yesSubstatus=confirmed) or host override. */
	priceApproved: boolean | null;
	/** Host override for price approved (null = use yesSubstatus). */
	priceApprovedByHost: boolean | null;
	/** All invoices for this user are paid (only relevant when they have amount due). */
	invoicePaid: boolean | null;
	/** Invoice breakdown for modal (host/co-host only). */
	invoiceBreakdown?: InvoiceBreakdown | null;
	/** Bed IDs currently assigned (for multi-select beds UI). */
	assignedBedIds: string[];
	/** Display state: invited | accepted | rsvp_yes | rsvp_no (only for active members; removed are in removedRows). */
	memberTripState?: MemberTripState;
	/** Trip role for this member (host, co-host, guest) so UI can e.g. hide Remove for host. */
	role?: string;
}

export type RemovedRow = {
	userId: string;
	name: string;
	email: string;
	role: string;
};

export const load: PageServerLoad = async ({ parent }) => {
	const parentData = await parent();
	const tripId = parentData.trip?.id;
	const trip = parentData.trip;
	const members = parentData.trip?.members ?? [];
	const rsvps = parentData.trip?.rsvps ?? [];
	const isHost = parentData.isHost ?? false;
	const canManageGuests = isHost || parentData.membership?.role === 'co-host';
	if (!canManageGuests) {
		throw redirect(303, tripId ? `/trips/${tripId}` : '/trips');
	}

	// Fetch room assignments directly so we always get latest from DB (avoids layout merge/serialization issues)
	const roomAssignments =
		tripId ?
			await prisma.roomAssignment.findMany({
				where: { tripId },
				include: {
					room: {
						include: {
							beds: { orderBy: ROOM_BEDS_ORDER_BY, select: { id: true, bedType: true } }
						}
					}
				}
			})
		:	[];
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

	// Refresh invoice for every unique guest with a room assignment, run in parallel, not serially
	if (tripId) {
		const uniqueUserIds = [...new Set(roomAssignments.map((a) => a.userId))];
		await Promise.allSettled(uniqueUserIds.map((uid) => createInvoiceForUser(tripId, uid)));
	}
	const invoices =
		tripId &&
		(await prisma.invoice.findMany({
			where: { tripId },
			select: { userId: true, totalAmount: true, status: true, breakdownJson: true }
		}));
	// Per-user total to pay and breakdown for host/co-host
	const toPayByUserId = new Map<string, number>();
	const breakdownByUserId = new Map<string, import('$lib/server/invoice-calculator.js').InvoiceBreakdown>();
	for (const inv of invoices ?? []) {
		if (inv.status === 'due') {
			const cur = toPayByUserId.get(inv.userId) ?? 0;
			toPayByUserId.set(inv.userId, cur + inv.totalAmount);
			if (inv.breakdownJson && canManageGuests) {
				try {
					const b = JSON.parse(inv.breakdownJson) as InvoiceBreakdown;
					breakdownByUserId.set(inv.userId, b);
				} catch {
					// ignore parse errors
				}
			}
		}
	}

	const rsvpByUserId = new Map(rsvps.map((r) => [r.userId, r]));
	const assignmentsByUserId = new Map<string, typeof roomAssignments>();
	for (const a of roomAssignments) {
		const list = assignmentsByUserId.get(a.userId) ?? [];
		list.push(a);
		assignmentsByUserId.set(a.userId, list);
	}

	let goingCount = 0;
	let goingPartySize = 0;
	let notGoingCount = 0;
	let unrespondedCount = 0;

	const activeMembers = members.filter((m) => m.inviteStatus !== 'denied');
	const removedMembers = members.filter((m) => m.inviteStatus === 'denied');
	const guestRows: GuestRow[] = [];

	for (const member of activeMembers) {
		const uid = member.user?.id;
		const rsvp = uid ? rsvpByUserId.get(uid) : null;
		const assignments = uid ? (assignmentsByUserId.get(uid) ?? []) : [];
		const firstAssignment = assignments[0] ?? null;
		const profile = uid ? profileByUserId.get(uid) : null;
		const status =
		rsvp?.status === 'yes' ? 'yes' :
		rsvp?.status === 'no' ? 'no' :
		rsvp?.status === 'waitlisted' ? 'waitlisted' :
		null;
		const totalPartySize = assignments.reduce((s, a) => s + (a.partySize || 1), 0);
		if (status === 'yes') {
			goingCount++;
			goingPartySize += totalPartySize || (rsvp?.adultsCount ?? 1);
		} else if (status === 'no') notGoingCount++;
		else unrespondedCount++;

		const hasDietary =
			!!(profile?.dietaryRestrictions?.trim() || profile?.allergies?.trim());

		const toPayTotal = uid ? (toPayByUserId.get(uid) ?? null) : null;
		const invoiceBreakdown = uid && canManageGuests ? (breakdownByUserId.get(uid) ?? null) : null;
		const priceApprovedByHost = rsvp?.priceApprovedByHost ?? null;
		const priceApproved =
			priceApprovedByHost !== null
				? priceApprovedByHost
				: status === 'yes' && rsvp?.yesSubstatus === 'confirmed'
					? true
					: status === 'yes' && rsvp?.yesSubstatus === 'reconfirm_required'
						? false
						: null;
		const invoicePaid =
			uid && assignments.length > 0 ? (toPayTotal === null || toPayTotal === 0) : null;
		const assignedBedIds: string[] = [];
		for (const a of assignments) {
			if (a.bedId) {
				assignedBedIds.push(a.bedId);
			} else if (a.room?.beds?.length) {
				const bed = a.bedType ? a.room.beds.find((b) => b.bedType === a.bedType) : a.room.beds[0];
				if (bed?.id) assignedBedIds.push(bed.id);
			}
		}
		const memberTripState = getMemberTripState(member, rsvp ?? null);
		guestRows.push({
			type: 'member',
			userId: uid,
			role: member.role,
			name: member.user?.name ?? '—',
			email: member.user?.email ?? '—',
			avatarUrl: member.user?.avatarUrl,
			rsvpStatus: status,
			rsvpUpdatedAt: rsvp?.updatedAt ? rsvp.updatedAt.toISOString() : null,
			yesSubstatus: rsvp?.yesSubstatus ?? null,
			reconfirmDeadlineAt: rsvp?.reconfirmDeadlineAt ? rsvp.reconfirmDeadlineAt.toISOString() : null,
			partySize: totalPartySize || (status === 'yes' ? (rsvp?.adultsCount ?? 1) + (rsvp?.kidsCount ?? 0) : 0),
			roomName: firstAssignment?.room?.name ?? null,
			bedType: firstAssignment?.bedType ?? null,
			roomId: firstAssignment?.roomId ?? null,
			assignmentId: firstAssignment?.id ?? null,
			arrivalDate: firstAssignment?.startDate
				? new Date(firstAssignment.startDate).toISOString().slice(0, 10)
				: rsvp?.arrivalDatetime
					? new Date(rsvp.arrivalDatetime).toISOString().slice(0, 10)
					: null,
			departureDate: firstAssignment?.endDate
				? new Date(firstAssignment.endDate).toISOString().slice(0, 10)
				: rsvp?.departureDatetime
					? new Date(rsvp.departureDatetime).toISOString().slice(0, 10)
					: null,
			hasDietaryFlags: hasDietary,
			dietaryRestrictions: profile?.dietaryRestrictions ?? null,
			allergies: profile?.allergies ?? null,
			toPayTotal: canManageGuests ? (toPayTotal !== null && toPayTotal > 0 ? toPayTotal : null) : null,
			priceApproved: canManageGuests ? priceApproved : null,
			priceApprovedByHost: canManageGuests ? priceApprovedByHost : null,
			invoicePaid: canManageGuests ? invoicePaid : null,
			invoiceBreakdown: canManageGuests ? (invoiceBreakdown ?? null) : null,
			assignedBedIds,
			memberTripState
		});
	}

	const removedRows: RemovedRow[] = removedMembers.map((m) => ({
		userId: m.user?.id ?? '',
		name: m.user?.name ?? '—',
		email: m.user?.email ?? '—',
		role: m.role
	}));

	for (const inv of invites) {
		unrespondedCount++;
		const email = inv.recipientEmail ?? inv.recipientPhone ?? '—';
		const name = inv.recipient?.name ?? email;
		guestRows.push({
			type: 'invite',
			inviteId: inv.id,
			recipientUserId: inv.recipientUserId ?? null,
			name,
			email,
			avatarUrl: null,
			rsvpStatus: null,
			rsvpUpdatedAt: null,
			yesSubstatus: null,
			reconfirmDeadlineAt: null,
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
			toPayTotal: null,
			priceApproved: null,
			priceApprovedByHost: null,
			invoicePaid: null,
			assignedBedIds: []
		});
	}

	const totalInvited = guestRows.length;
	const rooms =
		trip?.rooms?.map((r) => ({
			id: r.id,
			name: r.name,
			beds: (r.beds ?? []).map((b) => ({ id: b.id, bedType: b.bedType }))
		})) ?? [];

	// Max occupancy: trip-level setting, or sum of room max occupancies
	const roomSum = trip?.rooms?.reduce((sum, r) => sum + (r.maxOccupancy ?? 0), 0) ?? 0;
	const maxOccupancy = trip?.maxGuests ?? (roomSum > 0 ? roomSum : null);

	// Waitlist data (only fetch for hosts/co-hosts)
	let waitlistEntries: WaitlistEntry[] = [];
	let waitlistCount = 0;
	if (canManageGuests && tripId) {
		const waitlisted = await prisma.rSVP.findMany({
			where: { tripId, status: 'waitlisted' },
			orderBy: [{ waitlistPosition: 'asc' }, { waitlistJoinedAt: 'asc' }],
			select: {
				userId: true,
				status: true,
				waitlistPosition: true,
				waitlistJoinedAt: true,
				user: { select: { name: true, email: true, avatarUrl: true } }
			}
		});
		waitlistCount = waitlisted.length;
		waitlistEntries = waitlisted.map((w) => ({
			userId: w.userId,
			name: w.user?.name ?? '—',
			email: w.user?.email ?? '—',
			avatarUrl: w.user?.avatarUrl ?? null,
			waitlistPosition: w.waitlistPosition,
			waitlistJoinedAt: w.waitlistJoinedAt?.toISOString() ?? null,
			status: 'waitlisted' as const
		}));
	}

	let legacyReservations: { id: string; name: string; email: string; roomName: string; bedType: string | null; checkInDate: string; checkOutDate: string; nights: number; numberOfGuests: number; calculatedPrice: number; submittedAt: string }[] = [];
	let legacyStats: { totalReservations: number; totalRevenue: number; totalNights: number; averagePrice: number } | null = null;
	if (canManageGuests && tripId) {
		const reservations = await prisma.reservation.findMany({
			where: { tripId },
			include: { room: true, bed: true },
			orderBy: { submittedAt: 'desc' }
		});
		legacyReservations = reservations.map((r) => ({
			id: r.id,
			name: r.name,
			email: r.email,
			roomName: r.room?.name ?? '',
			bedType: r.bed?.bedType ?? null,
			checkInDate: r.checkInDate.toISOString(),
			checkOutDate: r.checkOutDate.toISOString(),
			nights: r.nights,
			numberOfGuests: r.numberOfGuests,
			calculatedPrice: r.calculatedPrice,
			submittedAt: r.submittedAt.toISOString()
		}));
		const totalRevenue = reservations.reduce((s, r) => s + r.calculatedPrice, 0);
		legacyStats = {
			totalReservations: reservations.length,
			totalRevenue,
			totalNights: reservations.reduce((s, r) => s + r.nights, 0),
			averagePrice: reservations.length > 0 ? totalRevenue / reservations.length : 0
		};
	}

	return {
		trip: trip
			? {
					id: trip.id,
					name: trip.name,
					rsvpByDate: trip.rsvpByDate ? trip.rsvpByDate.toISOString().slice(0, 10) : null,
					allowPartialStays: trip.allowPartialStays ?? false,
				checkInDate: trip.checkInDate ? trip.checkInDate.toISOString().slice(0, 10) : null,
					checkOutDate: trip.checkOutDate ? trip.checkOutDate.toISOString().slice(0, 10) : null
				}
			: null,
		guestRows,
		removedRows,
		summary: {
			totalInvited,
			goingCount,
			goingPartySize,
			notGoingCount,
			unrespondedCount
		},
		maxOccupancy,
		rooms,
		invites,
		isHost,
		canManageGuests,
		legacyReservations,
		legacyStats,
		// Waitlist
		waitlistCount,
		waitlistEntries,
		maxCapacity: (trip as { maxCapacity?: number | null } | null)?.maxCapacity ?? null
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
		const canManage = await isTripHostOrCoHost(tripId, user.id);
		if (!canManage) throw error(403, 'Only the host or co-host can invite guests');

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

		const trip = await prisma.trip.findUnique({
			where: { id: tripId },
			select: { name: true, checkInDate: true, checkOutDate: true, location: true, locationCity: true }
		});

		if (existingUser) {
			if (trip) {
				await notifyExistingUserOfInvite({
					inviteId: invite.id,
					tripId,
					tripName: trip.name,
					recipientUserId: existingUser.id
				});
			}
		} else if (trip) {
			const { sendHtmlEmail } = await import('$lib/server/email/resend.js');
			const { TEMPLATE_KEYS } = await import('$lib/server/email/templates.js');
			const { renderTripInviteHtml } = await import('$lib/server/email/render/trip-invite.js');
			const baseUrl = process.env.APP_BASE_URL || 'http://localhost:5173';
			const inviteUrl = `${baseUrl}/invite/${token}`;
			const hostName = user.name || user.email;
			const checkIn = trip.checkInDate
				? new Date(trip.checkInDate).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
				: '';
			const checkOut = trip.checkOutDate
				? new Date(trip.checkOutDate).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
				: '';
			const destination = trip.locationCity?.trim() || trip.location?.trim() || '';
			const html = renderTripInviteHtml({ hostName, tripName: trip.name, checkIn, checkOut, inviteUrl, destination });
			const sendResult = await sendHtmlEmail({
				to: email,
				subject: `${hostName} invited you to ${trip.name}`,
				html,
				templateKey: TEMPLATE_KEYS.TRIP_INVITE,
				tags: [{ name: 'category', value: 'trip-invite' }]
			});
			if (!sendResult.success) {
				const err = sendResult.error ?? '';
				const testingMode =
					/testing emails|only send testing|verify a domain/i.test(err) ||
					err.includes('your own email address');
				const createInviteEmailWarning = testingMode
					? 'Invite was saved, but Resend did not deliver the email. In testing mode you can only send to your own verified address until you add and verify a domain at resend.com/domains and set RESEND_FROM_EMAIL to an address on that domain. Share your trip link from the Guests page, or invite again after DNS is verified.'
					: `Invite was saved, but the email could not be sent: ${err.slice(0, 280)}${err.length > 280 ? '…' : ''}`;
				return { createInviteSuccess: true, createInviteEmailWarning };
			}
		}

		return { createInviteSuccess: true };
	},

	inviteFriend: async ({ request, params, cookies }) => {
		const user = await getSessionUser(cookies);
		if (!user) throw redirect(303, '/login');
		const tripId = params.tripId;
		const canManage = await isTripHostOrCoHost(tripId, user.id);
		if (!canManage) throw error(403, 'Only the host or co-host can invite guests');
		const formData = await request.formData();
		const friendUserId = (formData.get('friendUserId') as string)?.trim() ?? '';
		if (!friendUserId) return { inviteFriendError: 'Missing friend' };
		const friend = await prisma.user.findUnique({
			where: { id: friendUserId },
			select: { id: true, email: true }
		});
		if (!friend) return { inviteFriendError: 'User not found' };
		const alreadyMember = await prisma.tripMember.findUnique({
			where: { tripId_userId: { tripId, userId: friendUserId } }
		});
		if (alreadyMember) return { inviteFriendError: 'This person is already a guest.' };
		const existingPending = await prisma.invite.findFirst({
			where: {
				tripId,
				recipientUserId: friendUserId,
				status: { in: PENDING_INVITE_STATUSES }
			}
		});
		if (existingPending) return { inviteFriendError: 'A pending invite has already been sent to this person.' };
		const token = crypto.randomUUID();
		const invite = await prisma.invite.create({
			data: {
				tripId,
				token,
				invitedByUserId: user.id,
				channel: 'email',
				recipientEmail: friend.email,
				recipientPhone: null,
				recipientUserId: friendUserId,
				expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
			}
		});
		const trip = await prisma.trip.findUnique({
			where: { id: tripId },
			select: { name: true }
		});
		if (trip) {
			await notifyExistingUserOfInvite({
				inviteId: invite.id,
				tripId,
				tripName: trip.name,
				recipientUserId: friendUserId
			});
		}
		return { inviteFriendSuccess: true };
	},

	removeGuest: async ({ request, params, cookies }) => {
		const user = await getSessionUser(cookies);
		if (!user) throw redirect(303, '/login');
		const tripId = params.tripId;
		const canManage = await isTripHostOrCoHost(tripId, user.id);
		if (!canManage) throw error(403, 'Only the host or co-host can remove guests');

		const formData = await request.formData();
		const userId = (formData.get('userId') as string)?.trim();
		if (!userId) return { removeGuestError: 'Missing user' };

		const target = await prisma.tripMember.findUnique({
			where: { tripId_userId: { tripId, userId } }
		});
		if (!target) return { removeGuestError: 'Guest not found' };
		if (target.role === 'host') return { removeGuestError: 'Cannot remove the trip host' };

		await prisma.tripMember.update({
			where: { tripId_userId: { tripId, userId } },
			data: { inviteStatus: 'denied' }
		});

		// If the removed user had RSVP yes, a spot just opened
		const removedRsvp = await prisma.rSVP.findUnique({
			where: { tripId_userId: { tripId, userId } },
			select: { status: true }
		});
		if (removedRsvp?.status === 'yes') {
			await handleSpotOpened(tripId).catch(console.error);
		}
		// If they were waitlisted, remove from queue so positions stay clean
		if (removedRsvp?.status === 'waitlisted') {
			await prisma.rSVP.update({
				where: { tripId_userId: { tripId, userId } },
				data: { status: 'no', waitlistPosition: null, claimWindowExpiresAt: null }
			});
		}

		// Notify the removed guest (fire-and-forget; trip name fetched inside)
		const tripForEmail = await prisma.trip.findUnique({
			where: { id: tripId },
			select: { name: true }
		});
		if (tripForEmail) sendRemovedFromTripEmail(tripId, userId, tripForEmail.name);

		return { removeGuestSuccess: true };
	},

	/** Deletes a pending trip invite row only (sent/opened). Does not delete any User account. */
	deletePendingInvite: async ({ request, params, cookies }) => {
		const user = await getSessionUser(cookies);
		if (!user) throw redirect(303, '/login');
		const tripId = params.tripId;
		const canManage = await isTripHostOrCoHost(tripId, user.id);
		if (!canManage) throw error(403, 'Only the host or co-host can manage invites');

		const formData = await request.formData();
		const inviteId = (formData.get('inviteId') as string)?.trim();
		if (!inviteId) return fail(400, { deletePendingInviteError: 'Missing invite' });

		const invite = await prisma.invite.findFirst({
			where: {
				id: inviteId,
				tripId,
				status: { in: PENDING_INVITE_STATUSES }
			}
		});
		if (!invite) {
			return fail(400, { deletePendingInviteError: 'Invite not found or already accepted' });
		}

		await prisma.invite.delete({ where: { id: inviteId } });
		return { deletePendingInviteSuccess: true };
	},

	restoreGuest: async ({ request, params, cookies }) => {
		const user = await getSessionUser(cookies);
		if (!user) throw redirect(303, '/login');
		const tripId = params.tripId;
		const canManage = await isTripHostOrCoHost(tripId, user.id);
		if (!canManage) throw error(403, 'Only the host or co-host can restore guests');

		const formData = await request.formData();
		const userId = (formData.get('userId') as string)?.trim();
		if (!userId) return { restoreGuestError: 'Missing user' };

		await prisma.tripMember.update({
			where: { tripId_userId: { tripId, userId } },
			data: { inviteStatus: 'approved' }
		});
		return { restoreGuestSuccess: true };
	},

	nudgeUnresponded: async ({ request, params, cookies }) => {
		const user = await getSessionUser(cookies);
		if (!user) throw redirect(303, '/login');
		const tripId = params.tripId;
		const host = await isTripHost(tripId, user.id);
		if (!host) throw error(403, 'Only the trip host can nudge guests');
		const formData = await request.formData();
		const targetUserId = (formData.get('userId') as string)?.trim();
		if (!targetUserId) return { nudgeUnrespondedSuccess: true };

		const trip = await prisma.trip.findUnique({ where: { id: tripId }, select: { name: true } });
		if (trip) {
			await prisma.notification.create({
				data: {
					userId: targetUserId,
					type: 'rsvp_nudge',
					title: 'RSVP Reminder',
					message: `The host is waiting for your RSVP to "${trip.name}".`,
					relatedTripId: tripId
				}
			});
		}
		return { nudgeUnrespondedSuccess: true };
	},

	nudgeAllPending: async ({ params, cookies }) => {
		const user = await getSessionUser(cookies);
		if (!user) throw redirect(303, '/login');
		const tripId = params.tripId;
		const host = await isTripHost(tripId, user.id);
		if (!host) throw error(403, 'Only the trip host can nudge guests');

		const rsvps = await prisma.rSVP.findMany({
			where: { tripId },
			select: { userId: true, status: true }
		});
		const respondedUserIds = new Set(rsvps.filter((r) => r.status === 'yes' || r.status === 'no').map((r) => r.userId));
		const members = await prisma.tripMember.findMany({
			where: { tripId, inviteStatus: 'approved' },
			select: { userId: true }
		});
		const unrespondedUserIds = members.map((m) => m.userId).filter((uid) => !respondedUserIds.has(uid) && uid !== user.id);

		if (unrespondedUserIds.length > 0) {
			const trip = await prisma.trip.findUnique({ where: { id: tripId }, select: { name: true } });
			if (trip) {
				await prisma.notification.createMany({
					data: unrespondedUserIds.map((uid) => ({
						userId: uid,
						type: 'rsvp_nudge',
						title: 'RSVP Reminder',
						message: `The host is waiting for your RSVP to "${trip.name}".`,
						relatedTripId: tripId
					}))
				});
			}
		}
		return { nudgeAllPendingSuccess: true };
	},

	updateGuestRsvp: async ({ request, params, cookies }) => {
		const user = await getSessionUser(cookies);
		if (!user) throw redirect(303, '/login');
		const tripId = params.tripId;
		const canManage = await isTripHostOrCoHost(tripId, user.id);
		if (!canManage) throw error(403, 'Only the host or co-host can update guest RSVP');

		const formData = await request.formData();
		const userId = (formData.get('userId') as string)?.trim();
		const rsvpStatusRaw = (formData.get('rsvpStatus') as string)?.trim() || '';
		const partySizeRaw = formData.get('partySize');
		const partySize = Math.min(20, Math.max(1, parseInt(String(partySizeRaw), 10) || 1));

		if (!userId) return fail(400, { updateGuestRsvpError: 'Missing user' });

		const isMember = await prisma.tripMember.findUnique({
			where: { tripId_userId: { tripId, userId } }
		});
		if (!isMember) return fail(400, { updateGuestRsvpError: 'User is not a guest on this trip' });
		if (isMember.inviteStatus !== 'approved') return fail(400, { updateGuestRsvpError: 'Cannot update RSVP for a non-approved guest' });

		if (rsvpStatusRaw === '' || rsvpStatusRaw === 'no-response') {
			await prisma.rSVP.deleteMany({ where: { tripId, userId } });
		} else if (rsvpStatusRaw === 'yes' || rsvpStatusRaw === 'no') {
			await prisma.rSVP.upsert({
				where: { tripId_userId: { tripId, userId } },
				create: {
					tripId,
					userId,
					status: rsvpStatusRaw,
					adultsCount: partySize,
					kidsCount: 0
				},
				update: {
					status: rsvpStatusRaw,
					adultsCount: partySize,
					kidsCount: 0
				}
			});
		}

		const assignment = await prisma.roomAssignment.findFirst({
			where: { tripId, userId }
		});
		if (assignment) {
			await prisma.roomAssignment.update({
				where: { id: assignment.id },
				data: { partySize }
			});
		}

		await createInvoiceForUser(tripId, userId).catch(() => {});
		await checkAndSetReconfirmRequired(tripId);
		return { updateGuestRsvpSuccess: true };
	},

	/** Assign beds to a guest (multi-select). Replaces all existing assignments. Cost is calculated from selected beds. */
	assignBeds: async ({ request, params, cookies }) => {
		const user = await getSessionUser(cookies);
		if (!user) throw redirect(303, '/login');
		const tripId = params.tripId;
		const canManage = await isTripHostOrCoHost(tripId, user.id);
		if (!canManage) throw error(403, 'Only the host or co-host can assign beds');

		const formData = await request.formData();
		const userId = (formData.get('userId') as string)?.trim();
		if (!userId) return { assignBedsSuccess: true };

		const trip = await prisma.trip.findUnique({
			where: { id: tripId },
			select: { checkInDate: true, checkOutDate: true, allowPartialStays: true }
		});
		if (!trip) return { assignBedsSuccess: true };

		const isMember = await prisma.tripMember.findUnique({
			where: { tripId_userId: { tripId, userId } }
		});
		if (!isMember || isMember.inviteStatus !== 'approved') return { assignBedsSuccess: true };

		const { startDate, endDate } = parseTripDatesFromForm(formData, trip);
		await applyBedAssignments({ tripId, userId, rawBedIds: formData.getAll('bedIds'), startDate, endDate });
		await createInvoiceForUser(tripId, userId).catch(() => {});
		return { assignBedsSuccess: true };
	},

	/** Add a guest manually (no invite link). Creates a placeholder user + TripMember so host can set room, RSVP, cost. */
	addManualGuest: async ({ request, params, cookies }) => {
		const user = await getSessionUser(cookies);
		if (!user) throw redirect(303, '/login');
		const tripId = params.tripId;
		const canManage = await isTripHostOrCoHost(tripId, user.id);
		if (!canManage) throw error(403, 'Only the host or co-host can add guests manually');

		const formData = await request.formData();
		const name = (formData.get('name') as string)?.trim() ?? '';
		const emailRaw = (formData.get('email') as string)?.trim() ?? '';
		const dietaryRestrictions = (formData.get('dietaryRestrictions') as string)?.trim() || null;
		const allergies = (formData.get('allergies') as string)?.trim() || null;

		if (!name) return fail(400, { addManualGuestError: 'Name is required' });

		let userId: string;

		if (emailRaw) {
			const existing = await prisma.user.findFirst({
				where: { email: { equals: emailRaw, mode: 'insensitive' } },
				select: { id: true }
			});
			if (existing) {
				const alreadyMember = await prisma.tripMember.findUnique({
					where: { tripId_userId: { tripId, userId: existing.id } }
				});
				if (alreadyMember) return fail(400, { addManualGuestError: 'This person is already a guest' });
				userId = existing.id;
			await prisma.tripMember.create({
				data: { tripId, userId: existing.id, role: 'guest', inviteStatus: 'approved' }
			});
		} else {
			const passwordHash = await hashPassword(crypto.randomUUID());
			const newUser = await prisma.user.create({
				data: {
					email: emailRaw.toLowerCase(),
					passwordHash,
					name: name || null
				}
			});
			userId = newUser.id;
			await prisma.tripMember.create({
				data: { tripId, userId: newUser.id, role: 'guest', inviteStatus: 'approved' }
			});
		}
	} else {
		const placeholderEmail = `manual-${crypto.randomUUID()}@guest.placeholder`;
		const passwordHash = await hashPassword(crypto.randomUUID());
		const newUser = await prisma.user.create({
			data: {
				email: placeholderEmail,
				passwordHash,
				name: name || null
			}
		});
		userId = newUser.id;
		await prisma.tripMember.create({
			data: { tripId, userId: newUser.id, role: 'guest', inviteStatus: 'approved' }
		});
		}

		// Save dietary info to GuestProfile if provided
		if (dietaryRestrictions || allergies) {
			await prisma.guestProfile.upsert({
				where: { tripId_userId: { tripId, userId } },
				create: { tripId, userId, dietaryRestrictions, allergies },
				update: { dietaryRestrictions, allergies }
			});
		}

		return { addManualGuestSuccess: true };
	},
	exportLegacyBookings: async ({ params, cookies }) => {
		const user = await getSessionUser(cookies);
		if (!user) return fail(401, { message: 'Not logged in' });
		const canManage = await isTripHostOrCoHost(params.tripId, user.id);
		if (!canManage) return fail(403, { message: 'Only host or co-host can export' });
		const trip = await prisma.trip.findUnique({
			where: { id: params.tripId },
			include: {
				reservations: {
					include: { room: true, bed: true },
					orderBy: { submittedAt: 'asc' }
				}
			}
		});
		if (!trip) return fail(404, { message: 'Trip not found' });
		const headers = ['Name', 'Email', 'Room', 'Bed', 'Check-in', 'Check-out', 'Nights', 'Guests', 'Total Price'];
		const rows = trip.reservations.map((r) => [
			r.name,
			r.email,
			r.room?.name ?? '',
			r.bed?.bedType ?? 'N/A',
			new Date(r.checkInDate).toLocaleDateString(),
			new Date(r.checkOutDate).toLocaleDateString(),
			r.nights.toString(),
			r.numberOfGuests.toString(),
			r.calculatedPrice.toFixed(2)
		]);
		const csv = [headers.join(','), ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))].join('\n');
		const filename = `${trip.name.replace(/[^a-z0-9]/gi, '_')}_legacy_bookings.csv`;
		return { exportLegacyCsv: csv, exportLegacyFilename: filename };
	},
	markInvoicePaid: async ({ params, cookies, request }) => {
		const user = await getSessionUser(cookies);
		if (!user) return fail(401, { message: 'Not logged in' });
		const canManage = await isTripHostOrCoHost(params.tripId, user.id);
		if (!canManage) return fail(403, { message: 'Only host or co-host can mark invoices as paid' });
		const formData = await request.formData();
		const targetUserId = (formData.get('userId') as string)?.trim();
		if (!targetUserId) return fail(400, { message: 'Missing user' });
		await prisma.invoice.updateMany({
			where: { tripId: params.tripId, userId: targetUserId, status: 'due' },
			data: { status: 'paid', updatedAt: new Date() }
		});
		return { markInvoicePaidSuccess: true };
	},
	markInvoiceUnpaid: async ({ params, cookies, request }) => {
		const user = await getSessionUser(cookies);
		if (!user) return fail(401, { message: 'Not logged in' });
		const canManage = await isTripHostOrCoHost(params.tripId, user.id);
		if (!canManage) return fail(403, { message: 'Only host or co-host can update payment status' });
		const formData = await request.formData();
		const targetUserId = (formData.get('userId') as string)?.trim();
		if (!targetUserId) return fail(400, { message: 'Missing user' });
		await prisma.invoice.updateMany({
			where: { tripId: params.tripId, userId: targetUserId, status: 'paid' },
			data: { status: 'due', updatedAt: new Date() }
		});
		return { markInvoiceUnpaidSuccess: true };
	},
	updatePriceApproved: async ({ params, cookies, request }) => {
		const user = await getSessionUser(cookies);
		if (!user) return fail(401, { message: 'Not logged in' });
		const canManage = await isTripHostOrCoHost(params.tripId, user.id);
		if (!canManage) return fail(403, { message: 'Only host or co-host can update price approval' });
		const formData = await request.formData();
		const targetUserId = (formData.get('userId') as string)?.trim();
		const approvedRaw = formData.get('approved');
		if (!targetUserId) return fail(400, { message: 'Missing user' });
		const approved = approvedRaw === 'true' ? true : approvedRaw === 'false' ? false : null;
		await prisma.rSVP.updateMany({
			where: { tripId: params.tripId, userId: targetUserId },
			data: { priceApprovedByHost: approved }
		});
		return { updatePriceApprovedSuccess: true };
	},
	/** Combined update for Edit modal: RSVP, beds, price approval, paid status */
	updateGuestDetails: async ({ params, cookies, request }) => {
		const user = await getSessionUser(cookies);
		if (!user) return fail(401, { message: 'Not logged in' });
		const canManage = await isTripHostOrCoHost(params.tripId, user.id);
		if (!canManage) return fail(403, { message: 'Only host or co-host can edit guests' });
		const formData = await request.formData();
		const targetUserId = (formData.get('userId') as string)?.trim();
		if (!targetUserId) return fail(400, { message: 'Missing user' });

		const tripId = params.tripId;
		const rsvpStatusRaw = (formData.get('rsvpStatus') as string)?.trim() || 'yes';
		const partySize = Math.min(20, Math.max(1, parseInt(String(formData.get('partySize')), 10) || 1));
		const bedIds = formData.getAll('bedIds');
		const priceApproved = formData.get('priceApproved') === 'true';
		const invoicePaid = formData.get('invoicePaid') === 'true';

		// Update RSVP
		if (rsvpStatusRaw === 'no-response' || rsvpStatusRaw === '') {
			await prisma.rSVP.deleteMany({ where: { tripId, userId: targetUserId } });
		} else {
			await prisma.rSVP.upsert({
				where: { tripId_userId: { tripId, userId: targetUserId } },
				create: {
					tripId,
					userId: targetUserId,
					status: rsvpStatusRaw,
					adultsCount: partySize
				},
				update: { status: rsvpStatusRaw, adultsCount: partySize }
			});
		}

		const assignment = await prisma.roomAssignment.findFirst({
			where: { tripId, userId: targetUserId }
		});
		if (assignment) {
			await prisma.roomAssignment.update({
				where: { id: assignment.id },
				data: { partySize }
			});
		}

		// Update price approved
		await prisma.rSVP.updateMany({
			where: { tripId, userId: targetUserId },
			data: { priceApprovedByHost: priceApproved }
		});

		// Assign beds
		const trip = await prisma.trip.findUnique({
			where: { id: tripId },
			select: { checkInDate: true, checkOutDate: true, allowPartialStays: true }
		});
		if (trip) {
			const { startDate, endDate } = parseTripDatesFromForm(formData, trip);
			await applyBedAssignments({
				tripId,
				userId: targetUserId,
				rawBedIds: bedIds,
				startDate,
				endDate
			});
		}

		// Invoice paid status
		if (invoicePaid) {
			await prisma.invoice.updateMany({
				where: { tripId, userId: targetUserId, status: 'due' },
				data: { status: 'paid', updatedAt: new Date() }
			});
		} else {
			await prisma.invoice.updateMany({
				where: { tripId, userId: targetUserId, status: 'paid' },
				data: { status: 'due', updatedAt: new Date() }
			});
		}

		await createInvoiceForUser(tripId, targetUserId).catch(() => {});
		await checkAndSetReconfirmRequired(tripId, { guestId: targetUserId });
		return { updateGuestDetailsSuccess: true };
	},

	/**
	 * Promote a guest to co-host, or demote a co-host back to guest.
	 * Only the trip host can call this (not co-hosts).
	 */
	updateMemberRole: async ({ request, params, cookies }) => {
		const user = await getSessionUser(cookies);
		if (!user) return fail(401, { message: 'Not logged in' });

		const tripId = params.tripId;
		const isHost = await isTripHost(tripId, user.id);
		if (!isHost) return fail(403, { message: 'Only the trip host can change member roles' });

		const formData = await request.formData();
		const targetUserId = (formData.get('userId') as string)?.trim();
		const newRole = (formData.get('role') as string)?.trim();

		if (!targetUserId) return fail(400, { message: 'Missing user' });
		if (newRole !== 'guest' && newRole !== 'co-host') {
			return fail(400, { message: 'Role must be "guest" or "co-host"' });
		}

		const target = await prisma.tripMember.findUnique({
			where: { tripId_userId: { tripId, userId: targetUserId } }
		});
		if (!target) return fail(404, { message: 'Member not found' });
		if (target.role === 'host') return fail(400, { message: 'Cannot change the host\'s role' });
		if (target.userId === user.id) return fail(400, { message: 'Cannot change your own role' });

		await prisma.tripMember.update({
			where: { tripId_userId: { tripId, userId: targetUserId } },
			data: { role: newRole }
		});

		// Welcome email when promoting to co-host
		if (newRole === 'co-host' && target.role !== 'co-host') {
			sendWelcomeCoHostEmail(tripId, targetUserId, user.name ?? 'The host');
		}

		return { updateMemberRoleSuccess: true };
	}
};
