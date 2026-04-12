import { fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { getSessionUser } from '$lib/server/session.js';
import { isTripMember } from '$lib/server/trip-access.js';
import { prisma } from '$lib/server/prisma.js';
import { calculatePricingDisplay } from '$lib/server/pricing-display.js';

export const load: PageServerLoad = async ({ parent, params }) => {
	const parentData = await parent();
	const tripId = params.tripId ?? '';
	const rooms = parentData.trip?.rooms ?? [];

	const [roomAssignments, pricing] = await Promise.all([
		prisma.roomAssignment.findMany({
			where: { tripId },
			include: {
				user: { select: { id: true, name: true, avatarUrl: true } },
				room: { select: { id: true, name: true } }
			}
		}),
		calculatePricingDisplay(tripId).catch(() => ({ roomPricing: [], perPersonPrice: undefined, perPersonPerNightPrice: undefined }))
	]);

	return {
		trip: parentData.trip,
		rooms,
		roomAssignments,
		roomPricing: pricing.roomPricing ?? [],
		isHost: parentData.isHost ?? false,
		currentUserId: parentData.user?.id ?? null
	};
};

export const actions: Actions = {
	/** Request to share a bed; notifies the current occupant to approve. */
	requestBedShare: async ({ params, cookies, request }) => {
		const user = await getSessionUser(cookies);
		if (!user) return fail(401, { message: 'Not logged in' });
		const tripId = params.tripId ?? '';
		const member = await isTripMember(tripId, user.id);
		if (!member) return fail(403, { message: 'Not a trip member' });
		const formData = await request.formData();
		const bedId = (formData.get('bedId') as string)?.trim();
		if (!bedId) return fail(400, { message: 'Missing bed' });
		const assignment = await prisma.roomAssignment.findFirst({
			where: { tripId, bedId },
			include: { user: { select: { id: true, name: true } } }
		});
		if (!assignment) return fail(400, { message: 'No one is assigned to this bed' });
		if (assignment.userId === user.id) return fail(400, { message: "You're already in this bed" });

		// Prevent duplicate requests for the same bed
		const existing = await prisma.notification.findFirst({
			where: {
				userId: assignment.userId,
				type: 'bed_share_request',
				relatedTripId: tripId,
				relatedEntityId: bedId,
				// Only block if the same requester already sent one (message contains their name)
				message: { contains: user.name?.trim() || user.id }
			}
		});
		if (existing) return fail(400, { message: 'You already sent a request for this bed' });

		const requesterName = user.name?.trim() || 'Someone';
		await prisma.notification.create({
			data: {
				userId: assignment.userId,
				type: 'bed_share_request',
				title: 'Bed share request',
				message: `${requesterName} would like to share this bed with you. Approve or decline in your notifications.`,
				relatedTripId: tripId,
				relatedEntityId: bedId
			}
		});
		return { requestBedShareSuccess: true };
	},

	/** Claim an empty/open bed for the current user. */
	claimBed: async ({ params, cookies, request }) => {
		const user = await getSessionUser(cookies);
		if (!user) return fail(401, { message: 'Not logged in' });
		const tripId = params.tripId ?? '';
		const member = await isTripMember(tripId, user.id);
		if (!member) return fail(403, { message: 'Not a trip member' });
		const formData = await request.formData();
		const bedId = (formData.get('bedId') as string)?.trim();
		if (!bedId) return fail(400, { message: 'Missing bed' });
		const bed = await prisma.bed.findUnique({
			where: { id: bedId },
			include: { room: { select: { id: true, tripId: true } } }
		});
		if (!bed || bed.room.tripId !== tripId) return fail(400, { message: 'Bed not found' });
		// Check if already claimed
		const taken = await prisma.roomAssignment.findFirst({ where: { tripId, bedId } });
		if (taken) return fail(400, { message: 'This bed is already taken' });
		// Check if user already has a bed on this trip
		const userBed = await prisma.roomAssignment.findFirst({ where: { tripId, userId: user.id } });
		if (userBed) return fail(400, { message: 'You already have a bed on this trip' });
		await prisma.roomAssignment.create({
			data: { tripId, roomId: bed.room.id, userId: user.id, bedId }
		});
		return { claimBedSuccess: true };
	}
};
