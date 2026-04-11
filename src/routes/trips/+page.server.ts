import { redirect, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { getSessionUser } from '$lib/server/session.js';
import { getUserTrips, isTripHost } from '$lib/server/trip-access.js';
import { prisma } from '$lib/server/prisma.js';
import { sendTripCanceledEmails } from '$lib/server/notification-service.js';

export const load: PageServerLoad = async ({ cookies }) => {
	const user = await getSessionUser(cookies);
	
	if (!user) {
		throw redirect(303, '/login?redirect=/trips');
	}

	try {
		const [tripsResult, pendingInvites] = await Promise.all([
			getUserTrips(user.id),
			prisma.invite.findMany({
				where: { recipientUserId: user.id, status: 'sent' },
				include: { trip: { select: { name: true, id: true } } }
			})
		]);

		const { ownedTrips, invitedTrips, allTrips } = tripsResult;

		return {
			user,
			ownedTrips,
			invitedTrips,
			allTrips,
			pendingInvites
		};
	} catch (error) {
		console.error('Error loading trips:', error);
		return {
			user,
			ownedTrips: [],
			invitedTrips: [],
			allTrips: [],
			pendingInvites: []
		};
	}
};

export const actions: Actions = {
	deleteTrip: async ({ request, cookies }) => {
		const user = await getSessionUser(cookies);
		if (!user) {
			return fail(401, { message: 'You must be logged in to delete a trip.' });
		}

		const formData = await request.formData();
		const tripId = formData.get('tripId');
		if (typeof tripId !== 'string' || !tripId) {
			return fail(400, { message: 'Missing trip ID.' });
		}

		const isHost = await isTripHost(tripId, user.id);
		if (!isHost) {
			return fail(403, { message: 'You can only delete trips you host.' });
		}

		try {
			// Notify members before deletion so we can still query the trip and member list
			await sendTripCanceledEmails(tripId);
			await prisma.trip.delete({ where: { id: tripId } });
			return { success: true };
		} catch (error) {
			console.error('Error deleting trip:', error);
			return fail(500, { message: 'Failed to delete trip. Please try again.' });
		}
	}
};
