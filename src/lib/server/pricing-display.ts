/**
 * Calculate and format pricing display for rooms/beds based on pricing model
 */

import { computeRoomPricing, getBedWeight, parseBedWeights, type PricingMode } from './pricing-canonical.js';
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
			// Price per person = (total ÷ max(effective guest count, yes-RSVPs)) × (bed weight × privacy ÷ average combined weight)
			const bedWeights = parseBedWeights(trip.bedWeights);
			let totalSlots = 0;
			let sumCombinedWeight = 0;
			for (const r of trip.rooms) {
				const p = r.privacyFactor ?? 1.0;
				for (const b of r.beds) {
					const slots = b.capacitySlots || b.capacity || 1;
					totalSlots += slots;
					sumCombinedWeight += slots * getBedWeight(bedWeights, b.bedType) * p;
				}
			}
			const avgCombinedWeight = totalSlots > 0 ? sumCombinedWeight / totalSlots : 1;
			const effectiveGuests = Math.max(1, trip.expectedPeopleCount ?? trip.maxGuests ?? totalSlots);
			const base = trip.totalCost / effectiveGuests;
			const roomPrivacy = room.privacyFactor ?? 1.0;
			for (const bed of room.beds) {
				const w = getBedWeight(bedWeights, bed.bedType);
				const bedPriceFullStay = (base * (w * roomPrivacy)) / avgCombinedWeight;
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
