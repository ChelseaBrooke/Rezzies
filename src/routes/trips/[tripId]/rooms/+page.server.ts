import type { PageServerLoad } from './$types';
import { prisma } from '$lib/server/prisma.js';

export const load: PageServerLoad = async ({ parent, params }) => {
	const parentData = await parent();
	const tripId = params.tripId ?? '';
	const rooms = parentData.trip?.rooms ?? [];

	const roomAssignments = await prisma.roomAssignment.findMany({
		where: { tripId },
		include: {
			user: { select: { id: true, name: true, avatarUrl: true } },
			room: { select: { id: true, name: true } }
		}
	});

	return {
		trip: parentData.trip,
		rooms,
		roomAssignments,
		isHost: parentData.isHost ?? false
	};
};
