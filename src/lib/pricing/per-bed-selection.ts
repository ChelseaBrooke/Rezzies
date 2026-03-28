/**
 * Selection-based PER_BED simulation (shared: wizard UI + server).
 * Low = others take heaviest beds first; high = others take lightest first.
 */

export interface PerBedSelectionUnit {
	bedId: string;
	weight: number;
}

export function perBedLowHighForUnit(
	totalCost: number,
	expectedGuestCount: number,
	unitWeights: number[],
	unitIndex: number
): { low: number; high: number } {
	const n = unitWeights.length;
	if (n === 0 || unitIndex < 0 || unitIndex >= n || totalCost <= 0) return { low: 0, high: 0 };
	const k = Math.min(Math.max(1, expectedGuestCount), n);
	const remG = k - 1;
	const wSelf = unitWeights[unitIndex];
	if (wSelf <= 0) return { low: 0, high: 0 };
	const others = unitWeights.filter((_, i) => i !== unitIndex);
	const desc = [...others].sort((a, b) => b - a);
	const asc = [...others].sort((a, b) => a - b);
	const sumHighOthers = desc.slice(0, remG).reduce((s, x) => s + x, 0);
	const sumLowOthers = asc.slice(0, remG).reduce((s, x) => s + x, 0);
	const denomLow = wSelf + sumHighOthers;
	const denomHigh = wSelf + sumLowOthers;
	if (denomLow <= 0 || denomHigh <= 0) return { low: totalCost, high: totalCost };
	return {
		low: (totalCost / denomLow) * wSelf,
		high: (totalCost / denomHigh) * wSelf
	};
}

export function computePerBedRangeByBedId(
	totalCost: number,
	expectedGuestCount: number,
	units: PerBedSelectionUnit[]
): Map<string, { low: number; high: number }> {
	const weights = units.map((u) => u.weight);
	const map = new Map<string, { low: number; high: number }>();
	for (let i = 0; i < units.length; i++) {
		map.set(units[i].bedId, perBedLowHighForUnit(totalCost, expectedGuestCount, weights, i));
	}
	return map;
}
