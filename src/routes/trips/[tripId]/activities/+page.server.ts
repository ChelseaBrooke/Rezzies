import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { getSessionUser } from '$lib/server/session.js';
import { isTripMember, isTripHost } from '$lib/server/trip-access.js';
import { prisma } from '$lib/server/prisma.js';

export const load: PageServerLoad = async ({ params, cookies, parent }) => {
	const user = await getSessionUser(cookies);

	if (!user) {
		throw redirect(303, `/login?redirect=/trips/${params.tripId}/activities`);
	}

	const tripId = params.tripId;
	const parentData = await parent();

	const member = await isTripMember(tripId, user.id);
	if (!member) {
		throw error(403, 'You do not have access to this trip');
	}

	const trip = await prisma.trip.findUnique({
		where: { id: tripId },
		include: {
			activities: {
				include: {
					participants: {
						include: {
							user: {
								select: {
									id: true,
									name: true
								}
							}
						}
					}
				},
				orderBy: {
					date: 'asc'
				}
			}
		}
	});

	if (!trip) {
		throw error(404, 'Trip not found');
	}

	return {
		user,
		trip,
		activities: trip.activities,
		isHost: parentData.isHost ?? false
	};
};

export const actions: Actions = {
	addActivityParticipant: async ({ request, params, cookies }) => {
		const user = await getSessionUser(cookies);
		if (!user) throw redirect(303, '/login');
		const tripId = params.tripId;
		const formData = await request.formData();
		const activityId = formData.get('activityId') as string;
		const userId = formData.get('userId') as string;
		if (!activityId || !userId) return { addActivityParticipantError: 'Activity and user required.' };
		const activity = await prisma.activity.findFirst({ where: { id: activityId, tripId } });
		if (!activity) return { addActivityParticipantError: 'Activity not found.' };
		await prisma.activityParticipant.upsert({
			where: { activityId_userId: { activityId, userId } },
			create: { activityId, userId, status: 'in' },
			update: { status: 'in' }
		});
		return { addActivityParticipantSuccess: true };
	},

	removeActivityParticipant: async ({ request, params, cookies }) => {
		const user = await getSessionUser(cookies);
		if (!user) throw redirect(303, '/login');
		const tripId = params.tripId;
		const formData = await request.formData();
		const activityId = formData.get('activityId') as string;
		const userId = formData.get('userId') as string;
		if (!activityId || !userId) return { removeActivityParticipantError: 'Activity and user required.' };
		await prisma.activityParticipant.deleteMany({
			where: { activityId, userId }
		});
		return { removeActivityParticipantSuccess: true };
	},

	moveActivity: async ({ request, params, cookies }) => {
		const user = await getSessionUser(cookies);
		if (!user) throw redirect(303, '/login');
		const tripId = params.tripId;
		const host = await isTripHost(tripId, user.id);
		if (!host) return { moveActivityError: 'Only host can move activities.' };
		const formData = await request.formData();
		const activityId = formData.get('activityId') as string;
		const dateStr = formData.get('date') as string;
		const time = (formData.get('time') as string)?.trim() || null;
		if (!activityId || !dateStr) return { moveActivityError: 'Activity and date required.' };
		const activity = await prisma.activity.findFirst({ where: { id: activityId, tripId } });
		if (!activity) return { moveActivityError: 'Activity not found.' };
		await prisma.activity.update({
			where: { id: activityId },
			data: { date: new Date(dateStr), time }
		});
		return { moveActivitySuccess: true };
	}
};
