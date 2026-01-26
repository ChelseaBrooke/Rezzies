// Canonical Pricing Model for Rezzies
// Implements sleep-slot based pricing with bed weights, sharing discounts, and privacy premiums

import { prisma } from './prisma.js';

export type PricingMode = 'PER_ROOM' | 'PER_PERSON' | 'PER_BED' | 'PER_PERSON_PER_NIGHT';

export interface BedWeights {
	[key: string]: number; // e.g., { "king": 1.00, "queen": 0.75, "twin": 0.50 }
}

export interface PricingSettings {
	bedWeights: BedWeights;
	sharingExponentAlpha: number; // 0.3-0.9, default 0.60
	privacyPremiumP: number; // 0-0.25, default 0.00
}

export interface RoomPricing {
	roomId: number;
	occMax: number; // Total sleep slots in room
	bedWeightSum: number;
	slotValueBase: number;
	slotValue: number; // Final slot value after privacy premium
	slotPriceFullStay: number; // Price per slot for full stay
	roomPriceFullStay: number; // Total room price for full stay
	slotPricePerNight: number;
	roomPricePerNight: number;
}

export interface ComputedPricing {
	tripId: string;
	totalNights: number;
	totalValueAllSlots: number;
	dollarsPerValueUnit: number;
	roomPricing: RoomPricing[];
	totalSlots: number;
}

export interface ReservationPriceParams {
	tripId: string;
	roomId: number;
	bedId?: string;
	numberOfSlots: number;
	checkInDate: Date;
	checkOutDate: Date;
}

// Default bed weights
export const DEFAULT_BED_WEIGHTS: BedWeights = {
	king: 1.00,
	queen: 0.75,
	full: 0.70,
	twin: 0.50,
	bunk: 0.50, // Per slot in bunk
	sofa: 0.40,
	other: 0.60
};

/**
 * Calculate nights between two dates (end exclusive)
 */
