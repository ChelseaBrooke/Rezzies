import { error, fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { getSessionUser } from '$lib/server/session.js';
import { isTripMember } from '$lib/server/trip-access.js';
import { prisma } from '$lib/server/prisma.js';
import { totalSpotsForBeds, hasEnoughSpots, isPrismaUniqueConflict } from '$lib/server/bed-spot-validation.js';
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
	const myAssignmentIds = new Set(
		allAssignments.filter((a) => a.userId === user.id && a.bedId).map((a) => a.bedId as string)
	);
	const claimedBedIdsByOther = new Set(
		allAssignments.filter((a) => a.userId !== user.id && a.bedId).map((a) => a.bedId as string)
	);
	const selectedActivities = trip.activities.filter((a) => a.participants.length > 0);

	return {
		user,
		trip,
		currentRsvp,
		currentProfile,
		myClaimedBedIds: Array.from(myAssignmentIds),
		claimedBedIdsByOther: Array.from(claimedBedIdsByOther),
		selectedActivities
	};
};

const rsvpSchema = z.object({
	status: z.enum(['yes', 'no', 'maybe']),
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
		const data = {
			status: formData.get('status') as string,
			arrivalDatetime: formData.get('arrivalDatetime') ? new Date(formData.get('arrivalDatetime') as string) : undefined,
			departureDatetime: formData.get('departureDatetime') ? new Date(formData.get('departureDatetime') as string) : undefined,
			adultsCount: Number(formData.get('adultsCount')),
			kidsCount: Number(formData.get('kidsCount')),
			petsCount: Number(formData.get('petsCount')),
			notes: formData.get('notes') as string | null
		};

		const validation = rsvpSchema.safeParse(data);
		if (!validation.success) {
			return { error: validation.error.errors[0]?.message };
		}

		// Upsert RSVP
		await prisma.rSVP.upsert({
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

		// When guest RSVPs "no", release their bed claims so beds become available again
		if (validation.data.status === 'no') {
			await prisma.roomAssignment.deleteMany({
				where: { tripId, userId: user.id }
			});
		}

		return { success: true };
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

		const rsvp = await prisma.rSVP.findUnique({
			where: { tripId_userId: { tripId, userId: user.id } }
		});
		const partySize = Math.min(99, Math.max(1, rsvp?.adultsCount ?? 1));

		const trip = await prisma.trip.findUnique({
			where: { id: tripId },
			include: { rooms: { include: { beds: true } } }
		});
		if (!trip) return fail(404, { claimBedsError: 'Trip not found' });

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

		return { claimBedsSuccess: true };
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
