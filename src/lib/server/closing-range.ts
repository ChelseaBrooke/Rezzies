/**
 * RSVP "closing range" (PRICING.md): favorable (low $) uses Trip.maxCapacity as denominator
 * in the headcount model; expensive uses max(yes, expectedPeopleCount). Distinct from live
 * per_person which divides by sum(room.maxOccupancy).
 */

export function sumRoomMaxOccupancy(
	rooms: Array<{ maxOccupancy?: number | null }>
): number {
	return Math.max(1, rooms.reduce((s, r) => s + (r.maxOccupancy ?? 0), 0) || 0);
}

/**
 * Yes-RSVPs in DB. For "I'm about to say yes" / not yet yes, include +1 so the range matches
 * the moment-of-submit when their RSVP is counted (PRICING.md: recalc at submit with live count).
 */
export function effectiveYesCountForClosingRange(
	yesRsvpCount: number,
	guestIsAlreadyYes: boolean
): number {
	return guestIsAlreadyYes ? yesRsvpCount : yesRsvpCount + 1;
}

/** Favorable headcount = host attendance cap. Fallback: maxGuests, then sumRoomMaxOcc. */
export function favorableHeadcountForClosingRange(
	trip: { maxCapacity?: number | null; maxGuests?: number | null; rooms: Array<{ maxOccupancy?: number | null }> }
): number {
	const cap = trip.maxCapacity;
	if (cap != null && cap > 0) return cap;
	const m = trip.maxGuests;
	if (m != null && m > 0) return m;
	return sumRoomMaxOccupancy(trip.rooms);
}

/** max(currentYes, expected). expected defaults to 1. */
export function expensiveHeadcountForClosingRange(
	effectiveYes: number,
	expectedPeopleCount: number | null | undefined
): number {
	return Math.max(1, effectiveYes, Math.max(1, expectedPeopleCount ?? 1));
}

/**
 * per_person closing: total cents for party, favorable ÷ cap vs expensive ÷ min(eRaw, cap)
 * (PRICING.md). lowCents = favorable (largest denom), highCents = expensive (higher $).
 */
export function perPersonClosingRangeCents(
	totalCostDollars: number,
	partySize: number,
	favorableDenom: number,
	expensiveDenomRaw: number
): { lowCents: number; highCents: number; favorableDenomUsed: number; expensiveDenomUsed: number } {
	const t = Math.round(totalCostDollars * 100);
	const f = Math.max(1, favorableDenom);
	const eRaw = Math.max(1, expensiveDenomRaw);
	const e = Math.min(eRaw, f);
	const lowCents = Math.round((t * partySize) / f);
	const highCents = Math.round((t * partySize) / e);
	if (lowCents <= highCents) {
		return { lowCents, highCents, favorableDenomUsed: f, expensiveDenomUsed: e };
	}
	return {
		lowCents: highCents,
		highCents: lowCents,
		favorableDenomUsed: f,
		expensiveDenomUsed: e
	};
}
