import { fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { prisma } from '$lib/server/prisma.js';
import { tripCreationSchema } from '$lib/server/validation.js';
import { generateInviteCode } from '$lib/server/pricing.js';

export const load: PageServerLoad = async () => {
	return {};
};

export const actions: Actions = {
	create: async ({ request, cookies }) => {
		try {
			const formData = await request.formData();
			
			// Debug: Log all form data
			console.log('=== Form Data Received ===');
			for (const [key, value] of formData.entries()) {
				console.log(`${key}: ${value} (type: ${typeof value})`);
			}
			console.log('========================');

			// Extract and clean form data
			const name = formData.get('name') as string;
			const description = formData.get('description') as string;
			const listingUrl = formData.get('listingUrl') as string;
			const listingTitle = formData.get('listingTitle') as string;
			const listingCoverPhoto = formData.get('listingCoverPhoto') as string;
			const checkInDateStr = formData.get('checkInDate') as string;
			const checkOutDateStr = formData.get('checkOutDate') as string;
			const totalCostStr = formData.get('totalCost') as string;
			const pricingModelStr = formData.get('pricingModel') as string;
			const expectedPeopleCountStr = formData.get('expectedPeopleCount') as string;
			const maxGuestsStr = formData.get('maxGuests') as string;
			const allowPartialStaysStr = formData.get('allowPartialStays') as string;
			const bedWeightsStr = formData.get('bedWeights') as string;
			const sharingExponentAlphaStr = formData.get('sharingExponentAlpha') as string;
			const privacyPremiumPStr = formData.get('privacyPremiumP') as string;
			const enableMeals = formData.get('enableMeals') === 'true' || formData.get('enableMeals') === 'on';
			const enableActivities = formData.get('enableActivities') === 'true' || formData.get('enableActivities') === 'on';
			const enableExtras = formData.get('enableExtras') === 'true' || formData.get('enableExtras') === 'on';
			const selectedRoomPhotosStr = formData.get('selectedRoomPhotos') as string;

			// Validate required fields - check for empty strings too
			const missingFields: string[] = [];
			if (!name || name.trim() === '') missingFields.push('name');
			if (!checkInDateStr || checkInDateStr.trim() === '') missingFields.push('checkInDate');
			if (!checkOutDateStr || checkOutDateStr.trim() === '') missingFields.push('checkOutDate');
			if (!totalCostStr || totalCostStr.trim() === '') missingFields.push('totalCost');
			if (!pricingModelStr || pricingModelStr.trim() === '') missingFields.push('pricingModel');
			
			if (missingFields.length > 0) {
				return fail(400, {
					error: `Missing required fields: ${missingFields.join(', ')}`,
					details: Object.fromEntries(missingFields.map(f => [f, `${f} is required`]))
				});
			}

			const totalCost = Number(totalCostStr);
			if (isNaN(totalCost) || totalCost <= 0) {
				console.error(`Invalid totalCost: "${totalCostStr}" -> ${totalCost}`);
				return fail(400, {
					error: 'Invalid total cost',
					details: { 
						totalCost: `Total cost must be a positive number. Received: "${totalCostStr}" (parsed as: ${totalCost})` 
					}
				});
			}

			const checkInDate = new Date(checkInDateStr);
			const checkOutDate = new Date(checkOutDateStr);
			
			if (isNaN(checkInDate.getTime())) {
				console.error(`Invalid checkInDate: "${checkInDateStr}"`);
				return fail(400, {
					error: 'Invalid check-in date',
					details: { checkInDate: `Check-in date is invalid. Received: "${checkInDateStr}"` }
				});
			}
			
			if (isNaN(checkOutDate.getTime())) {
				console.error(`Invalid checkOutDate: "${checkOutDateStr}"`);
				return fail(400, {
					error: 'Invalid check-out date',
					details: { checkOutDate: `Check-out date is invalid. Received: "${checkOutDateStr}"` }
				});
			}
			
			if (checkOutDate <= checkInDate) {
				return fail(400, {
					error: 'Invalid date range',
					details: { checkOutDate: 'Check-out date must be after check-in date' }
				});
			}

			const pricingModel = pricingModelStr.toUpperCase() as 'PER_ROOM' | 'PER_BED' | 'PER_PERSON' | 'PER_PERSON_PER_NIGHT';
			if (!['PER_ROOM', 'PER_BED', 'PER_PERSON', 'PER_PERSON_PER_NIGHT'].includes(pricingModel)) {
				return fail(400, {
					error: 'Invalid pricing model',
					details: { pricingModel: 'Pricing model must be one of: PER_ROOM, PER_BED, PER_PERSON, PER_PERSON_PER_NIGHT' }
				});
			}

			const data = {
				name: name.trim(),
				description: description?.trim() || undefined,
				listingUrl: listingUrl?.trim() || undefined,
				listingTitle: listingTitle?.trim() || undefined,
				listingCoverPhoto: listingCoverPhoto?.trim() || undefined,
				checkInDate,
				checkOutDate,
				totalCost,
				pricingModel,
				expectedPeopleCount: expectedPeopleCountStr && expectedPeopleCountStr.trim() !== '' ? Number(expectedPeopleCountStr) : undefined,
				maxGuests: maxGuestsStr && maxGuestsStr.trim() !== '' ? Number(maxGuestsStr) : undefined,
				allowPartialStays: allowPartialStaysStr === 'true' || allowPartialStaysStr === 'on',
				bedWeights: bedWeightsStr?.trim() || undefined,
				sharingExponentAlpha: sharingExponentAlphaStr && sharingExponentAlphaStr.trim() !== '' ? Number(sharingExponentAlphaStr) : 0.60,
				privacyPremiumP: privacyPremiumPStr && privacyPremiumPStr.trim() !== '' ? Number(privacyPremiumPStr) : 0.00
			};

			// Validate
			const validationResult = tripCreationSchema.safeParse(data);
			if (!validationResult.success) {
				console.error('Validation errors:', validationResult.error.errors);
				console.error('Data being validated:', data);
				return fail(400, {
					error: 'Invalid trip data',
					details: validationResult.error.errors,
					formData: data
				});
			}

			// Generate unique invite code
			let inviteCode = generateInviteCode();
			let codeExists = true;
			while (codeExists) {
				const existing = await prisma.trip.findUnique({
					where: { inviteCode }
				});
				if (!existing) {
					codeExists = false;
				} else {
					inviteCode = generateInviteCode();
				}
			}

			// Get user session if available (for /trips/new route)
			const userSession = cookies.get('user_session');
			let userId: string | null = null;
			
			if (userSession) {
				// Try to get user from session
				const { getSessionUser } = await import('$lib/server/session.js');
				const user = await getSessionUser(cookies);
				userId = user?.id || null;
			}

			// Create trip
			const trip = await prisma.trip.create({
				data: {
					name: validationResult.data.name,
					description: validationResult.data.description,
					listingUrl: validationResult.data.listingUrl || null,
					listingTitle: validationResult.data.listingTitle || null,
					listingCoverPhoto: validationResult.data.listingCoverPhoto || null,
					checkInDate: validationResult.data.checkInDate,
					checkOutDate: validationResult.data.checkOutDate,
					totalCost: validationResult.data.totalCost,
					pricingModel: validationResult.data.pricingModel,
					inviteCode,
					expectedPeopleCount: validationResult.data.expectedPeopleCount || null,
					maxGuests: validationResult.data.maxGuests || null,
					allowPartialStays: validationResult.data.allowPartialStays,
					bedWeights: validationResult.data.bedWeights || null,
					sharingExponentAlpha: validationResult.data.sharingExponentAlpha,
					privacyPremiumP: validationResult.data.privacyPremiumP,
					isPublished: false,
					timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
					scrapePayload: formData.get('scrapePayload') as string || null
				}
			});

			// If created by a User (not AdminUser), create TripMember record
			if (userId) {
				await prisma.tripMember.create({
					data: {
						tripId: trip.id,
						userId: userId,
						role: 'host',
						inviteStatus: 'accepted'
					}
				});
			}

			// Create MealPlan if enabled
			if (enableMeals) {
				await prisma.mealPlan.create({
					data: {
						tripId: trip.id,
						enabled: true,
						mode: 'slots'
					}
				});
			}

			// Store selected room photos in scrapePayload for later use
			if (selectedRoomPhotosStr) {
				try {
					const roomPhotos = JSON.parse(selectedRoomPhotosStr);
					const currentPayload = trip.scrapePayload ? JSON.parse(trip.scrapePayload) : {};
					await prisma.trip.update({
						where: { id: trip.id },
						data: {
							scrapePayload: JSON.stringify({
								...currentPayload,
								selectedRoomPhotos: roomPhotos
							})
						}
					});
				} catch (e) {
					console.error('Error storing room photos:', e);
				}
			}

			// Redirect to room setup
			throw redirect(303, `/admin/trips/${trip.id}/rooms`);
		} catch (error) {
			if (error && typeof error === 'object' && 'status' in error && error.status === 303) {
				throw error; // Re-throw redirects
			}
			console.error('Trip creation error:', error);
			return fail(500, {
				error: 'Failed to create trip. Please try again.'
			});
		}
	}
};
