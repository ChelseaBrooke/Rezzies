import { prisma } from '$lib/server/prisma.js';
import { sendBedRemovedEmails } from './notification-service.js';

/**
 * When a bed is removed: release all claims on that bed, create in-app notifications
 * for affected users, and send bed-removed emails. Call this before deleting the bed.
 */
export async function releaseBedClaimsAndNotify(bedId: string): Promise<{ affectedUserIds: string[] }> {
	const assignments = await prisma.roomAssignment.findMany({
		where: { bedId },
		include: {
			trip: { select: { id: true, name: true } },
			user: { select: { id: true, name: true, email: true } }
		}
	});

	const affectedUserIds = [...new Set(assignments.map((a) => a.userId))];

	if (affectedUserIds.length === 0) {
		await prisma.roomAssignment.deleteMany({ where: { bedId } });
		return { affectedUserIds: [] };
	}

	const tripId = assignments[0]?.tripId;
	const tripName = assignments[0]?.trip?.name ?? 'the trip';

	await prisma.$transaction([
		prisma.roomAssignment.deleteMany({ where: { bedId } }),
		...affectedUserIds.map((userId) =>
			prisma.notification.create({
				data: {
					userId,
					type: 'room_assigned',
					title: 'A bed you claimed was removed',
					message: `A bed on "${tripName}" was removed. Please log in and choose a new bed for your stay.`,
					relatedTripId: tripId ?? null
				}
			})
		)
	]);

	if (tripId) {
		const affectedUsers = assignments.map((a) => ({
			userId: a.userId,
			name: a.user?.name,
			email: a.user?.email
		}));
		sendBedRemovedEmails(tripId, tripName, affectedUsers);
	}

	return { affectedUserIds };
}
