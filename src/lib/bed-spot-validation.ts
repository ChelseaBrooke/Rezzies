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
		t === 'sofa' ||
		t === 'sofa_bed' ||
		t === 'futon'
	) {
		return 2;
	}
	return 1;
}

/** Wizard / API payload room list: sum (count × default slots per bed type) for each bed line. */
export function totalSleepSpotsFromWizardRooms(
	rooms: Array<{ beds?: Array<{ bedType?: string; count?: unknown }> }> | null | undefined
): number {
	if (!rooms?.length) return 0;
	let n = 0;
	for (const room of rooms) {
		for (const bed of room.beds ?? []) {
			const countRaw = bed.count;
			const c =
				typeof countRaw === 'number' && Number.isFinite(countRaw) && countRaw > 0
					? Math.floor(countRaw)
					: typeof countRaw === 'string' && countRaw.trim() !== ''
						? Math.max(1, parseInt(countRaw, 10) || 1)
						: 1;
			const slots = sleepSlotsDefaultForBedType(bed.bedType);
			n += c * slots;
		}
	}
	return n;
}

/** Sum effective sleep spots for persisted bed rows (same rule as RSVP). */
export function sumEffectiveSleepSpotsForBedRows(
	beds: Array<{
		id?: string;
		bedType?: string | null;
		capacitySlots?: number | null;
		capacity?: number | null;
	}>
): number {
	let n = 0;
	for (const b of beds) {
		n += effectiveSleepSlots({
			id: b.id ?? '',
			bedType: b.bedType,
			capacitySlots: b.capacitySlots,
			capacity: b.capacity
		});
	}
	return n;
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
	const seen = new Set<string>();
	for (const bedId of bedIds) {
		if (seen.has(bedId)) continue;
		seen.add(bedId);
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
