// Pricing calculation logic for Divvi
// Supports multiple pricing models: per_room, per_bed, per_person, per_person_per_night
// PER_BED uses canonical effectiveGuests × effectiveWeight formula via pricing-canonical.

import { prisma } from './prisma.js';
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
 * Generate a unique invite code
 */
export function generateInviteCode(): string {
	const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed confusing chars
	let code = '';
	for (let i = 0; i < 6; i++) {
		code += chars.charAt(Math.floor(Math.random() * chars.length));
	}
	return code;
}

/**
 * Calculate price based on pricing model
 */
export async function calculatePrice(
	params: CalculatePriceParams
): Promise<PriceCalculationResult> {
	const { tripId, roomId, bedId, numberOfGuests = 1, checkInDate, checkOutDate } = params;

	// Get trip details
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
			const canonical = await calculateReservationPrice({
				tripId,
				roomId: resolvedRoomId,
				bedId: bedId!,
				numberOfSlots: numberOfGuests ?? 1,
				checkInDate,
				checkOutDate
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
 * Per Person: Total cost divided by total capacity, flat rate
 */
function calculatePerPersonPrice(
	trip: { totalCost: number; rooms: Array<{ maxOccupancy: number | null }> },
	numberOfGuests: number,
	totalNights: number
): PriceCalculationResult {
	// Calculate total capacity
	const totalCapacity = trip.rooms.reduce((sum, room) => {
		return sum + (room.maxOccupancy || 1);
	}, 0);

	const costPerPerson = trip.totalCost / totalCapacity;
	const totalPrice = costPerPerson * numberOfGuests;
	const nightlyRate = totalPrice / totalNights; // For display purposes

	return {
		nights: totalNights, // Full trip duration
		nightlyRate: Number(nightlyRate.toFixed(2)),
		totalPrice: Number(totalPrice.toFixed(2))
	};
}

/**
 * Per Person Per Night: Total cost divided by total capacity and nights
 */
function calculatePerPersonPerNightPrice(
	trip: { totalCost: number; rooms: Array<{ maxOccupancy: number | null }> },
	numberOfGuests: number,
	nights: number,
	totalNights: number
): PriceCalculationResult {
	// Calculate total capacity
	const totalCapacity = trip.rooms.reduce((sum, room) => {
		return sum + (room.maxOccupancy || 1);
	}, 0);

	const costPerPersonPerNight = trip.totalCost / totalNights / totalCapacity;
	const nightlyRate = costPerPersonPerNight * numberOfGuests;
	const totalPrice = nightlyRate * nights;

	return {
		nights,
		nightlyRate: Number(nightlyRate.toFixed(2)),
		totalPrice: Number(totalPrice.toFixed(2))
	};
}

/**
 * Legacy function for backward compatibility
 * @deprecated Use calculatePrice instead
 */
export function calculateGuestPrice({
	bedId,
	checkInDate,
	checkOutDate
}: {
	bedId: string;
	checkInDate: Date;
	checkOutDate: Date;
}): PriceCalculationResult {
	const nights = calculateNights(checkInDate, checkOutDate);
	// This is a stub - should not be used in new code
	throw new Error('Legacy calculateGuestPrice is deprecated. Use calculatePrice with tripId instead.');
}

/**
 * Legacy function for backward compatibility
 * @deprecated
 */
export function getAllBedsWithPricing(): Array<{ id: string; roomId: number; bedType: string; nightlyRate: number }> {
	// Stub for backward compatibility
	return [];
}

/**
 * Legacy function for backward compatibility
 * @deprecated
 */
export function getBedById(bedId: string): { id: string; roomId: number; bedType: string } | undefined {
	return undefined;
}

/**
 * Legacy function for backward compatibility
 * @deprecated
 */
export function getBedsByRoomId(roomId: number): Array<{ id: string; roomId: number; bedType: string }> {
	return [];
}
