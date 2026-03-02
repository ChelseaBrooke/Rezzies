import { error, fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { getSessionUser } from '$lib/server/session.js';
import { isTripHost, isTripHostOrCoHost, getMemberTripState, type MemberTripState } from '$lib/server/trip-access.js';
import type { InvoiceBreakdown } from '$lib/server/invoice-calculator.js';
import { prisma } from '$lib/server/prisma.js';
import { notifyExistingUserOfInvite } from '$lib/server/invite-service.js';
import { createInvoiceForUser } from '$lib/server/invoice-calculator.js';
import { hashPassword } from '$lib/server/auth.js';
import { checkAndSetReconfirmRequired } from '$lib/server/guest-estimate.js';
import { z } from 'zod';

const PENDING_INVITE_STATUSES = ['sent', 'opened'];

export type GuestRow = {
	type: 'member' | 'invite';
	userId?: string;
	inviteId?: string;
	name: string;
	email: string;
	avatarUrl?: string | null;
	rsvpStatus: 'yes' | 'no' | null;
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
	// Fetch room assignments directly so we always get latest from DB (avoids layout merge/serialization issues)
	const roomAssignments =
		tripId ?
			await prisma.roomAssignment.findMany({
				where: { tripId },
				include: { room: { include: { beds: { select: { id: true, bedType: true } } } } }
			})
		:	[];
	const isHost = parentData.isHost ?? false;
	const canManageGuests = isHost || parentData.membership?.role === 'co-host';

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

	// Refresh invoice for every unique guest with a room assignment — run in parallel, not serially
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

	const activeMembers = members.filter((m) => m.inviteStatus !== 'removed');
	const removedMembers = members.filter((m) => m.inviteStatus === 'removed');
	const guestRows: GuestRow[] = [];

	for (const member of activeMembers) {
		const uid = member.user?.id;
		const rsvp = uid ? rsvpByUserId.get(uid) : null;
		const assignments = uid ? (assignmentsByUserId.get(uid) ?? []) : [];
		const firstAssignment = assignments[0] ?? null;
		const profile = uid ? profileByUserId.get(uid) : null;
		const status = rsvp?.status === 'yes' ? 'yes' : rsvp?.status === 'no' ? 'no' : null;
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
			toPayTotal: toPayTotal !== null && toPayTotal > 0 ? toPayTotal : null,
			priceApproved,
			priceApprovedByHost,
			invoicePaid,
			invoiceBreakdown: invoiceBreakdown ?? null,
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
					inviteCode: trip.inviteCode,
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
		legacyStats
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
			data: { inviteStatus: 'removed' }
		});
		return { removeGuestSuccess: true };
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
			data: { inviteStatus: 'accepted' }
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
			where: { tripId, inviteStatus: { in: ['invited', 'accepted'] } },
			select: { userId: true }
		});
		const _unrespondedUserIds = members.map((m) => m.userId).filter((uid) => !respondedUserIds.has(uid));
		// TODO: send nudge notification to each unresponded user
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
		if (isMember.inviteStatus === 'removed') return fail(400, { updateGuestRsvpError: 'Cannot update RSVP for a removed guest' });

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
		const bedIds = formData.getAll('bedIds');
		const partySizeRaw = formData.get('partySize');
		const partySize = Math.min(20, Math.max(1, parseInt(String(partySizeRaw), 10) || 1));
		if (!userId) return { assignBedsSuccess: true };

		const trip = await prisma.trip.findUnique({
			where: { id: tripId },
			select: { checkInDate: true, checkOutDate: true, allowPartialStays: true }
		});
		if (!trip) return { assignBedsSuccess: true };

		const isMember = await prisma.tripMember.findUnique({
			where: { tripId_userId: { tripId, userId } }
		});
		if (!isMember || isMember.inviteStatus === 'removed') return { assignBedsSuccess: true };

		let startDate: Date | null = trip.checkInDate;
		let endDate: Date | null = trip.checkOutDate;
		if (trip.allowPartialStays) {
			const startRaw = (formData.get('startDate') as string)?.trim();
			const endRaw = (formData.get('endDate') as string)?.trim();
			if (startRaw) {
				const d = new Date(startRaw);
				if (!Number.isNaN(d.getTime())) startDate = d;
			}
			if (endRaw) {
				const d = new Date(endRaw);
				if (!Number.isNaN(d.getTime())) endDate = d;
			}
		}

		await prisma.roomAssignment.deleteMany({ where: { tripId, userId } });

		const bedIdList = Array.isArray(bedIds) ? bedIds : [bedIds];
		const validBedIds = bedIdList
			.filter((id): id is string => typeof id === 'string')
			.map((id) => id.trim())
			.filter((id) => id !== '');

		for (const bedId of validBedIds) {
			const bed = await prisma.bed.findFirst({
				where: { id: bedId },
				include: { room: { select: { id: true, tripId: true } } }
			});
			if (!bed || bed.room.tripId !== tripId) continue;
			await prisma.roomAssignment.create({
				data: {
					tripId,
					userId,
					roomId: bed.roomId,
					bedId: bed.id,
					bedType: bed.bedType,
					partySize: 1,
					...(startDate && { startDate }),
					...(endDate && { endDate })
				}
			});
		}

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
					data: { tripId, userId: existing.id, role: 'guest', inviteStatus: 'accepted' }
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
					data: { tripId, userId: newUser.id, role: 'guest', inviteStatus: 'accepted' }
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
				data: { tripId, userId: newUser.id, role: 'guest', inviteStatus: 'accepted' }
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
			let startDate: Date | null = trip.checkInDate;
			let endDate: Date | null = trip.checkOutDate;
			if (trip.allowPartialStays) {
				const startRaw = (formData.get('startDate') as string)?.trim();
				const endRaw = (formData.get('endDate') as string)?.trim();
				if (startRaw) {
					const d = new Date(startRaw);
					if (!Number.isNaN(d.getTime())) startDate = d;
				}
				if (endRaw) {
					const d = new Date(endRaw);
					if (!Number.isNaN(d.getTime())) endDate = d;
				}
			}
			await prisma.roomAssignment.deleteMany({ where: { tripId, userId: targetUserId } });
			const validBedIds = (Array.isArray(bedIds) ? bedIds : [bedIds])
				.filter((id): id is string => typeof id === 'string')
				.map((id) => id.trim())
				.filter((id) => id !== '');
			for (const bedId of validBedIds) {
				const bed = await prisma.bed.findFirst({
					where: { id: bedId },
					include: { room: { select: { tripId: true } } }
				});
				if (bed && bed.room.tripId === tripId) {
					await prisma.roomAssignment.create({
						data: {
							tripId,
							userId: targetUserId,
							roomId: bed.roomId,
							bedId: bed.id,
							bedType: bed.bedType,
							partySize: 1,
							...(startDate && { startDate }),
							...(endDate && { endDate })
						}
					});
				}
			}
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
	}
};
