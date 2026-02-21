import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { getSessionUser } from '$lib/server/session.js';
import { isTripMember, isTripHost } from '$lib/server/trip-access.js';
import { prisma } from '$lib/server/prisma.js';
import type { Meal, MealGuest, MealType, DaySection, MealSlotCoverage } from '$lib/components/trips/meals/types.js';

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'] as const;

function parseTags(tagsJson: string | null): string[] {
	if (!tagsJson) return [];
	try {
		const arr = JSON.parse(tagsJson);
		return Array.isArray(arr) ? arr.filter((s: unknown) => typeof s === 'string') : [];
	} catch {
		return [];
	}
}

function buildMealsFromSlots(
	slots: any[],
	members: MealGuest[],
	guestProfilesByUser: Map<string, { dietaryRestrictions: string | null; allergies: string | null }>,
	currentUserId: string
): Meal[] {
	const memberMap = new Map(members.map((m) => [m.id, m]));
	return slots.map((slot) => {
		const cookIds = slot.assignedUserId ? [slot.assignedUserId] : [];
		const cooks = cookIds.map((id) => memberMap.get(id)).filter(Boolean) as MealGuest[];
		const attendance = (slot.attendance ?? []).map((a: any) => ({
			mealId: slot.id,
			guestId: a.userId,
			guest: memberMap.get(a.userId),
			optedOut: a.optedOut,
			optOutReason: a.optOutReason,
			dietaryNote: a.dietaryNote
		}));
		const optedOutCount = attendance.filter((a) => a.optedOut).length;
		const totalGuests = members.length;
		const attendingCount = Math.max(0, totalGuests - optedOutCount);

		// Allergy/dietary summary from attending guests (profile + per-meal note)
		const allergySummary: Record<string, number> = {};
		attendance.filter((a) => !a.optedOut).forEach((a) => {
			const profile = guestProfilesByUser.get(a.guestId);
			const parts: string[] = [];
			if (profile?.allergies) parts.push(...profile.allergies.split(/[,;]/).map((s) => s.trim()).filter(Boolean));
			if (profile?.dietaryRestrictions) parts.push(...profile.dietaryRestrictions.split(/[,;]/).map((s) => s.trim()).filter(Boolean));
			if (a.dietaryNote) parts.push(a.dietaryNote.trim());
			parts.forEach((p) => {
				const key = p || 'Other';
				allergySummary[key] = (allergySummary[key] ?? 0) + 1;
			});
		});

		return {
			id: slot.id,
			tripId: slot.tripId,
			title: slot.title ?? null,
			mealType: slot.mealType as MealType,
			startAt: new Date(slot.date),
			time: slot.time,
			description: slot.menuText ?? null,
			notes: slot.notes ?? null,
			tags: parseTags(slot.tags),
			cookIds,
			cooks,
			attendance,
			attendingCount,
			optedOutCount,
			allergySummary
		};
	});
}

function buildCoverage(tripDays: string[], meals: Meal[]): MealSlotCoverage[] {
	const mealByKey = new Map<string, Meal>();
	meals.forEach((m) => {
		const dateKey = m.startAt.toISOString().slice(0, 10);
		mealByKey.set(`${dateKey}-${m.mealType}`, m);
	});
	const out: MealSlotCoverage[] = [];
	for (const date of tripDays) {
		for (const mt of MEAL_TYPES) {
			out.push({
				date,
				mealType: mt as MealType,
				meal: mealByKey.get(`${date}-${mt}`) ?? null
			});
		}
	}
	return out;
}

