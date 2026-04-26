import { totalSleepSpotsFromWizardRooms } from '$lib/bed-spot-validation.js';

/**
 * Divvi uses Trip.maxGuests for the host-declared guest ceiling (wizard "max occupancy").
 * Trip.maxCapacity is an optional waitlist RSVP cap — not used for this guard.
 */
export function isPerBedPricingSpotShortfall(draft: {
	pricingModel?: string;
	maxOccupancy?: number;
	rooms?: Array<{ beds?: Array<{ bedType?: string; count?: unknown }> }>;
}): boolean {
	const pm = (draft.pricingModel ?? '').toLowerCase().replace(/_/g, '-');
	if (pm !== 'per-bed') return false;
	const cap = Number(draft.maxOccupancy);
	if (!Number.isFinite(cap) || cap < 1) return false;
	const spots = totalSleepSpotsFromWizardRooms(draft.rooms ?? []);
	return spots < cap;
}

export function perBedSpotShortfallDetails(draft: {
	pricingModel?: string;
	maxOccupancy?: number;
	rooms?: Array<{ beds?: Array<{ bedType?: string; count?: unknown }> }>;
}): { spots: number; cap: number; shortfall: number } | null {
	const pm = (draft.pricingModel ?? '').toLowerCase().replace(/_/g, '-');
	if (pm !== 'per-bed') return null;
	const cap = Number(draft.maxOccupancy);
	if (!Number.isFinite(cap) || cap < 1) return null;
	const spots = totalSleepSpotsFromWizardRooms(draft.rooms ?? []);
	if (spots >= cap) return null;
	return { spots, cap, shortfall: cap - spots };
}
