// Pricing calculation logic
// DO NOT CHANGE CONSTANTS UNLESS YOU WANT PRICING TO SHIFT

// Stay details
const TOTAL_STAY_COST = 7538;
const TOTAL_NIGHTS = 7;
const NIGHTLY_HOUSE_COST = TOTAL_STAY_COST / TOTAL_NIGHTS; // 1076.86

// Bed Base Weights (value of bed type)
const BED_BASE_WEIGHTS = {
	king: 1.35,
	queen: 1.15,
	twin: 0.85,
	bunk: 0.7
} as const;

// Room Sharing Modifiers (privacy penalty)
const ROOM_BED_COUNT_MODIFIER: Record<number, number> = {
	1: 1.0, // private room
	2: 0.92, // shared with 1 other bed
	3: 0.85 // shared with 2 other beds
};

// Bed type
type BedType = 'king' | 'queen' | 'twin' | 'bunk';

// Canonical Room + Bed Inventory
type Bed = {
	id: string;
	roomId: number;
	bedType: BedType;
};

const BEDS: Bed[] = [
	// Bedroom 1
	{ id: 'r1-king', roomId: 1, bedType: 'king' },
	{ id: 'r1-bunk-a', roomId: 1, bedType: 'bunk' },
	{ id: 'r1-bunk-b', roomId: 1, bedType: 'bunk' },

	// Bedroom 2
	{ id: 'r2-queen', roomId: 2, bedType: 'queen' },
	{ id: 'r2-bunk-a', roomId: 2, bedType: 'bunk' },
	{ id: 'r2-bunk-b', roomId: 2, bedType: 'bunk' },

	// Bedroom 3
	{ id: 'r3-queen', roomId: 3, bedType: 'queen' },
	{ id: 'r3-bunk-a', roomId: 3, bedType: 'bunk' },
	{ id: 'r3-bunk-b', roomId: 3, bedType: 'bunk' },

	// Bedroom 4
	{ id: 'r4-queen', roomId: 4, bedType: 'queen' },
	{ id: 'r4-twin', roomId: 4, bedType: 'twin' },

	// Bedroom 5
	{ id: 'r5-queen', roomId: 5, bedType: 'queen' },

	// Bedroom 6
	{ id: 'r6-queen', roomId: 6, bedType: 'queen' },

	// Bedroom 7
	{ id: 'r7-queen', roomId: 7, bedType: 'queen' },
	{ id: 'r7-bunk-a', roomId: 7, bedType: 'bunk' },
	{ id: 'r7-bunk-b', roomId: 7, bedType: 'bunk' },

	// Bedroom 8
	{ id: 'r8-queen', roomId: 8, bedType: 'queen' },
	{ id: 'r8-bunk-a', roomId: 8, bedType: 'bunk' },
	{ id: 'r8-bunk-b', roomId: 8, bedType: 'bunk' },

	// Bedroom 9
	{ id: 'r9-queen', roomId: 9, bedType: 'queen' },
	{ id: 'r9-twin', roomId: 9, bedType: 'twin' }
];

// Utility: Count Beds Per Room
function getRoomBedCounts(beds: Bed[]): Record<number, number> {
	return beds.reduce((acc, bed) => {
		acc[bed.roomId] = (acc[bed.roomId] || 0) + 1;
		return acc;
	}, {} as Record<number, number>);
}

// Compute Weight for Each Bed
type BedWithWeight = Bed & {
	baseWeight: number;
	roomModifier: number;
	effectiveWeight: number;
};

function calculateBedWeights(beds: Bed[]): BedWithWeight[] {
	const roomBedCounts = getRoomBedCounts(beds);

	return beds.map((bed) => {
		const baseWeight = BED_BASE_WEIGHTS[bed.bedType];
		const roomModifier = ROOM_BED_COUNT_MODIFIER[roomBedCounts[bed.roomId]] ?? 0.85;

		const effectiveWeight = baseWeight * roomModifier;

		return {
			...bed,
			baseWeight,
			roomModifier,
			effectiveWeight
		};
	});
}

// Calculate Total Weight Pool
function calculateTotalWeight(bedsWithWeights: BedWithWeight[]): number {
	return bedsWithWeights.reduce((sum, bed) => sum + bed.effectiveWeight, 0);
}

// Derive Dollar Value per Weight Unit
function calculatePricePerWeightUnit(): number {
	const bedsWithWeights = calculateBedWeights(BEDS);
	const totalWeight = calculateTotalWeight(bedsWithWeights);
	return NIGHTLY_HOUSE_COST / totalWeight;
}

// Guest Price Calculation (CORE FUNCTION)
export function calculateGuestPrice({
	bedId,
	checkInDate,
	checkOutDate
}: {
	bedId: string;
	checkInDate: Date;
	checkOutDate: Date;
}): {
	nights: number;
	nightlyRate: number;
	totalPrice: number;
} {
	const nights = Math.ceil(
		(checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24)
	);

	const bedsWithWeights = calculateBedWeights(BEDS);
	const pricePerWeightUnit = calculatePricePerWeightUnit();

	const selectedBed = bedsWithWeights.find((b) => b.id === bedId);
	if (!selectedBed) {
		throw new Error(`Invalid bed selection: ${bedId}`);
	}

	const nightlyRate = selectedBed.effectiveWeight * pricePerWeightUnit;
	const totalPrice = nightlyRate * nights;

	return {
		nights,
		nightlyRate: Number(nightlyRate.toFixed(2)),
		totalPrice: Number(totalPrice.toFixed(2))
	};
}

// Get all beds with their pricing info (for UI)
export function getAllBedsWithPricing(): Array<Bed & { nightlyRate: number }> {
	const bedsWithWeights = calculateBedWeights(BEDS);
	const pricePerWeightUnit = calculatePricePerWeightUnit();

	return bedsWithWeights.map((bed) => ({
		id: bed.id,
		roomId: bed.roomId,
		bedType: bed.bedType,
		nightlyRate: Number((bed.effectiveWeight * pricePerWeightUnit).toFixed(2))
	}));
}

// Get bed by ID
export function getBedById(bedId: string): Bed | undefined {
	return BEDS.find((b) => b.id === bedId);
}

// Get all beds for a room
export function getBedsByRoomId(roomId: number): Bed[] {
	return BEDS.filter((b) => b.roomId === roomId);
}

