import { describe, it, expect } from 'vitest';
import { parseBedWeights, perBedSelectionRangeForTripBedIds } from './pricing-canonical.js';

describe('perBedSelectionRangeForTripBedIds headcount cap', () => {
	it('uses total sleeping spots (not bed count) so 12 vs 20 guests produce different modeled prices', () => {
		const trip = {
			rooms: [
				{
					id: 1,
					beds: Array.from({ length: 10 }, (_, i) => ({
						id: `bed-${i}`,
						bedType: 'bunk',
						capacitySlots: 2
					}))
				}
			]
		};
		const bedWeights = parseBedWeights(null);
		const totalNights = 5;
		const stayNights = 5;
		const targetBed = 'bed-0';

		const r12 = perBedSelectionRangeForTripBedIds(5000, 12, trip, bedWeights, [targetBed], totalNights, stayNights);
		const r20 = perBedSelectionRangeForTripBedIds(5000, 20, trip, bedWeights, [targetBed], totalNights, stayNights);

		const same =
			r12.low === r20.low && r12.high === r20.high && r12.low === r12.high && r20.low === r20.high;
		expect(same).toBe(false);
	});

	it('treats bunks as 2 spots when DB still has capacitySlots 1 (effectiveSleepSlots)', () => {
		const trip = {
			rooms: [
				{
					id: 1,
					beds: Array.from({ length: 10 }, (_, i) => ({
						id: `bed-${i}`,
						bedType: 'bunk',
						capacitySlots: 1
					}))
				}
			]
		};
		const bedWeights = parseBedWeights(null);
		const r12 = perBedSelectionRangeForTripBedIds(5000, 12, trip, bedWeights, ['bed-0'], 5, 5);
		const r20 = perBedSelectionRangeForTripBedIds(5000, 20, trip, bedWeights, ['bed-0'], 5, 5);
		const collapsed =
			r12.low === r20.low && r12.high === r20.high && r12.low === r12.high && r20.low === r20.high;
		expect(collapsed).toBe(false);
	});
});
