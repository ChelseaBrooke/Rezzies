import type { PageServerLoad } from './$types';
import { prisma } from '$lib/server/prisma.js';
import { calculatePrice } from '$lib/server/pricing.js';
import { roomTypeDisplayLabel } from '$lib/room-type-display.js';

const assignmentInclude = {
	room: { select: { id: true, name: true, photoUrls: true } as const },
	bed: { select: { id: true, bedType: true } as const },
	user: { select: { id: true, name: true } as const }
} as const;

function vacationStayRoomLabelFromRows(
	mine: Array<{
		roomId: number;
		room: { name: string | null } | null;
	}>,
	layoutRooms: Array<{ id: number; name: string; roomType?: string | null }>
): string | null {
	if (!mine.length) return null;
	for (const a of mine) {
		const fromJoin = a.room?.name?.trim();
		if (fromJoin) return fromJoin;
		const row = layoutRooms.find((r) => r.id === a.roomId);
		if (row?.name?.trim()) return row.name.trim();
		if (row) return roomTypeDisplayLabel(row);
	}
	return null;
}

export const load: PageServerLoad = async ({ parent, params }) => {
	const parentData = await parent();
	const user = parentData.user;
	const trip = parentData.trip;
	if (!user || !trip) return parentData;

	const tripId = params.tripId;
	const isHost = parentData.isHost === true;
	const [userRsvp, userInvoices, roomAssignments, guestRoomAssignments] = await Promise.all([
		prisma.rSVP.findFirst({ where: { tripId, userId: user.id } }),
		prisma.invoice.findMany({
			where: { tripId, userId: user.id },
			orderBy: { createdAt: 'desc' }
		}),
		prisma.roomAssignment.findMany({
			where: { tripId },
			include: assignmentInclude
		}),
		isHost
			? Promise.resolve([])
			: prisma.roomAssignment.findMany({
					where: { tripId, userId: user.id },
					include: assignmentInclude
				})
	]);

	const layoutRooms = (trip.rooms ?? []) as Array<{ id: number; name: string; roomType?: string | null }>;
	const vacationStayRoomLabel = !isHost
		? vacationStayRoomLabelFromRows(guestRoomAssignments, layoutRooms)
		: null;

	// Guest dashboard: current price for this user's reservation (may change as more people RSVP)
	let userReservationPrice: number | null = null;
	if (!isHost && trip.checkInDate && trip.checkOutDate) {
		const myAssignments = guestRoomAssignments.length > 0 ? guestRoomAssignments : roomAssignments.filter((a) => a.userId === user.id);
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
		guestRoomAssignments,
		vacationStayRoomLabel,
		userReservationPrice
	};
};
