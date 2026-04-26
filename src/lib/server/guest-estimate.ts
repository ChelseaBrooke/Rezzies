/**
 * Guest cost estimate range for RSVP cost commitment.
 * Computes low/high estimate based on headcount min/max; used for checkbox and reconfirm logic.
 */

import { prisma } from './prisma.js';
import { effectiveSleepSlots } from '$lib/bed-spot-validation.js';
import { ROOM_BEDS_ORDER_BY, TRIP_ROOMS_ORDER_BY } from './trip-room-order.js';
import {
	calculateReservationPrice,
	calculateNights,
	parseBedWeights,
	perBedSelectionRangeForTripBedIds,
	buildPerBedOccupancyMap,
	computePerBedLivePriceForBed,
	perRoomShareFullTrip
} from './pricing-canonical.js';
import { createHash } from 'crypto';

/**
 * Per-bed commitment band: optimistic $ at modeled **full house** (`hmax`), pessimistic $ at
 * **planning minimum** headcount (`hmin`). We deliberately do **not** simulate at raw yes-RSVP count
 * (can be tiny vs beds) — that inflates the “max” with non-physical allocation math. Live invoice
 * stays in `displayCents` from real assignments.
 *
 * Within each headcount we take both fill-order corners so we do not collapse when only one pair
 * of corners matches (e.g. hmax.low === hmin.high).
 */
function perBedPlanningBandUsd(
	tripTotalCost: number,
	trip: Parameters<typeof perBedSelectionRangeForTripBedIds>[2],
	bedWeights: ReturnType<typeof parseBedWeights>,
	bedId: string,
	totalTripNights: number,
	stayNights: number,
	hmin: number,
	hmax: number
): { low: number; high: number } {
	const atMax = perBedSelectionRangeForTripBedIds(
		tripTotalCost,
		hmax,
		trip,
		bedWeights,
		[bedId],
		totalTripNights,
		stayNights
	);
	const atMin = perBedSelectionRangeForTripBedIds(
		tripTotalCost,
		hmin,
		trip,
		bedWeights,
		[bedId],
		totalTripNights,
		stayNights
	);
	const low = Math.min(atMax.low, atMax.high);
	const high = Math.max(atMin.low, atMin.high);
	if (low <= high) return { low, high };
	return { low: high, high: low };
}

function dollarsToSpreadCents(lowEnd: number, highEnd: number, hmin: number, hmax: number): { lowCents: number; highCents: number } {
	let lowCents = Math.floor(lowEnd * 100 + 1e-9);
	let highCents = Math.ceil(highEnd * 100 - 1e-9);
	if (lowCents > highCents) {
		const t = lowCents;
		lowCents = highCents;
		highCents = t;
	}
	if (hmin < hmax && lowCents === highCents && highEnd > lowEnd + 1e-8) {
		highCents = lowCents + 1;
	}
	return { lowCents, highCents };
}

export interface GuestEstimateRange {
	lowCents: number;
	highCents: number;
	hmin: number;
	hmax: number;
	costBasisVersion: string;
	explanationReason: string;
	/** When set (PER_BED): current estimate using effective guest count; always in [lowCents, highCents]. */
	displayCents?: number;
}

export interface ReconfirmPolicy {
	enabled: boolean;
	deadlineType: 'rolling' | 'fixed_trip_date' | 'host_configured';
	rollingHours?: number;
	fixedDaysBeforeTrip?: number;
	hostConfiguredAt?: string; // ISO datetime
}

const DEFAULT_RECONFIRM_POLICY: ReconfirmPolicy = {
	enabled: true,
	deadlineType: 'rolling',
	rollingHours: 72
};

export function parseReconfirmPolicy(json: string | null): ReconfirmPolicy {
	if (!json?.trim()) return { ...DEFAULT_RECONFIRM_POLICY };
	try {
		const parsed = JSON.parse(json) as Partial<ReconfirmPolicy>;
		return {
			enabled: parsed.enabled ?? DEFAULT_RECONFIRM_POLICY.enabled,
			deadlineType: parsed.deadlineType ?? DEFAULT_RECONFIRM_POLICY.deadlineType,
			rollingHours: parsed.rollingHours ?? DEFAULT_RECONFIRM_POLICY.rollingHours,
			fixedDaysBeforeTrip: parsed.fixedDaysBeforeTrip,
			hostConfiguredAt: parsed.hostConfiguredAt
		};
	} catch {
		return { ...DEFAULT_RECONFIRM_POLICY };
	}
}

