import { fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { prisma } from '$lib/server/prisma.js';
import { roomCreationSchema, bedCreationSchema } from '$lib/server/validation.js';
import { calculatePricingDisplay } from '$lib/server/pricing-display.js';
import { extractPropertyRoomsAndPhotos } from '$lib/server/room-extractor.js';

export const load: PageServerLoad = async ({ params }) => {
	const trip = await prisma.trip.findUnique({
		where: { id: params.tripId },
		include: {
			rooms: {
				include: {
					beds: true
				},
				orderBy: {
					id: 'asc'
				}
			}
		}
	});

	if (!trip) {
		throw redirect(303, '/admin');
	}

	// Calculate pricing display
	let pricingDisplay = null;
	let extractedData = null;
	
	try {
		if (trip.rooms.length > 0) {
			pricingDisplay = await calculatePricingDisplay(params.tripId);
		}
		
		// If trip has listingUrl and no rooms yet, fetch extracted data
		if (trip.listingUrl && trip.rooms.length === 0) {
			try {
				console.log(`[Room Setup] Attempting to extract rooms from: ${trip.listingUrl}`);
				extractedData = await extractPropertyRoomsAndPhotos(trip.listingUrl);
				console.log(`[Room Setup] Extraction result:`, {
					roomsFound: extractedData?.rooms?.length || 0,
					photosFound: extractedData?.photos?.length || 0,
					rooms: extractedData?.rooms
				});
			} catch (error) {
				console.error('[Room Setup] Error extracting rooms/photos:', error);
				// Continue without extracted data
			}
		} else {
			console.log(`[Room Setup] Skipping extraction - listingUrl: ${trip.listingUrl ? 'exists' : 'missing'}, rooms.length: ${trip.rooms.length}`);
		}
	} catch (error) {
		console.error('Error calculating pricing:', error);
		// Continue without pricing display
	}

	return {
		trip,
		pricingDisplay,
		extractedData
	};
};

export const actions: Actions = {
	createRoom: async ({ request, params }) => {
		try {
			const formData = await request.formData();

			const data = {
				tripId: params.tripId,
				name: formData.get('name') as string,
				description: formData.get('description') as string || undefined,
				maxOccupancy: formData.get('maxOccupancy') ? Number(formData.get('maxOccupancy')) : undefined
			};

			const validationResult = roomCreationSchema.safeParse(data);
			if (!validationResult.success) {
				return fail(400, {
					error: 'Invalid room data',
					details: validationResult.error.errors
				});
			}

			await prisma.room.create({
				data: validationResult.data
			});

			return { success: true };
		} catch (error) {
			console.error('Room creation error:', error);
			return fail(500, {
				error: 'Failed to create room. Please try again.'
			});
		}
	},

	createBed: async ({ request }) => {
		try {
			const formData = await request.formData();

			const data = {
				roomId: Number(formData.get('roomId')),
				bedType: formData.get('bedType') as string,
				capacity: Number(formData.get('capacity')) || 1,
				capacitySlots: Number(formData.get('capacitySlots')) || 1
			};

			const validationResult = bedCreationSchema.safeParse(data);
			if (!validationResult.success) {
				return fail(400, {
					error: 'Invalid bed data',
					details: validationResult.error.errors
				});
			}

			await prisma.bed.create({
				data: validationResult.data
			});

			return { success: true };
		} catch (error) {
			console.error('Bed creation error:', error);
			return fail(500, {
				error: 'Failed to create bed. Please try again.'
			});
		}
	},

	deleteRoom: async ({ request }) => {
		try {
			const formData = await request.formData();
			const roomId = Number(formData.get('roomId'));

			await prisma.room.delete({
				where: { id: roomId }
			});

			return { success: true };
		} catch (error) {
			console.error('Room deletion error:', error);
			return fail(500, {
				error: 'Failed to delete room. Please try again.'
			});
		}
	},

	deleteBed: async ({ request }) => {
		try {
			const formData = await request.formData();
			const bedId = formData.get('bedId') as string;

			await prisma.bed.delete({
				where: { id: bedId }
			});

			return { success: true };
		} catch (error) {
			console.error('Bed deletion error:', error);
			return fail(500, {
				error: 'Failed to delete bed. Please try again.'
			});
		}
	},

	importRooms: async ({ request, params }) => {
		try {
			const formData = await request.formData();
			const roomsJson = formData.get('rooms') as string;
			const photosJson = formData.get('photos') as string;
			const selectedPhotosJson = formData.get('selectedPhotos') as string;

			if (!roomsJson) {
				return fail(400, { error: 'No rooms data provided' });
			}

			const rooms = JSON.parse(roomsJson);
			const photos = photosJson ? JSON.parse(photosJson) : [];
			const selectedPhotos = selectedPhotosJson ? JSON.parse(selectedPhotosJson) : [];

			// Create rooms and beds from extracted data
			for (let roomIdx = 0; roomIdx < rooms.length; roomIdx++) {
				const roomData = rooms[roomIdx];
				const roomPhotos = selectedPhotos[roomIdx] || [];

				const room = await prisma.room.create({
					data: {
						tripId: params.tripId,
						name: roomData.name,
						description: roomData.description || undefined,
						maxOccupancy: roomData.maxOccupancy || undefined,
						photoUrls: roomPhotos // Set selected photos
					}
				});

				// Create beds for this room
				for (const bedData of roomData.beds) {
					for (let i = 0; i < bedData.quantity; i++) {
						await prisma.bed.create({
							data: {
								roomId: room.id,
								bedType: bedData.bedType,
								capacity: bedData.capacity || 1,
								capacitySlots: bedData.bedType === 'bunk' ? 2 : 1
							}
						});
					}
				}
			}

			return { success: true, imported: true };
		} catch (error) {
			console.error('Import rooms error:', error);
			return fail(500, {
				error: 'Failed to import rooms. Please try again.'
			});
		}
	},

	publish: async ({ params }) => {
		try {
			// Check if trip has at least one room
			const trip = await prisma.trip.findUnique({
				where: { id: params.tripId },
				include: {
					rooms: {
						include: {
							beds: true
						}
					}
				}
			});

			if (!trip) {
				return fail(404, { error: 'Trip not found' });
			}

			if (trip.rooms.length === 0) {
				return fail(400, { error: 'Please add at least one room before publishing' });
			}

			const roomsWithoutBeds = trip.rooms.filter(r => r.beds.length === 0);
			if (roomsWithoutBeds.length > 0 && trip.pricingModel !== 'per_room') {
				return fail(400, { error: 'All rooms must have at least one bed' });
			}

			await prisma.trip.update({
				where: { id: params.tripId },
				data: { isPublished: true }
			});

			return { success: true, published: true };
		} catch (error) {
			console.error('Publish error:', error);
			return fail(500, {
				error: 'Failed to publish trip. Please try again.'
			});
		}
	}
};
