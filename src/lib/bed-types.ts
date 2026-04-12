/**
 * Canonical bed type definitions shared across client and server.
 */

export const BED_TYPES = [
	'king',
	'queen',
	'twin',
	'full',
	'bunk',
	'sofa_bed',
	'air_mattress',
	'other'
] as const;

export type BedType = (typeof BED_TYPES)[number];

export const BED_TYPE_LABELS: Record<BedType, string> = {
	king: 'King',
	queen: 'Queen',
	twin: 'Twin',
	full: 'Full',
	bunk: 'Bunk',
	sofa_bed: 'Sofa Bed',
	air_mattress: 'Air Mattress',
	other: 'Other'
};

export function normalizeBedType(raw: string | null | undefined): BedType {
	if (!raw) return 'other';
	const t = raw.trim().toLowerCase().replace(/\s+/g, '_');
	return BED_TYPES.includes(t as BedType) ? (t as BedType) : 'other';
}

export function isValidBedType(value: string): value is BedType {
	return BED_TYPES.includes(value as BedType);
}
