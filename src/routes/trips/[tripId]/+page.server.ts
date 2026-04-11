import type { PageServerLoad } from './$types';
import { prisma } from '$lib/server/prisma.js';
import { calculatePrice } from '$lib/server/pricing.js';

export const load: PageServerLoad = async ({ parent, params }) => {
	const parentData = await parent();
	const user = parentData.user;
	const trip = parentData.trip;
	if (!user || !trip) return parentData;

	const tripId = params.tripId;
	const [userRsvp, userInvoices, roomAssignments] = await Promise.all([
		prisma.rSVP.findFirst({ where: { tripId, userId: user.id } }),
		prisma.invoice.findMany({
			where: { tripId, userId: user.id },
			orderBy: { createdAt: 'desc' }
		}),
		prisma.roomAssignment.findMany({
			where: { tripId },
			include: {
				room: { select: { id: true, name: true, photoUrls: true } },
				bed: { select: { id: true, bedType: true } },
				user: { select: { id: true, name: true } }
			}
		})
	]);

	// Guest dashboard: current price for this user's reservation (may change as more people RSVP)
	let userReservationPrice: number | null = null;
	const isHost = parentData.isHost === true;
	if (!isHost && trip.checkInDate && trip.checkOutDate) {
		const myAssignments = roomAssignments.filter((a) => a.userId === user.id);
		if (myAssignments.length > 0) {
			const results = await Promise.all(
				myAssignments.map((a) =>
					calculatePrice({
						tripId,
						roomId: a.roomId,
						bedId: a.bedId ?? undefined,
						numberOfGuests: a.partySize ?? 1,
						checkInDate: trip.checkInDate!,
						checkOutDate: trip.checkOutDate!
					})
				)
			);
			const total = results.reduce((sum, r) => sum + r.totalPrice, 0);
			userReservationPrice = Math.round(total * 100) / 100;
		}
	}

	return {
		...parentData,
		userRsvp,
		userInvoices,
		roomAssignments,
		userReservationPrice
	};
};
