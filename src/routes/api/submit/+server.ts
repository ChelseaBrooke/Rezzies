import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireInternalApiKey } from '$lib/server/api-protection.js';
import { guestSubmissionSchema, createErrorResponse, createSuccessResponse } from '$lib/server/validation.js';
import { prisma } from '$lib/server/prisma.js';
import { calculateGuestPrice } from '$lib/server/pricing.js';
import { sendTemplateEmail } from '$lib/server/email/sendgrid.js';
import { TEMPLATE_KEYS } from '$lib/server/email/templates.js';

export const POST: RequestHandler = async (event) => {
	// Verify API key
	const authError = requireInternalApiKey(event);
	if (authError) {
		return authError;
	}

	try {
		const body = await event.request.json();
		
		// Validate input
		const validationResult = guestSubmissionSchema.safeParse(body);
		if (!validationResult.success) {
			return json(
				createErrorResponse('VALIDATION_ERROR', 'Invalid submission data', validationResult.error.errors),
				400
			);
		}

		const data = validationResult.data;

		// Verify bed exists and is available
		const bed = await prisma.bed.findUnique({
			where: { id: data.bedId },
			include: { room: true }
		});

		if (!bed) {
			return json(
				createErrorResponse('NOT_FOUND', 'Bed not found'),
				404
			);
		}

		if (!bed.isAvailable) {
			return json(
				createErrorResponse('UNAVAILABLE', 'Selected bed is no longer available'),
				409
			);
		}

		// Recalculate price server-side to prevent tampering
		const priceCalculation = calculateGuestPrice({
			bedId: data.bedId,
			checkInDate: data.checkInDate,
			checkOutDate: data.checkOutDate
		});

		// Check for existing submission for this bed (prevent double-booking)
		const existingSubmission = await prisma.guestSubmission.findFirst({
			where: {
				bedId: data.bedId,
				checkInDate: { lte: data.checkOutDate },
				checkOutDate: { gte: data.checkInDate }
			}
		});

		if (existingSubmission) {
			return json(
				createErrorResponse('CONFLICT', 'This bed is already booked for the selected dates'),
				409
			);
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
			},
			include: {
				room: true,
				bed: true
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

		return json(createSuccessResponse(submission), 201);
	} catch (error) {
		console.error('Submission error:', error);
		return json(
			createErrorResponse('INTERNAL_ERROR', 'Failed to process submission', error instanceof Error ? error.message : 'Unknown error'),
			500
		);
	}
};

