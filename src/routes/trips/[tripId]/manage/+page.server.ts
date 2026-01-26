import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { getSessionUser } from '$lib/server/session.js';
import { isTripHost } from '$lib/server/trip-access.js';
import { prisma } from '$lib/server/prisma.js';
import { z } from 'zod';

export const load: PageServerLoad = async ({ params, cookies }) => {
	const user = await getSessionUser(cookies);
	
	if (!user) {
		throw redirect(303, `/login?redirect=/trips/${params.tripId}/manage`);
	}

	const tripId = params.tripId;

	// Check if user is host
	const host = await isTripHost(tripId, user.id);
	if (!host) {
		throw error(403, 'Only the trip host can manage this trip');
	}

	// Get trip with all related data
	const trip = await prisma.trip.findUnique({
		where: { id: tripId },
		include: {
			rooms: {
				include: {
					beds: true,
					roomAssignments: {
						include: {
							user: {
								select: {
									id: true,
									name: true,
									email: true
								}
							}
						}
					}
				}
			},
			members: {
				include: {
					user: {
						select: {
							id: true,
							email: true,
							name: true
						}
					}
				}
			},
			invites: {
				orderBy: {
					createdAt: 'desc'
				}
			},
			mealPlan: true,
			mealSlots: {
				include: {
					assignedUser: {
						select: {
							id: true,
							name: true
						}
					}
				},
				orderBy: {
					date: 'asc'
				}
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
			},
			extraCostRules: true,
			rsvps: {
				include: {
					user: {
						select: {
							id: true,
							name: true,
							email: true
						}
					}
				}
			}
		}
	});

	if (!trip) {
		throw error(404, 'Trip not found');
	}

	return {
		user,
		trip
	};
};

const inviteSchema = z.object({
	email: z.string().email().optional(),
	phone: z.string().optional(),
	channel: z.enum(['email', 'sms', 'app'])
}).refine((data) => data.email || data.phone || data.channel === 'app', {
	message: 'Email or phone is required'
});

export const actions: Actions = {
	updateTrip: async ({ request, params, cookies }) => {
		const user = await getSessionUser(cookies);
		if (!user) throw redirect(303, '/login');

		const tripId = params.tripId;
		const host = await isTripHost(tripId, user.id);
		if (!host) throw error(403, 'Only the trip host can manage this trip');

		const formData = await request.formData();
		const name = formData.get('name') as string;
		const description = formData.get('description') as string | null;
		const location = formData.get('location') as string | null;
		const isPublished = formData.get('isPublished') === 'true';

		await prisma.trip.update({
			where: { id: tripId },
			data: {
				name,
				description: description || null,
				location: location || null,
				isPublished
			}
		});

		return { success: true };
	},
	
	createInvite: async ({ request, params, cookies }) => {
		const user = await getSessionUser(cookies);
		if (!user) throw redirect(303, '/login');

		const tripId = params.tripId;
		const host = await isTripHost(tripId, user.id);
		if (!host) throw error(403, 'Only the trip host can invite guests');

		const formData = await request.formData();
		const email = formData.get('email') as string | null;
		const phone = formData.get('phone') as string | null;
		const channel = (formData.get('channel') as string) || 'email';

		const validation = inviteSchema.safeParse({ email, phone, channel });
		if (!validation.success) {
			return { error: validation.error.errors[0]?.message };
		}

		// Generate unique token
		const token = crypto.randomUUID();

		// Create invite
		const invite = await prisma.invite.create({
			data: {
				tripId,
				token,
				invitedByUserId: user.id,
				channel,
				recipientEmail: email || null,
				recipientPhone: phone || null,
				expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
			}
		});

		// TODO: Send email/SMS if configured
		// For now, just return the invite link
		const inviteUrl = `${process.env.APP_BASE_URL || 'http://localhost:5173'}/invite/${token}`;

		return { success: true, inviteUrl, invite };
	},

	createMealPlan: async ({ params, cookies }) => {
		const user = await getSessionUser(cookies);
		if (!user) throw redirect(303, '/login');

		const tripId = params.tripId;
		const host = await isTripHost(tripId, user.id);
		if (!host) throw error(403, 'Only the trip host can manage meals');

		await prisma.mealPlan.upsert({
			where: { tripId },
			create: {
				tripId,
				enabled: true,
				mode: 'slots'
			},
			update: {
				enabled: true
			}
		});

		return { success: true };
	},

	createMealSlot: async ({ request, params, cookies }) => {
		const user = await getSessionUser(cookies);
		if (!user) throw redirect(303, '/login');

		const tripId = params.tripId;
		const host = await isTripHost(tripId, user.id);
		if (!host) throw error(403, 'Only the trip host can manage meals');

		const formData = await request.formData();
		const mealType = formData.get('mealType') as string;
		const date = new Date(formData.get('date') as string);
		const time = formData.get('time') as string | null;
		const menuText = formData.get('menuText') as string | null;
		const notes = formData.get('notes') as string | null;

		await prisma.mealSlot.create({
			data: {
				tripId,
				mealType,
				date,
				time: time || null,
				menuText: menuText || null,
				notes: notes || null
			}
		});

		return { success: true };
	},

	createActivity: async ({ request, params, cookies }) => {
		const user = await getSessionUser(cookies);
		if (!user) throw redirect(303, '/login');

		const tripId = params.tripId;
		const host = await isTripHost(tripId, user.id);
		if (!host) throw error(403, 'Only the trip host can manage activities');

		const formData = await request.formData();
		const title = formData.get('title') as string;
		const date = new Date(formData.get('date') as string);
		const time = formData.get('time') as string | null;
		const location = formData.get('location') as string | null;
		const pricePerPerson = Number(formData.get('pricePerPerson')) || 0;
		const maxParticipants = formData.get('maxParticipants') ? Number(formData.get('maxParticipants')) : null;
		const notes = formData.get('notes') as string | null;

		await prisma.activity.create({
			data: {
				tripId,
				title,
				date,
				time: time || null,
				location: location || null,
				pricePerPerson,
				maxParticipants,
				notes: notes || null
			}
		});

		return { success: true };
	},

	createExtraCost: async ({ request, params, cookies }) => {
		const user = await getSessionUser(cookies);
		if (!user) throw redirect(303, '/login');

		const tripId = params.tripId;
		const host = await isTripHost(tripId, user.id);
		if (!host) throw error(403, 'Only the trip host can manage extras');

		const formData = await request.formData();
		const label = formData.get('label') as string;
		const amount = Number(formData.get('amount'));
		const type = formData.get('type') as string;

		await prisma.extraCostRule.create({
			data: {
				tripId,
				label,
				amount,
				type
			}
		});

		return { success: true };
	}
};
