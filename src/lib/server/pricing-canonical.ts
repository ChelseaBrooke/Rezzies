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
 * Normalize bed type for weight lookup: lowercase, spaces -> underscore,
 * and strip common suffixes (_bed, _size) so "queen_bed" / "Queen Bed" -> "queen", "twin_bed" -> "twin".
 */
function normalizeBedType(bedType: string | null): string {
	if (!bedType || !bedType.trim()) return 'other';
	let key = bedType.trim().toLowerCase().replace(/\s+/g, '_');
	// Strip trailing _bed or _size so we match canonical keys (king, queen, twin, etc.)
	if (key.endsWith('_bed')) key = key.slice(0, -4);
	if (key.endsWith('_size')) key = key.slice(0, -5);
	return key || 'other';
}

export function getBedWeight(weights: BedWeights, bedType: string | null): number {
	const key = normalizeBedType(bedType);
	return weights[key] ?? weights.other ?? DEFAULT_BED_WEIGHTS.other;
}

/** Minimum (shared) and maximum (private) effective privacy factor */
export const PRIVACY_FACTOR_SHARED = 1.0;
export const PRIVACY_FACTOR_PRIVATE = 1.25;

/**
 * Effective privacy factor from number of beds in the room (evolving factor).
 * Fewer beds → more private → higher factor. See PRICING_MATH.md.
 * 1 bed → 1.25, 2 beds → 1.125, 3+ beds → 1.0.
 */
export function getEffectivePrivacyFactor(bedCount: number): number {
	if (bedCount < 1) return PRIVACY_FACTOR_SHARED;
	const factor = PRIVACY_FACTOR_PRIVATE - (bedCount - 1) * 0.125;
	return Math.max(PRIVACY_FACTOR_SHARED, Math.min(PRIVACY_FACTOR_PRIVATE, factor));
}

/**
 * Get effective privacy for a room (uses bed count; pass beds array or length).
 */
export function getRoomEffectivePrivacy(beds: { length: number } | unknown[]): number {
	const n = Array.isArray(beds) ? beds.length : 0;
	return getEffectivePrivacyFactor(n);
}

/** Spot count for a bed (PRICING_MATH: capacity in people). */
export function getSpotCount(bed: { capacitySlots?: number | null; capacity?: number | null }): number {
	return bed.capacitySlots ?? bed.capacity ?? 1;
}

/**
 * Allocate a night's cost in integer cents across spots by weight.
 * Uses largest-remainder; tie-break by spot id for determinism. Sum of returned cents = totalCents.
 * PRICING_MATH: "distribute remaining cents using a deterministic method (e.g. largest remainder or stable sort by spot id)".
 */
export function allocateNightCostCentsToSpots(
	totalCents: number,
	spots: Array<{ weight: number; id: string }>
): number[] {
	if (spots.length === 0) return [];
	const totalWeight = spots.reduce((s, p) => s + p.weight, 0);
	if (totalWeight <= 0) return spots.map(() => 0);
	const exact = spots.map((p) => (totalCents * p.weight) / totalWeight);
	const base = exact.map((e) => Math.floor(e));
	let remainder = totalCents - base.reduce((s, b) => s + b, 0);
	const indicesByRemainder = spots
		.map((_, i) => ({ i, r: exact[i] - base[i], id: spots[i].id }))
		.sort((a, b) => {
			if (b.r !== a.r) return b.r - a.r;
			return a.id.localeCompare(b.id);
		});
	const out = [...base];
	for (let j = 0; j < remainder && j < indicesByRemainder.length; j++) {
		out[indicesByRemainder[j].i] += 1;
	}
	return out;
}

/** Spot weight = bedTypeWeight × effectiveRoomPrivacy (PRICING_MATH). */
export function getSpotWeight(
	bed: { bedType: string },
	roomBeds: { length: number } | unknown[],
	bedWeights: BedWeights
): number {
	return getBedWeight(bedWeights, bed.bedType) * getRoomEffectivePrivacy(roomBeds);
}

export interface PerBedInventoryWeights {
	W_full: number;
	totalSpotCapacity: number;
	avgW: number;
	W_floor: number;
	W_max: number;
	W_min: number;
}

/**
 * Compute PER_BED inventory weights for estimate range and W_eff (PRICING_MATH).
 * W_full = sum(spotWeight for every spot in inventory); W_floor = minExpected × avgW; W_max = W_full; W_min = W_floor.
 */
