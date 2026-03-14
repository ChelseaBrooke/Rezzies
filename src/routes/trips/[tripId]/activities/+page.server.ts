import { error, fail, redirect } from '@sveltejs/kit';
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
	addDiscoveredActivity: async ({ request, params, cookies }) => {
		const user = await getSessionUser(cookies);
		if (!user) throw redirect(303, '/login');
		const tripId = params.tripId;
		const member = await isTripMember(tripId, user.id);
		if (!member) return { addDiscoveredActivityError: 'You do not have access to this trip.' };

		const formData = await request.formData();
		const title = (formData.get('title') as string)?.trim();
		if (!title) return { addDiscoveredActivityError: 'Activity name is required.' };

		const trip = await prisma.trip.findUnique({
			where: { id: tripId },
			select: { checkInDate: true, checkOutDate: true }
		});
		if (!trip?.checkInDate) return { addDiscoveredActivityError: 'Trip has no check-in date set.' };

		const location = (formData.get('location') as string)?.trim() || null;
		const notes = (formData.get('notes') as string)?.trim() || null;
		const dateStr = (formData.get('date') as string)?.trim();
		const activityDate = dateStr ? new Date(dateStr) : trip.checkInDate;
		if (isNaN(activityDate.getTime())) return { addDiscoveredActivityError: 'Invalid date.' };

		const time = (formData.get('time') as string)?.trim() || null;
		const additionType = (formData.get('additionType') as string) || 'planned';
		if (additionType === 'poll') {
			if (!dateStr || !time) return { addDiscoveredActivityError: 'Please choose a date and time for the activity so it can be added to the itinerary if the poll wins.' };
			let activitySnapshot: Record<string, unknown> | null = null;
			const snapshotStr = formData.get('activitySnapshot') as string | null;
			if (snapshotStr) {
				try {
					activitySnapshot = JSON.parse(snapshotStr) as Record<string, unknown>;
				} catch {
					// optional; ignore invalid JSON
				}
			}
			const now = new Date();
			const endAt = new Date(now.getTime() + 48 * 60 * 60 * 1000);
			try {
				await (prisma.poll.create as any)({
					data: {
						tripId,
						createdById: user.id,
						title: `Activity: ${title}`,
						description: notes || undefined,
						category: 'Activities',
						pollType: 'single',
						status: 'open',
						showResultsLive: true,
						startAt: now,
						endAt,
						activityDate: activityDate,
						activityTime: time,
						activityLocation: location || null,
						activitySnapshot: activitySnapshot ?? undefined,
						options: {
							create: [
								{ label: 'Add to itinerary', sortOrder: 0 },
								{ label: 'Skip', sortOrder: 1 }
							]
						}
					}
				});
			} catch (e) {
				console.error('Poll create error:', e);
				return fail(500, { addDiscoveredActivityError: 'Could not create poll. Please try again.' });
			}
			return { addDiscoveredActivitySuccess: true, pollCreated: true };
		}

		const status = additionType === 'tentative' ? 'tentative' : 'planned';
		const activity = await prisma.activity.create({
			data: {
				tripId,
				title,
				date: activityDate,
				time,
				location,
			notes: notes || undefined,
			status
			}
		});
		await prisma.activityParticipant.create({
			data: { activityId: activity.id, userId: user.id, status: 'in' }
		});
		return { addDiscoveredActivitySuccess: true, activityId: activity.id, pollCreated: false };
	},

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
