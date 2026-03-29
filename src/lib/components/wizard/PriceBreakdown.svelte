<script lang="ts">
	import type { TripDraft } from '$lib/stores/tripDraft.js';
	import { effectiveMaxForDraft } from '$lib/stores/tripDraft.js';
	
	let { draft }: { draft: TripDraft } = $props();
	
	// Bed weights matching pricing-canonical.ts
	const BED_WEIGHTS: Record<string, number> = {
		king: 1.00,
		queen: 0.75,
		full: 0.70,
		twin: 0.50,
		bunk: 0.50,
		sofa: 0.40,
		other: 0.60
	};
	
	const calculateNights = $derived(() => {
		if (!draft.checkInDate || !draft.checkOutDate) return 0;
		const checkIn = new Date(draft.checkInDate);
		const checkOut = new Date(draft.checkOutDate);
		const diffTime = Math.abs(checkOut.getTime() - checkIn.getTime());
		const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
		return diffDays;
	});
	
	const totalTripCost = $derived(() => {
		return parseFloat(draft.totalTripCost) || 0;
	});
	
	const customItemsTotal = $derived(() => {
		if (!draft.customLineItems || !Array.isArray(draft.customLineItems)) return 0;
		return draft.customLineItems.reduce((sum, item) => {
			return sum + (parseFloat(item.amount) || 0);
		}, 0);
	});
	
	const subtotal = $derived(() => {
		return totalTripCost() + customItemsTotal();
	});
	
	const perNight = $derived(() => {
		const nights = calculateNights();
		if (nights === 0) return 0;
		return subtotal() / nights;
	});
	
	// Calculate pricing breakdown based on model
	const rooms = $derived(() => {
		return draft.rooms || [];
	});
	
	const totalRooms = $derived(() => {
		return rooms().length;
	});
	
	const totalBeds = $derived(() => {
		return rooms().reduce((sum, room) => {
			return sum + room.beds.reduce((bedSum, bed) => bedSum + bed.count, 0);
		}, 0);
	});
	
	const bedsByType = $derived(() => {
		const bedMap = new Map<string, number>();
		rooms().forEach(room => {
			room.beds.forEach(bed => {
				const bedType = bed.bedType.toLowerCase();
				const current = bedMap.get(bedType) || 0;
				bedMap.set(bedType, current + bed.count);
			});
		});
		return Array.from(bedMap.entries()).map(([type, count]) => ({ type, count }));
	});
	
	// Per Room: Simple division
	const perRoomCost = $derived(() => {
		if (totalRooms() === 0) return 0;
		return subtotal() / totalRooms();
	});
	
	// Per Person: division at min headcount, with max headcount (capacity) comparison when higher
	const perPersonCost = $derived(() => {
		const expectedGuests = draft.expectedGuestCount || 1;
		if (expectedGuests === 0) return 0;
		return subtotal() / expectedGuests;
	});
	
	const minHeadcount = $derived(() => Math.max(1, Number(draft.expectedGuestCount) || 1));
	const effectiveMaxHeadcount = $derived(() => effectiveMaxForDraft(draft));

	const perPersonAtMaxOccupancy = $derived(() => {
		const cap = effectiveMaxHeadcount();
		if (cap === 0) return 0;
		return subtotal() / cap;
	});
	
	// Per Bed: Weighted calculation
	// Calculate total weighted value: sum of (bed_count * bed_weight) for each bed type
	const totalWeightedValue = $derived(() => {
		let total = 0;
		bedsByType().forEach(({ type, count }) => {
			const weight = BED_WEIGHTS[type.toLowerCase()] || BED_WEIGHTS.other;
			total += count * weight;
		});
		return total;
	});
	
	// Calculate price per weight unit (like "k" in the example)
	const pricePerWeightUnit = $derived(() => {
		if (totalWeightedValue() === 0) return 0;
		return subtotal() / totalWeightedValue();
	});
	
	// Calculate cost per bed type
	const perBedTypeCost = $derived(() => {
		if (totalWeightedValue() === 0) return [];
		const basePrice = pricePerWeightUnit();
		return bedsByType().map(({ type, count }) => {
			const weight = BED_WEIGHTS[type.toLowerCase()] || BED_WEIGHTS.other;
			const pricePerBed = basePrice * weight;
			return {
				type,
				count,
				weight,
				pricePerBed,
				totalCost: pricePerBed * count
			};
		});
	});
</script>