/**
 * Compute a deterministic cost-basis version string from trip pricing inputs.
 */
function computeCostBasisVersion(trip: {
	id: string;
	totalCost: number;
	pricingModel: string;
	bedWeights: string | null;
	expectedPeopleCount: number | null;
	maxGuests: number | null;
	rooms?: { id: number; privacyFactor: number | null; beds: { id: string; bedType: string; capacitySlots: number | null; capacity: number | null }[] }[];
}): string {
	const payload = {
		tripId: trip.id,
		totalCost: trip.totalCost,
		pricingModel: trip.pricingModel,
		bedWeights: trip.bedWeights,
		expectedPeopleCount: trip.expectedPeopleCount,
		maxGuests: trip.maxGuests,
		rooms: trip.rooms?.map((r) => ({
			id: r.id,
			privacyFactor: r.privacyFactor,
			beds: r.beds?.map((b) => ({ id: b.id, bedType: b.bedType, slots: effectiveSleepSlots(b) }))
		}))
	};
	return createHash('sha256').update(JSON.stringify(payload)).digest('hex').slice(0, 16);
}

/**
 * Compute guest's estimated cost range: low (if Hmax attend), high (if Hmin attend).
 * Uses current trip + RSVPs for headcount bounds; if guest has no room assignment, uses first room/bed for estimate.
 */
