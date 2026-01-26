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

			const data = {
				name: formData.get('name') as string,
				description: formData.get('description') as string || undefined,
				listingUrl: formData.get('listingUrl') as string || undefined,
				listingTitle: formData.get('listingTitle') as string || undefined,
				listingCoverPhoto: formData.get('listingCoverPhoto') as string || undefined,
				checkInDate: new Date(formData.get('checkInDate') as string),
				checkOutDate: new Date(formData.get('checkOutDate') as string),
				totalCost: Number(formData.get('totalCost')),
				pricingModel: (formData.get('pricingModel') as string).toUpperCase() as 'PER_ROOM' | 'PER_BED' | 'PER_PERSON' | 'PER_PERSON_PER_NIGHT',
				expectedPeopleCount: formData.get('expectedPeopleCount') ? Number(formData.get('expectedPeopleCount')) : undefined,
				maxGuests: formData.get('maxGuests') ? Number(formData.get('maxGuests')) : undefined,
				allowPartialStays: formData.get('allowPartialStays') === 'true' || formData.get('allowPartialStays') === 'on',
				bedWeights: formData.get('bedWeights') as string || null,
				sharingExponentAlpha: Number(formData.get('sharingExponentAlpha')) || 0.60,
				privacyPremiumP: Number(formData.get('privacyPremiumP')) || 0.00
			};

			// Validate
			const validationResult = tripCreationSchema.safeParse(data);
			if (!validationResult.success) {
				return fail(400, {
					error: 'Invalid trip data',
					details: validationResult.error.errors
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
					isPublished: false
				}
			});

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
