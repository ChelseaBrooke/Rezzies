import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { z } from 'zod';
import { prisma } from '$lib/server/prisma.js';
import { calculateReservationPrice } from '$lib/server/pricing-canonical.js';
import { createSuccessResponse, createErrorResponse } from '$lib/server/validation.js';

const priceCalculationSchema = z.object({
	tripId: z.string().uuid(),
	roomId: z.number().int().positive(),
	bedId: z.string().uuid().optional(),
	numberOfSlots: z.number().int().positive().default(1),
	checkInDate: z.coerce.date(),
	checkOutDate: z.coerce.date()
}).refine((data) => data.checkOutDate > data.checkInDate, {
	message: 'Check-out date must be after check-in date',
	path: ['checkOutDate']
});

export const POST: RequestHandler = async (event) => {
	try {
		const body = await event.request.json();
		const validationResult = priceCalculationSchema.safeParse(body);
		
		if (!validationResult.success) {
			return json(
				createErrorResponse('VALIDATION_ERROR', 'Invalid price calculation data', validationResult.error.errors),
				400
			);
		}

		const { tripId, roomId, bedId, numberOfSlots, checkInDate, checkOutDate } = validationResult.data;

		// Verify the trip exists and the request is allowed:
		// Either the trip is published (public pricing) OR the requesting user is a member.
		const user = event.locals.user;
		const trip = await prisma.trip.findUnique({
			where: { id: tripId },
			select: { isPublished: true }
		});
		if (!trip) {
			return json(createErrorResponse('NOT_FOUND', 'Trip not found'), { status: 404 });
		}
		if (!trip.isPublished) {
			if (!user) {
				return json(createErrorResponse('UNAUTHORIZED', 'Authentication required'), { status: 401 });
			}
			const membership = await prisma.tripMember.findUnique({
				where: { tripId_userId: { tripId, userId: user.id } },
				select: { id: true }
			});
			if (!membership) {
				return json(createErrorResponse('FORBIDDEN', 'Access denied'), { status: 403 });
			}
		}

		const result = await calculateReservationPrice({
			tripId,
			roomId,
			bedId,
			numberOfSlots,
			checkInDate,
			checkOutDate
		});

		return json(createSuccessResponse({
			nights: result.nights,
			nightlyRate: result.perNightRate,
			totalPrice: result.totalPrice
		}));
	} catch (error) {
		console.error('Price calculation error:', error);
		return json(
			createErrorResponse('INTERNAL_ERROR', 'Failed to calculate price', error instanceof Error ? error.message : 'Unknown error'),
			500
		);
	}
};

