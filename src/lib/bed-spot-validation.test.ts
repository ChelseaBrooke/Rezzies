import { describe, it, expect } from 'vitest';
import {
	totalSpotsForBeds,
	hasEnoughSpots,
	isPrismaUniqueConflict
} from './bed-spot-validation.js';

describe('totalSpotsForBeds', () => {
	it('sums capacitySlots when present', () => {
		const map = new Map([
			['b1', { id: 'b1', capacitySlots: 2 }],
			['b2', { id: 'b2', capacitySlots: 1 }]
		]);
		expect(totalSpotsForBeds(map, ['b1', 'b2'])).toBe(3);
	});

	it('falls back to capacity when capacitySlots missing', () => {
		const map = new Map([
			['b1', { id: 'b1', capacity: 2 }]
		]);
		expect(totalSpotsForBeds(map, ['b1'])).toBe(2);
	});

	it('defaults to 1 spot when both missing and type unknown', () => {
		const map = new Map([['b1', { id: 'b1' }]]);
		expect(totalSpotsForBeds(map, ['b1'])).toBe(1);
	});

	it('queen with legacy capacity 1 still counts as 2 spots', () => {
		const map = new Map([['b1', { id: 'b1', bedType: 'queen', capacitySlots: 1, capacity: 1 }]]);
		expect(totalSpotsForBeds(map, ['b1'])).toBe(2);
	});

	it('ignores unknown bed ids', () => {
		const map = new Map([
			['b1', { id: 'b1', capacitySlots: 2 }]
		]);
		expect(totalSpotsForBeds(map, ['b1', 'unknown'])).toBe(2);
	});

	it('returns 0 for empty bedIds', () => {
		const map = new Map([['b1', { id: 'b1', capacitySlots: 2 }]]);
		expect(totalSpotsForBeds(map, [])).toBe(0);
	});
});

describe('hasEnoughSpots', () => {
	it('allows party size 1 with 1 spot', () => {
		expect(hasEnoughSpots(1, 1)).toBe(true);
	});

	it('allows party size 1 with 2 spots (solo claiming double bed)', () => {
		expect(hasEnoughSpots(2, 1)).toBe(true);
	});

	it('allows party size 3 with 3 spots', () => {
		expect(hasEnoughSpots(3, 3)).toBe(true);
	});

	it('allows party size 3 with 4 spots', () => {
		expect(hasEnoughSpots(4, 3)).toBe(true);
	});

	it('rejects when spots less than party size', () => {
		expect(hasEnoughSpots(2, 3)).toBe(false);
		expect(hasEnoughSpots(0, 1)).toBe(false);
	});

	it('rejects invalid party size', () => {
		expect(hasEnoughSpots(2, 0)).toBe(false);
		expect(hasEnoughSpots(2, -1)).toBe(false);
	});
});

describe('isPrismaUniqueConflict', () => {
	it('returns true for P2002 error', () => {
		expect(isPrismaUniqueConflict({ code: 'P2002' })).toBe(true);
	});

	it('returns false for other error codes', () => {
		expect(isPrismaUniqueConflict({ code: 'P2003' })).toBe(false);
		expect(isPrismaUniqueConflict(new Error('P2002'))).toBe(false);
	});

	it('returns false for null or non-objects', () => {
		expect(isPrismaUniqueConflict(null)).toBe(false);
		expect(isPrismaUniqueConflict(undefined)).toBe(false);
		expect(isPrismaUniqueConflict('P2002')).toBe(false);
	});
});
