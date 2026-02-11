import { describe, it, expect } from 'vitest';
import {
	requiresReconfirm,
	getReconfirmDeadline,
	parseReconfirmPolicy,
	type AcceptedEstimate,
	type GuestEstimateRange,
	type ReconfirmPolicy
} from './guest-estimate.js';

describe('requiresReconfirm', () => {
	const policy: ReconfirmPolicy = { enabled: true, deadlineType: 'rolling', rollingHours: 72 };

	it('returns false when accepted is null', () => {
		expect(
			requiresReconfirm(null, { lowCents: 20000, highCents: 30000, hmin: 5, hmax: 10, costBasisVersion: 'v1', explanationReason: '' }, policy)
		).toBe(false);
	});

	it('returns false when policy is disabled', () => {
		const accepted: AcceptedEstimate = {
			acceptedEstimateLowCents: 20000,
			acceptedEstimateHighCents: 30000,
			acceptedHeadcountMin: 5,
			acceptedHeadcountMax: 10,
			acceptedCostBasisVersion: 'v1'
		};
		expect(
			requiresReconfirm(accepted, { lowCents: 20000, highCents: 30000, hmin: 5, hmax: 10, costBasisVersion: 'v1', explanationReason: '' }, { ...policy, enabled: false })
		).toBe(false);
	});

	it('returns false when latest range is within accepted range', () => {
		const accepted: AcceptedEstimate = {
			acceptedEstimateLowCents: 20000,
			acceptedEstimateHighCents: 35000,
			acceptedHeadcountMin: 5,
			acceptedHeadcountMax: 10,
			acceptedCostBasisVersion: 'v1'
		};
		const latest: GuestEstimateRange = { lowCents: 22000, highCents: 32000, hmin: 6, hmax: 10, costBasisVersion: 'v1', explanationReason: '' };
		expect(requiresReconfirm(accepted, latest, policy)).toBe(false);
	});

	it('returns true when latest low is below accepted low', () => {
		const accepted: AcceptedEstimate = {
			acceptedEstimateLowCents: 20000,
			acceptedEstimateHighCents: 30000,
			acceptedHeadcountMin: 5,
			acceptedHeadcountMax: 10,
			acceptedCostBasisVersion: 'v1'
		};
		const latest: GuestEstimateRange = { lowCents: 18000, highCents: 28000, hmin: 8, hmax: 12, costBasisVersion: 'v1', explanationReason: '' };
		expect(requiresReconfirm(accepted, latest, policy)).toBe(true);
	});

	it('returns true when latest high is above accepted high', () => {
		const accepted: AcceptedEstimate = {
			acceptedEstimateLowCents: 20000,
			acceptedEstimateHighCents: 30000,
			acceptedHeadcountMin: 5,
			acceptedHeadcountMax: 10,
			acceptedCostBasisVersion: 'v1'
		};
		const latest: GuestEstimateRange = { lowCents: 22000, highCents: 36000, hmin: 4, hmax: 8, costBasisVersion: 'v1', explanationReason: '' };
		expect(requiresReconfirm(accepted, latest, policy)).toBe(true);
	});

	it('returns true when cost basis version changed', () => {
		const accepted: AcceptedEstimate = {
			acceptedEstimateLowCents: 20000,
			acceptedEstimateHighCents: 30000,
			acceptedHeadcountMin: 5,
			acceptedHeadcountMax: 10,
			acceptedCostBasisVersion: 'v1'
		};
		const latest: GuestEstimateRange = { lowCents: 20000, highCents: 30000, hmin: 5, hmax: 10, costBasisVersion: 'v2', explanationReason: '' };
		expect(requiresReconfirm(accepted, latest, policy)).toBe(true);
	});

	it('returns false when accepted cost basis version is null and range is in bounds', () => {
		const accepted: AcceptedEstimate = {
			acceptedEstimateLowCents: 20000,
			acceptedEstimateHighCents: 30000,
			acceptedHeadcountMin: null,
			acceptedHeadcountMax: null,
			acceptedCostBasisVersion: null
		};
		const latest: GuestEstimateRange = { lowCents: 20000, highCents: 30000, hmin: 5, hmax: 10, costBasisVersion: 'v1', explanationReason: '' };
		expect(requiresReconfirm(accepted, latest, policy)).toBe(false);
	});
});

describe('getReconfirmDeadline', () => {
	it('returns null when policy disabled', () => {
		expect(getReconfirmDeadline({ enabled: false, deadlineType: 'rolling' }, null)).toBe(null);
	});

	it('returns now + rollingHours for rolling policy', () => {
		const now = Date.now();
		const deadline = getReconfirmDeadline({ enabled: true, deadlineType: 'rolling', rollingHours: 48 }, null);
		expect(deadline).not.toBe(null);
		const expected = now + 48 * 60 * 60 * 1000;
		expect(Math.abs(deadline!.getTime() - expected)).toBeLessThan(2000);
	});

	it('returns trip start minus days for fixed_trip_date', () => {
		const tripStart = new Date('2026-06-15T00:00:00Z');
		const deadline = getReconfirmDeadline(
			{ enabled: true, deadlineType: 'fixed_trip_date', fixedDaysBeforeTrip: 7 },
			tripStart
		);
		expect(deadline).not.toBe(null);
		expect(deadline!.toISOString().slice(0, 10)).toBe('2026-06-08');
	});
});

describe('parseReconfirmPolicy', () => {
	it('returns default when null or empty', () => {
		expect(parseReconfirmPolicy(null).enabled).toBe(true);
		expect(parseReconfirmPolicy('').deadlineType).toBe('rolling');
		expect(parseReconfirmPolicy('  ').rollingHours).toBe(72);
	});

	it('parses valid JSON', () => {
		const p = parseReconfirmPolicy(JSON.stringify({ enabled: false, deadlineType: 'rolling', rollingHours: 24 }));
		expect(p.enabled).toBe(false);
		expect(p.rollingHours).toBe(24);
	});
});

describe('YES submit -> reconfirm required (logic)', () => {
	it('after guest accepts range, a worse latest range triggers reconfirm', () => {
		const accepted: AcceptedEstimate = {
			acceptedEstimateLowCents: 24000,
			acceptedEstimateHighCents: 32000,
			acceptedHeadcountMin: 8,
			acceptedHeadcountMax: 12,
			acceptedCostBasisVersion: 'v1'
		};
		// Headcount dropped: share went up
		const latest: GuestEstimateRange = {
			lowCents: 26000,
			highCents: 38000,
			hmin: 6,
			hmax: 10,
			costBasisVersion: 'v1',
			explanationReason: 'Fewer guests confirmed'
		};
		const policy: ReconfirmPolicy = { enabled: true, deadlineType: 'rolling', rollingHours: 72 };
		expect(requiresReconfirm(accepted, latest, policy)).toBe(true);
	});

	it('after guest accepts range, same range stays confirmed', () => {
		const accepted: AcceptedEstimate = {
			acceptedEstimateLowCents: 24000,
			acceptedEstimateHighCents: 32000,
			acceptedHeadcountMin: 8,
			acceptedHeadcountMax: 12,
			acceptedCostBasisVersion: 'v1'
		};
		const latest: GuestEstimateRange = {
			lowCents: 24000,
			highCents: 32000,
			hmin: 8,
			hmax: 12,
			costBasisVersion: 'v1',
			explanationReason: ''
		};
		const policy: ReconfirmPolicy = { enabled: true, deadlineType: 'rolling', rollingHours: 72 };
		expect(requiresReconfirm(accepted, latest, policy)).toBe(false);
	});
});
