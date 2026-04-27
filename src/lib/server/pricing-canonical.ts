// Canonical Pricing Model for Divvi
// Per-bed and per-room pricing use bed-type weights and room privacy factors.
// See PRICING.md for formulas.
//
// Vocabulary note: this module uses UPPER_SNAKE form for PricingMode ('PER_BED', 'PER_ROOM', …).
// The DB and REST API layer uses lowercase_underscore ('per_bed', 'per_room', …), see pricing.ts.
// calculatePrice() in pricing.ts is the public entry point; it normalises the model string and
// delegates PER_BED math here via calculateReservationPrice().

import { prisma } from './prisma.js';
import { effectiveSleepSlots, type BedLike } from '$lib/bed-spot-validation.js';
import { favorableHeadcountForClosingRange } from './closing-range.js';
import { ROOM_BEDS_ORDER_BY, TRIP_ROOMS_ORDER_BY } from './trip-room-order.js';
import {
	perBedLowHighForUnit,
	computePerBedRangeByBedId as computePerBedRangeByBedIdCore,
	type PerBedSelectionUnit,
	type PerBedRange
} from '$lib/pricing/per-bed-selection.js';

export type PricingMode = 'PER_ROOM' | 'PER_PERSON' | 'PER_BED' | 'PER_PERSON_PER_NIGHT';

/** Full-trip $ share per physical room (trip total ÷ room count). */
export function perRoomShareFullTrip(trip: { totalCost: number; rooms: { id: number }[] }): number {
	const n = trip.rooms?.length ?? 0;
	if (n <= 0) return trip.totalCost;
	return trip.totalCost / n;
}

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
	/**
	 * PER_BED quote: exclude this user's current room assignments, then apply provisionalPick.
	 * Omit for invoices / stored assignments (occupancy = DB only).
	 */
	quoteForUserId?: string;
	/**
	 * PER_BED quote: bed being priced (merged into occupancy). Required for public quote when quoteForUserId is unset.
	 */
	provisionalPick?: { bedId: string; partySize: number };
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
 * Return array of UTC date keys (YYYY-MM-DD) for each night in [checkIn, checkOut), end exclusive.
 * Used in PER_ROOM and for night-key iteration (e.g. distributing trip cost to nights).
 */
export function getNightsBetween(checkIn: Date, checkOut: Date): string[] {
	const out: string[] = [];
	const start = new Date(checkIn);
	start.setUTCHours(0, 0, 0, 0);
	const end = new Date(checkOut);
	end.setUTCHours(0, 0, 0, 0);
	const endMs = end.getTime();
	for (let t = start.getTime(); t < endMs; t += 24 * 60 * 60 * 1000) {
		const d = new Date(t);
		const y = d.getUTCFullYear();
		const m = String(d.getUTCMonth() + 1).padStart(2, '0');
		const day = String(d.getUTCDate()).padStart(2, '0');
		out.push(`${y}-${m}-${day}`);
	}
	return out;
}

/**
 * Distribute totalTripCostCents evenly across nights with deterministic rounding.
 * Sum of returned array equals totalTripCostCents.
 */
export function distributeTripCostCentsToNights(
	totalTripCostCents: number,
	nightKeys: string[]
): number[] {
	if (nightKeys.length === 0) return [];
	if (nightKeys.length === 1) return [totalTripCostCents];
	const perNight = totalTripCostCents / nightKeys.length;
	const base = nightKeys.map(() => Math.floor(perNight));
	let remainder = totalTripCostCents - base.reduce((s, b) => s + b, 0);
	// Deterministic: assign extra cents to first `remainder` nights (by sorted key)
	const indices = nightKeys.map((_, i) => i).sort((a, b) => nightKeys[a].localeCompare(nightKeys[b]));
	const out = [...base];
	for (let j = 0; j < remainder && j < indices.length; j++) {
		out[indices[j]] += 1;
	}
	return out;
}

/** Format Date as UTC YYYY-MM-DD for night-key comparison. */
function dateToUtcKey(d: Date): string {
	const y = d.getUTCFullYear();
	const m = String(d.getUTCMonth() + 1).padStart(2, '0');
	const day = String(d.getUTCDate()).padStart(2, '0');
	return `${y}-${m}-${day}`;
}

/**
 * True if nightKey (YYYY-MM-DD) falls within [startDate, endDate), end exclusive.
 * Uses startDate/endDate or trip bounds when null.
 */
export function isNightInRange(
	nightKey: string,
	startDate: Date | null,
	endDate: Date | null,
	tripCheckIn: Date,
	tripCheckOut: Date
): boolean {
	const startKey = startDate ? dateToUtcKey(startDate) : dateToUtcKey(tripCheckIn);
	const endKey = endDate ? dateToUtcKey(endDate) : dateToUtcKey(tripCheckOut);
	return nightKey >= startKey && nightKey < endKey;
}

