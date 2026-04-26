import { prisma } from './prisma.js';
import { sumEffectiveSleepSpotsForBedRows } from '$lib/bed-spot-validation.js';

/** Sum effective sleep spots for all beds on the trip (query-time; not stored). */
export async function getTotalSleepSpotsForTripId(tripId: string): Promise<number> {
	const beds = await prisma.bed.findMany({
		where: { room: { tripId } },
		select: { id: true, bedType: true, capacitySlots: true, capacity: true }
	});
	return sumEffectiveSleepSpotsForBedRows(beds);
}
