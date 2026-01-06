import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { z } from 'zod';
import { calculateGuestPrice } from '$lib/server/pricing.js';
import { createSuccessResponse, createErrorResponse } from '$lib/server/validation.js';

const priceCalculationSchema = z.object({
	bedId: z.string(),
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

		const { bedId, checkInDate, checkOutDate } = validationResult.data;
		
		const result = calculateGuestPrice({
			bedId,
			checkInDate,
			checkOutDate
		});

		return json(createSuccessResponse(result));
	} catch (error) {
		console.error('Price calculation error:', error);
		return json(
			createErrorResponse('INTERNAL_ERROR', 'Failed to calculate price', error instanceof Error ? error.message : 'Unknown error'),
			500
		);
	}
};