/** Canonical bed-type keys used in DEFAULT_BED_WEIGHTS (order: prefer longer matches first to avoid "king" in "bunk") */
const BED_TYPE_CANONICAL_KEYS = [
	'air_mattress',
	'sofa_bed',
	'sofa',
	'king',
	'queen',
	'bunk',
	'twin',
	'single',
	'double',
	'full',
	'other'
];

/**
 * Normalize bed type for weight lookup: lowercase, spaces -> underscore,
 * strip common suffixes (_bed, _size), then match exact or substring so "Queen Bed" -> "queen", "Bunk" -> "bunk".
 * Distinct from the shared normalizeBedType in $lib/bed-types, this one does extra fuzzy matching for pricing weights.
 */
function normalizeBedTypeForWeight(bedType: string | null): string {
	if (!bedType || !bedType.trim()) return 'other';
	let key = bedType.trim().toLowerCase().replace(/\s+/g, '_');
	// Strip trailing _bed or _size so we match canonical keys (king, queen, twin, etc.)
	if (key.endsWith('_bed')) key = key.slice(0, -4);
	if (key.endsWith('_size')) key = key.slice(0, -5);
	if (!key) return 'other';
	// Exact match
	if (DEFAULT_BED_WEIGHTS[key] !== undefined) return key;
	// Substring match: e.g. "queen_primary" or "bunk_bed" (already stripped) or "room_queen"
	for (const canon of BED_TYPE_CANONICAL_KEYS) {
		if (canon === 'other') continue;
		if (key === canon || key.includes(canon)) return canon;
	}
	return 'other';
}

export function getBedWeight(weights: BedWeights, bedType: string | null): number {
	const key = normalizeBedTypeForWeight(bedType);
	return weights[key] ?? weights.other ?? DEFAULT_BED_WEIGHTS.other;
}

/** Minimum (shared) and maximum (private) effective privacy factor */
export const PRIVACY_FACTOR_SHARED = 1.0;
export const PRIVACY_FACTOR_PRIVATE = 1.25;

/**
 * Effective privacy factor from number of beds in the room (evolving factor).
 * Fewer beds → more private → higher factor. See PRICING.md.
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

/** Spot count for a bed (PRICING.md: capacity in people). Uses bed-type defaults when DB still has 1/1 for bunks, queens, etc. */
export function getSpotCount(bed: {
	capacitySlots?: number | null;
	capacity?: number | null;
	bedType?: string | null;
}): number {
	return effectiveSleepSlots(bed as BedLike);
}

/** Spot weight = bedTypeWeight × effectiveRoomPrivacy (PRICING.md). */
export function getSpotWeight(
	bed: { bedType: string },
	roomBeds: { length: number } | unknown[],
	bedWeights: BedWeights
): number {
	return getBedWeight(bedWeights, bed.bedType) * getRoomEffectivePrivacy(roomBeds);
}

/** One PER_BED inventory unit per Bed row; weight = bed type × room privacy (no per-slot expansion). */
export interface PerBedInventoryUnit {
	bedId: string;
	roomId: number;
	bedType: string;
	weight: number;
	spotCount: number; // max occupants for this bed (capacitySlots / capacity)
}

export function buildPerBedInventoryUnits(
	trip: {
		rooms: Array<{
			id: number;
			beds: Array<{
				id: string;
				bedType: string;
				capacitySlots?: number | null;
				capacity?: number | null;
			}>;
		}>;
	},
	bedWeights: BedWeights
): PerBedInventoryUnit[] {
	const out: PerBedInventoryUnit[] = [];
	for (const room of trip.rooms) {
		const roomPrivacy = getRoomEffectivePrivacy(room.beds);
		for (const bed of room.beds) {
			const w = getBedWeight(bedWeights, bed.bedType) * roomPrivacy;
			const spotCount = getSpotCount(bed);
			out.push({ bedId: bed.id, roomId: room.id, bedType: bed.bedType, weight: w, spotCount });
		}
	}
	return out;
}

export { perBedLowHighForUnit, type PerBedRange } from '$lib/pricing/per-bed-selection.js';

export function computePerBedRangeByBedId(
	totalCost: number,
	expectedGuestCount: number,
	units: PerBedInventoryUnit[]
): Map<string, PerBedRange> {
	return computePerBedRangeByBedIdCore(totalCost, expectedGuestCount, units as PerBedSelectionUnit[]);
}

export function aggregatePerBedTypeRanges(
	units: PerBedInventoryUnit[],
	rangeByBedId: Map<string, PerBedRange>
): Record<string, { low: number; high: number }> {
	const byType: Record<string, { low: number; high: number }> = {};
	for (const u of units) {
		const r = rangeByBedId.get(u.bedId);
		if (!r) continue;
		const key = normalizeBedTypeForWeight(u.bedType);
		if (!byType[key]) byType[key] = { low: r.lowBedPrice, high: r.highBedPrice };
		else {
			byType[key].low = Math.min(byType[key].low, r.lowBedPrice);
			byType[key].high = Math.max(byType[key].high, r.highBedPrice);
		}
	}
	return byType;
}

