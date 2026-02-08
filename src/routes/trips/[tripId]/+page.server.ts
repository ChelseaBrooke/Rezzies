import type { PageServerLoad } from './$types';
import { prisma } from '$lib/server/prisma.js';

export const load: PageServerLoad = async ({ parent, params }) => {
	const parentData = await parent();
	const user = parentData.user;
	const trip = parentData.trip;
	if (!user || !trip) return parentData;

	const [userRsvp, userProfile, userInvoices, roomAssignments] = await Promise.all([
		prisma.rSVP.findFirst({ where: { tripId: params.tripId, userId: user.id } }),
		prisma.guestProfile.findFirst({ where: { tripId: params.tripId, userId: user.id } }),
		prisma.invoice.findMany({
			where: { tripId: params.tripId, userId: user.id },
			orderBy: { createdAt: 'desc' }
		}),
		prisma.roomAssignment.findMany({
			where: { tripId: params.tripId },
			include: {
				room: { select: { id: true, name: true } },
				user: { select: { id: true, name: true } }
			}
		})
	]);

	return {
		...parentData,
		userRsvp,
		userProfile,
		userInvoices,
		roomAssignments
	};
};
