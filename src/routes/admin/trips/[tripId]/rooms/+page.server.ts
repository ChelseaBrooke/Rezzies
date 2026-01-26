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
				
				if (!extractedData || extractedData.rooms.length === 0) {
					console.warn('[Room Setup] No rooms extracted. Check server logs for details.');
				}
			} catch (error) {
				const errorMsg = error instanceof Error ? error.message : String(error);
				console.error('[Room Setup] Error extracting rooms/photos:', errorMsg);
				console.error('[Room Setup] Error details:', error);
				// Store error message so UI can display it
				extractedData = {
					rooms: [],
					photos: [],
					error: errorMsg
				};
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

			console.log('[Import Rooms] Starting import...');
			console.log('[Import Rooms] roomsJson length:', roomsJson?.length || 0);
			console.log('[Import Rooms] photosJson length:', photosJson?.length || 0);
			console.log('[Import Rooms] selectedPhotosJson length:', selectedPhotosJson?.length || 0);

			if (!roomsJson) {
				console.error('[Import Rooms] No rooms data provided');
				return fail(400, { error: 'No rooms data provided' });
			}

			let rooms, photos, selectedPhotos;
			try {
				rooms = JSON.parse(roomsJson);
				photos = photosJson ? JSON.parse(photosJson) : [];
				selectedPhotos = selectedPhotosJson ? JSON.parse(selectedPhotosJson) : [];
				console.log('[Import Rooms] Parsed data:', {
					roomsCount: rooms?.length || 0,
					photosCount: photos?.length || 0,
					selectedPhotosCount: selectedPhotos?.length || 0
				});
			} catch (parseError) {
				console.error('[Import Rooms] JSON parse error:', parseError);
				return fail(400, { 
					error: 'Invalid data format. Please try extracting rooms again.',
					details: parseError instanceof Error ? parseError.message : String(parseError)
				});
			}

			if (!Array.isArray(rooms) || rooms.length === 0) {
				console.error('[Import Rooms] Invalid rooms array:', rooms);
				return fail(400, { error: 'No valid rooms found in data' });
			}

			// Create rooms and beds from extracted data
			for (let roomIdx = 0; roomIdx < rooms.length; roomIdx++) {
				const roomData = rooms[roomIdx];
				const roomPhotos = selectedPhotos[roomIdx] || [];

				console.log(`[Import Rooms] Processing room ${roomIdx + 1}/${rooms.length}:`, {
					name: roomData.name,
					bedsCount: roomData.beds?.length || 0,
					photosCount: roomPhotos.length
				});

				if (!roomData.name) {
					console.error(`[Import Rooms] Room ${roomIdx} missing name:`, roomData);
					return fail(400, { error: `Room ${roomIdx + 1} is missing a name` });
				}

				if (!Array.isArray(roomData.beds) || roomData.beds.length === 0) {
					console.warn(`[Import Rooms] Room ${roomIdx} has no beds, creating room without beds`);
				}

				try {
					const room = await prisma.room.create({
						data: {
							tripId: params.tripId,
							name: roomData.name,
							description: roomData.description || undefined,
							maxOccupancy: roomData.maxOccupancy || undefined,
							photoUrls: Array.isArray(roomPhotos) ? roomPhotos : []
						}
					});

					console.log(`[Import Rooms] Created room: ${room.name} (ID: ${room.id})`);

					// Create beds for this room
					if (Array.isArray(roomData.beds)) {
						for (const bedData of roomData.beds) {
							if (!bedData.bedType) {
								console.warn(`[Import Rooms] Bed missing bedType, skipping:`, bedData);
								continue;
							}

							const quantity = bedData.quantity || 1;
							const capacity = bedData.capacity || (bedData.bedType === 'king' || bedData.bedType === 'queen' || bedData.bedType === 'full' || bedData.bedType === 'murphy' ? 2 : 1);
							const capacitySlots = bedData.bedType === 'bunk' ? 2 : 1;

							for (let i = 0; i < quantity; i++) {
								await prisma.bed.create({
									data: {
										roomId: room.id,
										bedType: bedData.bedType,
										capacity: capacity,
										capacitySlots: capacitySlots
									}
								});
							}
							console.log(`[Import Rooms] Created ${quantity} bed(s) of type ${bedData.bedType}`);
						}
					}
				} catch (dbError) {
					console.error(`[Import Rooms] Database error creating room ${roomIdx}:`, dbError);
					return fail(500, {
						error: `Failed to create room "${roomData.name}": ${dbError instanceof Error ? dbError.message : String(dbError)}`
					});
				}
			}

			console.log('[Import Rooms] Successfully imported all rooms');
			return { success: true, imported: true };
		} catch (error) {
			console.error('[Import Rooms] Unexpected error:', error);
			console.error('[Import Rooms] Error stack:', error instanceof Error ? error.stack : 'N/A');
			return fail(500, {
				error: 'Failed to import rooms. Please try again.',
				details: error instanceof Error ? error.message : String(error)
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