export type PerBedAssignmentLike = {
	userId: string;
	roomId: number;
	bedId: string | null;
	partySize: number | null;
};

/** Party size per bed from yes-RSVP assignments, with optional quote overlay. */
export function buildPerBedOccupancyMap(
	assignments: PerBedAssignmentLike[],
	yesUserIds: Set<string>,
	options?: {
		excludeUserId?: string;
		provisional?: { bedId: string; partySize: number };
	}
): Map<string, number> {
	const occ = new Map<string, number>();
	for (const a of assignments) {
		if (!yesUserIds.has(a.userId)) continue;
		if (options?.excludeUserId && a.userId === options.excludeUserId) continue;
		if (!a.bedId) continue;
		const p = Math.max(1, a.partySize ?? 1);
		occ.set(a.bedId, (occ.get(a.bedId) ?? 0) + p);
	}
	if (options?.provisional) {
		const bid = options.provisional.bedId;
		const p = Math.max(1, options.provisional.partySize);
		occ.set(bid, (occ.get(bid) ?? 0) + p);
	}
	return occ;
}

export function computePerBedLiveTotalWeight(
	trip: { rooms: Array<{ beds: Array<{ id: string; bedType: string }> }> },
	bedWeights: BedWeights,
	occupancy: Map<string, number>
): { totalWeight: number; weightByBedId: Map<string, number> } {
	const weightByBedId = new Map<string, number>();
	for (const room of trip.rooms) {
		for (const bed of room.beds) {
			if (!occupancy.has(bed.id)) continue;
			const w = getBedWeight(bedWeights, bed.bedType) * getRoomEffectivePrivacy(room.beds);
			weightByBedId.set(bed.id, w);
		}
	}
	let totalWeight = 0;
	for (const bedId of occupancy.keys()) {
		totalWeight += weightByBedId.get(bedId) ?? 0;
	}
	return { totalWeight, weightByBedId };
}

/**
 * Full-trip bed share for one assignment, then × stayFactor. Bed price is split among all occupants on that bed.
 */
export function computePerBedLivePriceForBed(
	trip: { totalCost: number; checkInDate: Date; checkOutDate: Date; rooms: Array<{ beds: Array<{ id: string; bedType: string }> }> },
	bedWeights: BedWeights,
	occupancy: Map<string, number>,
	targetBedId: string,
	targetPartySize: number,
	stayNights: number
): number {
	const totalNights = calculateNights(trip.checkInDate, trip.checkOutDate);
	const stayFactor = totalNights > 0 ? stayNights / totalNights : 1;
	const { totalWeight, weightByBedId } = computePerBedLiveTotalWeight(trip, bedWeights, occupancy);
	if (totalWeight <= 0) return 0;
	const w = weightByBedId.get(targetBedId) ?? 0;
	if (w <= 0) return 0;
	const partyOnBed = occupancy.get(targetBedId) ?? 0;
	if (partyOnBed <= 0) return 0;
	const bedShareFullTrip = (trip.totalCost * w) / totalWeight;
	return bedShareFullTrip * (Math.max(1, targetPartySize) / partyOnBed) * stayFactor;
}

/**
 * Expected vs max headcount helpers (bed row count, not sleep slots).
 */
export function getPerBedRangeGuestCounts(trip: {
	expectedPeopleCount?: number | null;
	maxGuests?: number | null;
	rooms: Array<{ beds: unknown[] }>;
}): { minExpectedGuests: number; maxCapacityGuests: number } {
	const totalBedRows = trip.rooms.reduce((s, r) => s + r.beds.length, 0);
	const minExpectedGuests = Math.max(1, trip.expectedPeopleCount ?? 1);
	const maxCapacityGuests = Math.max(1, trip.maxGuests ?? Math.max(1, totalBedRows));
	return { minExpectedGuests, maxCapacityGuests };
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
			if (typeof v === 'number') normalized[normalizeBedTypeForWeight(k)] = v;
		}
		return { ...DEFAULT_BED_WEIGHTS, ...normalized };
	} catch {
		return DEFAULT_BED_WEIGHTS;
	}
}

/**
 * Compute canonical pricing for all rooms in a trip.
 * Uses bed-type weights and room privacy factors. See PRICING.md.
 */
