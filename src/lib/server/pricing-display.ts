/**
 * Calculate and format pricing display for rooms/beds based on pricing model
 */

import { computeRoomPricing, type PricingMode } from './pricing-canonical.js';
import { prisma } from './prisma.js';

export interface RoomPricingDisplay {
	roomId: number;
	roomName: string;
	priceDisplay: string; // Formatted price string
	bedPricing?: BedPricingDisplay[];
}

export interface BedPricingDisplay {
	bedId: string;
	bedType: string;
	priceDisplay: string; // Formatted price string
}

/**
 * Calculate pricing display for a trip based on its pricing model
 */
export async function calculatePricingDisplay(tripId: string): Promise<{
	roomPricing: RoomPricingDisplay[];
	perPersonPrice?: number;
	perPersonPerNightPrice?: number;
}> {
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

	if (!trip || trip.rooms.length === 0) {
		return { roomPricing: [] };
	}

	const totalNights = Math.ceil(
		(trip.checkOutDate.getTime() - trip.checkInDate.getTime()) / (1000 * 60 * 60 * 24)
	);

	const pricingModel = trip.pricingModel.toUpperCase() as PricingMode;

	// Use canonical pricing for accurate calculations
	const computedPricing = await computeRoomPricing(tripId);

	const roomPricing: RoomPricingDisplay[] = [];

	if (pricingModel === 'PER_PERSON') {
		// Calculate per person price
		const totalCapacity = trip.rooms.reduce((sum, room) => {
			return sum + (room.maxOccupancy || computedPricing.roomPricing.find(r => r.roomId === room.id)?.occMax || 1);
		}, 0);

		const perPersonPrice = trip.totalCost / totalCapacity;

		return {
			roomPricing: trip.rooms.map(room => ({
				roomId: room.id,
				roomName: room.name,
				priceDisplay: `$${perPersonPrice.toFixed(2)} per person`
			})),
			perPersonPrice
		};
	}

	if (pricingModel === 'PER_PERSON_PER_NIGHT') {
		// Calculate per person per night price
		const totalCapacity = trip.rooms.reduce((sum, room) => {
			return sum + (room.maxOccupancy || computedPricing.roomPricing.find(r => r.roomId === room.id)?.occMax || 1);
		}, 0);

		const perPersonPerNightPrice = trip.totalCost / totalNights / totalCapacity;

		return {
			roomPricing: trip.rooms.map(room => ({
				roomId: room.id,
				roomName: room.name,
				priceDisplay: `$${perPersonPerNightPrice.toFixed(2)} per person per night`
			})),
			perPersonPerNightPrice
		};
	}

	// For PER_ROOM and PER_BED, use canonical pricing
	for (const room of trip.rooms) {
		const roomPricingData = computedPricing.roomPricing.find(r => r.roomId === room.id);
		
		if (!roomPricingData) {
			continue;
		}

		const bedPricing: BedPricingDisplay[] = [];

		if (pricingModel === 'PER_BED') {
			// Show price per bed
			for (const bed of room.beds) {
				// Calculate bed price based on bed weight and slots
				const bedWeights = JSON.parse(trip.bedWeights || '{}');
				const bedWeight = bedWeights[bed.bedType.toLowerCase()] || 0.6;
				const slots = bed.capacitySlots || bed.capacity || 1;
				
				// Use proportional pricing based on bed weight
				const bedWeightRatio = (bedWeight * slots) / roomPricingData.bedWeightSum;
				const bedPriceFullStay = roomPricingData.roomPriceFullStay * bedWeightRatio;
				const bedPricePerNight = bedPriceFullStay / totalNights;

				bedPricing.push({
					bedId: bed.id,
					bedType: bed.bedType,
					priceDisplay: `$${bedPricePerNight.toFixed(2)} per night ($${bedPriceFullStay.toFixed(2)} for ${totalNights} nights)`
				});
			}
		}

		const roomDisplay: RoomPricingDisplay = {
			roomId: room.id,
			roomName: room.name,
			priceDisplay: pricingModel === 'PER_ROOM'
				? `$${roomPricingData.roomPricePerNight.toFixed(2)} per night ($${roomPricingData.roomPriceFullStay.toFixed(2)} for ${totalNights} nights)`
				: `See bed pricing below`,
			bedPricing: bedPricing.length > 0 ? bedPricing : undefined
		};

		roomPricing.push(roomDisplay);
	}

	return { roomPricing };
}
