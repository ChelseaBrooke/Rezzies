import { fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { getSessionUser } from '$lib/server/session.js';
import { prisma } from '$lib/server/prisma.js';
import { tripCreationSchema } from '$lib/server/validation.js';
import { generateInviteCode } from '$lib/server/pricing.js';

export const load: PageServerLoad = async ({ cookies }) => {
	const user = await getSessionUser(cookies);
	if (!user) {
		throw redirect(303, '/login?redirect=/trips/new/autofill');
	}
	return { user };
};

export const actions: Actions = {
	create: async ({ request, cookies }) => {
		const user = await getSessionUser(cookies);
		if (!user) {
			throw redirect(303, '/login');
		}

		try {
			const formData = await request.formData();
			
			// Extract form data (same as admin version)
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
			const scrapePayloadStr = formData.get('scrapePayload') as string;

			// Validate required fields
			const missingFields: string[] = [];
			if (!name || name.trim() === '') missingFields.push('name');
			if (!checkInDateStr || checkInDateStr.trim() === '') missingFields.push('checkInDate');
			if (!checkOutDateStr || checkOutDateStr.trim() === '') missingFields.push('checkOutDate');
			if (!totalCostStr || totalCostStr.trim() === '') missingFields.push('totalCost');
			if (!pricingModelStr || pricingModelStr.trim() === '') missingFields.push('pricingModel');
			
			if (missingFields.length > 0) {
				return fail(400, {
					error: `Missing required fields: ${missingFields.join(', ')}`
				});
			}

			const totalCost = Number(totalCostStr);
			if (isNaN(totalCost) || totalCost <= 0) {
				return fail(400, {
					error: 'Invalid total cost'
				});
			}

			const checkInDate = new Date(checkInDateStr);
			const checkOutDate = new Date(checkOutDateStr);
			
			if (isNaN(checkInDate.getTime()) || isNaN(checkOutDate.getTime())) {
				return fail(400, {
					error: 'Invalid dates'
				});
			}
			
			if (checkOutDate <= checkInDate) {
				return fail(400, {
					error: 'Check-out date must be after check-in date'
				});
			}

			const pricingModel = pricingModelStr.toUpperCase() as 'PER_ROOM' | 'PER_BED' | 'PER_PERSON' | 'PER_PERSON_PER_NIGHT';
			if (!['PER_ROOM', 'PER_BED', 'PER_PERSON', 'PER_PERSON_PER_NIGHT'].includes(pricingModel)) {
				return fail(400, {
					error: 'Invalid pricing model'
				});
			}

			// Generate unique invite code
			const inviteCode = generateInviteCode();

			// Create trip with User as host (no hostId, we'll use TripMember)
			const trip = await prisma.trip.create({
				data: {
					name,
					description: description || null,
					listingUrl: listingUrl || null,
					listingTitle: listingTitle || null,
					listingCoverPhoto: listingCoverPhoto || null,
					checkInDate,
					checkOutDate,
					totalCost,
					pricingModel,
					inviteCode,
					isPublished: false,
					expectedPeopleCount: expectedPeopleCountStr ? Number(expectedPeopleCountStr) : null,
					maxGuests: maxGuestsStr ? Number(maxGuestsStr) : null,
					allowPartialStays: allowPartialStaysStr === 'true',
					bedWeights: bedWeightsStr || null,
					sharingExponentAlpha: sharingExponentAlphaStr ? Number(sharingExponentAlphaStr) : 0.60,
					privacyPremiumP: privacyPremiumPStr ? Number(privacyPremiumPStr) : 0.00,
					scrapePayload: scrapePayloadStr || null,
					timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
				}
			});

			// Create TripMember record for the host
			await prisma.tripMember.create({
				data: {
					tripId: trip.id,
					userId: user.id,
					role: 'host',
					inviteStatus: 'accepted'
				}
			});

			throw redirect(303, `/admin/trips/${trip.id}/rooms`);
		} catch (error) {
			console.error('Error creating trip:', error);
			if (error && typeof error === 'object' && 'status' in error && error.status === 303) {
				throw error; // Re-throw redirects
			}
			return fail(500, {
				error: 'Failed to create trip'
			});
		}
	}
};
