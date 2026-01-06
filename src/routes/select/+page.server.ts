import { fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { prisma } from '$lib/server/prisma.js';
import { getAllBedsWithPricing, getBedsByRoomId } from '$lib/server/pricing.js';
import { guestSubmissionSchema } from '$lib/server/validation.js';
import { calculateGuestPrice } from '$lib/server/pricing.js';
import { sendTemplateEmail } from '$lib/server/email/sendgrid.js';
import { TEMPLATE_KEYS } from '$lib/server/email/templates.js';

export const load: PageServerLoad = async () => {
	// Get all rooms with their beds
	const rooms = await prisma.room.findMany({
		include: {
			beds: {
				where: { isAvailable: true },
				orderBy: { bedType: 'asc' }
			}
		},
		orderBy: { id: 'asc' }
	});

	// Get pricing for all beds
	const bedsWithPricing = getAllBedsWithPricing();
	const pricingMap = new Map(bedsWithPricing.map(b => [b.id, b.nightlyRate]));

	// Get existing submissions to check availability
	const submissions = await prisma.guestSubmission.findMany({
		select: {
			bedId: true,
			checkInDate: true,
			checkOutDate: true
		}
	});

	// Enrich rooms with pricing and availability
	const enrichedRooms = rooms.map(room => {
		const canonicalBeds = getBedsByRoomId(room.id);
		
		return {
			...room,
			beds: canonicalBeds.map(bed => {
				const dbBed = room.beds.find(b => b.id === bed.id);
				const nightlyRate = pricingMap.get(bed.id) || 0;
				
				// Check if bed is booked for any overlapping dates
				const isBooked = submissions.some(sub => {
					return sub.bedId === bed.id;
				});

				return {
					id: bed.id,
					bedType: bed.bedType,
					capacity: dbBed?.capacity || 1,
					nightlyRate,
					isAvailable: dbBed?.isAvailable && !isBooked
				};
			})
		};
	});

	return {
		rooms: enrichedRooms
	};
};

export const actions: Actions = {
	default: async ({ request }) => {
		try {
			const formData = await request.formData();
			
			const data = {
				name: formData.get('name') as string,
				email: formData.get('email') as string,
				roomId: Number(formData.get('roomId')),
				bedId: formData.get('bedId') as string,
				checkInDate: new Date(formData.get('checkInDate') as string),
				checkOutDate: new Date(formData.get('checkOutDate') as string)
			};

			// Recalculate price server-side
			const priceCalculation = calculateGuestPrice({
				bedId: data.bedId,
				checkInDate: data.checkInDate,
				checkOutDate: data.checkOutDate
			});

			// Validate input
			const validationResult = guestSubmissionSchema.safeParse({
				...data,
				nights: priceCalculation.nights,
				calculatedPrice: priceCalculation.totalPrice
			});

			if (!validationResult.success) {
				return fail(400, {
					error: 'Invalid submission data',
					details: validationResult.error.errors
				});
			}

			// Verify bed exists and is available
			const bed = await prisma.bed.findUnique({
				where: { id: data.bedId },
				include: { room: true }
			});

			if (!bed) {
				return fail(404, { error: 'Bed not found' });
			}

			if (!bed.isAvailable) {
				return fail(409, { error: 'Selected bed is no longer available' });
			}

			// Check for existing submission for this bed (prevent double-booking)
			const existingSubmission = await prisma.guestSubmission.findFirst({
				where: {
					bedId: data.bedId,
					checkInDate: { lte: data.checkOutDate },
					checkOutDate: { gte: data.checkInDate }
				}
			});

			if (existingSubmission) {
				return fail(409, { error: 'This bed is already booked for the selected dates' });
			}

			// Create submission
			const submission = await prisma.guestSubmission.create({
				data: {
					name: data.name,
					email: data.email,
					roomId: data.roomId,
					bedId: data.bedId,
					checkInDate: data.checkInDate,
					checkOutDate: data.checkOutDate,
					nights: priceCalculation.nights,
					calculatedPrice: priceCalculation.totalPrice
				}
			});

			// Send confirmation email
			await sendTemplateEmail({
				to: data.email,
				templateId: TEMPLATE_KEYS.GUEST_CONFIRMATION,
				dynamicTemplateData: {
					guestName: data.name,
					roomName: bed.room.name,
					bedType: bed.bedType,
					checkInDate: data.checkInDate.toISOString().split('T')[0],
					checkOutDate: data.checkOutDate.toISOString().split('T')[0],
					nights: priceCalculation.nights,
					totalPrice: priceCalculation.totalPrice.toFixed(2),
					confirmationUrl: `${process.env.APP_BASE_URL || 'http://localhost:5173'}/confirmation/${submission.id}`
				},
				categories: ['guest-confirmation']
			});

			throw redirect(303, `/confirmation/${submission.id}`);
		} catch (error) {
			if (error && typeof error === 'object' && 'status' in error && error.status === 303) {
				throw error; // Re-throw redirects
			}
			console.error('Submission error:', error);
			return fail(500, {
				error: 'Failed to process submission. Please try again.'
			});
		}
	}
};

