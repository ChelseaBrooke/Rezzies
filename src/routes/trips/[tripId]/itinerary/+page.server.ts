import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { getSessionUser } from '$lib/server/session.js';
import { isTripMember, isTripHost } from '$lib/server/trip-access.js';
import { prisma } from '$lib/server/prisma.js';

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'] as const;

export const load: PageServerLoad = async ({ params, cookies, parent }) => {
	const user = await getSessionUser(cookies);
	
	if (!user) {
		throw redirect(303, `/login?redirect=/trips/${params.tripId}/itinerary`);
	}

	const tripId = params.tripId;
	const parentData = await parent();

	// Check if user is a member
	const member = await isTripMember(tripId, user.id);
	if (!member) {
		throw error(403, 'You do not have access to this trip');
	}

	// Get trip with itinerary and meals data
	const trip = await prisma.trip.findUnique({
		where: { id: tripId },
		include: {
			mealPlan: true,
			members: {
				include: {
					user: {
						select: {
							id: true,
							name: true,
							email: true
						}
					}
				}
			},
			rsvps: {
				include: {
					user: {
						select: {
							id: true,
							name: true
						}
					}
				}
			},
			mealSlots: {
				include: {
					assignedUser: {
						select: {
							id: true,
							name: true
						}
					}
				},
				orderBy: [{ date: 'asc' }, { mealType: 'asc' }]
			},
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

	const members =
		trip.members?.map((m) => ({
			id: m.user?.id,
			name: m.user?.name ?? m.user?.email ?? 'Unknown',
			email: m.user?.email
		})) ?? [];

	// Group events by date
	const eventsByDate: Record<string, any[]> = {};

	// Add arrivals/departures from RSVPs
	trip.rsvps.forEach(rsvp => {
		if (rsvp.arrivalDatetime) {
			const date = rsvp.arrivalDatetime.toISOString().split('T')[0];
			if (!eventsByDate[date]) eventsByDate[date] = [];
			eventsByDate[date].push({
				type: 'arrival',
				user: rsvp.user,
				time: rsvp.arrivalDatetime
			});
		}
		if (rsvp.departureDatetime) {
			const date = rsvp.departureDatetime.toISOString().split('T')[0];
			if (!eventsByDate[date]) eventsByDate[date] = [];
			eventsByDate[date].push({
				type: 'departure',
				user: rsvp.user,
				time: rsvp.departureDatetime
			});
		}
	});

	// Add meal slots
	trip.mealSlots.forEach(slot => {
		const date = slot.date.toISOString().split('T')[0];
		if (!eventsByDate[date]) eventsByDate[date] = [];
		eventsByDate[date].push({
			type: 'meal',
			slotId: slot.id,
			mealType: slot.mealType,
			time: slot.time,
			assignedUser: slot.assignedUser,
			menuText: slot.menuText,
			notes: slot.notes
		});
	});

	// Add activities
	trip.activities.forEach(activity => {
		const date = activity.date.toISOString().split('T')[0];
		if (!eventsByDate[date]) eventsByDate[date] = [];
		eventsByDate[date].push({
			type: 'activity',
			activityId: activity.id,
			title: activity.title,
			time: activity.time,
			location: activity.location,
			participants: activity.participants.map((p) => p.user),
			pricePerPerson: activity.pricePerPerson
		});
	});

	// Sort events within each date
	const toSortKey = (ev: { time?: string | Date | null; type: string }) => {
		if (ev.time instanceof Date) return ev.time.getTime();
		if (typeof ev.time === 'string' && /^\d{1,2}:\d{2}/.test(ev.time)) return new Date(`1970-01-01T${ev.time}`).getTime();
		return 0;
	};
	Object.keys(eventsByDate).forEach((date) => {
		eventsByDate[date].sort((a, b) => {
			const diff = toSortKey(a) - toSortKey(b);
			if (diff !== 0) return diff;
			const order: Record<string, number> = { arrival: 0, meal: 1, activity: 2, departure: 3 };
			return (order[a.type] ?? 4) - (order[b.type] ?? 4);
		});
	});

	// Trip days only (check-in through check-out)
	const tripDays: string[] = [];
	if (trip.checkInDate && trip.checkOutDate) {
		const start = new Date(trip.checkInDate);
		const end = new Date(trip.checkOutDate);
		for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
			tripDays.push(d.toISOString().split('T')[0]);
		}
	}

	// People who RSVP'd yes (for drag-to-assign)
	const goingUsers =
		trip.rsvps
			?.filter((r) => r.status === 'yes')
			.map((r) => ({
				id: r.user?.id,
				name: r.user?.name ?? 'Guest'
			}))
			.filter((u) => u.id) ?? [];

	return {
		user,
		trip,
		eventsByDate,
		tripDays,
		goingUsers,
		mealPlan: trip.mealPlan ?? null,
		mealSlots: trip.mealSlots,
		members: members.filter((m) => m.id),
		isHost: parentData.isHost ?? false
	};
};

export const actions: Actions = {
	setMealPlanEnabled: async ({ request, params, cookies }) => {
		const user = await getSessionUser(cookies);
		if (!user) throw redirect(303, '/login');
		const tripId = params.tripId;
		const host = await isTripHost(tripId, user.id);
		if (!host) return { setMealPlanError: 'Only the host can change meal planning.' };
		const formData = await request.formData();
		const enabled = formData.get('enabled') === 'true';
		await prisma.mealPlan.upsert({
			where: { tripId },
			create: { tripId, enabled, mode: 'slots' },
			update: { enabled }
		});
		return { setMealPlanSuccess: true };
	},

	createMealSlot: async ({ request, params, cookies }) => {
		const user = await getSessionUser(cookies);
		if (!user) throw redirect(303, '/login');
		const tripId = params.tripId;
		const host = await isTripHost(tripId, user.id);
		if (!host) return { createMealSlotError: 'Only the host can add meal slots.' };
		const formData = await request.formData();
		const mealType = (formData.get('mealType') as string) || 'dinner';
		const dateStr = formData.get('date') as string;
		if (!dateStr) return { createMealSlotError: 'Date is required.' };
		const date = new Date(dateStr);
		const time = (formData.get('time') as string)?.trim() || null;
		const menuText = (formData.get('menuText') as string)?.trim() || null;
		const notes = (formData.get('notes') as string)?.trim() || null;
		if (!MEAL_TYPES.includes(mealType as (typeof MEAL_TYPES)[number])) {
			return { createMealSlotError: 'Invalid meal type.' };
		}
		await prisma.mealSlot.create({
			data: { tripId, mealType, date, time, menuText, notes }
		});
		return { createMealSlotSuccess: true };
	},

	updateMealSlot: async ({ request, params, cookies }) => {
		const user = await getSessionUser(cookies);
		if (!user) throw redirect(303, '/login');
		const tripId = params.tripId;
		const formData = await request.formData();
		const slotId = formData.get('slotId') as string;
		if (!slotId) return { updateMealSlotError: 'Slot ID required.' };
		const slot = await prisma.mealSlot.findFirst({ where: { id: slotId, tripId } });
		if (!slot) return { updateMealSlotError: 'Slot not found.' };
		const isHost = await isTripHost(tripId, user.id);
		const mealType = (formData.get('mealType') as string) || slot.mealType;
		const dateStr = formData.get('date') as string;
		const time = (formData.get('time') as string)?.trim() || null;
		const menuText = (formData.get('menuText') as string)?.trim() || null;
		const notes = (formData.get('notes') as string)?.trim() || null;
		const assignedUserId = formData.get('assignedUserId') as string | null;
		const data: Record<string, unknown> = {};
		if (isHost) {
			if (dateStr) data.date = new Date(dateStr);
			data.mealType = MEAL_TYPES.includes(mealType as (typeof MEAL_TYPES)[number]) ? mealType : slot.mealType;
			data.time = time;
			data.menuText = menuText;
			data.notes = notes;
		}
		if (assignedUserId !== undefined) {
			data.assignedUserId = assignedUserId === '' ? null : assignedUserId;
		}
		await prisma.mealSlot.update({
			where: { id: slotId },
			data: data as Parameters<typeof prisma.mealSlot.update>[0]['data']
		});
		return { updateMealSlotSuccess: true };
	},

	deleteMealSlot: async ({ request, params, cookies }) => {
		const user = await getSessionUser(cookies);
		if (!user) throw redirect(303, '/login');
		const tripId = params.tripId;
		const host = await isTripHost(tripId, user.id);
		if (!host) return { deleteMealSlotError: 'Only the host can remove meal slots.' };
		const formData = await request.formData();
		const slotId = formData.get('slotId') as string;
		if (!slotId) return { deleteMealSlotError: 'Slot ID required.' };
		await prisma.mealSlot.deleteMany({ where: { id: slotId, tripId } });
		return { deleteMealSlotSuccess: true };
	},

	generateSlots: async ({ params, cookies }) => {
		const user = await getSessionUser(cookies);
		if (!user) throw redirect(303, '/login');
		const tripId = params.tripId;
		const host = await isTripHost(tripId, user.id);
		if (!host) return { generateSlotsError: 'Only the host can generate slots.' };
		const trip = await prisma.trip.findUnique({
			where: { id: tripId },
			select: { checkInDate: true, checkOutDate: true }
		});
		if (!trip?.checkInDate || !trip?.checkOutDate) {
			return { generateSlotsError: 'Trip dates are required.' };
		}
		const start = new Date(trip.checkInDate);
		const end = new Date(trip.checkOutDate);
		const toCreate: { tripId: string; mealType: string; date: Date }[] = [];
		for (let d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
			for (const mealType of ['breakfast', 'lunch', 'dinner'] as const) {
				toCreate.push({
					tripId,
					mealType,
					date: new Date(d)
				});
			}
		}
		await prisma.mealSlot.createMany({ data: toCreate });
		return { generateSlotsSuccess: true };
	},

	assignMealMaker: async ({ request, params, cookies }) => {
		const user = await getSessionUser(cookies);
		if (!user) throw redirect(303, '/login');
		const tripId = params.tripId;
		const formData = await request.formData();
		const slotId = formData.get('slotId') as string;
		const assignedUserId = (formData.get('assignedUserId') as string) || null;
		if (!slotId) return { assignMealMakerError: 'Slot ID required.' };
		const slot = await prisma.mealSlot.findFirst({ where: { id: slotId, tripId } });
		if (!slot) return { assignMealMakerError: 'Slot not found.' };
		await prisma.mealSlot.update({
			where: { id: slotId },
			data: { assignedUserId: assignedUserId || null }
		});
		return { assignMealMakerSuccess: true };
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

	moveMealSlot: async ({ request, params, cookies }) => {
		const user = await getSessionUser(cookies);
		if (!user) throw redirect(303, '/login');
		const tripId = params.tripId;
		const host = await isTripHost(tripId, user.id);
		if (!host) return { moveMealSlotError: 'Only host can move meal slots.' };
		const formData = await request.formData();
		const slotId = formData.get('slotId') as string;
		const dateStr = formData.get('date') as string;
		const time = (formData.get('time') as string)?.trim() || null;
		if (!slotId || !dateStr) return { moveMealSlotError: 'Slot and date required.' };
		const slot = await prisma.mealSlot.findFirst({ where: { id: slotId, tripId } });
		if (!slot) return { moveMealSlotError: 'Slot not found.' };
		await prisma.mealSlot.update({
			where: { id: slotId },
			data: { date: new Date(dateStr), time }
		});
		return { moveMealSlotSuccess: true };
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
