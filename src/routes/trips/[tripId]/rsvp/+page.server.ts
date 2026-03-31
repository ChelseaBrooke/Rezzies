import { error, fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { getSessionUser } from '$lib/server/session.js';
import { isTripMember } from '$lib/server/trip-access.js';
import { prisma } from '$lib/server/prisma.js';
import { totalSpotsForBeds, hasEnoughSpots, isPrismaUniqueConflict } from '$lib/bed-spot-validation.js';
import {
	computeGuestEstimateRange,
	computeGuestEstimateWithOverrides,
	parseReconfirmPolicy,
	checkAndSetReconfirmRequired
} from '$lib/server/guest-estimate.js';
import { computeRoomPricing, computePerBedPricingAtHeadcount } from '$lib/server/pricing-canonical.js';
import { checkAndHandleCapacity, handleSpotOpened } from '$lib/server/waitlist-service.js';
import { z } from 'zod';

export const load: PageServerLoad = async ({ params, cookies }) => {
	const user = await getSessionUser(cookies);
	
	if (!user) {
		throw redirect(303, `/login?redirect=/trips/${params.tripId}/rsvp`);
	}

	const tripId = params.tripId;

	// Check if user is a member
	const member = await isTripMember(tripId, user.id);
	if (!member) {
		throw error(403, 'You must be a member of this trip to RSVP');
	}

	// Get trip with all necessary data: rooms with beds, and all bed claims (to show claimed-by-other)
	const trip = await prisma.trip.findUnique({
		where: { id: tripId },
		include: {
			mealPlan: true,
			rooms: {
				include: {
					beds: { where: { isAvailable: true } },
					roomAssignments: true
				}
			},
			activities: {
				include: {
					participants: {
						where: {
							userId: user.id
						}
					}
				},
				orderBy: {
					date: 'asc'
				}
			},
			extraCostRules: true,
			guestProfiles: {
				where: {
					userId: user.id
				}
			},
			rsvps: {
				where: {
					userId: user.id
				}
			}
		}
	});

	if (!trip) {
		throw error(404, 'Trip not found');
	}

	// Get user's current selections
	const currentRsvp = trip.rsvps[0] || null;
	const currentProfile = trip.guestProfiles[0] || null;
	const allAssignments = trip.rooms.flatMap((r) => r.roomAssignments);
	const isPerRoomPricing = (trip.pricingModel ?? '').toLowerCase() === 'per_room';
	const myAssignmentIds = new Set(
		allAssignments.filter((a) => a.userId === user.id && a.bedId).map((a) => a.bedId as string)
	);
	const claimedBedIdsByOther = new Set(
		allAssignments.filter((a) => a.userId !== user.id && a.bedId).map((a) => a.bedId as string)
	);
	const myClaimedRoomIds = allAssignments
		.filter((a) => a.userId === user.id && a.bedId == null)
		.map((a) => a.roomId);
	const claimedWholeRoomIdsByOther = new Set(
		allAssignments.filter((a) => a.userId !== user.id && a.bedId == null).map((a) => a.roomId)
	);
	const selectedActivities = trip.activities.filter((a) => a.participants.length > 0);

	// Cost commitment: estimate range when user has or is choosing YES
	let guestEstimate: Awaited<ReturnType<typeof computeGuestEstimateRange>> | null = null;
	let guestEstimateError: string | null = null;
	if (currentRsvp?.status === 'yes' || true) {
		try {
			guestEstimate = await computeGuestEstimateRange(tripId, user.id);
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Unknown error';
			guestEstimateError = message;
			// Log so host/dev can see why estimate failed (e.g. no rooms, per-bed without bed selection)
			console.warn('[RSVP] computeGuestEstimateRange failed:', message);
		}
	}
	const reconfirmPolicy = parseReconfirmPolicy(null);

	let roomPricing: Awaited<ReturnType<typeof computeRoomPricing>> | null = null;
	if (trip.rooms.length > 0) {
		try {
			roomPricing = await computeRoomPricing(tripId);
		} catch {
			// Trip may have pricing config issues
		}
	}

	// Per-bed totals = what you'd pay at current yes-RSVP count (including plus-ones)
	const yesRsvps = await prisma.rSVP.findMany({
		where: { tripId, status: 'yes' },
		select: { adultsCount: true }
	});
	const yesRsvpHeadcount = Math.max(1, yesRsvps.reduce((s, r) => s + (r.adultsCount ?? 1), 0));

	let bedPricing: Record<
		string,
		{ low: number; high: number; total: number; perNightLow: number; perNightHigh: number; perNight: number }
	> | null = null;
	if ((trip.pricingModel ?? '').toLowerCase() === 'per_bed' && trip.rooms.length > 0) {
		const perBed = await computePerBedPricingAtHeadcount(tripId, yesRsvpHeadcount);
		if (perBed) bedPricing = perBed.bedPricing;
	}

	// Waitlist state for this user
	const waitlistStatus = currentRsvp?.status ?? null;
	const isWaitlisted = waitlistStatus === 'waitlisted';
	const hasClaimWindow = waitlistStatus === 'invited_to_rsvp';
	const claimWindowExpiresAt = currentRsvp?.claimWindowExpiresAt ?? null;
	const waitlistPosition = currentRsvp?.waitlistPosition ?? null;
	const claimWindowExpired =
		hasClaimWindow && claimWindowExpiresAt ? claimWindowExpiresAt < new Date() : false;

	// Count of yes RSVPs for capacity display
	const yesCount = await prisma.rSVP.count({ where: { tripId, status: 'yes' } });

	return {
		user,
		trip,
		currentRsvp,
		currentProfile,
		isPerRoomPricing,
		myClaimedBedIds: Array.from(myAssignmentIds),
		claimedBedIdsByOther: Array.from(claimedBedIdsByOther),
		myClaimedRoomIds,
		claimedWholeRoomIdsByOther: Array.from(claimedWholeRoomIdsByOther),
		selectedActivities,
		guestEstimate,
		guestEstimateError,
		reconfirmPolicy,
		roomPricing,
		bedPricing,
		yesRsvpHeadcount,
		// Waitlist
		isWaitlisted,
		hasClaimWindow,
		claimWindowExpiresAt: claimWindowExpiresAt?.toISOString() ?? null,
		claimWindowExpired,
		waitlistPosition,
		maxCapacity: trip.maxCapacity ?? null,
		yesCount
	};
};

const rsvpSchema = z.object({
	status: z.enum(['yes', 'no']),
	arrivalDatetime: z.coerce.date().optional(),
	departureDatetime: z.coerce.date().optional(),
	adultsCount: z.coerce.number().int().positive().default(1),
	kidsCount: z.coerce.number().int().min(0).default(0),
	petsCount: z.coerce.number().int().min(0).default(0),
	notes: z.string().optional()
});

const profileSchema = z.object({
	dietaryRestrictions: z.string().optional(),
	allergies: z.string().optional(),
	phone: z.string().optional(),
	emergencyContact: z.string().optional()
});

export const actions: Actions = {
	updateRsvp: async ({ request, params, cookies }) => {
		const user = await getSessionUser(cookies);
		if (!user) throw redirect(303, '/login');

		const tripId = params.tripId;
		const member = await isTripMember(tripId, user.id);
		if (!member) throw error(403, 'You must be a member of this trip');

		const formData = await request.formData();
		const costCommitmentAccepted = formData.get('costCommitmentAccepted') === 'true' || formData.get('costCommitmentAccepted') === '1';
		const arrivalDateRaw = (formData.get('arrivalDate') as string | null)?.trim() || '';
		const departureDateRaw = (formData.get('departureDate') as string | null)?.trim() || '';

		const data = {
			status: formData.get('status') as string,
			arrivalDatetime: arrivalDateRaw ? new Date(`${arrivalDateRaw}T00:00:00`) : undefined,
			departureDatetime: departureDateRaw ? new Date(`${departureDateRaw}T00:00:00`) : undefined,
			adultsCount: Number(formData.get('adultsCount')),
			kidsCount: Number(formData.get('kidsCount')),
			petsCount: Number(formData.get('petsCount')),
			// Notes are only stored for NO; Zod .optional() accepts undefined but not null
			notes: (formData.get('notes') as string | null)?.trim() || undefined
		};

		const validation = rsvpSchema.safeParse(data);
		if (!validation.success) {
			// Log validation failure so you can see which field failed (check terminal/server logs)
			console.error('[RSVP updateRsvp] Validation failed. Data submitted:', JSON.stringify(data, null, 2));
			console.error('[RSVP updateRsvp] Zod errors:', validation.error.errors.map((e) => ({ path: e.path.join('.'), message: e.message })));
			return fail(400, { error: validation.error.errors[0]?.message });
		}
		const notesForStatus = validation.data.status === 'no' ? (data.notes ?? undefined) : undefined;

		// Waitlist guard: only allow YES if the user is not on the waitlist (or has an active claim window)
		if (validation.data.status === 'yes') {
			const existingRsvp = await prisma.rSVP.findUnique({
				where: { tripId_userId: { tripId, userId: user.id } },
				select: { status: true, claimWindowExpiresAt: true }
			});
			if (existingRsvp?.status === 'waitlisted') {
				return fail(403, { error: 'You are on the waitlist. Wait until a spot opens and you receive your invite.' });
			}
			if (existingRsvp?.status === 'invited_to_rsvp') {
				const expired = existingRsvp.claimWindowExpiresAt && existingRsvp.claimWindowExpiresAt < new Date();
				if (expired) {
					return fail(403, { error: 'Your claim window has expired. You have been returned to the waitlist.' });
				}
			}
		}

		// YES requires cost commitment: server recomputes estimate and persists accepted range
		if (validation.data.status === 'yes') {
			if (!costCommitmentAccepted) {
				return fail(400, { error: 'Please agree to the cost estimate below to submit YES RSVP.' });
			}
			let estimate;
			try {
				estimate = await computeGuestEstimateRange(tripId, user.id);
			} catch (e) {
				return fail(400, { error: 'Could not compute cost estimate. Try again or pick a room first.' });
			}
			const now = new Date();
			await prisma.rSVP.upsert({
				where: { tripId_userId: { tripId, userId: user.id } },
				create: {
					tripId,
					userId: user.id,
					...validation.data,
					notes: null,
					costCommitmentAccepted: true,
					rsvpYesAcceptedAt: now,
					yesSubstatus: 'confirmed',
					acceptedEstimateLowCents: estimate.lowCents,
					acceptedEstimateHighCents: estimate.highCents,
					acceptedHeadcountMin: estimate.hmin,
					acceptedHeadcountMax: estimate.hmax,
					acceptedCostBasisVersion: estimate.costBasisVersion,
					reconfirmRequiredAt: null,
					reconfirmDeadlineAt: null,
					latestEstimateLowCents: estimate.lowCents,
					latestEstimateHighCents: estimate.highCents,
					latestEstimateUpdatedAt: now
				},
				update: {
					...validation.data,
					notes: null,
					costCommitmentAccepted: true,
					rsvpYesAcceptedAt: now,
					yesSubstatus: 'confirmed',
					acceptedEstimateLowCents: estimate.lowCents,
					acceptedEstimateHighCents: estimate.highCents,
					acceptedHeadcountMin: estimate.hmin,
					acceptedHeadcountMax: estimate.hmax,
					acceptedCostBasisVersion: estimate.costBasisVersion,
					reconfirmRequiredAt: null,
					reconfirmDeadlineAt: null,
					latestEstimateLowCents: estimate.lowCents,
					latestEstimateHighCents: estimate.highCents,
					latestEstimateUpdatedAt: now
				}
			});
		await checkAndSetReconfirmRequired(tripId);
		// Check if the trip just became full and enqueue not-responded guests
		await checkAndHandleCapacity(tripId).catch(console.error);
		return { success: true };
	}

	// No or Maybe: clear cost commitment fields
	await prisma.rSVP.upsert({
			where: { tripId_userId: { tripId, userId: user.id } },
			create: {
				tripId,
				userId: user.id,
				...validation.data,
				notes: notesForStatus ?? null
			},
			update: {
				...validation.data,
				notes: notesForStatus ?? null,
				costCommitmentAccepted: null,
				rsvpYesAcceptedAt: null,
				yesSubstatus: null,
				acceptedEstimateLowCents: null,
				acceptedEstimateHighCents: null,
				acceptedHeadcountMin: null,
				acceptedHeadcountMax: null,
				acceptedCostBasisVersion: null,
				reconfirmRequiredAt: null,
				reconfirmDeadlineAt: null,
				latestEstimateLowCents: null,
				latestEstimateHighCents: null,
				latestEstimateUpdatedAt: null
			}
		});

		if (validation.data.status === 'no') {
			await prisma.roomAssignment.deleteMany({
				where: { tripId, userId: user.id }
			});
			// A spot just opened; promote the next waitlisted user
			await handleSpotOpened(tripId).catch(console.error);
		}

		await checkAndSetReconfirmRequired(tripId);
		return { success: true };
	},

	updateDietary: async ({ request, params, cookies }) => {
		const user = await getSessionUser(cookies);
		if (!user) throw redirect(303, '/login');
		const tripId = params.tripId;
		const member = await isTripMember(tripId, user.id);
		if (!member) throw error(403, 'You must be a member of this trip');

		const fd = await request.formData();
		const dietaryRestrictions = (fd.get('dietaryRestrictions') as string)?.trim() || null;
		const allergies = (fd.get('allergies') as string)?.trim() || null;

		// Save user's own dietary info to GuestProfile
		await prisma.guestProfile.upsert({
			where: { tripId_userId: { tripId, userId: user.id } },
			create: { tripId, userId: user.id, dietaryRestrictions, allergies },
			update: { dietaryRestrictions, allergies }
		});

		// Collect plus-one dietary info and persist in RSVP notes (YES RSVPs only)
		const plusOneCount = parseInt((fd.get('plusOneCount') as string) ?? '0', 10) || 0;
		if (plusOneCount > 0) {
			const plusOnes = Array.from({ length: plusOneCount }, (_, i) => ({
				name: (fd.get(`plusOneName_${i}`) as string)?.trim() || null,
				dietary: (fd.get(`plusOneDietary_${i}`) as string)?.trim() || null,
				allergies: (fd.get(`plusOneAllergies_${i}`) as string)?.trim() || null
			})).filter(p => p.name || p.dietary || p.allergies);

			if (plusOnes.length > 0) {
				await prisma.rSVP.updateMany({
					where: { tripId, userId: user.id, status: 'yes' },
					data: { notes: JSON.stringify({ plusOneDietaryProfiles: plusOnes }) }
				});
			}
		}

		return { updateDietarySuccess: true };
	},

	updateProfile: async ({ request, params, cookies }) => {
		const user = await getSessionUser(cookies);
		if (!user) throw redirect(303, '/login');

		const tripId = params.tripId;
		const member = await isTripMember(tripId, user.id);
		if (!member) throw error(403, 'You must be a member of this trip');

		const formData = await request.formData();
		const data = {
			dietaryRestrictions: formData.get('dietaryRestrictions') as string | null,
			allergies: formData.get('allergies') as string | null,
			phone: formData.get('phone') as string | null,
			emergencyContact: formData.get('emergencyContact') as string | null
		};

		const validation = profileSchema.safeParse(data);
		if (!validation.success) {
			return { error: validation.error.errors[0]?.message };
		}

		// Upsert profile
		await prisma.guestProfile.upsert({
			where: {
				tripId_userId: {
					tripId,
					userId: user.id
				}
			},
			create: {
				tripId,
				userId: user.id,
				...validation.data
			},
			update: validation.data
		});

		return { success: true };
	},

	/** Whole-room claim for PER_ROOM pricing (one room per party; bedId null). */
	claimRooms: async ({ request, params, cookies }) => {
		const user = await getSessionUser(cookies);
		if (!user) throw redirect(303, '/login');

		const tripId = params.tripId;
		const member = await isTripMember(tripId, user.id);
		if (!member) throw error(403, 'You must be a member of this trip');

		const formData = await request.formData();
		const roomIdsRaw = formData.getAll('roomIds');
		const roomIds = Array.isArray(roomIdsRaw)
			? (roomIdsRaw as string[]).map((id) => parseInt(String(id), 10)).filter((n) => Number.isFinite(n))
			: [];
		const partySizeRaw = Number(formData.get('partySize'));
		const rsvp = await prisma.rSVP.findUnique({
			where: { tripId_userId: { tripId, userId: user.id } }
		});
		const partySize = Math.min(
			99,
			Math.max(1, Number.isFinite(partySizeRaw) && partySizeRaw > 0 ? partySizeRaw : (rsvp?.adultsCount ?? 1))
		);

		const trip = await prisma.trip.findUnique({
			where: { id: tripId },
			include: { rooms: { include: { beds: true } } }
		});
		if (!trip) return fail(404, { claimBedsError: 'Trip not found' });
		if ((trip.pricingModel ?? '').toLowerCase() !== 'per_room') {
			return fail(400, { claimBedsError: 'Whole-room selection is only for per-room priced trips.' });
		}
		if (roomIds.length !== 1) {
			return fail(400, { claimBedsError: 'Select exactly one room for your party.' });
		}
		const roomId = roomIds[0];
		const room = trip.rooms.find((r) => r.id === roomId);
		if (!room) return fail(400, { claimBedsError: 'Invalid room.' });

		function roomCapacity(r: (typeof trip.rooms)[0]): number {
			const fromBeds = r.beds.reduce((s, b) => s + (b.capacitySlots ?? b.capacity ?? 1), 0);
			return Math.max(1, r.maxOccupancy ?? (fromBeds || 1));
		}
		const cap = roomCapacity(room);
		if (partySize > cap) {
			return fail(400, {
				claimBedsError: `Your party (${partySize}) is larger than this room's capacity (${cap}). Choose a larger room or reduce party size.`
			});
		}

		const taken = await prisma.roomAssignment.findFirst({
			where: {
				tripId,
				roomId,
				bedId: null,
				userId: { not: user.id }
			}
		});
		if (taken) {
			return fail(409, {
				bedClaimConflict: true,
				claimBedsError: 'That room was just claimed by someone else. Pick another.'
			});
		}

		try {
			await prisma.$transaction(async (tx) => {
				await tx.roomAssignment.deleteMany({ where: { tripId, userId: user.id } });
				await tx.roomAssignment.create({
					data: {
						tripId,
						roomId,
						userId: user.id,
						bedId: null,
						partySize
					}
				});
			});
		} catch (e: unknown) {
			if (isPrismaUniqueConflict(e)) {
				return fail(409, { bedClaimConflict: true, claimBedsError: 'That room was just claimed. Pick another.' });
			}
			throw e;
		}

		const { createInvoiceForUser } = await import('$lib/server/invoice-calculator.js');
		await createInvoiceForUser(tripId, user.id).catch(() => {});
		await checkAndSetReconfirmRequired(tripId);
		return { claimBedsSuccess: true };
	},

	/** Guest claims beds. Party size must be covered by total spots of selected beds. One bed = one guest (unique). */
	claimBeds: async ({ request, params, cookies }) => {
		const user = await getSessionUser(cookies);
		if (!user) throw redirect(303, '/login');

		const tripId = params.tripId;
		const member = await isTripMember(tripId, user.id);
		if (!member) throw error(403, 'You must be a member of this trip');

		const formData = await request.formData();
		const bedIdsRaw = formData.getAll('bedIds');
		const bedIds = Array.isArray(bedIdsRaw) ? (bedIdsRaw as string[]).filter((id) => typeof id === 'string' && id.trim() !== '') : [];
		const partySizeRaw = Number(formData.get('partySize'));

		const rsvp = await prisma.rSVP.findUnique({
			where: { tripId_userId: { tripId, userId: user.id } }
		});
		const partySize = Math.min(99, Math.max(1, Number.isFinite(partySizeRaw) && partySizeRaw > 0 ? partySizeRaw : (rsvp?.adultsCount ?? 1)));

		const trip = await prisma.trip.findUnique({
			where: { id: tripId },
			include: { rooms: { include: { beds: true } } }
		});
		if (!trip) return fail(404, { claimBedsError: 'Trip not found' });
		if ((trip.pricingModel ?? '').toLowerCase() === 'per_room') {
			return fail(400, {
				claimBedsError: 'This trip prices by whole room. Select a room above instead of individual beds.'
			});
		}

		const allBeds = trip.rooms.flatMap((r) => r.beds);
		const bedsById = new Map(allBeds.map((b) => [b.id, b]));
		const totalSpots = totalSpotsForBeds(bedsById, bedIds);
		const toCreate = bedIds
			.map((bedId) => {
				const bed = bedsById.get(bedId);
				if (!bed) return null;
				return { bedId: bed.id, roomId: bed.roomId, bedType: bed.bedType };
			})
			.filter((x): x is NonNullable<typeof x> => x !== null);

		if (!hasEnoughSpots(totalSpots, partySize)) {
			return fail(400, {
				claimBedsError: `You need at least ${partySize} spot(s) for your party. Selected beds total ${totalSpots} spot(s). Add more beds.`
			});
		}

		try {
			await prisma.$transaction(async (tx) => {
				await tx.roomAssignment.deleteMany({ where: { tripId, userId: user.id } });
				for (const { bedId, roomId, bedType } of toCreate) {
					await tx.roomAssignment.create({
						data: {
							tripId,
							roomId,
							userId: user.id,
							bedId,
							bedType,
							partySize: 1
						}
					});
				}
			});
		} catch (e: unknown) {
			if (isPrismaUniqueConflict(e)) {
				return fail(409, { bedClaimConflict: true, claimBedsError: 'That bed was just claimed. Pick another.' });
			}
			throw e;
		}

		const { createInvoiceForUser } = await import('$lib/server/invoice-calculator.js');
		await createInvoiceForUser(tripId, user.id).catch(() => {});

		await checkAndSetReconfirmRequired(tripId);
		return { claimBedsSuccess: true };
	},

	getEstimate: async ({ request, params, cookies }) => {
		const user = await getSessionUser(cookies);
		if (!user) throw redirect(303, '/login');
		const tripId = params.tripId;
		const member = await isTripMember(tripId, user.id);
		if (!member) throw error(403, 'You must be a member of this trip');

		const formData = await request.formData();
		const arrivalDate = (formData.get('arrivalDate') as string)?.trim() ?? '';
		const departureDate = (formData.get('departureDate') as string)?.trim() ?? '';
		const adultsCount = Math.max(1, Number(formData.get('adultsCount')) || 1);
		const bedIdsRaw = formData.getAll('bedIds');
		const bedIds = Array.isArray(bedIdsRaw) ? (bedIdsRaw as string[]).filter((id) => typeof id === 'string' && id.trim() !== '') : [];
		const roomIdsRaw = formData.getAll('roomIds');
		const roomIds = Array.isArray(roomIdsRaw)
			? (roomIdsRaw as string[]).map((id) => parseInt(String(id), 10)).filter((n) => Number.isFinite(n))
			: [];

		const estimate = await computeGuestEstimateWithOverrides(tripId, user.id, {
			...(arrivalDate && { arrivalDate }),
			...(departureDate && { departureDate }),
			adultsCount,
			bedIds,
			...(roomIds.length > 0 ? { roomIds } : {})
		});
		return { getEstimate: estimate ?? undefined };
	},

	toggleActivity: async ({ request, params, cookies }) => {
		const user = await getSessionUser(cookies);
		if (!user) throw redirect(303, '/login');

		const tripId = params.tripId;
		const member = await isTripMember(tripId, user.id);
		if (!member) throw error(403, 'You must be a member of this trip');

		const formData = await request.formData();
		const activityId = formData.get('activityId') as string;
		const status = formData.get('status') as string;

		await prisma.activityParticipant.upsert({
			where: {
				activityId_userId: {
					activityId,
					userId: user.id
				}
			},
			create: {
				activityId,
				userId: user.id,
				status: status === 'in' ? 'in' : 'out'
			},
			update: {
				status: status === 'in' ? 'in' : 'out'
			}
		});

		return { success: true };
	},

	selectExtra: async ({ request, params, cookies }) => {
		const user = await getSessionUser(cookies);
		if (!user) throw redirect(303, '/login');

		const tripId = params.tripId;
		const member = await isTripMember(tripId, user.id);
		if (!member) throw error(403, 'You must be a member of this trip');

		const formData = await request.formData();
		const ruleId = formData.get('ruleId') as string;
		const quantity = Number(formData.get('quantity')) || 0;

		if (quantity === 0) {
			// Remove selection
			await prisma.guestExtraSelection.deleteMany({
				where: {
					tripId,
					userId: user.id,
					ruleId
				}
			});
		} else {
			// Upsert selection
			await prisma.guestExtraSelection.upsert({
				where: {
					id: `${tripId}-${user.id}-${ruleId}` // This won't work, need to find a better way
				},
				create: {
					tripId,
					userId: user.id,
					ruleId,
					quantity
				},
				update: {
					quantity
				}
			});
		}

		return { success: true };
	}
};
