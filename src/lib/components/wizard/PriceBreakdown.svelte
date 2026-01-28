<script lang="ts">
	import type { TripDraft } from '$lib/stores/tripDraft.js';
	
	let { draft }: { draft: TripDraft } = $props();
	
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
</script>

<div class="price-breakdown">
	<h3 class="breakdown-title">Price Breakdown</h3>
	
	<div class="breakdown-list">
		<div class="breakdown-item">
			<span class="item-label">Per Night</span>
			<span class="item-value">${perNight().toFixed(2)}</span>
		</div>
		<div class="breakdown-item">
			<span class="item-label">Nights</span>
			<span class="item-value">{calculateNights()}</span>
		</div>
		<div class="breakdown-item">
			<span class="item-label">Trip Cost</span>
			<span class="item-value">${totalTripCost().toFixed(2)}</span>
		</div>
		
		{#if draft.customLineItems && Array.isArray(draft.customLineItems)}
			{#each draft.customLineItems as item}
				{#if item.label && parseFloat(item.amount) > 0}
					<div class="breakdown-item">
						<span class="item-label">{item.label}</span>
						<span class="item-value">${parseFloat(item.amount).toFixed(2)}</span>
					</div>
				{/if}
			{/each}
		{/if}
	</div>
	
	<div class="breakdown-total">
		<span class="total-label">Total</span>
		<span class="total-value">${subtotal().toFixed(2)}</span>
	</div>
</div>

<style>
	.price-breakdown {
		border-top: 1px solid var(--border);
		padding-top: 1rem;
		margin-top: 1rem;
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
		gap: 0.375rem;
		margin-bottom: 0.5rem;
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
		padding-top: 0.5rem;
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
</style>
