<script lang="ts">
	import SectionCard from '$lib/components/wizard/SectionCard.svelte';
	import type { TripDraft } from '$lib/stores/tripDraft.js';
	
	let { draft, autosave }: { draft: TripDraft; autosave: () => void } = $props();
	
	function addCustomLineItem() {
		draft.customLineItems = [
			...draft.customLineItems,
			{ label: '', amount: '' }
		];
		autosave();
	}
	
	function removeCustomLineItem(index: number) {
		draft.customLineItems = draft.customLineItems.filter((_, i) => i !== index);
		autosave();
	}
</script>

<div class="step-content">
	<SectionCard title="Pricing" icon="💰">
		<div class="form-grid">
			<div class="form-group">
				<label for="totalTripCost">Total Trip Cost *</label>
				<input
					type="number"
					id="totalTripCost"
					bind:value={draft.totalTripCost}
					oninput={autosave}
					placeholder="0.00"
					step="0.01"
					required
				/>
			</div>
			<div class="form-group">
				<label for="cleaningFee">Cleaning Fee</label>
				<input
					type="number"
					id="cleaningFee"
					bind:value={draft.cleaningFee}
					oninput={autosave}
					placeholder="0.00"
					step="0.01"
				/>
			</div>
			<div class="form-group">
				<label for="serviceFee">Service Fee</label>
				<input
					type="number"
					id="serviceFee"
					bind:value={draft.serviceFee}
					oninput={autosave}
					placeholder="0.00"
					step="0.01"
				/>
			</div>
			<div class="form-group">
				<label for="taxes">Taxes</label>
				<input
					type="number"
					id="taxes"
					bind:value={draft.taxes}
					oninput={autosave}
					placeholder="0.00"
					step="0.01"
				/>
			</div>
			<div class="form-group">
				<label for="refundableDeposit">Refundable Deposit</label>
				<input
					type="number"
					id="refundableDeposit"
					bind:value={draft.refundableDeposit}
					oninput={autosave}
					placeholder="0.00"
					step="0.01"
				/>
			</div>
			<div class="form-group">
				<label for="minimumPayment">Minimum Payment to Reserve</label>
				<input
					type="number"
					id="minimumPayment"
					bind:value={draft.minimumPayment}
					oninput={autosave}
					placeholder="0.00"
					step="0.01"
				/>
			</div>
			<div class="form-group full-width">
				<label>Custom Line Items</label>
				<div class="line-items-list">
					{#each draft.customLineItems as item, index}
						<div class="line-item">
							<input
								type="text"
								bind:value={item.label}
								oninput={autosave}
								placeholder="Item label"
							/>
							<input
								type="number"
								bind:value={item.amount}
								oninput={autosave}
								placeholder="Amount"
								step="0.01"
							/>
							<button
								type="button"
								class="btn-remove-small"
								onclick={() => removeCustomLineItem(index)}
							>
								×
							</button>
						</div>
					{/each}
					<button type="button" class="btn-add-item" onclick={addCustomLineItem}>
						+ Add Line Item
					</button>
				</div>
			</div>
		</div>
	</SectionCard>
	
	<SectionCard title="Pricing Model" icon="📊">
		<div class="form-grid">
			<div class="form-group">
				<label for="pricingModel">Pricing Model</label>
				<select id="pricingModel" bind:value={draft.pricingModel} onchange={autosave}>
					<option value="per-person">Per Person</option>
					<option value="per-room">Per Room</option>
					<option value="per-bed">Per Bed</option>
					<option value="hybrid">Hybrid</option>
				</select>
			</div>
			<div class="form-group">
				<label for="pricingType">Pricing Type</label>
				<select id="pricingType" bind:value={draft.pricingType} onchange={autosave}>
					<option value="per-night">Per Night</option>
					<option value="flat">Flat Rate</option>
				</select>
			</div>
			<div class="form-group">
				<label for="prorationRule">Proration Rule</label>
				<select id="prorationRule" bind:value={draft.prorationRule} onchange={autosave}>
					<option value="proportional">Proportional</option>
					<option value="full-night">Full Night Only</option>
					<option value="half-night">Half Night</option>
				</select>
			</div>
			<div class="form-group full-width">
				<label class="checkbox-label">
					<input
						type="checkbox"
						bind:checked={draft.partialStayAllowed}
						onchange={autosave}
					/>
					<span>Partial stay allowed</span>
				</label>
			</div>
		</div>
	</SectionCard>
	
	<SectionCard title="Capacity Rules" icon="👥">
		<div class="form-grid">
			<div class="form-group">
				<label for="maxGuestsPerRoom">Max Guests Per Room</label>
				<input
					type="number"
					id="maxGuestsPerRoom"
					bind:value={draft.maxGuestsPerRoom}
					oninput={autosave}
					min="0"
				/>
			</div>
			<div class="form-group">
				<label for="maxGuestsPerBed">Max Guests Per Bed</label>
				<input
					type="number"
					id="maxGuestsPerBed"
					bind:value={draft.maxGuestsPerBed}
					oninput={autosave}
					min="0"
				/>
			</div>
			<div class="form-group full-width">
				<label class="checkbox-label">
					<input
						type="checkbox"
						bind:checked={draft.couplesAllowed}
						onchange={autosave}
					/>
					<span>Couples allowed</span>
				</label>
			</div>
			<div class="form-group full-width">
				<label class="checkbox-label">
					<input
						type="checkbox"
						bind:checked={draft.childrenAllowed}
						onchange={autosave}
					/>
					<span>Children allowed</span>
				</label>
			</div>
			<div class="form-group full-width">
				<label for="genderRestrictions">Gender Restrictions (Optional)</label>
				<input
					type="text"
					id="genderRestrictions"
					bind:value={draft.genderRestrictions}
					oninput={autosave}
					placeholder="e.g., Mixed gender rooms allowed"
				/>
			</div>
		</div>
	</SectionCard>
</div>

<style>
	.step-content {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}
	
	.form-grid {
		display: grid;
		grid-template-columns: repeat(1, 1fr);
		gap: 1.5rem;
	}
	
	@media (min-width: 768px) {
		.form-grid {
			grid-template-columns: repeat(2, 1fr);
		}
	}
	
	@media (min-width: 1280px) {
		.form-grid {
			grid-template-columns: repeat(3, 1fr);
		}
	}
	
	.form-group.full-width {
		grid-column: 1 / -1;
	}
	
	.line-items-list {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}
	
	.line-item {
		display: grid;
		grid-template-columns: 1fr auto auto;
		gap: 0.75rem;
		align-items: center;
	}
	
	.line-item input:first-child {
		flex: 1;
	}
	
	.btn-remove-small {
		padding: 0.5rem;
		background: transparent;
		color: var(--muted);
		border: 1px solid var(--border);
		border-radius: 0.5rem;
		cursor: pointer;
		font-size: 1.25rem;
		width: 2.5rem;
		height: 2.5rem;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.2s ease;
	}
	
	.btn-remove-small:hover {
		background: #ef4444;
		color: white;
		border-color: #ef4444;
	}
	
	.btn-add-item {
		padding: 0.75rem 1.5rem;
		background: var(--primary);
		color: white;
		border: none;
		border-radius: 0.5rem;
		cursor: pointer;
		font-size: 0.9375rem;
		font-weight: 500;
		transition: background 0.2s ease;
		width: 100%;
	}
	
	.btn-add-item:hover {
		background: var(--primary-dark);
	}
</style>