export function calculateNights(startDate: Date, endDate: Date): number {
	return Math.ceil(
		(endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
	);
}

/**
 * Parse bed weights from JSON string or use defaults
 */
function parseBedWeights(weightsJson: string | null): BedWeights {
	if (!weightsJson) {
		return DEFAULT_BED_WEIGHTS;
	}
	try {
		const parsed = JSON.parse(weightsJson);
		return { ...DEFAULT_BED_WEIGHTS, ...parsed };
	} catch {
		return DEFAULT_BED_WEIGHTS;
	}
}

/**
 * Compute canonical pricing for all rooms in a trip
 * This is the core function that reconciles all pricing to tripTotal
 */
export async function computeRoomPricing(
	tripId: string
): Promise<ComputedPricing> {
	const trip = await prisma.trip.findUnique({
		where: { id: tripId },
		include: {
			rooms: {
				include: {
					beds: true
				}
			}
		}
	});

	if (!trip) {
		throw new Error('Trip not found');
	}

	if (trip.rooms.length === 0) {
		throw new Error('Trip has no rooms configured');
	}

	const totalNights = calculateNights(trip.checkInDate, trip.checkOutDate);
	const bedWeights = parseBedWeights(trip.bedWeights);
	const sharingAlpha = trip.sharingExponentAlpha || 0.60;
	const privacyP = trip.privacyPremiumP || 0.00;

	// Step 1: Calculate bed weight sum and occMax for each room
	const roomData = trip.rooms.map(room => {
		let bedWeightSum = 0;
		let occMax = 0;

		for (const bed of room.beds) {
			const bedWeight = bedWeights[bed.bedType.toLowerCase()] || bedWeights.other;
			const slots = bed.capacitySlots || bed.capacity || 1;
			bedWeightSum += bedWeight * slots;
			occMax += slots;
		}

		return {
			roomId: room.id,
			occMax,
			bedWeightSum
		};
	});

	// Find max occupancy for privacy normalization
	const occMaxMax = Math.max(...roomData.map(r => r.occMax), 1);

	// Step 2: Calculate per-slot value base (with sharing discount)
	const roomPricing: RoomPricing[] = roomData.map(room => {
		// Apply sharing discount
		const roomValueDiscounted = room.bedWeightSum / Math.pow(room.occMax, sharingAlpha);
		const slotValueBase = roomValueDiscounted / room.occMax;

		// Apply privacy premium
		let privacyMultiplier = 1.0;
		if (occMaxMax > 1 && privacyP > 0) {
			const privacyNorm = 1 - ((room.occMax - 1) / (occMaxMax - 1));
			privacyMultiplier = 1 + (privacyP * privacyNorm);
		}

		const slotValue = slotValueBase * privacyMultiplier;

		return {
			roomId: room.roomId,
			occMax: room.occMax,
			bedWeightSum: room.bedWeightSum,
			slotValueBase,
			slotValue,
			slotPriceFullStay: 0, // Will be calculated after scaling
			roomPriceFullStay: 0,
			slotPricePerNight: 0,
			roomPricePerNight: 0
		};
	});

	// Step 3: Calculate total value and scaling factor
	const totalValueAllSlots = roomPricing.reduce(
		(sum, r) => sum + (r.slotValue * r.occMax),
		0
	);

	if (totalValueAllSlots === 0) {
		throw new Error('Total value is zero - check bed configuration');
	}

	const dollarsPerValueUnit = trip.totalCost / totalValueAllSlots;

	// Step 4: Scale to dollars
	const totalSlots = roomPricing.reduce((sum, r) => sum + r.occMax, 0);

	for (const room of roomPricing) {
		room.slotPriceFullStay = dollarsPerValueUnit * room.slotValue;
		room.roomPriceFullStay = room.slotPriceFullStay * room.occMax;
		room.slotPricePerNight = room.slotPriceFullStay / totalNights;
		room.roomPricePerNight = room.roomPricePerNight / totalNights;
	}

	// Sanity check: sum should equal tripTotal (within rounding)
	const sumCheck = roomPricing.reduce((sum, r) => sum + r.roomPriceFullStay, 0);
	const diff = Math.abs(sumCheck - trip.totalCost);
	if (diff > 0.01) {
		console.warn(`Pricing reconciliation warning: sum=${sumCheck}, expected=${trip.totalCost}, diff=${diff}`);
	}

	return {
		tripId,
		totalNights,
		totalValueAllSlots,
		dollarsPerValueUnit,
		roomPricing,
		totalSlots
	};
}

/**
 * Calculate price for a reservation using canonical model
 */
export async function calculateReservationPrice(
	params: ReservationPriceParams
): Promise<{
	nights: number;
	stayFactor: number;
	slotPriceForStay: number;
	totalPrice: number;
	perNightRate: number;
}> {
	const { tripId, roomId, numberOfSlots, checkInDate, checkOutDate } = params;

	const trip = await prisma.trip.findUnique({
		where: { id: tripId }
	});

	if (!trip) {
		throw new Error('Trip not found');
	}

	// Check partial stays
	const stayNights = calculateNights(checkInDate, checkOutDate);
	const totalNights = calculateNights(trip.checkInDate, trip.checkOutDate);
	const stayFactor = stayNights / totalNights;

	if (!trip.allowPartialStays && stayFactor < 1.0) {
		throw new Error('Partial stays are not allowed for this trip');
	}

	// Validate dates are within trip range
	if (checkInDate < trip.checkInDate || checkOutDate > trip.checkOutDate) {
		throw new Error('Reservation dates must be within trip dates');
	}

	// Get computed pricing
	const pricing = await computeRoomPricing(tripId);
	const roomPricing = pricing.roomPricing.find(r => r.roomId === roomId);

	if (!roomPricing) {
		throw new Error('Room not found in pricing');
	}

	// Calculate price
	const slotPriceForStay = roomPricing.slotPriceFullStay * stayFactor;
	const totalPrice = slotPriceForStay * numberOfSlots;
	const perNightRate = roomPricing.slotPricePerNight * numberOfSlots;

	return {
		nights: stayNights,
		stayFactor,
		slotPriceForStay,
		totalPrice: Math.round(totalPrice * 100) / 100, // Round to cents
		perNightRate: Math.round(perNightRate * 100) / 100
	};
}

/**
 * Get pricing preview for a specific mode
 */
export async function getPricingPreview(
	tripId: string,
	mode: PricingMode
): Promise<{
	mode: PricingMode;
	perPersonFullStay?: number;
	perRoomFullStay?: number;
	perBedFullStay?: { bedType: string; price: number }[];
	perPersonPerNight?: number;
	roomBreakdown?: RoomPricing[];
}> {
	const pricing = await computeRoomPricing(tripId);
	const trip = await prisma.trip.findUnique({
		where: { id: tripId },
		include: { rooms: { include: { beds: true } } }
	});

	if (!trip) {
		throw new Error('Trip not found');
	}

	switch (mode) {
		case 'PER_PERSON': {
			const expectedPeople = trip.expectedPeopleCount || pricing.totalSlots;
			return {
				mode,
				perPersonFullStay: Math.round((trip.totalCost / expectedPeople) * 100) / 100
			};
		}

		case 'PER_ROOM': {
			const perRoom = Math.round((trip.totalCost / pricing.roomPricing.length) * 100) / 100;
			return {
				mode,
				perRoomFullStay: perRoom,
				roomBreakdown: pricing.roomPricing
			};
		}

		case 'PER_BED': {
			// Group by bed type and calculate average
			const bedPrices: { [key: string]: number[] } = {};
			for (const room of trip.rooms || []) {
				for (const bed of room.beds) {
					const roomP = pricing.roomPricing.find(r => r.roomId === room.id);
					if (roomP) {
						const bedPrice = roomP.slotPriceFullStay * (bed.capacitySlots || bed.capacity || 1);
						if (!bedPrices[bed.bedType]) {
							bedPrices[bed.bedType] = [];
						}
						bedPrices[bed.bedType].push(bedPrice);
					}
				}
			}

			const perBed = Object.entries(bedPrices).map(([bedType, prices]) => ({
				bedType,
				price: Math.round((prices.reduce((a, b) => a + b, 0) / prices.length) * 100) / 100
			}));

			return {
				mode,
				perBedFullStay: perBed
			};
		}

		case 'PER_PERSON_PER_NIGHT': {
			const perPersonPerNight = Math.round((trip.totalCost / pricing.totalNights / pricing.totalSlots) * 100) / 100;
			return {
				mode,
				perPersonPerNight,
				roomBreakdown: pricing.roomPricing
			};
		}
	}
}
