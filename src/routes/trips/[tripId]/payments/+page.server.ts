import { fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { createInvoiceForUser } from '$lib/server/invoice-calculator.js';
import { isTripHostOrCoHost } from '$lib/server/trip-access.js';
import { getSessionUser } from '$lib/server/session.js';
import { prisma } from '$lib/server/prisma.js';

export const load: PageServerLoad = async ({ parent, params }) => {
	const parentData = await parent();
	const tripId = parentData.trip?.id;
	const user = parentData.user;
	const canManageGuests = !!(parentData.isHost || parentData.membership?.role === 'co-host');

	const myInvoice =
		tripId && user
			? await createInvoiceForUser(tripId, user.id)
			: null;

	type LegacyRow = {
		id: string;
		name: string;
		email: string;
		roomName: string;
		bedType: string | null;
		checkInDate: string;
		checkOutDate: string;
		nights: number;
		numberOfGuests: number;
		calculatedPrice: number;
		submittedAt: string;
	};
	type LegacyStats = {
		totalReservations: number;
		totalRevenue: number;
		totalNights: number;
		averagePrice: number;
	};
	let legacyReservations: LegacyRow[] = [];
	let legacyStats: LegacyStats | null = null;

	if (tripId && canManageGuests) {
		const reservations = await prisma.reservation.findMany({
			where: { tripId },
			include: { room: true, bed: true },
			orderBy: { submittedAt: 'desc' }
		});
		legacyReservations = reservations.map((r) => ({
			id: r.id,
			name: r.name,
			email: r.email,
			roomName: r.room.name,
			bedType: r.bed?.bedType ?? null,
			checkInDate: r.checkInDate.toISOString(),
			checkOutDate: r.checkOutDate.toISOString(),
			nights: r.nights,
			numberOfGuests: r.numberOfGuests,
			calculatedPrice: r.calculatedPrice,
			submittedAt: r.submittedAt.toISOString()
		}));
		const totalRevenue = reservations.reduce((s, r) => s + r.calculatedPrice, 0);
		legacyStats = {
			totalReservations: reservations.length,
			totalRevenue,
			totalNights: reservations.reduce((s, r) => s + r.nights, 0),
			averagePrice: reservations.length > 0 ? totalRevenue / reservations.length : 0
		};
	}

	return {
		trip: parentData.trip,
		invoices: parentData.trip?.invoices ?? [],
		myInvoice,
		canManageGuests,
		legacyReservations,
		legacyStats
	};
};

export const actions: Actions = {
	exportLegacyBookings: async ({ params, cookies }) => {
		const user = await getSessionUser(cookies);
		if (!user) return fail(401, { message: 'Not logged in' });
		const canManage = await isTripHostOrCoHost(params.tripId, user.id);
		if (!canManage) return fail(403, { message: 'Only host or co-host can export' });

		const trip = await prisma.trip.findUnique({
			where: { id: params.tripId },
			include: {
				reservations: {
					include: { room: true, bed: true },
					orderBy: { submittedAt: 'asc' }
				}
			}
		});
		if (!trip) return fail(404, { message: 'Trip not found' });

		const headers = ['Name', 'Email', 'Room', 'Bed', 'Check-in', 'Check-out', 'Nights', 'Guests', 'Total Price'];
		const rows = trip.reservations.map((r) => [
			r.name,
			r.email,
			r.room.name,
			r.bed?.bedType ?? 'N/A',
			new Date(r.checkInDate).toLocaleDateString(),
			new Date(r.checkOutDate).toLocaleDateString(),
			r.nights.toString(),
			r.numberOfGuests.toString(),
			r.calculatedPrice.toFixed(2)
		]);
		const csv = [headers.join(','), ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))].join('\n');
		const filename = `${trip.name.replace(/[^a-z0-9]/gi, '_')}_legacy_bookings.csv`;

		return { exportLegacyCsv: csv, exportLegacyFilename: filename };
	}
};
