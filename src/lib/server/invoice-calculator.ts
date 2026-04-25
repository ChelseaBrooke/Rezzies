import { prisma } from './prisma.js';
import { ROOM_BEDS_ORDER_BY } from './trip-room-order.js';
import { calculateReservationPrice } from './pricing-canonical.js';

export interface InvoiceBreakdown {
	rooms: {
		roomId: number;
		roomName: string;
		bedType?: string;
		amount: number;
		nights: number;
	}[];
	meals?: {
		label: string;
		amount: number;
		partySize: number;
		perPerson: number;
	}[];
	activities: {
		activityId: string;
		activityName: string;
		amount: number;
		participants: number;
	}[];
	extras: {
		ruleId: string;
		label: string;
		amount: number;
		quantity: number;
	}[];
	total: number;
}

export async function calculateInvoiceForUser(tripId: string, userId: string): Promise<InvoiceBreakdown> {
	// Get user's selections (multiple room assignments = multi-select beds)
	const [roomAssignments, activityParticipants, extraSelections, trip] = await Promise.all([
		prisma.roomAssignment.findMany({
			where: { tripId, userId },
			include: { room: { include: { beds: { orderBy: ROOM_BEDS_ORDER_BY } } } }
		}),
		prisma.activityParticipant.findMany({
			where: {
				userId,
				activity: { tripId }
			},
			include: {
				activity: true
			}
		}),
		prisma.guestExtraSelection.findMany({
			where: { tripId, userId },
			include: {
				rule: true
			}
		}),
		prisma.trip.findUnique({
			where: { id: tripId },
			include: { mealPlan: true }
		})
	]);

	if (!trip) {
		throw new Error('Trip not found');
	}

	const breakdown: InvoiceBreakdown = {
		rooms: [],
		activities: [],
		extras: [],
		total: 0
	};

	const pricingModel = (trip.pricingModel || '').toLowerCase();

	// Calculate room costs (per-bed line items, or one line per whole-room claim for PER_ROOM)
	for (const roomAssignment of roomAssignments) {
		const startDate = roomAssignment.startDate || trip.checkInDate;
		const endDate = roomAssignment.endDate || trip.checkOutDate;
		const nights = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

		if (pricingModel === 'per_room' && roomAssignment.bedId == null) {
			const priceCalculation = await calculateReservationPrice({
				tripId,
				roomId: roomAssignment.roomId,
				numberOfSlots: roomAssignment.partySize || 1,
				checkInDate: startDate,
				checkOutDate: endDate
			});
			breakdown.rooms.push({
				roomId: roomAssignment.roomId,
				roomName: roomAssignment.room.name,
				amount: priceCalculation.totalPrice,
				nights
			});
			continue;
		}

		const bed = roomAssignment.bedId
			? roomAssignment.room.beds.find((b) => b.id === roomAssignment.bedId)
			: roomAssignment.room.beds.find((b) => b.bedType === roomAssignment.bedType) || roomAssignment.room.beds[0];

		if (bed) {
			const priceCalculation = await calculateReservationPrice({
				tripId,
				roomId: roomAssignment.roomId,
				bedId: bed.id,
				numberOfSlots: roomAssignment.partySize,
				checkInDate: startDate,
				checkOutDate: endDate
			});

			breakdown.rooms.push({
				roomId: roomAssignment.roomId,
				roomName: roomAssignment.room.name,
				bedType: bed.bedType ?? undefined,
				amount: priceCalculation.totalPrice,
				nights
			});
		}
	}

	const firstAssignment = roomAssignments[0];

	// Meal share (food fund) - when host pools money for food
	const mealPlan = trip.mealPlan;
	if (mealPlan?.perGuestMealContribution != null && mealPlan.perGuestMealContribution > 0 && roomAssignments.length > 0) {
		const partySize = roomAssignments.reduce((s, a) => s + (a.partySize || 1), 0);
		const mealAmount = partySize * mealPlan.perGuestMealContribution;
		breakdown.meals = [
			{
				label: 'Meal share (food fund)',
				amount: mealAmount,
				partySize,
				perPerson: mealPlan.perGuestMealContribution
			}
		];
	}

	// Calculate activity costs
	for (const participant of activityParticipants) {
		if (participant.status === 'in') {
			breakdown.activities.push({
				activityId: participant.activityId,
				activityName: participant.activity.title,
				amount: participant.activity.pricePerPerson,
				participants: 1 // Each participant pays their own
			});
		}
	}

	// Calculate extra costs
	for (const selection of extraSelections) {
		let amount = selection.rule.amount;
		
		// Apply quantity-based pricing
		if (selection.rule.type === 'per_pet' || selection.rule.type === 'per_night') {
			const nights = firstAssignment
				? Math.ceil(((firstAssignment.endDate || trip.checkOutDate).getTime() - (firstAssignment.startDate || trip.checkInDate).getTime()) / (1000 * 60 * 60 * 24))
				: Math.ceil((trip.checkOutDate.getTime() - trip.checkInDate.getTime()) / (1000 * 60 * 60 * 24));
			
			if (selection.rule.type === 'per_night') {
				amount = amount * nights;
			}
		}
		
		breakdown.extras.push({
			ruleId: selection.ruleId,
			label: selection.rule.label,
			amount: amount * selection.quantity,
			quantity: selection.quantity
		});
	}

	// Calculate total
	breakdown.total =
		breakdown.rooms.reduce((sum, r) => sum + r.amount, 0) +
		(breakdown.meals?.reduce((sum, m) => sum + m.amount, 0) ?? 0) +
		breakdown.activities.reduce((sum, a) => sum + a.amount, 0) +
		breakdown.extras.reduce((sum, e) => sum + e.amount, 0);

	return breakdown;
}

export async function createInvoiceForUser(tripId: string, userId: string) {
	const breakdown = await calculateInvoiceForUser(tripId, userId);

	// Check if invoice already exists
	const existing = await prisma.invoice.findFirst({
		where: { tripId, userId, status: 'due' }
	});

	if (existing) {
		// Update existing invoice
		const updated = await prisma.invoice.update({
			where: { id: existing.id },
			data: {
				totalAmount: breakdown.total,
				breakdownJson: JSON.stringify(breakdown)
			}
		});
		const { evaluateCostReapprovalForTrip } = await import('./cost-reapproval.js');
		await evaluateCostReapprovalForTrip(tripId).catch((e) => console.warn('[invoice] cost reapproval eval:', e));
		return updated;
	}

	// Create new invoice
	const created = await prisma.invoice.create({
		data: {
			tripId,
			userId,
			totalAmount: breakdown.total,
			currency: 'USD',
			status: 'due',
			breakdownJson: JSON.stringify(breakdown)
		}
	});
	const { evaluateCostReapprovalForTrip } = await import('./cost-reapproval.js');
	await evaluateCostReapprovalForTrip(tripId).catch((e) => console.warn('[invoice] cost reapproval eval:', e));
	return created;
}
