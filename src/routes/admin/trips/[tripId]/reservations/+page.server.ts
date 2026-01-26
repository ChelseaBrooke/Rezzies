import type { PageServerLoad, Actions } from './$types';
import { prisma } from '$lib/server/prisma.js';

export const load: PageServerLoad = async ({ params }) => {
	const trip = await prisma.trip.findUnique({
		where: { id: params.tripId },
		include: {
			reservations: {
				include: {
					room: true,
					bed: true
				},
				orderBy: {
					submittedAt: 'desc'
				}
			}
		}
	});

	if (!trip) {
		return {
			trip: null,
			reservations: []
		};
	}

	// Calculate totals
	const totalRevenue = trip.reservations.reduce((sum, r) => sum + r.calculatedPrice, 0);
	const totalNights = trip.reservations.reduce((sum, r) => sum + r.nights, 0);

	return {
		trip,
		reservations: trip.reservations,
		stats: {
			totalReservations: trip.reservations.length,
			totalRevenue,
			totalNights,
			averagePrice: trip.reservations.length > 0 ? totalRevenue / trip.reservations.length : 0
		}
	};
};

export const actions: Actions = {
	exportCSV: async ({ params }) => {
		const trip = await prisma.trip.findUnique({
			where: { id: params.tripId },
			include: {
				reservations: {
					include: {
						room: true,
						bed: true
					},
					orderBy: {
						submittedAt: 'asc'
					}
				}
			}
		});

		if (!trip) {
			return { error: 'Trip not found' };
		}

		// Generate CSV
		const headers = ['Name', 'Email', 'Room', 'Bed', 'Check-in', 'Check-out', 'Nights', 'Guests', 'Total Price'];
		const rows = trip.reservations.map(r => [
			r.name,
			r.email,
			r.room.name,
			r.bed?.bedType || 'N/A',
			new Date(r.checkInDate).toLocaleDateString(),
			new Date(r.checkOutDate).toLocaleDateString(),
			r.nights.toString(),
			r.numberOfGuests.toString(),
			r.calculatedPrice.toFixed(2)
		]);

		const csv = [
			headers.join(','),
			...rows.map(row => row.map(cell => `"${cell}"`).join(','))
		].join('\n');

		return {
			csv,
			filename: `${trip.name.replace(/[^a-z0-9]/gi, '_')}_ledger.csv`
		};
	}
};
