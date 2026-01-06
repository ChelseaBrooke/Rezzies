import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { prisma } from '$lib/server/prisma.js';
import { getAllBedsWithPricing, getBedsByRoomId } from '$lib/server/pricing.js';
import { createSuccessResponse, createErrorResponse } from '$lib/server/validation.js';

export const GET: RequestHandler = async () => {
	try {
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
						// Simple check: if there's any submission for this bed, mark as unavailable
						// More sophisticated overlap checking can be added if needed
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

		return json(createSuccessResponse(enrichedRooms));
	} catch (error) {
		console.error('Error fetching rooms:', error);
		return json(
			createErrorResponse('INTERNAL_ERROR', 'Failed to fetch rooms', error instanceof Error ? error.message : 'Unknown error'),
			500
		);
	}
};

