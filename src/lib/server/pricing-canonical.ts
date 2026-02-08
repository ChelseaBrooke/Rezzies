// Canonical Pricing Model for Divvi
// Per-bed and per-room pricing use bed-type weights and room privacy factors.
// See PRICING_MATH.md for formulas.

import { prisma } from './prisma.js';

export type PricingMode = 'PER_ROOM' | 'PER_PERSON' | 'PER_BED' | 'PER_PERSON_PER_NIGHT';

export interface BedWeights {
	[key: string]: number; // e.g., { "king": 1.3, "queen": 1.2, "twin": 1.0 }
}

export interface PricingSettings {
	bedWeights: BedWeights;
	sharingExponentAlpha: number; // legacy
	privacyPremiumP: number; // legacy; privacy now via Room.privacyFactor
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

// Default bed weights (universal). Per-bed pricing: larger beds cost more.
export const DEFAULT_BED_WEIGHTS: BedWeights = {
	twin: 1.0,
	single: 1.0,
	bunk: 0.9,
	full: 1.1,
	double: 1.1,
	queen: 1.2,
	king: 1.3,
	sofa: 0.85,
	sofa_bed: 0.85,
	air_mattress: 0.75,
	other: 1.0
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
 * Normalize bed type for weight lookup: lowercase, spaces -> underscore
 */
function normalizeBedType(bedType: string | null): string {
	if (!bedType || !bedType.trim()) return 'other';
	return bedType.trim().toLowerCase().replace(/\s+/g, '_');
}

export function getBedWeight(weights: BedWeights, bedType: string | null): number {
	const key = normalizeBedType(bedType);
	return weights[key] ?? weights.other ?? DEFAULT_BED_WEIGHTS.other;
}

/**
 * Parse bed weights from JSON string or use defaults
 */
export function parseBedWeights(weightsJson: string | null): BedWeights {
	if (!weightsJson) {
		return DEFAULT_BED_WEIGHTS;
	}
	try {
		const parsed = JSON.parse(weightsJson);
		// Normalize keys to lowercase with underscores
		const normalized: BedWeights = {};
		for (const [k, v] of Object.entries(parsed)) {
			if (typeof v === 'number') normalized[normalizeBedType(k)] = v;
		}
		return { ...DEFAULT_BED_WEIGHTS, ...normalized };
	} catch {
		return DEFAULT_BED_WEIGHTS;
	}
}

/**
 * Compute canonical pricing for all rooms in a trip.
 * Uses bed-type weights and room privacy factors. See PRICING_MATH.md.
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

	// Per-slot value = bedWeight * room privacyFactor; scale so sum = totalCost
	const roomData = trip.rooms.map((room) => {
		let bedWeightSum = 0;
		let occMax = 0;
		const privacyFactor = room.privacyFactor ?? 1.0;

		for (const bed of room.beds) {
			const w = getBedWeight(bedWeights, bed.bedType);
			const slots = bed.capacitySlots || bed.capacity || 1;
			bedWeightSum += w * slots;
			occMax += slots;
		}

		// slotValue = (weighted sum / occMax) * privacyFactor for a single "average" slot in this room
		const slotValue = occMax > 0 ? (bedWeightSum / occMax) * privacyFactor : privacyFactor;

		return {
			roomId: room.id,
			occMax,
			bedWeightSum,
			privacyFactor,
			slotValue
		};
	});

	const totalValueAllSlots = roomData.reduce(
		(sum, r) => sum + r.slotValue * r.occMax,
		0
	);

	if (totalValueAllSlots === 0) {
		throw new Error('Total value is zero - check bed configuration');
	}

	const dollarsPerValueUnit = trip.totalCost / totalValueAllSlots;
	const totalSlots = roomData.reduce((sum, r) => sum + r.occMax, 0);

	const roomPricing: RoomPricing[] = roomData.map((room) => {
		const slotPriceFullStay = dollarsPerValueUnit * room.slotValue;
		const roomPriceFullStay = slotPriceFullStay * room.occMax;
		return {
			roomId: room.roomId,
			occMax: room.occMax,
			bedWeightSum: room.bedWeightSum,
			slotValueBase: room.slotValue,
			slotValue: room.slotValue,
			slotPriceFullStay,
			roomPriceFullStay,
			slotPricePerNight: slotPriceFullStay / totalNights,
			roomPricePerNight: roomPriceFullStay / totalNights
		};
	});

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
 * Calculate price for a reservation using privacy-aware per-bed or per-room formula.
 * See PRICING_MATH.md.
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
	const { tripId, roomId, bedId, numberOfSlots, checkInDate, checkOutDate } = params;

	const trip = await prisma.trip.findUnique({
		where: { id: tripId },
		include: {
			rooms: {
				include: { beds: true }
			},
			roomAssignments: {
				include: { room: true }
			}
		}
	});

	if (!trip) {
		throw new Error('Trip not found');
	}

	const stayNights = calculateNights(checkInDate, checkOutDate);
	const totalNights = calculateNights(trip.checkInDate, trip.checkOutDate);
	const stayFactor = totalNights > 0 ? stayNights / totalNights : 1;

	if (!trip.allowPartialStays && stayFactor < 1.0) {
		throw new Error('Partial stays are not allowed for this trip');
	}

	if (checkInDate < trip.checkInDate || checkOutDate > trip.checkOutDate) {
		throw new Error('Reservation dates must be within trip dates');
	}

	const room = trip.rooms.find((r) => r.id === roomId);
	if (!room) {
		throw new Error('Room not found');
	}

	const expectedPeople = trip.expectedPeopleCount ?? trip.maxGuests ?? 1;
	const bedWeights = parseBedWeights(trip.bedWeights);
	const privacyFactor = room.privacyFactor ?? 1.0;

	const pricingModel = (trip.pricingModel || 'per_person').toLowerCase();

	if (pricingModel === 'per_bed') {
		// Price per person = totalCost × (bed weight × privacy factor) ÷ denominator
		const bed = bedId ? room.beds.find((b) => b.id === bedId) : room.beds[0];
		if (!bed) {
			throw new Error('Bed not found');
		}
		const bedWeight = getBedWeight(bedWeights, bed.bedType);
		const numerator = bedWeight * privacyFactor;

		let denominator = 0;
		for (const a of trip.roomAssignments) {
			const w = getBedWeight(bedWeights, a.bedType);
			const p = a.room?.privacyFactor ?? 1.0;
			denominator += (a.partySize || 1) * w * p;
		}
		denominator += numerator; // include current booking
		denominator = Math.max(denominator, expectedPeople);

		const pricePerPersonFullStay = (trip.totalCost * numerator) / denominator;
		const totalPrice = pricePerPersonFullStay * stayFactor;
		const perNightRate = totalNights > 0 ? totalPrice / stayNights : totalPrice;

		return {
			nights: stayNights,
			stayFactor,
			slotPriceForStay: totalPrice,
			totalPrice: Math.round(totalPrice * 100) / 100,
			perNightRate: Math.round(perNightRate * 100) / 100
		};
	}

	if (pricingModel === 'per_room') {
		// Price per person = totalCost × (room privacy factor) ÷ denominator
		// denominator = sum of (room privacy factor × people in that room) for all occupied rooms
		const peoplePerRoom: Record<number, number> = {};
		for (const r of trip.rooms) {
			peoplePerRoom[r.id] = 0;
		}
		for (const a of trip.roomAssignments) {
			peoplePerRoom[a.roomId] = (peoplePerRoom[a.roomId] ?? 0) + (a.partySize || 1);
		}
		peoplePerRoom[roomId] = (peoplePerRoom[roomId] ?? 0) + 1; // current booking

		let denominator = 0;
		for (const [rid, people] of Object.entries(peoplePerRoom)) {
			if (people <= 0) continue;
			const r = trip.rooms.find((x) => x.id === Number(rid));
			const p = r?.privacyFactor ?? 1.0;
			denominator += p * people;
		}
		denominator = Math.max(denominator, expectedPeople);

		const pricePerPersonFullStay = (trip.totalCost * privacyFactor) / denominator;
		const totalPrice = pricePerPersonFullStay * stayFactor;
		const perNightRate = totalNights > 0 ? totalPrice / stayNights : totalPrice;

		return {
			nights: stayNights,
			stayFactor,
			slotPriceForStay: totalPrice,
			totalPrice: Math.round(totalPrice * 100) / 100,
			perNightRate: Math.round(perNightRate * 100) / 100
		};
	}

	// PER_PERSON: equal split by capacity
	if (pricingModel === 'per_person') {
		const totalCapacity = trip.rooms.reduce((s, r) => s + (r.maxOccupancy ?? 0), 0) || 1;
		const pricePerPersonFullStay = trip.totalCost / totalCapacity;
		const totalPrice = pricePerPersonFullStay * numberOfSlots * stayFactor;
		const perNightRate = stayNights > 0 ? totalPrice / stayNights : totalPrice;
		return {
			nights: stayNights,
			stayFactor,
			slotPriceForStay: totalPrice,
			totalPrice: Math.round(totalPrice * 100) / 100,
			perNightRate: Math.round(perNightRate * 100) / 100
		};
	}

	// PER_PERSON_PER_NIGHT: equal split by capacity and nights
	if (pricingModel === 'per_person_per_night') {
		const totalCapacity = trip.rooms.reduce((s, r) => s + (r.maxOccupancy ?? 0), 0) || 1;
		const pricePerPersonPerNight = trip.totalCost / totalNights / totalCapacity;
		const totalPrice = pricePerPersonPerNight * numberOfSlots * stayNights;
		const perNightRate = pricePerPersonPerNight * numberOfSlots;
		return {
			nights: stayNights,
			stayFactor,
			slotPriceForStay: totalPrice,
			totalPrice: Math.round(totalPrice * 100) / 100,
			perNightRate: Math.round(perNightRate * 100) / 100
		};
	}

	// Fallback: use computed room pricing (e.g. legacy or unknown model)
	const pricing = await computeRoomPricing(tripId);
	const roomPricing = pricing.roomPricing.find((r) => r.roomId === roomId);
	if (!roomPricing) {
		throw new Error('Room not found in pricing');
	}
	const slotPriceForStay = roomPricing.slotPriceFullStay * stayFactor;
	const totalPrice = slotPriceForStay * numberOfSlots;
	const perNightRate = totalNights > 0 ? roomPricing.slotPricePerNight * numberOfSlots : totalPrice / stayNights;

	return {
		nights: stayNights,
		stayFactor,
		slotPriceForStay,
		totalPrice: Math.round(totalPrice * 100) / 100,
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
			// Preview: assume 1 person per room; denominator = sum(privacy factor)
			const privacySum = trip.rooms.reduce((s, r) => s + (r.privacyFactor ?? 1), 0) || 1;
			const roomBreakdownWithPrivacy: RoomPricing[] = pricing.roomPricing.map((r) => {
				const room = trip.rooms!.find((x) => x.id === r.roomId);
				const p = room?.privacyFactor ?? 1.0;
				const roomPriceFullStay = (trip.totalCost * p) / privacySum;
				return {
					...r,
					roomPriceFullStay,
					slotPriceFullStay: roomPriceFullStay / (r.occMax || 1),
					roomPricePerNight: roomPriceFullStay / pricing.totalNights,
					slotPricePerNight: roomPriceFullStay / (r.occMax || 1) / pricing.totalNights
				};
			});
			const perRoom =
				trip.rooms.length > 0
					? (trip.totalCost * (trip.rooms[0].privacyFactor ?? 1)) / privacySum
					: trip.totalCost / pricing.roomPricing.length;
			return {
				mode,
				perRoomFullStay: Math.round(perRoom * 100) / 100,
				roomBreakdown: roomBreakdownWithPrivacy
			};
		}

		case 'PER_BED': {
			// Preview: price per bed = totalCost * (bedWeight * privacy) / totalValue (from computeRoomPricing)
			const bedPrices: { [key: string]: number[] } = {};
			const weights = parseBedWeights(trip.bedWeights);
			for (const room of trip.rooms || []) {
				const p = room.privacyFactor ?? 1.0;
				for (const bed of room.beds) {
					const w = getBedWeight(weights, bed.bedType);
					const slots = bed.capacitySlots || bed.capacity || 1;
					const roomP = pricing.roomPricing.find((r) => r.roomId === room.id);
					const bedPrice = roomP
						? (trip.totalCost * w * p * slots) / pricing.totalValueAllSlots
						: (trip.totalCost * w * p * slots) / pricing.totalValueAllSlots;
					const key = normalizeBedType(bed.bedType);
					if (!bedPrices[key]) bedPrices[key] = [];
					bedPrices[key].push(bedPrice);
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