export async function computeRoomPricing(
	tripId: string
): Promise<ComputedPricing> {
	const trip = await prisma.trip.findUnique({
		where: { id: tripId },
		include: {
			rooms: {
				orderBy: TRIP_ROOMS_ORDER_BY,
				include: {
					beds: { orderBy: ROOM_BEDS_ORDER_BY }
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
	const model = (trip.pricingModel || '').toLowerCase();

	// PER_ROOM: equal $ per room (trip total ÷ # rooms), no bed-weight split
	if (model === 'per_room') {
		const n = trip.rooms.length;
		const share = perRoomShareFullTrip(trip);
		const roomPricing: RoomPricing[] = trip.rooms.map((room) => {
			const occMax = Math.max(
				1,
				room.maxOccupancy ??
					room.beds.reduce((s, bed) => s + getSpotCount(bed), 0)
			);
			const slotPriceFullStay = share / occMax;
			return {
				roomId: room.id,
				occMax,
				bedWeightSum: occMax,
				slotValueBase: 1,
				slotValue: 1,
				slotPriceFullStay,
				roomPriceFullStay: share,
				slotPricePerNight: totalNights > 0 ? slotPriceFullStay / totalNights : slotPriceFullStay,
				roomPricePerNight: totalNights > 0 ? share / totalNights : share
			};
		});
		return {
			tripId,
			totalNights,
			totalValueAllSlots: n,
			dollarsPerValueUnit: share,
			roomPricing,
			totalSlots: roomPricing.reduce((s, r) => s + r.occMax, 0)
		};
	}

	const bedWeights = parseBedWeights(trip.bedWeights);

	// Per-slot value = bedWeight * effective room privacy (from bed count). Scale so sum = totalCost.
	const roomData = trip.rooms.map((room) => {
		let bedWeightSum = 0;
		let occMax = 0;
		const privacyFactor = getRoomEffectivePrivacy(room.beds);

		for (const bed of room.beds) {
			const w = getBedWeight(bedWeights, bed.bedType);
			const slots = getSpotCount(bed);
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
	/** Full-stay bed price range based on occupancy extremes */
	low: number;
	high: number;
	/** Midpoint of low/high for compact UI */
	total: number;
	perNightLow: number;
	perNightHigh: number;
	/** Midpoint per night */
	perNight: number;
	/** Per-person price range (bed price / occupants under each scenario) */
	lowPerPerson: number;
	highPerPerson: number;
	perNightLowPerPerson: number;
	perNightHighPerPerson: number;
}

function fillPerBedDisplayFromRanges(
	rangeByBedId: Map<string, PerBedRange>,
	totalNights: number
): Record<string, PerBedDisplayPrice> {
	const bedPricing: Record<string, PerBedDisplayPrice> = {};
	for (const [bedId, r] of rangeByBedId) {
		const low = Math.round(r.lowBedPrice * 100) / 100;
		const high = Math.round(r.highBedPrice * 100) / 100;
		const total = Math.round(((low + high) / 2) * 100) / 100;
		const perNightLow = totalNights > 0 ? Math.round((low / totalNights) * 100) / 100 : 0;
		const perNightHigh = totalNights > 0 ? Math.round((high / totalNights) * 100) / 100 : 0;
		const perNight = totalNights > 0 ? Math.round((total / totalNights) * 100) / 100 : 0;
		const lowPerPerson = Math.round(r.lowPerPersonPrice * 100) / 100;
		const highPerPerson = Math.round(r.highPerPersonPrice * 100) / 100;
		const perNightLowPerPerson = totalNights > 0 ? Math.round((lowPerPerson / totalNights) * 100) / 100 : 0;
		const perNightHighPerPerson = totalNights > 0 ? Math.round((highPerPerson / totalNights) * 100) / 100 : 0;
		bedPricing[bedId] = {
			low, high, total, perNightLow, perNightHigh, perNight,
			lowPerPerson, highPerPerson, perNightLowPerPerson, perNightHighPerPerson
		};
	}
	return bedPricing;
}
/**
 * PER_BED estimated price ranges per bed (selection simulation using expected guest count only).
 */
export async function computePerBedDisplayPricing(tripId: string): Promise<{
	totalNights: number;
	bedPricing: Record<string, PerBedDisplayPrice>;
} | null> {
	const trip = await prisma.trip.findUnique({
		where: { id: tripId },
		include: {
			rooms: {
				orderBy: TRIP_ROOMS_ORDER_BY,
				include: { beds: { orderBy: ROOM_BEDS_ORDER_BY } }
			}
		}
	});
	if (!trip || trip.rooms.length === 0) return null;
	const bedWeights = parseBedWeights(trip.bedWeights);
	const units = buildPerBedInventoryUnits(trip, bedWeights);
	if (units.length === 0) return null;
	const { minExpectedGuests } = getPerBedRangeGuestCounts(trip);
	const rangeByBedId = computePerBedRangeByBedId(trip.totalCost, minExpectedGuests, units);
	const totalNights = calculateNights(trip.checkInDate, trip.checkOutDate);
	return { totalNights, bedPricing: fillPerBedDisplayFromRanges(rangeByBedId, totalNights) };
}

/**
 * PER_BED UI pricing: same selection simulation as computePerBedDisplayPricing.
 * `_headcount` is ignored; ranges use trip.expectedPeopleCount only (clamped to bed count).
 */
export async function computePerBedPricingAtHeadcount(
	tripId: string,
	_headcount: number
): Promise<{ totalNights: number; bedPricing: Record<string, PerBedDisplayPrice> } | null> {
	return computePerBedDisplayPricing(tripId);
}

export interface CostAtMaxParticipation {
	pricingModel: string;
	maxHeadcount: number;
	totalNights: number;
	totalCost: number;
	/** PER_PERSON: price per person when max headcount say yes */
	perPersonAtMax: number | null;
	/** PER_PERSON_PER_NIGHT: price per person per night at max */
	perPersonPerNightAtMax: number | null;
	/** PER_BED / PER_ROOM: average per person at max (totalCost / maxHeadcount) */
	perPersonAverageAtMax: number | null;
}

/**
 * For host dashboard: cost when everyone invited says yes (max participation).
 * Used to incentivize driving RSVPs so price per person goes down.
 */
export async function getCostAtMaxParticipation(tripId: string): Promise<CostAtMaxParticipation | null> {
	const trip = await prisma.trip.findUnique({
		where: { id: tripId },
		include: {
			rooms: {
				orderBy: TRIP_ROOMS_ORDER_BY,
				include: { beds: { orderBy: ROOM_BEDS_ORDER_BY } }
			}
		}
	});
	if (!trip || trip.rooms.length === 0) return null;

	const totalSlots = trip.rooms.reduce(
		(s, r) => s + r.beds.reduce((b, bed) => b + getSpotCount(bed), 0),
		0
	);
	const maxHeadcount = Math.max(1, trip.maxGuests ?? totalSlots);
	const totalNights = calculateNights(trip.checkInDate, trip.checkOutDate);
	const model = (trip.pricingModel ?? 'per_person').toLowerCase();

	const base: CostAtMaxParticipation = {
		pricingModel: trip.pricingModel ?? 'PER_PERSON',
		maxHeadcount,
		totalNights,
		totalCost: trip.totalCost,
		perPersonAtMax: null,
		perPersonPerNightAtMax: null,
		perPersonAverageAtMax: null
	};

	if (model === 'per_person') {
		base.perPersonAtMax = Math.round((trip.totalCost / maxHeadcount) * 100) / 100;
		return base;
	}
	if (model === 'per_person_per_night') {
		const perPersonPerNight = trip.totalCost / (maxHeadcount * totalNights);
		base.perPersonPerNightAtMax = Math.round(perPersonPerNight * 100) / 100;
		base.perPersonAtMax = Math.round((trip.totalCost / maxHeadcount) * 100) / 100;
		return base;
	}
	if (model === 'per_bed' || model === 'per_room') {
		base.perPersonAverageAtMax = Math.round((trip.totalCost / maxHeadcount) * 100) / 100;
		return base;
	}
	return base;
}

/**
 * Sum of current expected cost for all yes-RSVPs based on their reserved beds/rooms/slots.
 * PER_BED: selection-based live split (occupied beds only). For yes users with no bed on PER_BED, counts $0.
 */
export async function computeCommittedFundsFromYesRsvps(tripId: string): Promise<number> {
	// Fetch the trip ONCE with all data needed for price calculation across all yes-RSVPs.
	// This avoids the N+1 pattern of calling calculateReservationPrice (which re-fetches
	// the trip each time) in a loop over every assignment.
	const trip = await prisma.trip.findUnique({
		where: { id: tripId },
		include: {
			rooms: {
				orderBy: TRIP_ROOMS_ORDER_BY,
				include: { beds: { orderBy: ROOM_BEDS_ORDER_BY } }
			},
			rsvps: { where: { status: 'yes' }, select: { userId: true, adultsCount: true } },
			roomAssignments: true
		}
	});
	if (!trip?.rsvps?.length) return 0;

	const yesUserIds = new Set(trip.rsvps.map((r) => r.userId));
	const assignmentsByUser = new Map<string, typeof trip.roomAssignments>();
	for (const a of trip.roomAssignments) {
		if (!yesUserIds.has(a.userId)) continue;
		if (!assignmentsByUser.has(a.userId)) assignmentsByUser.set(a.userId, []);
		assignmentsByUser.get(a.userId)!.push(a);
	}

	const firstRoomId = trip.rooms?.[0]?.id ?? 0;
	const bedWeights = parseBedWeights(trip.bedWeights);
	const pricingModel = (trip.pricingModel || 'per_person').toLowerCase();
	const totalNights = calculateNights(trip.checkInDate, trip.checkOutDate);

	const perBedOcc =
		pricingModel === 'per_bed'
			? buildPerBedOccupancyMap(
					trip.roomAssignments.map((a) => ({
						userId: a.userId,
						roomId: a.roomId,
						bedId: a.bedId,
						partySize: a.partySize
					})),
					yesUserIds
				)
			: null;

	let total = 0;

	for (const userId of yesUserIds) {
		const assignments = assignmentsByUser.get(userId);

		if (assignments?.length) {
			if (pricingModel === 'per_room') {
				const seenRoomIds = new Set<number>();
				for (const a of assignments) {
					if (seenRoomIds.has(a.roomId)) continue;
					seenRoomIds.add(a.roomId);
					const start = a.startDate ?? trip.checkInDate;
					const end = a.endDate ?? trip.checkOutDate;
					const stayNights = calculateNights(start, end);
					const stayFactor = totalNights > 0 ? stayNights / totalNights : 1;
					const numRooms = trip.rooms.length || 1;
					total += (trip.totalCost / numRooms) * stayFactor;
				}
				continue;
			}
			for (const a of assignments) {
				const start = a.startDate ?? trip.checkInDate;
				const end = a.endDate ?? trip.checkOutDate;
				const stayNights = calculateNights(start, end);
				const stayFactor = totalNights > 0 ? stayNights / totalNights : 1;
				const slots = a.partySize ?? 1;
				const room = trip.rooms.find((r) => r.id === a.roomId);
				if (!room) continue;

				let price = 0;
				if (pricingModel === 'per_bed') {
					if (perBedOcc && a.bedId) {
						price = computePerBedLivePriceForBed(
							trip,
							bedWeights,
							perBedOcc,
							a.bedId,
							slots,
							stayNights
						);
					}
				} else if (pricingModel === 'per_person') {
					// PRICING.md: equal-split live = totalCost ÷ sum(room.maxOccupancy)
					const totalCapacity = trip.rooms.reduce((s, r) => s + (r.maxOccupancy ?? 0), 0) || 1;
					price = (trip.totalCost / totalCapacity) * slots * stayFactor;
				} else if (pricingModel === 'per_person_per_night') {
					const totalCapacity =
						trip.expectedPeopleCount ??
						(trip.rooms.reduce((s, r) => s + (r.maxOccupancy ?? 2), 0) || 1);
					price = (trip.totalCost / totalNights / totalCapacity) * slots * stayNights;
				} else {
					const privacyFactor = getRoomEffectivePrivacy(room.beds);
					price = (trip.totalCost / totalNights) * privacyFactor * stayFactor * slots;
				}
				total += price;
			}
		} else if (firstRoomId && pricingModel !== 'per_bed') {
			// Yes RSVP but no room assignment: count as 1 at equal-split (PRICING.md totalSlots).
			const totalCapacity = trip.rooms.reduce((s, r) => s + (r.maxOccupancy ?? 0), 0) || 1;
			total += trip.totalCost / totalCapacity;
		}
	}

	return Math.round(total * 100) / 100;
}

/**
 * Calculate price for a reservation using privacy-aware per-bed or per-room formula.
 * See PRICING.md.
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
	const { tripId, roomId, bedId, numberOfSlots, checkInDate, checkOutDate, quoteForUserId, provisionalPick } =
		params;

	const trip = await prisma.trip.findUnique({
		where: { id: tripId },
		include: {
			rooms: {
				orderBy: TRIP_ROOMS_ORDER_BY,
				include: { beds: { orderBy: ROOM_BEDS_ORDER_BY } }
			},
			rsvps: { where: { status: 'yes' }, select: { userId: true, adultsCount: true } },
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

	const bedWeights = parseBedWeights(trip.bedWeights);
	const privacyFactor = getRoomEffectivePrivacy(room.beds);

	const pricingModel = (trip.pricingModel || 'per_person').toLowerCase();

	if (pricingModel === 'per_room') {
		const roomShare = perRoomShareFullTrip(trip);
		const totalPrice = Math.round(roomShare * stayFactor * 100) / 100;
		const perNightRate = stayNights > 0 ? totalPrice / stayNights : totalPrice;
		return {
			nights: stayNights,
			stayFactor,
			slotPriceForStay: totalPrice,
			totalPrice,
			perNightRate: Math.round(perNightRate * 100) / 100
		};
	}

	if (pricingModel === 'per_bed') {
		const bed = bedId ? room.beds.find((b) => b.id === bedId) : room.beds[0];
		if (!bed) throw new Error('Bed not found');
		const yesUserIds = new Set((trip.rsvps ?? []).map((r) => r.userId));
		const isQuote = provisionalPick != null || quoteForUserId != null;
		const prov =
			provisionalPick ??
			(bedId ? { bedId, partySize: Math.max(1, numberOfSlots) } : undefined);
		if (isQuote && !prov) throw new Error('Bed required for per-bed price quote');
		const occ = buildPerBedOccupancyMap(
			trip.roomAssignments.map((a) => ({
				userId: a.userId,
				roomId: a.roomId,
				bedId: a.bedId,
				partySize: a.partySize
			})),
			yesUserIds,
			isQuote
				? {
						...(quoteForUserId != null ? { excludeUserId: quoteForUserId } : {}),
						provisional: prov!
					}
				: undefined
		);
		const totalPrice = computePerBedLivePriceForBed(
			trip,
			bedWeights,
			occ,
			bed.id,
			Math.max(1, numberOfSlots),
			stayNights
		);
		const perNightRate = stayNights > 0 ? totalPrice / stayNights : totalPrice;
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

	// PER_PERSON_PER_NIGHT: @deprecated in MVP (PRICING.md) — equal split by capacity and nights
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
	perBedFullStay?: { bedType: string; low: number; high: number; price: number }[];
	perPersonPerNight?: number;
	roomBreakdown?: RoomPricing[];
}> {
	const pricing = await computeRoomPricing(tripId);
	const trip = await prisma.trip.findUnique({
		where: { id: tripId },
		include: {
			rooms: {
				orderBy: TRIP_ROOMS_ORDER_BY,
				include: { beds: { orderBy: ROOM_BEDS_ORDER_BY } }
			}
		}
	});

	if (!trip) {
		throw new Error('Trip not found');
	}

	switch (mode) {
		case 'PER_PERSON': {
			// PRICING.md: live = totalCost ÷ sum(room.maxOccupancy)
			const totalCap = trip.rooms.reduce((s, r) => s + (r.maxOccupancy ?? 0), 0) || 1;
			return {
				mode,
				perPersonFullStay: Math.round((trip.totalCost / totalCap) * 100) / 100
			};
		}

		case 'PER_ROOM': {
			const share = perRoomShareFullTrip(trip);
			return {
				mode,
				perRoomFullStay: Math.round(share * 100) / 100,
				roomBreakdown: pricing.roomPricing
			};
		}

		case 'PER_BED': {
			const weights = parseBedWeights(trip.bedWeights);
			const units = buildPerBedInventoryUnits(trip, weights);
			const totalSpots = units.reduce((s, u) => s + u.spotCount, 0);
			// PRICING.md: sim at host max (maxCapacity); cap by total sleep spots
			const simCount = Math.min(
				Math.max(1, favorableHeadcountForClosingRange(trip)),
				Math.max(1, totalSpots)
			);
			const rangeByBedId = computePerBedRangeByBedId(trip.totalCost, simCount, units);
			const byType = aggregatePerBedTypeRanges(units, rangeByBedId);
			const perBed = Object.entries(byType).map(([bedType, r]) => {
				const low = Math.round(r.low * 100) / 100;
				const high = Math.round(r.high * 100) / 100;
				const price = Math.round(((low + high) / 2) * 100) / 100;
				return { bedType, low, high, price };
			});
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

/**
 * Sum selection-simulated low/high full-trip amounts for specific bed IDs, scaled by stay length.
 */
export function perBedSelectionRangeForTripBedIds(
	totalCost: number,
	expectedGuestCount: number,
	trip: { rooms: Array<{ id: number; beds: Array<{ id: string; bedType: string }> }> },
	bedWeights: BedWeights,
	bedIds: string[],
	totalTripNights: number,
	stayNights: number
): { low: number; high: number } {
	const units = buildPerBedInventoryUnits(trip, bedWeights);
	if (units.length === 0 || bedIds.length === 0) return { low: 0, high: 0 };
	// Must cap by total sleeping spots, not number of beds — otherwise 12 vs 20 guests can clamp to the same
	// "bed count" and collapse the whole headcount range (e.g. many bunks with 2 spots each).
	const totalSpots = units.reduce((s, u) => s + u.spotCount, 0);
	const simCount = Math.min(Math.max(1, expectedGuestCount), Math.max(1, totalSpots));
	const rangeByBedId = computePerBedRangeByBedId(totalCost, simCount, units);
	const f = totalTripNights > 0 ? stayNights / totalTripNights : 1;
	let low = 0;
	let high = 0;
	for (const id of bedIds) {
		const r = rangeByBedId.get(id);
		if (r) {
			low += r.lowBedPrice * f;
			high += r.highBedPrice * f;
		}
	}
	return { low, high };
}

// --- QC page: pure PER_BED estimate from inputs (no DB) ---

export interface QCPerBedRoom {
	beds: Array<{ bedType: string; spotCount: number }>;
}

export interface QCPerBedSelection {
	roomIndex: number;
	bedIndex: number;
	spotsClaimed: number;
	nightsStayed: number;
}

export interface QCPerBedInputs {
	totalTripCost: number;
	totalTripNights: number;
	minExpectedGuests: number;
	maxCapacityGuests: number;
	yesRsvpGuests: number;
	bedWeightsJson?: string | null;
	rooms: QCPerBedRoom[];
	selections: QCPerBedSelection[];
}

export interface QCPerBedResult {
	displayPrice: number;
	lowEnd: number;
	highEnd: number;
	totalTripNights: number;
	nightCost: number;
	simGuestCount: number;
	minExpectedGuests: number;
	maxCapacityGuests: number;
	breakdown: Array<{
		roomIndex: number;
		bedIndex: number;
		bedType: string;
		weight: number;
		nightsStayed: number;
		spotsClaimed: number;
		lowContribution: number;
		highContribution: number;
		contribution: number;
	}>;
}

/**
 * Compute PER_BED estimate from QC inputs using the same selection simulation as production.
 */
export function computePerBedEstimateFromInputs(inputs: QCPerBedInputs): QCPerBedResult {
	const totalTripNights = Math.max(1, inputs.totalTripNights);
	const nightCost = totalTripNights > 0 ? inputs.totalTripCost / totalTripNights : inputs.totalTripCost;

	const bedWeights = parseBedWeights(inputs.bedWeightsJson ?? null);

	const tripLike = {
		expectedPeopleCount: inputs.minExpectedGuests,
		maxGuests: inputs.maxCapacityGuests,
		rooms: inputs.rooms.map((r) => ({
			beds: r.beds.map((b) => ({
				bedType: b.bedType,
				capacitySlots: b.spotCount,
				capacity: b.spotCount
			}))
		}))
	};

	const { minExpectedGuests, maxCapacityGuests } = getPerBedRangeGuestCounts(tripLike);

	const units: PerBedInventoryUnit[] = [];
	inputs.rooms.forEach((room, ri) => {
		room.beds.forEach((bed, bi) => {
			const roomPrivacy = getRoomEffectivePrivacy(room.beds);
			const w = getBedWeight(bedWeights, bed.bedType) * roomPrivacy;
			units.push({
				bedId: `qc-${ri}-${bi}`,
				roomId: ri,
				bedType: bed.bedType,
				weight: w,
				spotCount: Math.max(1, bed.spotCount)
			});
		});
	});

	const simCount = Math.min(Math.max(1, minExpectedGuests), Math.max(1, units.reduce((s, u) => s + u.spotCount, 0)));
	const rangeByBedId = computePerBedRangeByBedId(inputs.totalTripCost, simCount, units);

	let displayPrice = 0;
	let highEnd = 0;
	let lowEnd = 0;
	const breakdown: QCPerBedResult['breakdown'] = [];

	for (const sel of inputs.selections) {
		const room = inputs.rooms[sel.roomIndex];
		if (!room) continue;
		const bed = room.beds[sel.bedIndex];
		if (!bed) continue;
		const roomPrivacy = getRoomEffectivePrivacy(room.beds);
		const weight = getBedWeight(bedWeights, bed.bedType) * roomPrivacy;
		const nightsStayed = Math.max(1, sel.nightsStayed);
		const spotsClaimed = Math.max(1, sel.spotsClaimed);
		const stayFactor = totalTripNights > 0 ? nightsStayed / totalTripNights : 1;

		const bedId = `qc-${sel.roomIndex}-${sel.bedIndex}`;
		const r = rangeByBedId.get(bedId);
		// Per-person share: bed price × (spotsClaimed / bed.spotCount)
		const bedSpotCount = Math.max(1, bed.spotCount);
		const occupantFraction = spotsClaimed / bedSpotCount;
		const rowLow = r ? r.lowBedPrice * occupantFraction * stayFactor : 0;
		const rowHigh = r ? r.highBedPrice * occupantFraction * stayFactor : 0;
		const contribution = Math.round(((rowLow + rowHigh) / 2) * 100) / 100;

		displayPrice += contribution;
		highEnd += rowHigh;
		lowEnd += rowLow;
		breakdown.push({
			roomIndex: sel.roomIndex,
			bedIndex: sel.bedIndex,
			bedType: bed.bedType,
			weight,
			nightsStayed,
			spotsClaimed,
			lowContribution: Math.round(rowLow * 100) / 100,
			highContribution: Math.round(rowHigh * 100) / 100,
			contribution
		});
	}

	return {
		displayPrice: Math.round(displayPrice * 100) / 100,
		lowEnd: Math.round(lowEnd * 100) / 100,
		highEnd: Math.round(highEnd * 100) / 100,
		totalTripNights,
		nightCost: Math.round(nightCost * 100) / 100,
		simGuestCount: simCount,
		minExpectedGuests,
		maxCapacityGuests,
		breakdown
	};
}
