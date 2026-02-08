import { prisma } from '$lib/server/prisma.js';

/**
 * When a bed is removed: release all claims on that bed, create in-app notifications
 * for affected users, and optionally send email. Call this before deleting the bed.
 */
export async function releaseBedClaimsAndNotify(bedId: string): Promise<{ affectedUserIds: string[] }> {
	const assignments = await prisma.roomAssignment.findMany({
		where: { bedId },
		include: {
			trip: { select: { id: true, name: true } },
			user: { select: { id: true, email: true } }
		}
	});

	const affectedUserIds = [...new Set(assignments.map((a) => a.userId))];

	if (affectedUserIds.length === 0) {
		await prisma.roomAssignment.deleteMany({ where: { bedId } });
		return { affectedUserIds: [] };
	}

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
					relatedTripId: assignments[0]?.tripId ?? null
				}
			})
		)
	]);

	// TODO: send email via sendTemplateEmail when BED_REMOVED template exists
	return { affectedUserIds };
}
