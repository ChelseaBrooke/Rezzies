import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { getSessionUser } from '$lib/server/session.js';
import { isTripMember, isTripHost, isTripHostOrCoHost } from '$lib/server/trip-access.js';
import { prisma } from '$lib/server/prisma.js';

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'] as const;

// Map ActivityParticipant.status storage values → display values
function toRsvpStatus(dbStatus: string): 'going' | 'skip' {
	if (dbStatus === 'in' || dbStatus === 'going') return 'going';
	return 'skip';
}

export const load: PageServerLoad = async ({ params, cookies, parent }) => {
	const user = await getSessionUser(cookies);

	if (!user) {
		throw redirect(303, `/login?redirect=/trips/${params.tripId}/itinerary`);
	}

	const tripId = params.tripId;
	const parentData = await parent();

	const member = await isTripMember(tripId, user.id);
	if (!member) {
		throw error(403, 'You do not have access to this trip');
	}

	const canManageMeals = await isTripHostOrCoHost(tripId, user.id);

	// Dietary lookup: User account fields (Basics) take priority; trip GuestProfile fills gaps only.
	const tripMembers = await prisma.tripMember.findMany({
		where: { tripId },
		select: { userId: true, user: { select: { id: true, name: true, dietaryTags: true, allergiesTags: true } } }
	});

	/** Account settings (User) win; trip GuestProfile fills gaps only */
	const dietaryByUser: Record<string, { dietaryRestrictions: string | null; allergies: string | null; name: string }> =
		{};
	for (const m of tripMembers) {
		if (!m.user) continue;
		const dt = m.user.dietaryTags?.trim() || null;
		const al = m.user.allergiesTags?.trim() || null;
		dietaryByUser[m.user.id] = {
			name: m.user.name ?? 'Guest',
			dietaryRestrictions: dt,
			allergies: al
		};
	}

	const guestProfiles = await prisma.guestProfile.findMany({
		where: { tripId },
		select: { userId: true, dietaryRestrictions: true, allergies: true }
	});
	for (const gp of guestProfiles) {
		const existing = dietaryByUser[gp.userId];
		const gpD = gp.dietaryRestrictions?.trim() || null;
		const gpA = gp.allergies?.trim() || null;
		if (!existing) {
			dietaryByUser[gp.userId] = {
				name: 'Guest',
				dietaryRestrictions: gpD,
				allergies: gpA
			};
			continue;
		}
		dietaryByUser[gp.userId] = {
			name: existing.name,
			dietaryRestrictions: existing.dietaryRestrictions || gpD,
			allergies: existing.allergies || gpA
		};
	}

	const trip = await prisma.trip.findUnique({
		where: { id: tripId },
		include: {
			mealPlan: true,
			members: {
				include: {
					user: { select: { id: true, name: true, email: true } }
				}
			},
			rsvps: {
				include: {
					user: { select: { id: true, name: true } }
				}
			},
			mealSlots: {
				include: {
					assignedUser: { select: { id: true, name: true } },
					attendance: {
						include: {
							user: { select: { id: true, name: true } }
						}
					}
				},
				orderBy: [{ date: 'asc' }, { mealType: 'asc' }]
			},
			activities: {
				include: {
					participants: {
						include: {
							user: { select: { id: true, name: true } }
						}
					}
				},
				orderBy: { date: 'asc' }
			}
		}
	});

	if (!trip) throw error(404, 'Trip not found');

	// Meals / activities / games are always-on: ensure meal plan row exists and is enabled
	let mealPlan = trip.mealPlan;
	if (!mealPlan || !mealPlan.enabled) {
		mealPlan = await prisma.mealPlan.upsert({
			where: { tripId },
			create: { tripId, enabled: true, mode: 'slots' },
			update: { enabled: true }
		});
	}

	const yesRsvpUserIdSet = new Set(
		(trip.rsvps ?? []).filter((r) => r.status === 'yes' && r.userId).map((r) => r.userId as string)
	);

	const members =
		trip.members?.map((m) => ({
			id: m.user?.id,
			name: m.user?.name ?? m.user?.email ?? 'Unknown',
			email: m.user?.email
		})) ?? [];

	type DietaryNoteRow = {
		userId: string;
		userName: string;
		dietaryRestrictions: string | null;
		allergies: string | null;
	};

	const accountGuestDietaryRows: DietaryNoteRow[] = Object.entries(dietaryByUser)
		.filter(([uid]) => yesRsvpUserIdSet.has(uid))
		.filter(([, d]) => d.dietaryRestrictions || d.allergies)
		.map(([userId, d]) => ({
			userId,
			userName: d.name,
			dietaryRestrictions: d.dietaryRestrictions,
			allergies: d.allergies
		}));

	const plusOneDietaryRows: DietaryNoteRow[] = [];
	for (const r of trip.rsvps ?? []) {
		if (r.status !== 'yes' || !r.notes?.trim()) continue;
		let parsed: { plusOneDietaryProfiles?: Array<{ name?: string | null; dietary?: string | null; allergies?: string | null }> };
		try {
			parsed = JSON.parse(r.notes) as typeof parsed;
		} catch {
			continue;
		}
		const profiles = parsed?.plusOneDietaryProfiles;
		if (!Array.isArray(profiles)) continue;
		const hostName = r.user?.name ?? 'Guest';
		profiles.forEach((p, i) => {
			const dietaryRestrictions = p.dietary?.trim() || null;
			const allergies = p.allergies?.trim() || null;
			if (!dietaryRestrictions && !allergies) return;
			const label = p.name?.trim() || `Plus-one (${hostName}'s party)`;
			plusOneDietaryRows.push({
				userId: `plusone:${r.userId}:${i}`,
				userName: label,
				dietaryRestrictions,
				allergies
			});
		});
	}

	const yesRsvpDietarySummaries: DietaryNoteRow[] = [...accountGuestDietaryRows, ...plusOneDietaryRows];

	// Group events by date
	const eventsByDate: Record<string, unknown[]> = {};

	// Arrivals/departures
	trip.rsvps.forEach((rsvp) => {
		if (rsvp.arrivalDatetime) {
			const date = rsvp.arrivalDatetime.toISOString().split('T')[0];
			if (!eventsByDate[date]) eventsByDate[date] = [];
			eventsByDate[date].push({ type: 'arrival', user: rsvp.user, time: rsvp.arrivalDatetime });
		}
		if (rsvp.departureDatetime) {
			const date = rsvp.departureDatetime.toISOString().split('T')[0];
			if (!eventsByDate[date]) eventsByDate[date] = [];
			eventsByDate[date].push({ type: 'departure', user: rsvp.user, time: rsvp.departureDatetime });
		}
	});

	// Meal slots, full attendance included
	trip.mealSlots.forEach((slot) => {
		const date = slot.date.toISOString().split('T')[0];
		if (!eventsByDate[date]) eventsByDate[date] = [];
		eventsByDate[date].push({
			type: 'meal',
			slotId: slot.id,
			mealType: slot.mealType,
			title: slot.title,
			time: slot.time,
			notes: slot.notes,
			menuText: slot.menuText,
			assignedUser: slot.assignedUser,
		// attendance: all trip members mapped to optedOut boolean
		attendance: slot.attendance.map((a) => ({
			userId: a.user.id,
			userName: a.user.name ?? 'Guest',
			optedOut: a.optedOut,
			dietaryNote: a.dietaryNote,
			dietaryRestrictions: dietaryByUser[a.user.id]?.dietaryRestrictions ?? null,
			allergies: dietaryByUser[a.user.id]?.allergies ?? null
		})),
		// currentUserOptedOut derived server-side for convenience
		currentUserOptedOut: slot.attendance.find((a) => a.userId === user.id)?.optedOut ?? false,
		// Dietary notes: RSVP yes + account or plus-one notes
		guestDietaryNotes: yesRsvpDietarySummaries
		});
	});

	// Activities, full participant RSVP included
	trip.activities.forEach((activity) => {
		const date = activity.date.toISOString().split('T')[0];
		if (!eventsByDate[date]) eventsByDate[date] = [];
		eventsByDate[date].push({
			type: 'activity',
			activityId: activity.id,
			title: activity.title,
			time: activity.time,
			location: activity.location,
			notes: activity.notes,
			status: activity.status,
			// Full participant list with display-friendly rsvpStatus
			participants: activity.participants.map((p) => ({
				id: p.user.id,
				name: p.user.name ?? 'Guest',
				rsvpStatus: toRsvpStatus(p.status)
			})),
			// Quick access to current user's RSVP
			currentUserRsvp: toRsvpStatus(
				activity.participants.find((p) => p.userId === user.id)?.status ?? 'skip'
			)
		});
	});

	// Sort events within each date
	const toSortKey = (ev: { time?: string | Date | null; type: string }) => {
		if (ev.time instanceof Date) return ev.time.getTime();
		if (typeof ev.time === 'string' && /^\d{1,2}:\d{2}/.test(ev.time))
			return new Date(`1970-01-01T${ev.time}`).getTime();
		return 0;
	};
	Object.keys(eventsByDate).forEach((date) => {
		(eventsByDate[date] as { type: string; time?: unknown }[]).sort((a, b) => {
			const diff =
				toSortKey(a as { time?: string | Date | null; type: string }) -
				toSortKey(b as { time?: string | Date | null; type: string });
			if (diff !== 0) return diff;
			const order: Record<string, number> = { arrival: 0, meal: 1, activity: 2, departure: 3 };
			return (order[a.type] ?? 4) - (order[b.type] ?? 4);
		});
	});

	// Trip days
	const tripDays: string[] = [];
	if (trip.checkInDate && trip.checkOutDate) {
		const end = new Date(trip.checkOutDate);
		for (const d = new Date(trip.checkInDate); d <= end; d.setDate(d.getDate() + 1)) {
			tripDays.push(d.toISOString().split('T')[0]);
		}
	}

	// Going users (for drag-to-assign + sidebar)
	const goingUsers =
		trip.rsvps
			?.filter((r) => r.status === 'yes')
			.map((r) => ({ id: r.user?.id, name: r.user?.name ?? 'Guest' }))
			.filter((u) => u.id) ?? [];

	return {
		user,
		trip,
		eventsByDate,
		tripDays,
		goingUsers,
		yesRsvpDietarySummaries,
		canManageMeals,
		mealPlan,
		mealSlots: trip.mealSlots,
		members: members.filter((m) => m.id),
		isHost: parentData.isHost ?? false
	};
};

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export const actions: Actions = {
	// ── RSVP ──────────────────────────────────────────────────────────────

	/** Set the current user's RSVP for an activity (going / maybe / skip). */
	setActivityRsvp: async ({ request, params, cookies }) => {
		const user = await getSessionUser(cookies);
		if (!user) throw redirect(303, '/login');
		const tripId = params.tripId;
		const member = await isTripMember(tripId, user.id);
		if (!member) return { setActivityRsvpError: 'Not a trip member.' };

		const fd = await request.formData();
		const activityId = fd.get('activityId') as string;
		const display = fd.get('status') as string; // "going" | "skip"

		if (!activityId) return { setActivityRsvpError: 'Activity ID required.' };

		const activity = await prisma.activity.findFirst({ where: { id: activityId, tripId } });
		if (!activity) return { setActivityRsvpError: 'Activity not found.' };

		// Map display value → storage value
		const dbStatus = display === 'going' ? 'in' : 'out';

		if (dbStatus === 'out') {
			// "Skip" = delete participant record so they're not counted
			await prisma.activityParticipant.deleteMany({
				where: { activityId, userId: user.id }
			});
		} else {
			await prisma.activityParticipant.upsert({
				where: { activityId_userId: { activityId, userId: user.id } },
				create: { activityId, userId: user.id, status: dbStatus },
				update: { status: dbStatus }
			});
		}
		return { setActivityRsvpSuccess: true };
	},

	/** Opt in or out of a meal slot. */
	setMealAttendance: async ({ request, params, cookies }) => {
		const user = await getSessionUser(cookies);
		if (!user) throw redirect(303, '/login');
		const tripId = params.tripId;
		const member = await isTripMember(tripId, user.id);
		if (!member) return { setMealAttendanceError: 'Not a trip member.' };

		const fd = await request.formData();
		const slotId = fd.get('slotId') as string;
		const optedOut = fd.get('optedOut') === 'true';

		if (!slotId) return { setMealAttendanceError: 'Slot ID required.' };
		const slot = await prisma.mealSlot.findFirst({ where: { id: slotId, tripId } });
		if (!slot) return { setMealAttendanceError: 'Meal slot not found.' };

		await prisma.mealSlotAttendance.upsert({
			where: { slotId_userId: { slotId, userId: user.id } },
			create: { slotId, userId: user.id, optedOut },
			update: { optedOut }
		});
		return { setMealAttendanceSuccess: true };
	},

	// ── Meal slot management ───────────────────────────────────────────────

	/** Kept for backwards compatibility; meal planning is always enabled in the product. */
	setMealPlanEnabled: async ({ params, cookies }) => {
		const user = await getSessionUser(cookies);
		if (!user) throw redirect(303, '/login');
		const tripId = params.tripId;
		const host = await isTripHost(tripId, user.id);
		if (!host) return { setMealPlanError: 'Only the host can change meal planning.' };
		await prisma.mealPlan.upsert({
			where: { tripId },
			create: { tripId, enabled: true, mode: 'slots' },
			update: { enabled: true }
		});
		return { setMealPlanSuccess: true };
	},

	createMealSlot: async ({ request, params, cookies }) => {
		const user = await getSessionUser(cookies);
		if (!user) throw redirect(303, '/login');
		const tripId = params.tripId;
		const canManage = await isTripHostOrCoHost(tripId, user.id);
		if (!canManage) return { createMealSlotError: 'Only the host or co-host can add meal slots.' };
		const formData = await request.formData();
		const mealType = (formData.get('mealType') as string) || 'dinner';
		const dateStr = formData.get('date') as string;
		if (!dateStr) return { createMealSlotError: 'Date is required.' };
		const date = new Date(dateStr);
		const time = (formData.get('time') as string)?.trim() || null;
		const title = (formData.get('title') as string)?.trim() || null;
		const notes = (formData.get('notes') as string)?.trim() || null;
		const assignedUserId = (formData.get('assignedUserId') as string)?.trim() || null;
		if (!MEAL_TYPES.includes(mealType as (typeof MEAL_TYPES)[number])) {
			return { createMealSlotError: 'Invalid meal type.' };
		}
		await prisma.mealSlot.create({
			data: { tripId, mealType, date, time, title, notes, assignedUserId: assignedUserId || null }
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
		const canManage = await isTripHostOrCoHost(tripId, user.id);
		const mealType = (formData.get('mealType') as string) || slot.mealType;
		const dateStr = formData.get('date') as string;
		const time = (formData.get('time') as string)?.trim() || null;
		const title = (formData.get('title') as string)?.trim() || null;
		const notes = (formData.get('notes') as string)?.trim() || null;
		const assignedUserId = formData.get('assignedUserId') as string | null;
		const data: Record<string, unknown> = {};
		if (canManage) {
			if (dateStr) data.date = new Date(dateStr);
			data.mealType = MEAL_TYPES.includes(mealType as (typeof MEAL_TYPES)[number])
				? mealType
				: slot.mealType;
			data.time = time;
			data.title = title;
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
		const canManage = await isTripHostOrCoHost(tripId, user.id);
		if (!canManage) return { deleteMealSlotError: 'Only the host or co-host can remove meal slots.' };
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
		const end = new Date(trip.checkOutDate);
		const toCreate: { tripId: string; mealType: string; date: Date }[] = [];
		for (const d = new Date(trip.checkInDate); d < end; d.setDate(d.getDate() + 1)) {
			for (const mealType of ['breakfast', 'lunch', 'dinner'] as const) {
				toCreate.push({ tripId, mealType, date: new Date(d) });
			}
		}
		await prisma.mealSlot.createMany({ data: toCreate });
		return { generateSlotsSuccess: true };
	},

	assignMealMaker: async ({ request, params, cookies }) => {
		const user = await getSessionUser(cookies);
		if (!user) throw redirect(303, '/login');
		const tripId = params.tripId;
		const canManage = await isTripHostOrCoHost(tripId, user.id);
		if (!canManage) return { assignMealMakerError: 'Only the host or co-host can assign cooks.' };
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

	// ── Activity management ────────────────────────────────────────────────

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
		const member = await isTripMember(tripId, user.id);
		if (!member) return { removeActivityParticipantError: 'Not a trip member.' };
		const formData = await request.formData();
		const activityId = formData.get('activityId') as string;
		const userId = formData.get('userId') as string;
		if (!activityId || !userId)
			return { removeActivityParticipantError: 'Activity and user required.' };
		// Scope activity to this trip before deleting
		const activity = await prisma.activity.findFirst({ where: { id: activityId, tripId } });
		if (!activity) return { removeActivityParticipantError: 'Activity not found.' };
		await prisma.activityParticipant.deleteMany({ where: { activityId, userId } });
		return { removeActivityParticipantSuccess: true };
	},

	moveMealSlot: async ({ request, params, cookies }) => {
		const user = await getSessionUser(cookies);
		if (!user) throw redirect(303, '/login');
		const tripId = params.tripId;
		const canManage = await isTripHostOrCoHost(tripId, user.id);
		if (!canManage) return { moveMealSlotError: 'Only the host or co-host can move meal slots.' };
		const formData = await request.formData();
		const slotId = formData.get('slotId') as string;
		const dateStr = formData.get('date') as string;
		const time = (formData.get('time') as string)?.trim() || null;
		if (!slotId || !dateStr) return { moveMealSlotError: 'Slot and date required.' };
		const slot = await prisma.mealSlot.findFirst({ where: { id: slotId, tripId } });
		if (!slot) return { moveMealSlotError: 'Slot not found.' };
		await prisma.mealSlot.update({ where: { id: slotId }, data: { date: new Date(dateStr), time } });
		return { moveMealSlotSuccess: true };
	},

	moveActivity: async ({ request, params, cookies }) => {
		const user = await getSessionUser(cookies);
		if (!user) throw redirect(303, '/login');
		const tripId = params.tripId;
		const canManage = await isTripHostOrCoHost(tripId, user.id);
		if (!canManage) return { moveActivityError: 'Only the host or co-host can move activities.' };
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
	},

	createActivity: async ({ request, params, cookies }) => {
		const user = await getSessionUser(cookies);
		if (!user) throw redirect(303, '/login');
		const tripId = params.tripId;
		const member = await isTripMember(tripId, user.id);
		if (!member) return { createActivityError: 'Not a trip member.' };

		const fd = await request.formData();
		const title = (fd.get('title') as string)?.trim();
		const dateStr = fd.get('date') as string;
		const time = (fd.get('time') as string)?.trim() || null;
		const location = (fd.get('location') as string)?.trim() || null;
		const notes = (fd.get('notes') as string)?.trim() || null;

		if (!title) return { createActivityError: 'Activity name is required.' };
		if (!dateStr) return { createActivityError: 'Date is required.' };

		const activity = await prisma.activity.create({
			data: {
				tripId,
				title,
				date: new Date(dateStr),
				time,
				location,
				notes,
				status: 'planned'
			}
		});

		// Auto-enroll creator as "going"
		await prisma.activityParticipant.create({
			data: { activityId: activity.id, userId: user.id, status: 'in' }
		});

		return { createActivitySuccess: true };
	},

	updateActivity: async ({ request, params, cookies }) => {
		const user = await getSessionUser(cookies);
		if (!user) throw redirect(303, '/login');
		const tripId = params.tripId;
		const canManage = await isTripHostOrCoHost(tripId, user.id);
		if (!canManage) return { updateActivityError: 'Only the host or co-host can edit activities.' };

		const fd = await request.formData();
		const activityId = (fd.get('activityId') as string)?.trim();
		if (!activityId) return { updateActivityError: 'Activity ID required.' };

		const activity = await prisma.activity.findFirst({ where: { id: activityId, tripId } });
		if (!activity) return { updateActivityError: 'Activity not found.' };

		const title = (fd.get('title') as string)?.trim();
		const dateStr = fd.get('date') as string;
		const time = (fd.get('time') as string)?.trim() || null;
		const location = (fd.get('location') as string)?.trim() || null;
		const notes = (fd.get('notes') as string)?.trim() || null;

		if (!title) return { updateActivityError: 'Activity name is required.' };

		await prisma.activity.update({
			where: { id: activityId },
			data: { title, ...(dateStr ? { date: new Date(dateStr) } : {}), time, location, notes }
		});

		return { updateActivitySuccess: true };
	}
};