export async function computeGuestEstimateRange(
	tripId: string,
	guestId: string
): Promise<GuestEstimateRange> {
	const [trip, rsvps, roomAssignments, guestRsvp] = await Promise.all([
		prisma.trip.findUnique({
			where: { id: tripId },
			include: {
				rooms: {
					orderBy: TRIP_ROOMS_ORDER_BY,
					include: { beds: { orderBy: ROOM_BEDS_ORDER_BY } }
				},
				roomAssignments: true
			}
		}),
		prisma.rSVP.findMany({
			where: { tripId, status: 'yes' },
			select: { userId: true, adultsCount: true }
		}),
		prisma.roomAssignment.findMany({
			where: { tripId },
			include: { room: { include: { beds: { orderBy: ROOM_BEDS_ORDER_BY } } } }
		}),
		prisma.rSVP.findUnique({
			where: { tripId_userId: { tripId, userId: guestId } }
		})
	]);

	if (!trip || trip.rooms.length === 0) {
		throw new Error('Trip not found or has no rooms');
	}

	const totalSlots = trip.rooms.reduce(
		(s, r) => s + r.beds.reduce((b, bed) => b + effectiveSleepSlots(bed), 0),
		0
	);
	const totalBeds = trip.rooms.reduce((s, r) => s + r.beds.length, 0);
	const maxCapacity = trip.maxGuests ?? totalSlots;

	// Headcount bounds for estimate display and pricing: min expected guests (higher share) to max capacity (lower share)
	const hmin = Math.max(1, trip.expectedPeopleCount ?? 1);
	const hmax = Math.max(hmin, maxCapacity);

	const costBasisVersion = computeCostBasisVersion(trip);

	const pricingModel = (trip.pricingModel || 'per_person').toLowerCase();
	const guestPartySize = Math.max(1, guestRsvp?.adultsCount ?? 1);

	// Get this guest's room/bed for price calc; if none, use first room + first bed
	const guestAssignments = roomAssignments.filter((a) => a.userId === guestId);
	const firstAssignment = guestAssignments[0];
	let roomId: number;
	let bedId: string | undefined;
	let numberOfSlots: number;
	let checkInDate: Date;
	let checkOutDate: Date;

	if (firstAssignment) {
		roomId = firstAssignment.roomId;
		bedId = firstAssignment.bedId ?? undefined;
		numberOfSlots = firstAssignment.partySize || 1;
		checkInDate = firstAssignment.startDate ?? trip.checkInDate;
		checkOutDate = firstAssignment.endDate ?? trip.checkOutDate;
	} else if (pricingModel === 'per_room') {
		const firstRoom = trip.rooms[0];
		if (!firstRoom) throw new Error('Trip has no rooms');
		roomId = firstRoom.id;
		bedId = undefined;
		numberOfSlots = guestPartySize;
		checkInDate = trip.checkInDate;
		checkOutDate = trip.checkOutDate;
	} else if (pricingModel === 'per_bed') {
		const firstRoom = trip.rooms.find((r) => (r.beds?.length ?? 0) > 0) ?? trip.rooms[0];
		if (!firstRoom) throw new Error('Trip has no rooms');
		const firstBed = firstRoom.beds?.[0];
		if (!firstBed) throw new Error('Trip has no beds configured');
		roomId = firstRoom.id;
		bedId = undefined;
		numberOfSlots = guestPartySize;
		checkInDate = trip.checkInDate;
		checkOutDate = trip.checkOutDate;
	} else {
		const firstRoom = trip.rooms.find((r) => (r.beds?.length ?? 0) > 0) ?? trip.rooms[0];
		if (!firstRoom) throw new Error('Trip has no rooms');
		const firstBed = firstRoom.beds?.[0];
		if (!firstBed) throw new Error('Trip has no beds configured');
		roomId = firstRoom.id;
		bedId = firstBed.id;
		numberOfSlots = guestPartySize;
		checkInDate = trip.checkInDate;
		checkOutDate = trip.checkOutDate;
	}

	// For PER_PERSON and PER_PERSON_PER_NIGHT, price doesn't vary by headcount in the same way; use capacity.
	let lowCents = 0;
	let highCents = 0;
	let explanationReason = 'Based on current headcount range.';
	let displayCents: number | undefined;

	if (pricingModel === 'per_bed' && guestAssignments.length > 0) {
		const guestClaimedBedIds = new Set(
			guestAssignments.map((a) => a.bedId).filter((id): id is string => id != null)
		);
		// Full lodging only when this guest has claimed every bed in the trip (by bed count, not slot sum)
		const allBedsClaimed = totalBeds > 0 && guestClaimedBedIds.size >= totalBeds;

		if (allBedsClaimed) {
			// Guest has the full lodging, no one to split with. Single value = full trip cost (for their stay).
			const totalNights = calculateNights(trip.checkInDate, trip.checkOutDate);
			const stayNights = calculateNights(checkInDate, checkOutDate);
			const stayFactor = totalNights > 0 ? stayNights / totalNights : 1;
			const fullStayCents = Math.round(trip.totalCost * stayFactor * 100);
			lowCents = fullStayCents;
			highCents = fullStayCents;
			explanationReason = "You're taking the full lodging; no split with other guests.";
		} else {
			const bedWeights = parseBedWeights(trip.bedWeights);
			const totalNights = calculateNights(trip.checkInDate, trip.checkOutDate);
			let lowEnd = 0;
			let highEnd = 0;
			let guestDisplayedTotal = 0;
			for (const a of guestAssignments) {
				if (!a.bedId) continue;
				const stayNights = calculateNights(a.startDate ?? trip.checkInDate, a.endDate ?? trip.checkOutDate);
				const band = perBedPlanningBandUsd(
					trip.totalCost,
					trip,
					bedWeights,
					a.bedId,
					totalNights,
					stayNights,
					hmin,
					hmax
				);
				lowEnd += band.low;
				highEnd += band.high;
				const pr = await calculateReservationPrice({
					tripId,
					roomId: a.roomId,
					bedId: a.bedId,
					numberOfSlots: a.partySize || 1,
					checkInDate: a.startDate ?? trip.checkInDate,
					checkOutDate: a.endDate ?? trip.checkOutDate
				});
				guestDisplayedTotal += pr.totalPrice;
			}
			const cents = dollarsToSpreadCents(lowEnd, highEnd, hmin, hmax);
			lowCents = cents.lowCents;
			highCents = cents.highCents;
			displayCents = Math.round(guestDisplayedTotal * 100);
			displayCents = Math.max(lowCents, Math.min(highCents, displayCents));
			explanationReason =
				'Low end models max headcount (capacity); high end models the planning minimum headcount. Both include how guests may spread across beds. Live amount uses current assignments.';
		}
	} else if (pricingModel === 'per_bed' && guestAssignments.length === 0) {
		const totalNights = calculateNights(trip.checkInDate, trip.checkOutDate);
		const stayNights = calculateNights(checkInDate, checkOutDate);
		const stayFactor = totalNights > 0 ? stayNights / totalNights : 1;
		const denom = Math.max(1, hmax);
		const cents = Math.round(((trip.totalCost * guestPartySize) / denom) * stayFactor * 100);
		lowCents = cents;
		highCents = cents;
		displayCents = cents;
		explanationReason =
			'Provisional share until the host assigns your bed (no open spots matched your party when you RSVPed).';
	} else if (pricingModel === 'per_room') {
		const pr = await calculateReservationPrice({
			tripId,
			roomId,
			numberOfSlots,
			checkInDate,
			checkOutDate,
			...(bedId ? { bedId } : {})
		});
		const cents = Math.round(pr.totalPrice * 100);
		lowCents = cents;
		highCents = cents;
		displayCents = cents;
		explanationReason = 'Each room pays an equal share of the trip total (prorated to your stay).';
	} else if (pricingModel !== 'per_bed') {
		// PER_PERSON / PER_PERSON_PER_NIGHT: use capacity-based single price; range = same or slight variance
		const single = await calculateReservationPrice({
			tripId,
			roomId,
			bedId,
			numberOfSlots,
			checkInDate,
			checkOutDate
		});
		const cents = Math.round(single.totalPrice * 100);
		lowCents = cents;
		highCents = cents;
		explanationReason = 'Fixed per-person rate for this trip.';
	}

	// Ensure low <= high
	if (lowCents > highCents) {
		const t = lowCents;
		lowCents = highCents;
		highCents = t;
	}

	return {
		lowCents,
		highCents,
		hmin,
		hmax,
		costBasisVersion,
		explanationReason,
		...(displayCents != null && { displayCents })
	};
}