<div class="price-breakdown">
	<div class="breakdown-list">
		<!-- Show what people will pay based on pricing model -->
		{#if draft.pricingModel === 'per-room' && totalRooms() > 0}
			<div class="breakdown-section">
				<div class="section-label">Cost Per Room</div>
				{#each rooms() as room, index}
					<div class="breakdown-item nested">
						<span class="item-label">{room.name || `Room ${index + 1}`}</span>
						<span class="item-value">${perRoomCost().toFixed(2)}</span>
					</div>
				{/each}
			</div>
		{:else if draft.pricingModel === 'per-bed' && totalBeds() > 0 && totalWeightedValue() > 0}
			<div class="breakdown-section">
				<div class="section-label">Cost Per Bed Type</div>
				{#each perBedTypeCost() as bedType}
					<div class="breakdown-item nested">
						<span class="item-label">{bedType.type} ({bedType.count}x)</span>
						<span class="item-value">${bedType.pricePerBed.toFixed(2)} per bed</span>
					</div>
					<div class="breakdown-item nested-sub">
						<span class="item-label">Total for {bedType.count} {bedType.type}{bedType.count > 1 ? 's' : ''}</span>
						<span class="item-value">${bedType.totalCost.toFixed(2)}</span>
					</div>
				{/each}
				<p class="per-bed-note">In per-bed pricing, everyone pays based on the bed they choose. Larger beds cost a bit more than smaller beds, and beds in private rooms cost a bit more than beds in shared rooms. The total trip cost is split proportionally across everyone attending, and prices can go down as more people RSVP until the deadline.</p>
			</div>
		{:else if draft.pricingModel === 'per-person' && draft.expectedGuestCount > 0}
			<div class="breakdown-section">
				<div class="section-label">Cost Per Person</div>
				<div class="breakdown-item nested">
					<span class="item-label"
						>At min headcount ({draft.expectedGuestCount} {draft.expectedGuestCount === 1 ? 'person' : 'people'})</span
					>
					<span class="item-value">${perPersonCost().toFixed(2)}</span>
				</div>
				{#if effectiveMaxHeadcount() > minHeadcount()}
					<div class="breakdown-item nested note">
						<span class="item-label"
							>If max headcount (capacity) is reached ({effectiveMaxHeadcount()} {effectiveMaxHeadcount() === 1 ? 'person' : 'people'})</span
						>
						<span class="item-value">${perPersonAtMaxOccupancy().toFixed(2)} per person</span>
					</div>
				{/if}
			</div>
		{:else}
			<div class="breakdown-item">
				<span class="item-label">Add rooms/beds to see pricing breakdown</span>
				<span class="item-value">—</span>
			</div>
		{/if}
		
	</div>
	
	<div class="breakdown-total">
		<span class="total-label">Total</span>
		<span class="total-value">${subtotal().toFixed(2)}</span>
	</div>
</div>

<style>
	.price-breakdown {
		margin-top: 0;
	}
	
	.breakdown-title {
		font-size: 0.9375rem;
		font-weight: 600;
		color: var(--text);
		margin: 0 0 0.5rem 0;
	}
	
	.breakdown-list {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		margin-bottom: 0.15rem;
	}
	
	.breakdown-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		font-size: 0.8125rem;
	}
	
	.item-label {
		color: var(--muted);
	}
	
	.item-value {
		color: var(--text);
		font-weight: 500;
	}
	
	.breakdown-total {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding-top: 0.15rem;
		margin-top: 0.15rem;
		border-top: 2px solid var(--border);
	}
	
	.total-label {
		font-size: 0.9375rem;
		font-weight: 600;
		color: var(--text);
	}
	
	.total-value {
		font-size: 1rem;
		font-weight: 700;
		color: var(--primary);
	}
	
	.breakdown-section {
		margin-top: 0;
		padding-top: 0;
		border-top: none;
	}
	
	.breakdown-section:first-child {
		margin-top: 0;
		padding-top: 0;
	}
	
	.section-label {
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--text);
		margin-bottom: 0.375rem;
	}
	
	.breakdown-item.nested {
		padding-left: 0.75rem;
		font-size: 0.75rem;
	}
	
	.breakdown-item.nested-sub {
		padding-left: 1.5rem;
		font-size: 0.7rem;
		color: var(--muted);
	}
	
	.breakdown-item.note {
		font-style: italic;
		color: var(--muted);
	}

	.per-bed-note {
		font-size: 0.75rem;
		color: var(--muted);
		line-height: 1.45;
		margin: 0.5rem 0 0 0.75rem;
		max-width: 52ch;
	}
</style>