export function computePerBedInventoryWeights(
	trip: {
		expectedPeopleCount?: number | null;
		rooms: Array<{ beds: Array<{ bedType: string; capacitySlots?: number | null; capacity?: number | null }> }>;
	},
	bedWeights: BedWeights
): PerBedInventoryWeights {
	let W_full = 0;
	let totalSpotCapacity = 0;
	for (const room of trip.rooms) {
		const roomPrivacy = getRoomEffectivePrivacy(room.beds);
		for (const bed of room.beds) {
			const spots = getSpotCount(bed);
			const w = getBedWeight(bedWeights, bed.bedType) * roomPrivacy;
			W_full += spots * w;
			totalSpotCapacity += spots;
		}
	}
	const avgW = totalSpotCapacity > 0 ? W_full / totalSpotCapacity : 1;
	const minExpected = Math.max(1, trip.expectedPeopleCount ?? 1);
	const W_floor = minExpected * avgW;
	return {
		W_full,
		totalSpotCapacity,
		avgW,
		W_floor,
		W_max: W_full,
		W_min: W_floor
	};
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

	// Per-slot value = bedWeight * effective room privacy (from bed count). Scale so sum = totalCost.
	const roomData = trip.rooms.map((room) => {
		let bedWeightSum = 0;
		let occMax = 0;
		const privacyFactor = getRoomEffectivePrivacy(room.beds);

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

export interface PerBedDisplayPrice {
	perNight: number;
	total: number;
}

/**
 * Per-bed display pricing: each bed's share by (bed-type weight × room privacy factor).
 * PRICING_MATH.md § PER_BED: "beds in private rooms cost more (bed-type weight × room privacy factor)".
 * Sum of all bed totals = trip.totalCost.
 */
export async function computePerBedDisplayPricing(tripId: string): Promise<{
	totalNights: number;
	bedPricing: Record<string, PerBedDisplayPrice>;
} | null> {
	const trip = await prisma.trip.findUnique({
		where: { id: tripId },
		include: {
			rooms: {
				select: {
					id: true,
					beds: { select: { id: true, bedType: true, capacitySlots: true, capacity: true } }
				}
			}
		}
	});
	if (!trip || trip.rooms.length === 0) return null;

	const totalNights = calculateNights(trip.checkInDate, trip.checkOutDate);
	const bedWeights = parseBedWeights(trip.bedWeights);

	// PRICING_MATH.md: effective privacy from bed count; slot value = bed weight × effective privacy
	let totalValueAllSlots = 0;
	const bedValues: { bedId: string; slots: number; slotValue: number }[] = [];
	for (const room of trip.rooms) {
		const roomPrivacy = getRoomEffectivePrivacy(room.beds);
		for (const bed of room.beds) {
			const slots = bed.capacitySlots ?? bed.capacity ?? 1;
			const w = getBedWeight(bedWeights, bed.bedType);
			const slotValue = w * roomPrivacy;
			totalValueAllSlots += slots * slotValue;
			bedValues.push({ bedId: bed.id, slots, slotValue });
		}
	}
	if (totalValueAllSlots <= 0) return null;

	const dollarsPerValueUnit = trip.totalCost / totalValueAllSlots;
	const bedPricing: Record<string, PerBedDisplayPrice> = {};
	for (const { bedId, slots, slotValue } of bedValues) {
		const totalForFullStay = dollarsPerValueUnit * slotValue * slots;
		bedPricing[bedId] = {
			total: Math.round(totalForFullStay * 100) / 100,
			perNight: totalNights > 0 ? Math.round((totalForFullStay / totalNights) * 100) / 100 : 0
		};
	}
	return { totalNights, bedPricing };
}

/**
 * Per-bed pricing at a specific headcount (yes-RSVPs + plus-ones).
 * Use for RSVP page "X/night · Y total". PRICING_MATH: W_eff = max(W_d, W_floor), spotCharge = nightCost × (spotWeight/W_eff).
 * W_d approximated as headcount × avgW when no assignment detail.
 */
export async function computePerBedPricingAtHeadcount(
	tripId: string,
	headcount: number
): Promise<{ totalNights: number; bedPricing: Record<string, PerBedDisplayPrice> } | null> {
	const trip = await prisma.trip.findUnique({
		where: { id: tripId },
		include: {
			rooms: {
				select: {
					id: true,
					beds: { select: { id: true, bedType: true, capacitySlots: true, capacity: true } }
				}
			}
		}
	});
	if (!trip || trip.rooms.length === 0) return null;

	const totalNights = calculateNights(trip.checkInDate, trip.checkOutDate);
	const bedWeights = parseBedWeights(trip.bedWeights);
	const inv = computePerBedInventoryWeights(trip, bedWeights);
	const H = Math.max(1, headcount);
	const W_d = H * inv.avgW;
	const W_eff = Math.max(W_d, inv.W_floor);

	// Integer cents to allocate per night = nightCost × (W_full/W_eff) so spot shares sum to that; then distribute with largest-remainder.
	const nightCostDollars = totalNights > 0 ? trip.totalCost / totalNights : trip.totalCost;
	const totalAllocCents = Math.round(nightCostDollars * 100 * (inv.W_full / W_eff));
	const spots: Array<{ weight: number; id: string }> = [];
	for (const room of trip.rooms) {
		const roomPrivacy = getRoomEffectivePrivacy(room.beds);
		for (const bed of room.beds) {
			const slots = getSpotCount(bed);
			const spotWeight = getBedWeight(bedWeights, bed.bedType) * roomPrivacy;
			for (let s = 0; s < slots; s++) {
				spots.push({ weight: spotWeight, id: `${bed.id}:${s}` });
			}
		}
	}
	const centsPerSpotOneNight = allocateNightCostCentsToSpots(totalAllocCents, spots);

	// Map spot index back to bedId (same order as spots).
	let idx = 0;
	const bedCentsPerNight: Record<string, number> = {};
	for (const room of trip.rooms) {
		for (const bed of room.beds) {
			const slots = getSpotCount(bed);
			let sum = 0;
			for (let s = 0; s < slots; s++) {
				sum += centsPerSpotOneNight[idx++];
			}
			bedCentsPerNight[bed.id] = sum;
		}
	}

	const bedPricing: Record<string, PerBedDisplayPrice> = {};
	for (const room of trip.rooms) {
		for (const bed of room.beds) {
			const nightlyCents = bedCentsPerNight[bed.id] ?? 0;
			const totalCents = nightlyCents * totalNights;
			bedPricing[bed.id] = {
				total: Math.round(totalCents) / 100,
				perNight: totalNights > 0 ? Math.round(nightlyCents) / 100 : 0
			};
		}
	}
	return { totalNights, bedPricing };
}

/**
 * Sum of current expected cost for all yes-RSVPs based on their reserved beds/rooms/slots.
 * Uses live pricing: W_eff = max(W_d, W_floor) (min expected guests or current claimed spots).
 * Not based on estimate range — this is the actual amount each would pay at current headcount.
 * Used for "$ committed" on host/guest dashboard.
 * For yes users with no room assignment (e.g. PER_PERSON before room pick), uses first room and 1 slot.
 */
export async function computeCommittedFundsFromYesRsvps(tripId: string): Promise<number> {
	const trip = await prisma.trip.findUnique({
		where: { id: tripId },
		include: {
			rooms: { include: { beds: true } },
			rsvps: { where: { status: 'yes' }, select: { userId: true } },
			roomAssignments: true
		}
	});
	if (!trip?.rsvps?.length) return 0;
	const yesUserIds = new Set(trip.rsvps.map((r) => r.userId));
	const assignmentsByUser = new Map<string, typeof trip.roomAssignments>();
	for (const a of trip.roomAssignments) {
		if (!yesUserIds.has(a.userId)) continue;
		let list = assignmentsByUser.get(a.userId);
		if (!list) {
			list = [];
			assignmentsByUser.set(a.userId, list);
		}
		list.push(a);
	}
	const firstRoom = trip.rooms?.[0];
	const firstRoomId = firstRoom?.id ?? 0;
	let total = 0;
	for (const userId of yesUserIds) {
		const assignments = assignmentsByUser.get(userId);
		if (assignments?.length) {
			for (const a of assignments) {
				const start = a.startDate ?? trip.checkInDate;
				const end = a.endDate ?? trip.checkOutDate;
				const res = await calculateReservationPrice({
					tripId,
					roomId: a.roomId,
					bedId: a.bedId ?? undefined,
					numberOfSlots: a.partySize ?? 1,
					checkInDate: start,
					checkOutDate: end
				});
				total += res.totalPrice;
			}
		} else if (firstRoomId && trip.checkInDate && trip.checkOutDate) {
			// Yes but no assignment (e.g. PER_PERSON): count as 1 person at current rate
			const res = await calculateReservationPrice({
				tripId,
				roomId: firstRoomId,
				bedId: undefined,
				numberOfSlots: 1,
				checkInDate: trip.checkInDate,
				checkOutDate: trip.checkOutDate
			});
			total += res.totalPrice;
		}
	}
	return Math.round(total * 100) / 100;
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
	const privacyFactor = getRoomEffectivePrivacy(room.beds);

	const pricingModel = (trip.pricingModel || 'per_person').toLowerCase();

	if (pricingModel === 'per_bed') {
		// PRICING_MATH: W_d = claimed weight (assignments + this booking), W_eff = max(W_d, W_floor), totalPrice = stayNights × nightCost × (k×w/W_eff)
		const bed = bedId ? room.beds.find((b) => b.id === bedId) : room.beds[0];
		if (!bed) {
			throw new Error('Bed not found');
		}
		const spotWeight = getSpotWeight(bed, room.beds, bedWeights);
		const inv = computePerBedInventoryWeights(trip, bedWeights);
		let W_d = 0;
		for (const a of trip.roomAssignments) {
			const r = trip.rooms.find((x) => x.id === a.roomId);
			if (!r || r.beds.length === 0) continue;
			const b = a.bedId ? r.beds.find((x) => x.id === a.bedId) : r.beds[0];
			if (b) {
				W_d += (a.partySize || 1) * getSpotWeight(b, r.beds, bedWeights);
			}
		}
		W_d += numberOfSlots * spotWeight; // include this booking
		const W_eff = Math.max(W_d, inv.W_floor);
		const nightCost = totalNights > 0 ? trip.totalCost / totalNights : trip.totalCost;
		const totalPriceDollars = stayNights * nightCost * (numberOfSlots * spotWeight) / W_eff;
		const totalPriceCents = Math.round(totalPriceDollars * 100);
		const totalPrice = totalPriceCents / 100;
		const perNightRate = stayNights > 0 ? totalPrice / stayNights : totalPrice;

		return {
			nights: stayNights,
			stayFactor,
			slotPriceForStay: totalPrice,
			totalPrice,
			perNightRate: Math.round(perNightRate * 100) / 100
		};
	}

	if (pricingModel === 'per_room') {
		// Price per person = totalCost × (room effective privacy) ÷ denominator
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
			const p = r ? getRoomEffectivePrivacy(r.beds) : PRIVACY_FACTOR_SHARED;
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
			// Preview: assume 1 person per room; denominator = sum(effective privacy by bed count)
			const privacySum = trip.rooms.reduce((s, r) => s + getRoomEffectivePrivacy(r.beds), 0) || 1;
			const roomBreakdownWithPrivacy: RoomPricing[] = pricing.roomPricing.map((r) => {
				const room = trip.rooms!.find((x) => x.id === r.roomId);
				const p = room ? getRoomEffectivePrivacy(room.beds) : PRIVACY_FACTOR_SHARED;
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
					? (trip.totalCost * getRoomEffectivePrivacy(trip.rooms[0].beds)) / privacySum
					: trip.totalCost / pricing.roomPricing.length;
			return {
				mode,
				perRoomFullStay: Math.round(perRoom * 100) / 100,
				roomBreakdown: roomBreakdownWithPrivacy
			};
		}

		case 'PER_BED': {
			// Price per person = (total ÷ max(effective guest count, yes-RSVPs)) × (bed weight × effective privacy ÷ average combined weight)
			const weights = parseBedWeights(trip.bedWeights);
			let totalSlots = 0;
			let sumCombinedWeight = 0;
			for (const room of trip.rooms || []) {
				const p = getRoomEffectivePrivacy(room.beds);
				for (const bed of room.beds) {
					const slots = bed.capacitySlots || bed.capacity || 1;
					totalSlots += slots;
					sumCombinedWeight += slots * getBedWeight(weights, bed.bedType) * p;
				}
			}
			const avgCombinedWeight = totalSlots > 0 ? sumCombinedWeight / totalSlots : 1;
			const effectiveGuests = Math.max(1, trip.expectedPeopleCount ?? trip.maxGuests ?? totalSlots);
			const base = trip.totalCost / effectiveGuests;
			const bedPrices: { [key: string]: number[] } = {};
			for (const room of trip.rooms || []) {
				const roomPrivacy = getRoomEffectivePrivacy(room.beds);
				for (const bed of room.beds) {
					const w = getBedWeight(weights, bed.bedType);
					const bedPrice = (base * (w * roomPrivacy)) / avgCombinedWeight;
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
