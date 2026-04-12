// Pricing calculation logic for Divvi
//
// Vocabulary note — three representations of "pricing model" exist in this codebase:
//   DB / API form    (this file):             'per_room' | 'per_bed' | 'per_person' | 'per_person_per_night'
//   Internal/canonical form (pricing-canonical.ts): 'PER_ROOM' | 'PER_BED' | 'PER_PERSON' | 'PER_PERSON_PER_NIGHT'
//   UI form (PricingStep.svelte):             'per-room' | 'per-bed' | 'per-person'
//
// mapPricingModel() in api/trips/publish and api/trips/[tripId]/update bridges UI → DB form.
// calculatePrice() normalizes via .toLowerCase() so it accepts both DB and canonical forms.

import { prisma } from './prisma.js';
import { ROOM_BEDS_ORDER_BY, TRIP_ROOMS_ORDER_BY } from './trip-room-order.js';
import { calculateReservationPrice } from './pricing-canonical.js';

export type PricingModel = 'per_room' | 'per_bed' | 'per_person' | 'per_person_per_night';

export interface PriceCalculationResult {
	nights: number;
	nightlyRate: number;
	totalPrice: number;
}

export interface CalculatePriceParams {
	tripId: string;
	roomId?: number;
	bedId?: string;
	numberOfGuests?: number;
	checkInDate: Date;
	checkOutDate: Date;
	/**
	 * PER_BED: merge this bed into occupancy (for quotes / new bookings). Omit for stored assignments only.
	 */
	perBedQuote?: boolean;
	/** PER_BED quote: exclude this user's assignments before merging the quoted bed */
	quoteForUserId?: string;
}

/**
 * Calculate the number of nights between two dates
 */
function calculateNights(checkInDate: Date, checkOutDate: Date): number {
	return Math.ceil(
		(checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24)
	);
}

/**
 * Calculate price based on pricing model
 */
export async function calculatePrice(
	params: CalculatePriceParams
): Promise<PriceCalculationResult> {
	const { tripId, roomId, bedId, numberOfGuests = 1, checkInDate, checkOutDate, perBedQuote, quoteForUserId } =
		params;

	// Get trip details
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

	const nights = calculateNights(checkInDate, checkOutDate);
	if (nights <= 0) {
		throw new Error('Invalid date range');
	}

	const totalNights = calculateNights(trip.checkInDate, trip.checkOutDate);

	// Calculate price based on model (normalize to lowercase; DB may store PER_BED, per_bed, etc.)
	const pricingModel = (trip.pricingModel ?? '').toLowerCase();
	switch (pricingModel) {
		case 'per_room':
			return calculatePerRoomPrice(trip, roomId!, nights, totalNights);

		case 'per_bed': {
			const resolvedRoomId =
				roomId ?? trip.rooms.find((r) => r.beds.some((b) => b.id === bedId))?.id;
			if (resolvedRoomId == null) throw new Error('Room not found for bed');
			const slots = numberOfGuests ?? 1;
			const canonical = await calculateReservationPrice({
				tripId,
				roomId: resolvedRoomId,
				bedId: bedId!,
				numberOfSlots: slots,
				checkInDate,
				checkOutDate,
				...(perBedQuote && bedId
					? {
							provisionalPick: { bedId, partySize: Math.max(1, slots) },
							...(quoteForUserId ? { quoteForUserId } : {})
						}
					: {})
			});
			return {
				nights: canonical.nights,
				nightlyRate: Number(canonical.perNightRate.toFixed(2)),
				totalPrice: Number(canonical.totalPrice.toFixed(2))
			};
		}

		case 'per_person':
			return calculatePerPersonPrice(trip, numberOfGuests, totalNights);

		case 'per_person_per_night':
			return calculatePerPersonPerNightPrice(trip, numberOfGuests, nights, totalNights);

		default:
			throw new Error(`Unknown pricing model: ${trip.pricingModel ?? '(empty)'}`);
	}
}

/**
 * Per Room: Total cost divided by number of rooms, then by nights
 */
function calculatePerRoomPrice(
	trip: { totalCost: number; rooms: Array<{ id: number }> },
	roomId: number,
	nights: number,
	totalNights: number
): PriceCalculationResult {
	const totalRooms = trip.rooms.length;
	const roomCostPerNight = trip.totalCost / totalNights / totalRooms;
	const nightlyRate = roomCostPerNight;
	const totalPrice = nightlyRate * nights;

	return {
		nights,
		nightlyRate: Number(nightlyRate.toFixed(2)),
		totalPrice: Number(totalPrice.toFixed(2))
	};
}

/**
 * Per Person: Total cost divided by expected people count (or room capacity as fallback), flat rate.
 * Uses trip.expectedPeopleCount first, then falls back to sum of room maxOccupancy.
 */
function calculatePerPersonPrice(
	trip: { totalCost: number; expectedPeopleCount?: number | null; rooms: Array<{ maxOccupancy: number | null }> },
	numberOfGuests: number,
	totalNights: number
): PriceCalculationResult {
	// Prefer the host-configured expected people count over room capacity sum.
	const totalCapacity =
		trip.expectedPeopleCount ??
		(trip.rooms.reduce((sum, room) => sum + (room.maxOccupancy || 2), 0) || 1);

	const costPerPerson = trip.totalCost / totalCapacity;
	const totalPrice = costPerPerson * numberOfGuests;
	const nightlyRate = totalPrice / totalNights;

	return {
		nights: totalNights,
		nightlyRate: Number(nightlyRate.toFixed(2)),
		totalPrice: Number(totalPrice.toFixed(2))
	};
}

/**
 * Per Person Per Night: Total cost divided by expected people count (or room capacity) and nights.
 */
function calculatePerPersonPerNightPrice(
	trip: { totalCost: number; expectedPeopleCount?: number | null; rooms: Array<{ maxOccupancy: number | null }> },
	numberOfGuests: number,
	nights: number,
	totalNights: number
): PriceCalculationResult {
	const totalCapacity =
		trip.expectedPeopleCount ??
		(trip.rooms.reduce((sum, room) => sum + (room.maxOccupancy || 2), 0) || 1);

	const costPerPersonPerNight = trip.totalCost / totalNights / totalCapacity;
	const nightlyRate = costPerPersonPerNight * numberOfGuests;
	const totalPrice = nightlyRate * nights;

	return {
		nights,
		nightlyRate: Number(nightlyRate.toFixed(2)),
		totalPrice: Number(totalPrice.toFixed(2))
	};
}

