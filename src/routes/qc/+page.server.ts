import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';
import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
	computePerBedEstimateFromInputs,
	DEFAULT_BED_WEIGHTS,
	type QCPerBedInputs
} from '$lib/server/pricing-canonical.js';

const BED_TYPES = ['king', 'queen', 'twin', 'bunk', 'full', 'sofa', 'other'] as const;

export const load: PageServerLoad = async () => {
	if (!dev) {
		const enabled = env.QC_PAGE_ENABLED?.trim().toLowerCase();
		const allowed = enabled === '1' || enabled === 'true' || enabled === 'yes';
		if (!allowed) {
			throw error(404, 'Not found');
		}
	}

	return {
		bedTypeOptions: BED_TYPES,
		defaultBedWeights: DEFAULT_BED_WEIGHTS
	};
};

const inputsSchema = {
	totalTripCost: (v: unknown) => typeof v === 'number' && v > 0,
	totalTripNights: (v: unknown) => typeof v === 'number' && v >= 1,
	minExpectedGuests: (v: unknown) => typeof v === 'number' && v >= 1,
	maxCapacityGuests: (v: unknown) => typeof v === 'number' && v >= 1,
	yesRsvpGuests: (v: unknown) => typeof v === 'number' && v >= 0,
	rooms: (v: unknown) =>
		Array.isArray(v) &&
		v.every(
			(r: unknown) =>
				Array.isArray((r as { beds?: unknown[] }).beds) &&
				(r as { beds: Array<{ bedType?: unknown; spotCount?: unknown }> }).beds.every(
					(b) =>
						typeof (b as { bedType: string }).bedType === 'string' &&
						typeof (b as { spotCount: number }).spotCount === 'number' &&
						(b as { spotCount: number }).spotCount >= 1
				)
		),
	selections: (v: unknown) =>
		Array.isArray(v) &&
		v.every(
			(s: unknown) =>
				typeof (s as { roomIndex: number }).roomIndex === 'number' &&
				typeof (s as { bedIndex: number }).bedIndex === 'number' &&
				typeof (s as { spotsClaimed: number }).spotsClaimed === 'number' &&
				typeof (s as { nightsStayed: number }).nightsStayed === 'number' &&
				(s as { nightsStayed: number }).nightsStayed >= 1
		)
};

function validateInputs(raw: unknown): QCPerBedInputs | null {
	if (!raw || typeof raw !== 'object') return null;
	const o = raw as Record<string, unknown>;
	if (!inputsSchema.totalTripCost(o.totalTripCost)) return null;
	if (!inputsSchema.totalTripNights(o.totalTripNights)) return null;
	if (!inputsSchema.minExpectedGuests(o.minExpectedGuests)) return null;
	if (!inputsSchema.maxCapacityGuests(o.maxCapacityGuests)) return null;
	if (!inputsSchema.yesRsvpGuests(o.yesRsvpGuests)) return null;
	if (!inputsSchema.rooms(o.rooms)) return null;
	if (!inputsSchema.selections(o.selections)) return null;

	const rooms = (o.rooms as QCPerBedInputs['rooms']).map((r) => ({
		beds: r.beds.map((b) => ({
			bedType: String(b.bedType).trim() || 'other',
			spotCount: Math.max(1, Number(b.spotCount))
		}))
	}));
	const selections = (o.selections as QCPerBedInputs['selections']).map((s) => ({
		roomIndex: Number(s.roomIndex),
		bedIndex: Number(s.bedIndex),
		spotsClaimed: Math.max(1, Number(s.spotsClaimed)),
		nightsStayed: Math.max(1, Number(s.nightsStayed))
	}));

	return {
		totalTripCost: Number(o.totalTripCost),
		totalTripNights: Math.max(1, Number(o.totalTripNights)),
		minExpectedGuests: Math.max(1, Number(o.minExpectedGuests)),
		maxCapacityGuests: Math.max(1, Number(o.maxCapacityGuests)),
		yesRsvpGuests: Math.max(0, Number(o.yesRsvpGuests)),
		rooms,
		selections
	};
}

export const actions: Actions = {
	compute: async ({ request }) => {
		if (request.method !== 'POST') return fail(405, { error: 'Method not allowed' });
		const formData = await request.formData();
		const payloadStr = formData.get('payload');
		if (typeof payloadStr !== 'string') {
			return fail(400, { error: 'Missing payload' });
		}
		let body: unknown;
		try {
			body = JSON.parse(payloadStr);
		} catch {
			return fail(400, { error: 'Invalid JSON in payload' });
		}
		const inputs = validateInputs(body);
		if (!inputs) {
			return fail(400, { error: 'Invalid inputs: check totalTripCost, totalTripNights, guest counts, rooms (beds with bedType and spotCount), and selections (roomIndex, bedIndex, spotsClaimed, nightsStayed).' });
		}
		if (inputs.rooms.length === 0) {
			return fail(400, { error: 'At least one room with at least one bed is required.' });
		}
		for (const sel of inputs.selections) {
			if (sel.roomIndex < 0 || sel.roomIndex >= inputs.rooms.length) {
				return fail(400, { error: `Selection references invalid roomIndex ${sel.roomIndex}.` });
			}
			const room = inputs.rooms[sel.roomIndex];
			if (sel.bedIndex < 0 || sel.bedIndex >= room.beds.length) {
				return fail(400, { error: `Selection references invalid bedIndex ${sel.bedIndex} in room ${sel.roomIndex}.` });
			}
		}
		try {
			const result = computePerBedEstimateFromInputs(inputs);
			return { success: true, result };
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Computation failed';
			return fail(500, { error: message });
		}
	}
};
