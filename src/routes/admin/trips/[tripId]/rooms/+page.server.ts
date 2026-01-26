import { fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { prisma } from '$lib/server/prisma.js';
import { roomCreationSchema, bedCreationSchema } from '$lib/server/validation.js';

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

	return {
		trip
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