export interface GuestEstimateOverrides {
	arrivalDate?: string; // YYYY-MM-DD
	departureDate?: string;
	adultsCount: number;
	bedIds: string[];
	/** PER_ROOM: selected room ids (whole-room claim); each adds one equal share of trip total */
	roomIds?: number[];
}

/**
 * Compute guest estimate using overrides (dates, party size, selected beds) for live preview.
 * Follows same pricing rules as computeGuestEstimateRange.
 */
export async function computeGuestEstimateWithOverrides(
	tripId: string,
	guestId: string,
	overrides: GuestEstimateOverrides
): Promise<GuestEstimateRange | null> {
	const [trip, yesRsvps] = await Promise.all([
		prisma.trip.findUnique({
			where: { id: tripId },
			include: {
				rooms: {
					orderBy: TRIP_ROOMS_ORDER_BY,
					include: { beds: { orderBy: ROOM_BEDS_ORDER_BY } }
				},
				roomAssignments: true
			}
		}),
		prisma.rSVP.findMany({
			where: { tripId, status: 'yes' },
			select: { userId: true, adultsCount: true }
		})
	]);
	if (!trip || trip.rooms.length === 0) return null;
	const yesUserIds = new Set(yesRsvps.map((r) => r.userId));
	const totalSlots = trip.rooms.reduce(
		(s, r) => s + r.beds.reduce((b, bed) => b + effectiveSleepSlots(bed), 0),
		0
	);
	const maxCapacity = trip.maxGuests ?? totalSlots;
	const hmin = Math.max(1, trip.expectedPeopleCount ?? 1);
	const hmax = Math.max(hmin, maxCapacity);

	const checkInDate =
		overrides.arrivalDate?.trim() ?
			new Date(overrides.arrivalDate.trim() + 'T12:00:00')
		:	trip.checkInDate;
	const checkOutDate =
		overrides.departureDate?.trim() ?
			new Date(overrides.departureDate.trim() + 'T12:00:00')
		:	trip.checkOutDate;
	const numberOfSlots = Math.max(1, overrides.adultsCount ?? 1);
	const pricingModel = (trip.pricingModel || 'per_person').toLowerCase();

	// Resolve selected beds to (roomId, bedId, slots) for per-bed; otherwise single room/bed for other models
	type BedSelection = { roomId: number; bedId: string; slots: number };
	let perBedSelections: BedSelection[] = [];
	let roomId: number;
	let bedId: string | undefined;

	if (pricingModel === 'per_room') {
		const ids = overrides.roomIds?.filter((id) => Number.isFinite(id)) ?? [];
		const pick = ids.length > 0 ? trip.rooms.find((r) => r.id === ids[0]) : trip.rooms[0];
		if (!pick) return null;
		roomId = pick.id;
		bedId = undefined;
	} else if (pricingModel === 'per_bed' && overrides.bedIds.length > 0) {
		for (const bid of overrides.bedIds) {
			for (const room of trip.rooms) {
				const bed = room.beds?.find((b) => b.id === bid);
				if (bed) {
					const slots = effectiveSleepSlots(bed);
					perBedSelections.push({ roomId: room.id, bedId: bed.id, slots });
					break;
				}
			}
		}
		if (perBedSelections.length === 0) {
			const firstRoom = trip.rooms.find((r) => (r.beds?.length ?? 0) > 0) ?? trip.rooms[0];
			const firstBed = firstRoom?.beds?.[0];
			if (!firstRoom || !firstBed) return null;
			perBedSelections = [{ roomId: firstRoom.id, bedId: firstBed.id, slots: effectiveSleepSlots(firstBed) }];
		}
		roomId = perBedSelections[0].roomId;
		bedId = perBedSelections[0].bedId;
	} else {
		const firstRoom = trip.rooms.find((r) => (r.beds?.length ?? 0) > 0) ?? trip.rooms[0];
		const firstBed = firstRoom?.beds?.[0];
		if (!firstRoom || !firstBed) return null;
		roomId = firstRoom.id;
		bedId = pricingModel === 'per_bed' ? undefined : firstBed.id;
	}

	const costBasisVersion = computeCostBasisVersion(trip);
	let lowCents = 0;
	let highCents = 0;
	let explanationReason = 'Based on current headcount range.';
	let displayCents: number | undefined;

	try {
		if (pricingModel === 'per_bed' && overrides.bedIds.length === 0) {
			const totalNights = calculateNights(trip.checkInDate, trip.checkOutDate);
			const stayNights = calculateNights(checkInDate, checkOutDate);
			const stayFactor = totalNights > 0 ? stayNights / totalNights : 1;
			const denom = Math.max(1, hmax);
			const cents = Math.round(((trip.totalCost * numberOfSlots) / denom) * stayFactor * 100);
			lowCents = cents;
			highCents = cents;
			displayCents = cents;
			explanationReason =
				'Provisional share until the host assigns your bed (no open spots matched your party when you RSVPed).';
		} else if (pricingModel === 'per_bed' && perBedSelections.length > 0) {
			const totalBeds = trip.rooms.reduce((s, r) => s + r.beds.length, 0);
			const selectedBedCount = new Set(perBedSelections.map((x) => x.bedId)).size;
			const allBedsSelected = totalBeds > 0 && selectedBedCount >= totalBeds;

			if (allBedsSelected) {
				// You're taking the full lodging, no one to split with. Single value = full trip cost (for your stay).
				const totalNights = calculateNights(trip.checkInDate, trip.checkOutDate);
				const stayNights = calculateNights(checkInDate, checkOutDate);
				const stayFactor = totalNights > 0 ? stayNights / totalNights : 1;
				const fullStayCents = Math.round(trip.totalCost * stayFactor * 100);
				lowCents = fullStayCents;
				highCents = fullStayCents;
				explanationReason = "You're taking the full lodging; no split with other guests.";
			} else {
				const bedWeights = parseBedWeights(trip.bedWeights);
				const totalNights = calculateNights(trip.checkInDate, trip.checkOutDate);
				const stayNights = calculateNights(checkInDate, checkOutDate);
				let lowEnd = 0;
				let highEnd = 0;
				for (const { bedId: bId } of perBedSelections) {
					const band = perBedPlanningBandUsd(
						trip.totalCost,
						trip,
						bedWeights,
						bId,
						totalNights,
						stayNights,
						hmin,
						hmax
					);
					lowEnd += band.low;
					highEnd += band.high;
				}
				const assignRows = trip.roomAssignments.map((a) => ({
					userId: a.userId,
					roomId: a.roomId,
					bedId: a.bedId,
					partySize: a.partySize
				}));
				const occ = buildPerBedOccupancyMap(assignRows, yesUserIds, { excludeUserId: guestId });
				for (const { bedId: bId, slots } of perBedSelections) {
					const p = Math.max(1, slots);
					occ.set(bId, (occ.get(bId) ?? 0) + p);
				}
				let guestDisplayedTotal = 0;
				for (const { bedId: bId, slots } of perBedSelections) {
					guestDisplayedTotal += computePerBedLivePriceForBed(
						trip,
						bedWeights,
						occ,
						bId,
						Math.max(1, slots),
						stayNights
					);
				}
				const cents = dollarsToSpreadCents(lowEnd, highEnd, hmin, hmax);
				lowCents = cents.lowCents;
				highCents = cents.highCents;
				displayCents = Math.round(guestDisplayedTotal * 100);
				displayCents = Math.max(lowCents, Math.min(highCents, displayCents));
				explanationReason =
					'Low end models max headcount (capacity); high end models the planning minimum headcount. Both include how guests may spread across beds. Live amount uses current assignments.';
			}
		} else if (pricingModel === 'per_room') {
			const totalNights = calculateNights(trip.checkInDate, trip.checkOutDate);
			const stayNights = calculateNights(checkInDate, checkOutDate);
			const stayFactor = totalNights > 0 ? stayNights / totalNights : 1;
			const share = perRoomShareFullTrip(trip);
			const roomCount = Math.max(1, overrides.roomIds?.length ?? 1);
			const total = share * roomCount * stayFactor;
			const cents = Math.round(total * 100);
			lowCents = cents;
			highCents = cents;
			displayCents = cents;
			explanationReason = 'Each selected room is an equal share of the trip total (prorated to your stay).';
		} else if (pricingModel !== 'per_bed') {
			const single = await calculateReservationPrice({
				tripId,
				roomId,
				bedId,
				numberOfSlots,
				checkInDate,
				checkOutDate
			});
			const cents = Math.round(single.totalPrice * 100);
			lowCents = cents;
			highCents = cents;
			explanationReason = 'Fixed per-person rate for this trip.';
		}
	} catch {
		return null;
	}

	if (lowCents > highCents) {
		[lowCents, highCents] = [highCents, lowCents];
	}

	return {
		lowCents,
		highCents,
		hmin,
		hmax,
		costBasisVersion,
		explanationReason,
		...(displayCents != null && { displayCents })
	};
}

