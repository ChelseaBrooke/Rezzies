import { fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { prisma } from '$lib/server/prisma.js';
import { getSessionUser } from '$lib/server/session.js';
import { reservationSchema } from '$lib/server/validation.js';
import { calculateReservationPrice, computeRoomPricing } from '$lib/server/pricing-canonical.js';
import { sendTemplateEmail } from '$lib/server/email/sendgrid.js';
import { TEMPLATE_KEYS } from '$lib/server/email/templates.js';

export const load: PageServerLoad = async ({ params, cookies }) => {
	const trip = await prisma.trip.findUnique({
		where: { inviteCode: params.inviteCode },
		include: {
			rooms: {
				include: {
					beds: {
						where: { isAvailable: true }
					}
				},
				orderBy: { id: 'asc' }
			}
		}
	});

	if (!trip) {
		throw redirect(303, '/');
	}

	if (!trip.isPublished) {
		throw redirect(303, '/');
	}

	// If user is logged in, add them as a trip member (guest) if not already, then send to trip dashboard
	const user = await getSessionUser(cookies);
	if (user) {
		const existing = await prisma.tripMember.findUnique({
			where: {
				tripId_userId: { tripId: trip.id, userId: user.id }
			}
		});
		if (existing) {
			throw redirect(303, `/trips/${trip.id}`);
		}
		await prisma.tripMember.create({
			data: {
				tripId: trip.id,
				userId: user.id,
				role: 'guest',
				inviteStatus: 'accepted'
			}
		});
		throw redirect(303, `/trips/${trip.id}`);
	}

	// Not logged in: show reservation/landing page
	const reservations = await prisma.reservation.findMany({
		where: { tripId: trip.id },
		select: {
			bedId: true,
			roomId: true,
			checkInDate: true,
			checkOutDate: true
		}
	});

	return {
		trip,
		reservations
	};
};

export const actions: Actions = {
	reserve: async ({ request, params }) => {
		try {
			const formData = await request.formData();

			// Verify trip exists and is published
			const trip = await prisma.trip.findUnique({
				where: { inviteCode: params.inviteCode }
			});

			if (!trip || !trip.isPublished) {
				return fail(404, { error: 'Trip not found or not available' });
			}

			// Get bed to determine numberOfSlots
			const bedId = formData.get('bedId') as string || undefined;
			let numberOfSlots = Number(formData.get('numberOfSlots')) || 1;
			
			if (bedId) {
				const bed = await prisma.bed.findUnique({
					where: { id: bedId }
				});
				if (bed) {
					numberOfSlots = bed.capacitySlots || bed.capacity || 1;
				}
			}

			const data = {
				tripId: trip.id,
				name: formData.get('name') as string,
				email: formData.get('email') as string,
				roomId: Number(formData.get('roomId')),
				bedId: bedId,
				numberOfGuests: Number(formData.get('numberOfGuests')) || numberOfSlots,
				checkInDate: new Date(formData.get('checkInDate') as string),
				checkOutDate: new Date(formData.get('checkOutDate') as string)
			};

			// Validate dates are within trip dates
			if (data.checkInDate < trip.checkInDate || data.checkOutDate > trip.checkOutDate) {
				return fail(400, {
					error: 'Selected dates must be within the trip dates'
				});
			}

			// Validate input
			const validationResult = reservationSchema.safeParse(data);
			if (!validationResult.success) {
				return fail(400, {
					error: 'Invalid reservation data',
					details: validationResult.error.errors
				});
			}

			// Calculate price using canonical model
			const priceCalculation = await calculateReservationPrice({
				tripId: trip.id,
				roomId: data.roomId,
				bedId: data.bedId,
				numberOfSlots: numberOfSlots,
				checkInDate: data.checkInDate,
				checkOutDate: data.checkOutDate
			});

			// Get pricing snapshot for locking
			const pricingSnapshot = JSON.stringify(await computeRoomPricing(trip.id));

			// Check for existing reservation conflicts
			if (data.bedId) {
				const existingReservation = await prisma.reservation.findFirst({
					where: {
						bedId: data.bedId,
						checkInDate: { lte: data.checkOutDate },
						checkOutDate: { gte: data.checkInDate }
					}
				});

				if (existingReservation) {
					return fail(409, {
						error: 'This bed is already booked for the selected dates'
					});
				}
			}

			// Create reservation
			const reservation = await prisma.reservation.create({
				data: {
					...validationResult.data,
					nights: priceCalculation.nights,
					numberOfSlots: numberOfSlots,
					calculatedPrice: priceCalculation.totalPrice,
					pricingSnapshot: pricingSnapshot
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
					roomName: reservation.room.name,
					bedType: reservation.bed?.bedType || 'N/A',
					checkInDate: data.checkInDate.toISOString().split('T')[0],
					checkOutDate: data.checkOutDate.toISOString().split('T')[0],
					nights: priceCalculation.nights,
					totalPrice: priceCalculation.totalPrice.toFixed(2),
					confirmationUrl: `${process.env.APP_BASE_URL || 'http://localhost:5173'}/confirmation/${reservation.id}`
				},
				categories: ['guest-confirmation']
			});

			throw redirect(303, `/confirmation/${reservation.id}`);
		} catch (error) {
			if (error && typeof error === 'object' && 'status' in error && error.status === 303) {
				throw error; // Re-throw redirects
			}
			console.error('Reservation error:', error);
			return fail(500, {
				error: 'Failed to process reservation. Please try again.'
			});
		}
	}
};
