/**
 * Shared helpers for the guests page server module.
 * Extracted to reduce duplication between the assignBeds and updateGuestDetails actions.
 */

import { prisma } from '$lib/server/prisma.js';

export type WaitlistEntry = {
	userId: string;
	name: string;
	email: string;
	avatarUrl: string | null;
	waitlistPosition: number | null;
	waitlistJoinedAt: string | null;
	status: 'waitlisted';
};

/**
 * Parse check-in/check-out dates from form data, respecting partial-stay overrides.
 * Falls back to the trip's full-stay dates when partial stays are not allowed or not provided.
 */
export function parseTripDatesFromForm(
	formData: FormData,
	trip: { checkInDate: Date; checkOutDate: Date; allowPartialStays: boolean | null }
): { startDate: Date; endDate: Date } {
	let startDate: Date = trip.checkInDate;
	let endDate: Date = trip.checkOutDate;

	if (trip.allowPartialStays) {
		const startRaw = (formData.get('startDate') as string)?.trim();
		const endRaw = (formData.get('endDate') as string)?.trim();
		if (startRaw) {
			const d = new Date(startRaw);
			if (!Number.isNaN(d.getTime())) startDate = d;
		}
		if (endRaw) {
			const d = new Date(endRaw);
			if (!Number.isNaN(d.getTime())) endDate = d;
		}
	}

	return { startDate, endDate };
}

/**
 * Replace all bed assignments for a guest on a trip.
 * Deletes existing assignments, then creates one RoomAssignment per valid bed ID.
 * Silently skips bed IDs that don't belong to this trip.
 */
export async function applyBedAssignments(params: {
	tripId: string;
	userId: string;
	rawBedIds: FormDataEntryValue[];
	startDate: Date;
	endDate: Date;
}): Promise<void> {
	const { tripId, userId, rawBedIds, startDate, endDate } = params;

	const validBedIds = (Array.isArray(rawBedIds) ? rawBedIds : [rawBedIds])
		.filter((id): id is string => typeof id === 'string')
		.map((id) => id.trim())
		.filter((id) => id !== '');

	await prisma.roomAssignment.deleteMany({ where: { tripId, userId } });

	for (const bedId of validBedIds) {
		const bed = await prisma.bed.findFirst({
			where: { id: bedId },
			include: { room: { select: { id: true, tripId: true } } }
		});
		if (!bed || bed.room.tripId !== tripId) continue;
		await prisma.roomAssignment.create({
			data: {
				tripId,
				userId,
				roomId: bed.roomId,
				bedId: bed.id,
				bedType: bed.bedType,
				partySize: 1,
				startDate,
				endDate
			}
		});
	}
}