/** Accepted range + assumptions as stored on RSVP */
export interface AcceptedEstimate {
	acceptedEstimateLowCents: number;
	acceptedEstimateHighCents: number;
	acceptedHeadcountMin: number | null;
	acceptedHeadcountMax: number | null;
	acceptedCostBasisVersion: string | null;
}

/**
 * Determine if reconfirmation is required: latest range outside accepted range, or cost basis changed.
 */
export function requiresReconfirm(
	accepted: AcceptedEstimate | null,
	latest: GuestEstimateRange,
	policy: ReconfirmPolicy
): boolean {
	if (!accepted || !policy.enabled) return false;
	// Cost basis changed (e.g. lodging total, rooms, pricing model)
	if (
		accepted.acceptedCostBasisVersion != null &&
		accepted.acceptedCostBasisVersion !== latest.costBasisVersion
	) {
		return true;
	}
	// Latest range outside accepted: if latest low < accepted low OR latest high > accepted high => out of range
	if (latest.lowCents < accepted.acceptedEstimateLowCents) return true;
	if (latest.highCents > accepted.acceptedEstimateHighCents) return true;
	// Headcount assumptions changed materially (optional: could require reconfirm if Hmin/Hmax differ)
	if (
		accepted.acceptedHeadcountMin != null &&
		accepted.acceptedHeadcountMax != null &&
		(latest.hmin !== accepted.acceptedHeadcountMin || latest.hmax !== accepted.acceptedHeadcountMax)
	) {
		// Only require if the range actually moved (we already checked cents above; headcount change may have shifted range)
		// So we already covered by cents check. Skip redundant headcount check unless we want stricter behavior.
	}
	return false;
}

