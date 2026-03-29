/** Minimal room/bed shape for counting spots (wizard draft or API payload). */
export type RoomLike = { beds?: Array<{ count?: number }> };

/**
 * Total bed slots: sum of each bed row’s `count` (defaults to 1 if missing/invalid).
 */
export function totalBedSpotCount(rooms: RoomLike[] | null | undefined): number {
	if (!rooms?.length) return 0;
	let n = 0;
	for (const room of rooms) {
		for (const bed of room.beds ?? []) {
			const c = Number(bed.count);
			n += Number.isFinite(c) && c > 0 ? Math.floor(c) : 1;
		}
	}
	return n;
}

/**
 * Max headcount used for pricing when the host did not enter a trip-level max:
 * falls back to bed spot count, then to min headcount. Does not mutate the draft.
 */
export function effectiveMaxHeadcount(
	expectedGuestCount: number,
	hostMaxOccupancy: number,
	rooms: RoomLike[] | null | undefined
): number {
	const expected = Math.max(1, Number(expectedGuestCount) || 1);
	const hostMax = Number(hostMaxOccupancy);
	const spots = totalBedSpotCount(rooms);
	const capacityCap = hostMax > 0 ? hostMax : spots > 0 ? spots : expected;
	return Math.max(expected, capacityCap);
}
