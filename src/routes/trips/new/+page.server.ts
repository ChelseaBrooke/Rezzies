import { fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { getSessionUser } from '$lib/server/session.js';
import { prisma } from '$lib/server/prisma.js';
import { generateInviteCode } from '$lib/server/pricing.js';

export const load: PageServerLoad = async ({ cookies, url }) => {
	const user = await getSessionUser(cookies);
	
	if (!user) {
		throw redirect(303, `/login?redirect=${encodeURIComponent(url.pathname)}`);
	}

	// Redirect to first step of wizard
	throw redirect(303, '/trips/new/step/1');
};

export const actions: Actions = {
	saveDraft: async ({ request, cookies }) => {
		const user = await getSessionUser(cookies);
		if (!user) {
			return fail(401, { error: 'Unauthorized' });
		}

		try {
			const fd = await request.formData();
			const formDataJson = fd.get('formData');
			if (formDataJson != null && typeof formDataJson === 'string') {
				JSON.parse(formDataJson); // validate it's valid JSON; store in DB/session if needed
			}
			// Store draft in sessionStorage on client for now; could save to database here if needed
			return { success: true };
		} catch (error) {
			console.error('Error saving draft:', error);
			return fail(500, { error: 'Failed to save draft' });
		}
	},

		create: async ({ request, cookies }) => {
		const user = await getSessionUser(cookies);
		if (!user) {
			throw redirect(303, '/login');
		}

		try {
			const formData = await request.formData();
			const formDataJson = formData.get('formData') as string;
			
			if (!formDataJson) {
				return fail(400, { error: 'Missing form data' });
			}

			const data = JSON.parse(formDataJson);
			
			// Fix Room sequence if needed (one-time fix for out-of-sync sequences)
			// This ensures the auto-increment sequence is in sync with existing data
			try {
				await prisma.$executeRawUnsafe(`
					SELECT setval(
						pg_get_serial_sequence('"Room"', 'id'),
						COALESCE((SELECT MAX(id) FROM "Room"), 0) + 1,
						false
					)
				`);
			} catch (seqError) {
				// Ignore sequence fix errors - not critical, might not be needed
				console.log('Sequence fix skipped (may not be needed):', seqError);
			}

			// Validate required fields
			if (!data.name || !data.checkInDate || !data.checkOutDate || !data.totalCost) {
				return fail(400, {
					error: 'Missing required fields: name, dates, and total cost are required'
				});
			}

			if (!data.rooms || data.rooms.length === 0) {
				return fail(400, {
					error: 'At least one room is required'
				});
			}

			// Validate dates
			const checkInDate = new Date(data.checkInDate);
			const checkOutDate = new Date(data.checkOutDate);
			
			if (isNaN(checkInDate.getTime()) || isNaN(checkOutDate.getTime())) {
				return fail(400, { error: 'Invalid dates' });
			}
			
			if (checkOutDate <= checkInDate) {
				return fail(400, { error: 'Check-out date must be after check-in date' });
			}

			const totalCost = parseFloat(data.totalCost);
			if (isNaN(totalCost) || totalCost <= 0) {
				return fail(400, { error: 'Invalid total cost' });
			}

			// Generate unique invite code
			const inviteCode = generateInviteCode();

			// Use a transaction to ensure atomicity
			const trip = await prisma.$transaction(async (tx) => {
				// Create trip
				const newTrip = await tx.trip.create({
					data: {
						name: data.name,
						description: data.description || null,
						location: data.location || null,
						listingUrl: data.listingUrl || null,
						listingTitle: data.listingTitle || null,
						listingCoverPhoto: data.coverPhoto || null,
						checkInDate,
						checkOutDate,
						totalCost,
						pricingModel: data.pricingModel || 'PER_PERSON',
						inviteCode,
						isPublished: false,
						maxGuests: data.maxGuests ? parseInt(data.maxGuests) : null,
						allowPartialStays: data.allowPartialStays || false,
						timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
					}
				});

				// Create TripMember record for the host
				await tx.tripMember.create({
					data: {
						tripId: newTrip.id,
						userId: user.id,
						role: 'host',
						inviteStatus: 'accepted'
					}
				});

				// Create rooms and beds
				for (const roomData of data.rooms) {
					// Privacy: use draft type if set, else infer — single-slot room = private (1.25), multi-slot = shared (1.0)
					const roomSlots = (roomData.beds || []).reduce(
						(sum: number, b: { quantity?: number; count?: number }) => sum + (b.quantity ?? b.count ?? 1),
						0
					);
					const privacyFactor =
						roomData.type === 'private'
							? 1.25
							: roomData.type === 'shared'
								? 1.0
								: roomSlots === 1
									? 1.25
									: 1.0;

					const room = await tx.room.create({
						data: {
							tripId: newTrip.id,
							name: roomData.name,
							maxOccupancy: roomData.maxOccupants || 2,
							photoUrls: roomData.photos || [],
							baseRateModifier: 1.0,
							privacyFactor
						}
					});

					// Create beds for this room
					if (roomData.beds && roomData.beds.length > 0) {
						for (const bedData of roomData.beds) {
							const bedType = bedData.bedType === 'CUSTOM' && bedData.customType 
								? bedData.customType.toLowerCase() 
								: bedData.bedType.toLowerCase();
							
							// Create multiple beds based on quantity
							for (let i = 0; i < (bedData.quantity || 1); i++) {
								await tx.bed.create({
									data: {
										roomId: room.id,
										bedType: bedType,
										capacity: bedData.bedType === 'KING' ? 2 : bedData.bedType === 'QUEEN' ? 2 : bedData.bedType === 'TWIN' ? 1 : bedData.bedType === 'BUNK' ? 2 : 1,
										capacitySlots: bedData.bedType === 'KING' ? 2 : bedData.bedType === 'QUEEN' ? 2 : bedData.bedType === 'TWIN' ? 1 : bedData.bedType === 'BUNK' ? 2 : 1,
										isAvailable: true
									}
								});
							}
						}
					}
				}

				return newTrip;
			});

			// Create meal plan if enabled (outside transaction to avoid timeout)
			if (data.enableMeals) {
				try {
					await prisma.mealPlan.create({
						data: {
							tripId: trip.id,
							enabled: true,
							mode: 'slots'
						}
					});

					// Create meal slots if meals are provided
					if (data.meals && data.meals.length > 0) {
						for (const mealData of data.meals) {
							if (mealData.date && mealData.name) {
								await prisma.mealSlot.create({
									data: {
										tripId: trip.id,
										mealType: 'dinner', // Default, can be customized
										date: new Date(mealData.date),
										menuText: mealData.name,
										capacityServings: null
									}
								});
							}
						}
					}
				} catch (mealError) {
					console.error('Error creating meal plan:', mealError);
					// Non-critical, continue
				}
			}

			// Send invites if requested (outside transaction to avoid timeout)
			if (data.inviteNow && data.inviteEmails && data.inviteEmails.length > 0) {
				// Import invite service
				const { createInvite } = await import('$lib/server/invite-service.js');
				
				for (const email of data.inviteEmails) {
					try {
						await createInvite({
							tripId: trip.id,
							invitedByUserId: user.id,
							channel: 'email',
							recipientEmail: email,
							message: data.inviteMessage || null
						});
					} catch (error) {
						console.error(`Failed to create invite for ${email}:`, error);
						// Continue with other invites even if one fails
					}
				}
			}

			// Redirect to trip management page
			throw redirect(303, `/trips/${trip.id}/manage`);
		} catch (error) {
			console.error('Error creating trip:', error);
			if (error && typeof error === 'object' && 'status' in error && error.status === 303) {
				throw error; // Re-throw redirects
			}
			return fail(500, {
				error: 'Failed to create trip. Please try again.'
			});
		}
	}
};
