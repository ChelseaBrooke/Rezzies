/**
 * Pure helpers for party-size vs bed-spot validation (used by RSVP claim flow and tests).
 */

export interface BedLike {
	id: string;
	capacitySlots?: number | null;
	capacity?: number | null;
}

/**
 * Sum of sleep spots for the given bed ids. Uses capacitySlots ?? capacity ?? 1 per bed.
 */
export function totalSpotsForBeds(bedsById: Map<string, BedLike>, bedIds: string[]): number {
	let total = 0;
	for (const bedId of bedIds) {
		const bed = bedsById.get(bedId);
		if (!bed) continue;
		total += bed.capacitySlots ?? bed.capacity ?? 1;
	}
	return total;
}

/**
 * Whether the given total spots satisfy party size (guest + plus-ones). Solo (1) can claim any bed.
 */
export function hasEnoughSpots(totalSpots: number, partySize: number): boolean {
	return partySize >= 1 && totalSpots >= partySize;
}

/**
 * Check if an error is a Prisma unique constraint violation (P2002).
 */
export function isPrismaUniqueConflict(e: unknown): boolean {
	return typeof e === 'object' && e !== null && (e as { code?: string }).code === 'P2002';
}
