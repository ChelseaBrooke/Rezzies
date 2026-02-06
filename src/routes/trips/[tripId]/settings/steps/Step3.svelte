<script lang="ts">
	interface Props {
		formData: {
			totalCost: string;
			pricingModel: string;
			allowPartialStays: boolean;
		};
		tripId: string;
	}

	let { formData, tripId }: Props = $props();

	const pricingModels = [
		{ value: 'PER_PERSON', label: 'Per Person' },
		{ value: 'PER_ROOM', label: 'Per Room' },
		{ value: 'PER_BED', label: 'Per Bed' },
		{ value: 'PER_PERSON_PER_NIGHT', label: 'Per Person Per Night' }
	];
</script>

<div class="step-content">
	<h1 class="step-title">Pricing & Policies</h1>
	
	<div class="form-section">
		<label for="totalCost" class="form-label">Total Trip Cost</label>
		<div class="currency-input-wrapper">
			<span class="currency-symbol">$</span>
			<input
				type="number"
				id="totalCost"
				class="form-input currency-input"
				bind:value={formData.totalCost}
				placeholder="0.00"
				step="0.01"
				min="0"
			/>
		</div>
		<p class="helper-text">Include fees and taxes if you would like your guests to split these costs as well</p>
	</div>
	
	<div class="form-section">
		<label class="form-label">Pricing Model</label>
		<div class="pricing-options">
			{#each pricingModels as model}
				<label class="pricing-option">
					<input
						type="radio"
						name="pricingModel"
						value={model.value}
						bind:group={formData.pricingModel}
					/>
					<span>{model.label}</span>
				</label>
			{/each}
		</div>
	</div>
	
	<div class="form-section">
		<label class="toggle-label">
			<input
				type="checkbox"
				bind:checked={formData.allowPartialStays}
				class="toggle-input"
			/>
			<span class="toggle-text">Allow partial stays</span>
		</label>
		<p class="helper-text">Guests can book for fewer nights than the full trip duration</p>
	</div>
	
	<div class="info-box">
		<p class="info-text">Additional policies (house rules, cancellation, etc.) can be managed from the trip management page.</p>
	</div>
</div>

<style>
	.step-content {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.step-title {
		font-size: 1.5rem;
		font-weight: 600;
		margin: 0 0 0.5rem 0;
		color: var(--text);
	}

	.form-section {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.form-label {
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--text);
	}

	.currency-input-wrapper {
		display: flex;
		align-items: center;
		border: 1px solid var(--border-strong);
		border-radius: var(--radius-md);
		overflow: hidden;
		background: white;
	}

	.currency-symbol {
		padding: 0.625rem 0.5rem 0.625rem 0.75rem;
		color: var(--muted);
		font-weight: 500;
	}

	.currency-input {
		flex: 1;
		border: none;
		padding: 0.625rem 0.75rem;
		font-size: 0.875rem;
	}

	.currency-input:focus {
		outline: none;
		box-shadow: none;
	}

	.currency-input-wrapper:focus-within {
		border-color: var(--primary);
		box-shadow: 0 0 0 3px var(--focusRing);
	}

	.helper-text {
		font-size: 0.8125rem;
		color: var(--muted);
		margin: 0.25rem 0 0 0;
	}

	.pricing-options {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.pricing-option {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		cursor: pointer;
		padding: 0.5rem;
		border-radius: var(--radius-md);
		transition: background var(--transition-fast);
	}

	.pricing-option:hover {
		background: var(--surface2);
	}

	.pricing-option input[type="radio"] {
		margin: 0;
		cursor: pointer;
	}

	.pricing-option span {
		font-size: 0.875rem;
		color: var(--text);
	}

	.toggle-label {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		cursor: pointer;
	}

	.toggle-input {
		margin: 0;
		cursor: pointer;
	}

	.toggle-text {
		font-size: 0.875rem;
		color: var(--text);
	}

	.info-box {
		background: var(--surface2);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		padding: 1rem;
		margin-top: 0.5rem;
	}

	.info-text {
		font-size: 0.8125rem;
		color: var(--muted);
		margin: 0;
	}
</style>