/**
 * Compute reconfirm deadline from policy (Rolling: now + N hours).
 */
export function getReconfirmDeadline(
	policy: ReconfirmPolicy,
	tripStartDate?: Date | null
): Date | null {
	if (!policy.enabled) return null;
	if (policy.deadlineType === 'rolling' && policy.rollingHours != null) {
		const d = new Date();
		d.setHours(d.getHours() + policy.rollingHours);
		return d;
	}
	if (policy.deadlineType === 'fixed_trip_date' && tripStartDate && policy.fixedDaysBeforeTrip != null) {
		const d = new Date(tripStartDate);
		d.setDate(d.getDate() - policy.fixedDaysBeforeTrip);
		return d;
	}
	if (policy.deadlineType === 'host_configured' && policy.hostConfiguredAt) {
		const d = new Date(policy.hostConfiguredAt);
		return Number.isNaN(d.getTime()) ? null : d;
	}
	return null;
}

/**
 * Check one or all YES guests and set yesSubstatus + reconfirm fields when latest estimate is out of range.
 * Call after RSVP count, room assignments, or trip cost changes.
 */
export async function checkAndSetReconfirmRequired(
	tripId: string,
	options?: { guestId?: string }
): Promise<void> {
	const trip = await prisma.trip.findUnique({
		where: { id: tripId },
		select: { checkInDate: true }
	});
	if (!trip) return;
	const policy = parseReconfirmPolicy(null);
	if (!policy.enabled) return;

	const where: { tripId: string; status: string; userId?: string } = {
		tripId,
		status: 'yes'
	};
	if (options?.guestId) where.userId = options.guestId;
	const rsvps = await prisma.rSVP.findMany({
		where,
		select: {
			userId: true,
			costCommitmentAccepted: true,
			acceptedEstimateLowCents: true,
			acceptedEstimateHighCents: true,
			acceptedHeadcountMin: true,
			acceptedHeadcountMax: true,
			acceptedCostBasisVersion: true
		}
	});

	const deadline = getReconfirmDeadline(policy, trip.checkInDate);
	const now = new Date();

	for (const rsvp of rsvps) {
		// Guest has no cost commitment (e.g. host set YES) -> require reconfirm
		if (!rsvp.costCommitmentAccepted || rsvp.acceptedEstimateLowCents == null) {
			await prisma.rSVP.update({
				where: { tripId_userId: { tripId, userId: rsvp.userId } },
				data: {
					yesSubstatus: 'reconfirm_required',
					reconfirmRequiredAt: now,
					reconfirmDeadlineAt: deadline,
					latestEstimateLowCents: null,
					latestEstimateHighCents: null,
					latestEstimateUpdatedAt: null
				}
			});
			continue;
		}
		let latest: GuestEstimateRange;
		try {
			latest = await computeGuestEstimateRange(tripId, rsvp.userId);
		} catch {
			continue;
		}
		const accepted: AcceptedEstimate = {
			acceptedEstimateLowCents: rsvp.acceptedEstimateLowCents,
			acceptedEstimateHighCents: rsvp.acceptedEstimateHighCents ?? rsvp.acceptedEstimateLowCents,
			acceptedHeadcountMin: rsvp.acceptedHeadcountMin,
			acceptedHeadcountMax: rsvp.acceptedHeadcountMax,
			acceptedCostBasisVersion: rsvp.acceptedCostBasisVersion
		};
		const needsReconfirm = requiresReconfirm(accepted, latest, policy);
		await prisma.rSVP.update({
			where: { tripId_userId: { tripId, userId: rsvp.userId } },
			data: {
				latestEstimateLowCents: latest.lowCents,
				latestEstimateHighCents: latest.highCents,
				latestEstimateUpdatedAt: now,
				...(needsReconfirm
					? {
							yesSubstatus: 'reconfirm_required',
							reconfirmRequiredAt: now,
							reconfirmDeadlineAt: deadline
						}
					: {
							yesSubstatus: 'confirmed',
							reconfirmRequiredAt: null,
							reconfirmDeadlineAt: null
						})
			}
		});
	}
}
