import { fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { getSessionUser } from '$lib/server/session.js';
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
		const formData = await request.formData();
		const bedId = (formData.get('bedId') as string)?.trim();
		if (!bedId) return fail(400, { message: 'Missing bed' });
		const tripId = params.tripId ?? '';
		const assignment = await prisma.roomAssignment.findFirst({
			where: { tripId, bedId },
			include: { user: { select: { id: true, name: true } } }
		});
		if (!assignment) return fail(400, { message: 'No one is assigned to this bed' });
		if (assignment.userId === user.id) return fail(400, { message: "You're already in this bed" });
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
	}
};
