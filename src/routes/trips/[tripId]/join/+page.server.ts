import { error, fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { getSessionUser } from '$lib/server/session.js';
import { prisma } from '$lib/server/prisma.js';
import { sendGuestJoinedEmail } from '$lib/server/notification-service.js';
import { hasValidInviteForTrip } from '$lib/server/invite-access.js';

export const load: PageServerLoad = async ({ params, cookies, url }) => {
	const inviteFromQuery = url.searchParams.get('invite')?.trim() || '';
	const loginRedirect = inviteFromQuery
		? `/login?redirect=${encodeURIComponent(`/trips/${params.tripId}/join?invite=${encodeURIComponent(inviteFromQuery)}`)}`
		: `/login?redirect=/trips/${params.tripId}/join`;

	const user = await getSessionUser(cookies);

	if (!user) {
		throw redirect(303, loginRedirect);
	}

	const tripId = params.tripId;

	// One round trip for everything the page needs — this load sits on the invite funnel,
	// and these three reads don't depend on each other (they were serial before).
	const [existing, trip, approvedCount] = await Promise.all([
		prisma.tripMember.findUnique({
			where: { tripId_userId: { tripId, userId: user.id } }
		}),
		prisma.trip.findUnique({
			where: { id: tripId },
			select: {
				id: true,
				name: true,
				checkInDate: true,
				checkOutDate: true,
				isPublished: true,
				listingCoverPhoto: true,
				locationCity: true,
				inviteMode: true,
				maxCapacity: true
			}
		}),
		prisma.tripMember.count({
			where: { tripId, inviteStatus: 'approved' }
		})
	]);

	if (existing) {
		if (existing.inviteStatus === 'approved') throw redirect(303, `/trips/${tripId}`);
		if (existing.inviteStatus === 'pending') throw redirect(303, `/trips/${tripId}/pending`);
		if (existing.inviteStatus === 'denied') throw redirect(303, `/trips/${tripId}/denied`);
	}

	if (!trip) {
		throw error(404, 'Trip not found');
	}

	// A host can send invites before finishing publish (draft trip). A guest who followed a
	// valid, unexpired invite link for this exact trip should still be able to join — only
	// block truly public/unauthenticated access to an unpublished trip.
	// Deliberately left out of the batch above: it only runs on the draft-trip path, so the
	// published (common) case pays nothing for it.
	if (!trip.isPublished && !(await hasValidInviteForTrip(inviteFromQuery, tripId))) {
		throw error(404, 'Trip not found');
	}

	const maxCapacity = trip.maxCapacity ?? null;
	const isTripFull = maxCapacity !== null && approvedCount >= maxCapacity;

	return {
		trip,
		user,
		inviteToken: inviteFromQuery || null,
		approvedCount,
		maxCapacity,
		isTripFull
	};
};

export const actions: Actions = {
	join: async ({ params, cookies, request }) => {
		const user = await getSessionUser(cookies);
		if (!user) {
			throw redirect(303, `/login?redirect=/trips/${params.tripId}/join`);
		}

		const tripId = params.tripId;
		const fd = await request.formData();
		const inviteToken = (fd.get('inviteToken') as string | null)?.trim() || '';

		const trip = await prisma.trip.findUnique({
			where: { id: tripId },
			select: { id: true, isPublished: true, inviteMode: true, maxCapacity: true }
		});

		if (!trip) {
			throw error(404, 'Trip not found');
		}

		// Same draft-trip-with-a-valid-invite exception as the load above.
		if (!trip.isPublished && !(await hasValidInviteForTrip(inviteToken, tripId))) {
			throw error(404, 'Trip not found');
		}

		if (trip.maxCapacity) {
			const currentCount = await prisma.tripMember.count({
				where: { tripId, inviteStatus: 'approved' }
			});
			if (currentCount >= trip.maxCapacity) {
				return fail(409, {
					capacityFull: true,
					message:
						'This trip is currently full. Join the waitlist to be notified when a spot opens.',
					canJoinWaitlist: true
				});
			}
		}

		const status = trip.inviteMode === 'open' ? 'approved' : 'pending';

		await prisma.tripMember.upsert({
			where: { tripId_userId: { tripId, userId: user.id } },
			create: { tripId, userId: user.id, role: 'guest', inviteStatus: status },
			update: {}
		});

		if (inviteToken) {
			await prisma.invite.updateMany({
				where: { token: inviteToken, tripId },
				data: { status: 'accepted', recipientUserId: user.id }
			});
		}

		if (status === 'approved') {
			sendGuestJoinedEmail(tripId, user.id);
			throw redirect(303, `/trips/${tripId}/rsvp`);
		} else {
			throw redirect(303, `/trips/${tripId}/pending`);
		}
	}
};