function buildDaySections(meals: Meal[]): DaySection[] {
	const byDate = new Map<string, Meal[]>();
	meals.forEach((m) => {
		const key = m.startAt.toISOString().slice(0, 10);
		if (!byDate.has(key)) byDate.set(key, []);
		byDate.get(key)!.push(m);
	});
	byDate.forEach((arr) => arr.sort((a, b) => {
		const order = { breakfast: 0, lunch: 1, dinner: 2, snack: 3 };
		const oa = order[a.mealType as keyof typeof order] ?? 4;
		const ob = order[b.mealType as keyof typeof order] ?? 4;
		if (oa !== ob) return oa - ob;
		const ta = a.time ? new Date(`1970-01-01T${a.time}`).getTime() : 0;
		const tb = b.time ? new Date(`1970-01-01T${b.time}`).getTime() : 0;
		return ta - tb;
	}));
	return [...byDate.entries()]
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([date, dayMeals]) => ({
			date,
			label: new Date(date + 'T12:00:00').toLocaleDateString('en-US', {
				weekday: 'long',
				month: 'short',
				day: 'numeric',
				year: 'numeric'
			}),
			meals: dayMeals
		}));
}

export const load: PageServerLoad = async ({ params, cookies, parent }) => {
	const user = await getSessionUser(cookies);
	if (!user) throw redirect(303, `/login?redirect=/trips/${params.tripId}/meals`);

	const tripId = params.tripId;
	const parentData = await parent();
	const member = await isTripMember(tripId, user.id);
	if (!member) throw error(403, 'You do not have access to this trip');

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
			guestProfiles: {
				select: {
					userId: true,
					dietaryRestrictions: true,
					allergies: true
				}
			},
			mealSlots: {
				include: {
					assignedUser: {
						select: { id: true, name: true }
					},
					attendance: {
						include: {
							user: {
								select: { id: true, name: true, email: true }
							}
						}
					}
				},
				orderBy: [{ date: 'asc' }, { mealType: 'asc' }]
			}
		}
	});

	if (!trip) throw error(404, 'Trip not found');

	const members: MealGuest[] = (trip.members ?? [])
		.filter((m) => m.user?.id)
		.map((m) => ({
			id: m.user!.id,
			name: m.user!.name ?? m.user!.email ?? 'Unknown',
			email: m.user!.email ?? null,
			dietaryRestrictions: null,
			allergies: null
		}));

	const guestProfilesByUser = new Map(
		(trip.guestProfiles ?? []).map((p) => [
			p.userId,
			{ dietaryRestrictions: p.dietaryRestrictions ?? null, allergies: p.allergies ?? null }
		])
	);
	members.forEach((m) => {
		const p = guestProfilesByUser.get(m.id);
		if (p) {
			m.dietaryRestrictions = p.dietaryRestrictions ?? undefined;
			m.allergies = p.allergies ?? undefined;
		}
	});

	// Trip days
	let tripDays: string[] = [];
	if (trip.checkInDate && trip.checkOutDate) {
		const start = new Date(trip.checkInDate);
		const end = new Date(trip.checkOutDate);
		for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
			tripDays.push(d.toISOString().slice(0, 10));
		}
	}

	const slots = trip.mealSlots ?? [];
	const meals = buildMealsFromSlots(
		slots.map((s) => ({
			...s,
			attendance: s.attendance ?? []
		})),
		members,
		guestProfilesByUser,
		user.id
	);
	const coverage = buildCoverage(tripDays, meals);
	const daySections = buildDaySections(meals);

	return {
		user: { id: user.id, name: user.name ?? 'You' },
		trip,
		mealPlan: trip.mealPlan ?? null,
		meals,
		coverage,
		daySections,
		members,
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

	createMeal: async ({ request, params, cookies }) => {
		const user = await getSessionUser(cookies);
		if (!user) throw redirect(303, '/login');
		const tripId = params.tripId;
		const member = await isTripMember(tripId, user.id);
		if (!member) return { createMealError: 'Not a trip member.' };
		const formData = await request.formData();
		const mealType = (formData.get('mealType') as string) || 'dinner';
		const dateStr = formData.get('date') as string;
		const time = (formData.get('time') as string)?.trim() || null;
		const title = (formData.get('title') as string)?.trim() || null;
		const description = (formData.get('description') as string)?.trim() || null;
		const cookId = (formData.get('cookId') as string)?.trim() || null;
		const tagsRaw = (formData.get('tags') as string)?.trim();
		let tags: string[] = [];
		if (tagsRaw) {
			try {
				const parsed = JSON.parse(tagsRaw);
				tags = Array.isArray(parsed) ? parsed.filter((s: unknown) => typeof s === 'string') : [];
			} catch {
				// ignore
			}
		}
		if (!dateStr) return { createMealError: 'Date is required.' };
		if (!MEAL_TYPES.includes(mealType as (typeof MEAL_TYPES)[number])) {
			return { createMealError: 'Invalid meal type.' };
		}
		await prisma.mealSlot.create({
			data: {
				tripId,
				mealType,
				date: new Date(dateStr),
				time,
				title,
				menuText: description,
				tags: tags.length ? JSON.stringify(tags) : null,
				assignedUserId: cookId || user.id
			}
		});
		return { createMealSuccess: true };
	},

	setMealAttendance: async ({ request, params, cookies }) => {
		const user = await getSessionUser(cookies);
		if (!user) throw redirect(303, '/login');
		const tripId = params.tripId;
		const member = await isTripMember(tripId, user.id);
		if (!member) return { setMealAttendanceError: 'Not a trip member.' };
		const formData = await request.formData();
		const slotId = formData.get('slotId') as string;
		const optedOut = formData.get('optedOut') === 'true';
		const optOutReason = (formData.get('optOutReason') as string)?.trim() || null;
		const dietaryNote = (formData.get('dietaryNote') as string)?.trim() || null;
		if (!slotId) return { setMealAttendanceError: 'Meal is required.' };
		const slot = await prisma.mealSlot.findFirst({ where: { id: slotId, tripId } });
		if (!slot) return { setMealAttendanceError: 'Meal not found.' };
		await prisma.mealSlotAttendance.upsert({
			where: {
				slotId_userId: { slotId, userId: user.id }
			},
			create: {
				slotId,
				userId: user.id,
				optedOut,
				optOutReason: optedOut ? optOutReason : null,
				dietaryNote: dietaryNote || null
			},
			update: {
				optedOut,
				optOutReason: optedOut ? optOutReason : null,
				dietaryNote: dietaryNote || null
			}
		});
		return { setMealAttendanceSuccess: true };
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
		const isCook = slot.assignedUserId === user.id;
		if (!isHost && !isCook) return { updateMealSlotError: 'Only host or cook can edit.' };
		const mealType = (formData.get('mealType') as string) || slot.mealType;
		const dateStr = formData.get('date') as string;
		const time = (formData.get('time') as string)?.trim() || null;
		const title = (formData.get('title') as string)?.trim() || null;
		const menuText = (formData.get('menuText') as string)?.trim() || null;
		const notes = (formData.get('notes') as string)?.trim() || null;
		const assignedUserId = (formData.get('assignedUserId') as string)?.trim() || null;
		const tagsRaw = (formData.get('tags') as string)?.trim();
		let tags: string[] = [];
		if (tagsRaw) {
			try {
				const parsed = JSON.parse(tagsRaw);
				tags = Array.isArray(parsed) ? parsed.filter((s: unknown) => typeof s === 'string') : [];
			} catch {
				// ignore
			}
		}
		const data: Record<string, unknown> = {
			mealType: MEAL_TYPES.includes(mealType as (typeof MEAL_TYPES)[number]) ? mealType : slot.mealType,
			time,
			title: title ?? slot.title,
			menuText: menuText ?? slot.menuText,
			notes: notes ?? slot.notes,
			assignedUserId: assignedUserId || null,
			tags: tags.length ? JSON.stringify(tags) : slot.tags
		};
		if (dateStr && isHost) data.date = new Date(dateStr);
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
		if (!host) return { deleteMealSlotError: 'Only the host can remove meals.' };
		const formData = await request.formData();
		const slotId = formData.get('slotId') as string;
		if (!slotId) return { deleteMealSlotError: 'Slot ID required.' };
		await prisma.mealSlot.deleteMany({ where: { id: slotId, tripId } });
		return { deleteMealSlotSuccess: true };
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
	}
};
