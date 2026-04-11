import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { prisma } from '$lib/server/prisma.js';
import { createSuccessResponse, createErrorResponse } from '$lib/server/validation.js';

export const GET: RequestHandler = async () => {
	try {
		const [rooms, submissions] = await Promise.all([
			prisma.room.findMany({
				include: {
					beds: {
						where: { isAvailable: true },
						orderBy: { bedType: 'asc' }
					}
				},
				orderBy: { id: 'asc' }
			}),
			prisma.guestSubmission.findMany({
				select: { bedId: true }
			})
		]);

		const bookedBedIds = new Set(submissions.map((s) => s.bedId));

		const enrichedRooms = rooms.map((room) => ({
			...room,
			beds: room.beds.map((bed) => ({
				id: bed.id,
				bedType: bed.bedType,
				capacity: bed.capacity ?? 1,
				isAvailable: bed.isAvailable && !bookedBedIds.has(bed.id)
			}))
		}));

		return json(createSuccessResponse(enrichedRooms));
	} catch (error) {
		console.error('Error fetching rooms:', error);
		return json(
			createErrorResponse(
				'INTERNAL_ERROR',
				'Failed to fetch rooms',
				error instanceof Error ? error.message : 'Unknown error'
			),
			500
		);
	}
};

