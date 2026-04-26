import { totalSleepSpotsFromWizardRooms } from '$lib/bed-spot-validation.js';
import { getTotalSleepSpotsForTripId } from './trip-bed-spots.js';

export function isPerBedPricingModel(pricingModel: string): boolean {
	const m = (pricingModel || '').toLowerCase();
	return m === 'per_bed' || m === 'per-bed';
}

export type PerBedSpotValidation =
	| { ok: true }
	| { ok: false; kind: 'no_rooms' | 'shortfall'; spots: number; maxGuests: number; shortfall: number };

/**
 * When enabling per-bed pricing, sleep spots (derived from beds) must cover Trip.maxGuests
 * (wizard max occupancy / headcount ceiling).
 */
export async function validatePerBedPricingAgainstHeadcountCeiling(params: {
	tripId: string;
	pricingModel: string;
	maxGuests: number | null;
	roomsPayload: Array<{ beds?: Array<{ bedType?: string; count?: unknown }> }>;
	/** If true, count spots from the wizard payload only (publish or room rebuild). If false, sum DB beds for tripId. */
	usePayloadSpotsOnly: boolean;
}): Promise<PerBedSpotValidation> {
	if (!isPerBedPricingModel(params.pricingModel)) return { ok: true };
	const cap = params.maxGuests;
	if (cap == null || cap < 1) return { ok: true };
	const spots = params.usePayloadSpotsOnly
		? totalSleepSpotsFromWizardRooms(params.roomsPayload)
		: await getTotalSleepSpotsForTripId(params.tripId);
	const hasAnyBedLine = (params.roomsPayload ?? []).some((r) => (r.beds?.length ?? 0) > 0);
	if (spots === 0 && !hasAnyBedLine) {
		return { ok: false, kind: 'no_rooms', spots: 0, maxGuests: cap, shortfall: cap };
	}
	if (spots < cap) {
		return { ok: false, kind: 'shortfall', spots, maxGuests: cap, shortfall: cap - spots };
	}
	return { ok: true };
}

export function perBedInsufficientMessage(spots: number, maxGuests: number): string {
	const shortfall = maxGuests - spots;
	return `Per-bed pricing requires at least ${maxGuests} bed-spots. You currently have ${spots}. Add ${shortfall} more before switching.`;
}
