/**
 * Pure helpers for party-size vs bed-spot validation (used by RSVP claim flow, APIs, and tests).
 */

export interface BedLike {
	id: string;
	capacitySlots?: number | null;
	capacity?: number | null;
	/** Used when DB still has legacy 1/1 for queen/king etc. */
	bedType?: string | null;
}

/**
 * Default sleep slots for a bed type (queen/king/full/bunk sleep two; twin one).
 * Matches trip wizard defaults in `trips/new/+page.server.ts`.
 */
export function sleepSlotsDefaultForBedType(bedType: string | null | undefined): number {
	const t = (bedType ?? 'other').toLowerCase().trim().replace(/\s+/g, '_');
	if (
		t === 'king' ||
		t === 'queen' ||
		t === 'california_king' ||
		t === 'cal_king' ||
		t === 'bunk' ||
		t === 'full' ||
		t === 'sofa_bed' ||
		t === 'futon'
	) {
		return 2;
	}
	return 1;
}

/**
 * Spots used for RSVP / party-size checks: at least the stored slots and at least the
 * bed-type default (fixes beds created with capacitySlots: 1 for every type).
 */
export function effectiveSleepSlots(bed: BedLike): number {
	const stored = bed.capacitySlots ?? bed.capacity ?? 1;
	const safeStored = Number.isFinite(stored) && stored > 0 ? stored : 1;
	return Math.max(safeStored, sleepSlotsDefaultForBedType(bed.bedType));
}

/** Capacity fields to persist when creating a new bed row. */
export function capacityFieldsForNewBed(bedType: string): { capacity: number; capacitySlots: number } {
	const n = sleepSlotsDefaultForBedType(bedType);
	return { capacity: n, capacitySlots: n };
}

/**
 * Sum of sleep spots for the given bed ids (see {@link effectiveSleepSlots}).
 */
export function totalSpotsForBeds(bedsById: Map<string, BedLike>, bedIds: string[]): number {
	let total = 0;
	for (const bedId of bedIds) {
		const bed = bedsById.get(bedId);
		if (!bed) continue;
		total += effectiveSleepSlots(bed);
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
