/**
 * Occupancy-aware PER_BED simulation (shared: wizard UI + server).
 * LOW  = maximum sharing + highest-value beds filled (cheapest per person).
 * HIGH = minimum sharing + lowest-value beds filled (most expensive per person).
 */

export interface PerBedSelectionUnit {
	bedId: string;
	weight: number;
	spotCount: number; // max occupants for this bed (>= 1)
}

export interface PerBedRange {
	/** Bed price under cheapest-per-person scenario */
	lowBedPrice: number;
	/** Bed price under most-expensive-per-person scenario */
	highBedPrice: number;
	/** Per-person price at lowest (this bed at full capacity, others heaviest-first) */
	lowPerPersonPrice: number;
	/** Per-person price at highest (1 occupant on this bed, others lightest-first) */
	highPerPersonPrice: number;
}

/**
 * Cheapest scenario for bed at unitIndex.
 * Goal: maximize totalWeight → minimise this bed's share → lowest per-person.
 *
 * Step A: fill THIS bed first (up to spotCount or all guests).
 * Step B: fill other beds heaviest-first, each to spotCount, until guests exhausted.
 * Weight is added once per bed that receives at least one guest.
 */
function cheapestOccupancy(
	totalCost: number,
	units: PerBedSelectionUnit[],
	unitIndex: number,
	k: number
): { bedPrice: number; perPersonPrice: number } {
	const u = units[unitIndex];
	const thisOccupants = Math.min(u.spotCount, k);
	let remaining = k - thisOccupants;

	// Sort other beds heaviest-first
	const others = units.filter((_, i) => i !== unitIndex).sort((a, b) => b.weight - a.weight);

	let totalWeight = u.weight;
	for (const other of others) {
		if (remaining <= 0) break;
		const take = Math.min(other.spotCount, remaining);
		// take >= 1 because remaining > 0 and spotCount >= 1
		totalWeight += other.weight;
		remaining -= take;
	}

	if (totalWeight <= 0) return { bedPrice: 0, perPersonPrice: 0 };
	const bedPrice = totalCost * (u.weight / totalWeight);
	return { bedPrice, perPersonPrice: bedPrice / thisOccupants };
}

/**
 * Most expensive scenario for bed at unitIndex.
 * Goal: minimise totalWeight → maximise this bed's share → highest per-person.
 *
 * Step A: only 1 occupant on THIS bed.
 * Step B (Pass 1): place 1 guest per other bed, lightest-first. Weight added once per bed.
 * Step C (Pass 2): if guests remain, fill extra spots lightest-first. Weight NOT added again.
 */
function mostExpensiveOccupancy(
	totalCost: number,
	units: PerBedSelectionUnit[],
	unitIndex: number,
	k: number
): { bedPrice: number; perPersonPrice: number } {
	const u = units[unitIndex];
	let remaining = k - 1; // 1 occupant on this bed

	// Sort other beds lightest-first
	const others = units.filter((_, i) => i !== unitIndex).sort((a, b) => a.weight - b.weight);
	const usedSpots = new Array(others.length).fill(0);

	// Pass 1: 1 per bed (adds each bed's weight once)
	let totalWeight = u.weight;
	for (let i = 0; i < others.length && remaining > 0; i++) {
		usedSpots[i] = 1;
		totalWeight += others[i].weight; // weight counted once here
		remaining--;
	}

	// Pass 2: fill additional spots, weight already counted, do NOT add again
	for (let i = 0; i < others.length && remaining > 0; i++) {
		const extra = others[i].spotCount - usedSpots[i];
		if (extra > 0) {
			const take = Math.min(extra, remaining);
			usedSpots[i] += take;
			remaining -= take;
		}
	}

	if (totalWeight <= 0) return { bedPrice: 0, perPersonPrice: 0 };
	const bedPrice = totalCost * (u.weight / totalWeight);
	return { bedPrice, perPersonPrice: bedPrice }; // 1 occupant on this bed
}

export function perBedOccupancyRangeForUnit(
	totalCost: number,
	expectedGuestCount: number,
	units: PerBedSelectionUnit[],
	unitIndex: number
): PerBedRange {
	const n = units.length;
	if (n === 0 || unitIndex < 0 || unitIndex >= n || totalCost <= 0 || expectedGuestCount <= 0) {
		return { lowBedPrice: 0, highBedPrice: 0, lowPerPersonPrice: 0, highPerPersonPrice: 0 };
	}

	// Global clamp: never simulate more guests than total spots across all beds
	const totalSpots = units.reduce((s, u) => s + u.spotCount, 0);
	const k = Math.min(Math.max(1, expectedGuestCount), totalSpots);

	const u = units[unitIndex];

	// Edge case: all guests fit on this bed alone, no other beds participate
	if (k <= u.spotCount) {
		const bedPrice = totalCost; // only bed in denominator
		return {
			lowBedPrice: bedPrice,
			highBedPrice: bedPrice,
			lowPerPersonPrice: bedPrice / k,  // everyone shares this bed
			highPerPersonPrice: bedPrice       // solo occupant worst case
		};
	}

	const cheap = cheapestOccupancy(totalCost, units, unitIndex, k);
	const expensive = mostExpensiveOccupancy(totalCost, units, unitIndex, k);

	// Normalise: ensure low ≤ high in both dimensions
	const [lowBed, highBed] =
		cheap.bedPrice <= expensive.bedPrice
			? [cheap.bedPrice, expensive.bedPrice]
			: [expensive.bedPrice, cheap.bedPrice];
	const [lowPP, highPP] =
		cheap.perPersonPrice <= expensive.perPersonPrice
			? [cheap.perPersonPrice, expensive.perPersonPrice]
			: [expensive.perPersonPrice, cheap.perPersonPrice];

	return {
		lowBedPrice: lowBed,
		highBedPrice: highBed,
		lowPerPersonPrice: lowPP,
		highPerPersonPrice: highPP
	};
}

export function computePerBedRangeByBedId(
	totalCost: number,
	expectedGuestCount: number,
	units: PerBedSelectionUnit[]
): Map<string, PerBedRange> {
	const map = new Map<string, PerBedRange>();
	for (let i = 0; i < units.length; i++) {
		map.set(units[i].bedId, perBedOccupancyRangeForUnit(totalCost, expectedGuestCount, units, i));
	}
	return map;
}

/**
 * Backward-compat: returns bed-price low/high only (spotCount = 1 for all units).
 */
export function perBedLowHighForUnit(
	totalCost: number,
	expectedGuestCount: number,
	unitWeights: number[],
	unitIndex: number
): { low: number; high: number } {
	const units: PerBedSelectionUnit[] = unitWeights.map((w, i) => ({
		bedId: `u${i}`,
		weight: w,
		spotCount: 1
	}));
	const r = perBedOccupancyRangeForUnit(totalCost, expectedGuestCount, units, unitIndex);
	return { low: r.lowBedPrice, high: r.highBedPrice };
}
