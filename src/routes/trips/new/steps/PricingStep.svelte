<script lang="ts">
	interface Props {
		formData: any;
		nextStep: () => void;
		prevStep: () => void;
	}
	
	let { formData, nextStep, prevStep }: Props = $props();
	
	const pricingModels = [
		{ value: 'PER_PERSON', label: 'Per Person', description: 'Total cost divided by number of guests' },
		{ value: 'PER_ROOM', label: 'Per Room', description: 'Each room has a fixed price' },
		{ value: 'PER_BED', label: 'Per Bed', description: 'Each bed has a fixed price' },
		{ value: 'PER_PERSON_PER_NIGHT', label: 'Per Person Per Night', description: 'Cost per person for each night' }
	];
</script>

<div class="step-content">
	<h1 class="step-title">Pricing</h1>
	<p class="step-subtitle">Configure how costs will be calculated and allocated</p>
	
	<div class="pricing-form">
		<!-- Pricing Model -->
		<div class="form-section">
			<label class="section-label">Pricing Model</label>
			<div class="pricing-options">
				{#each pricingModels as model}
					<label class="pricing-option">
						<input
							type="radio"
							name="pricingModel"
							value={model.value}
							bind:group={formData.pricingModel}
							required
						/>
						<div class="option-content">
							<div class="option-label">{model.label}</div>
							<div class="option-description">{model.description}</div>
						</div>
					</label>
				{/each}
			</div>
		</div>
		
		<!-- RSVP By Date -->
		<div class="form-section">
			<label for="rsvpByDate" class="section-label">RSVP By Date</label>
			<input
				type="date"
				id="rsvpByDate"
				bind:value={formData.rsvpByDate}
				class="date-input"
			/>
			<p class="helper-text">Guests must RSVP by this date</p>
		</div>
		
		<!-- Partial Stays -->
		<div class="form-section">
			<label class="toggle-label">
				<input
					type="checkbox"
					bind:checked={formData.allowPartialStays}
					class="toggle-input"
				/>
				<span class="toggle-content">
					<span class="toggle-title">Allow Partial Stays</span>
					<span class="toggle-description">Guests can book for fewer nights than the full trip duration</span>
				</span>
			</label>
		</div>
		
		<!-- Rounding Rule -->
		<div class="form-section">
			<label class="toggle-label">
				<input
					type="checkbox"
					bind:checked={formData.roundUp}
					class="toggle-input"
				/>
				<span class="toggle-content">
					<span class="toggle-title">Always Round Up</span>
					<span class="toggle-description">Round calculated prices up to the nearest dollar</span>
				</span>
			</label>
		</div>
		
		<!-- Helper Text -->
		<div class="info-box">
			<h4>How Pricing Works</h4>
			<p>
				Based on your selected model, Rezzies will automatically calculate each guest's share of the total lodging cost.
				The system considers room types, bed configurations, and occupancy to ensure fair pricing.
			</p>
		</div>
	</div>
	
	<div class="step-actions">
		<button type="button" class="btn btn-secondary" onclick={prevStep}>
			← Back
		</button>
		<button type="button" class="btn btn-primary" onclick={nextStep}>
			Continue to Meals →
		</button>
	</div>
</div>

<style>
	.pricing-form {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-xl);
	}
	
	.form-section {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-sm);
	}
	
	.section-label {
		font-size: 1.125rem;
		font-weight: 600;
		color: var(--color-text);
		margin-bottom: var(--spacing-sm);
	}
	
	.pricing-options {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-md);
	}
	
	.pricing-option {
		display: flex;
		align-items: flex-start;
		gap: var(--spacing-md);
		padding: var(--spacing-lg);
		border: 2px solid var(--color-border);
		border-radius: var(--radius-lg);
		cursor: pointer;
		transition: all var(--transition-base);
		background: white;
	}
	
	.pricing-option:hover {
		border-color: var(--color-primary);
		background: rgba(37, 99, 235, 0.02);
	}
	
	.pricing-option input[type="radio"] {
		margin-top: 2px;
		accent-color: var(--color-primary);
	}
	
	.option-content {
		flex: 1;
	}
	
	.option-label {
		font-weight: 600;
		font-size: 1.125rem;
		margin-bottom: var(--spacing-xs);
		color: var(--color-text);
	}
	
	.option-description {
		font-size: 0.95rem;
		color: var(--color-text-light);
	}
	
	.date-input {
		padding: var(--spacing-md);
		border: 2px solid var(--color-border);
		border-radius: var(--radius-md);
		font-size: 1rem;
		font-family: inherit;
		max-width: 300px;
	}
	
	.date-input:focus {
		outline: none;
		border-color: var(--color-primary);
	}
	
	.helper-text {
		font-size: 0.875rem;
		color: var(--color-text-light);
		margin-top: var(--spacing-xs);
	}
	
	.toggle-label {
		display: flex;
		align-items: flex-start;
		gap: var(--spacing-md);
		cursor: pointer;
		padding: var(--spacing-lg);
		border: 2px solid var(--color-border);
		border-radius: var(--radius-lg);
		background: white;
		transition: all var(--transition-base);
	}
	
	.toggle-label:hover {
		border-color: var(--color-primary);
		background: rgba(37, 99, 235, 0.02);
	}
	
	.toggle-input {
		margin-top: 2px;
		accent-color: var(--color-primary);
		width: 20px;
		height: 20px;
	}
	
	.toggle-content {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: var(--spacing-xs);
	}
	
	.toggle-title {
		font-weight: 600;
		font-size: 1.125rem;
		color: var(--color-text);
	}
	
	.toggle-description {
		font-size: 0.95rem;
		color: var(--color-text-light);
	}
	
	.info-box {
		background: rgba(37, 99, 235, 0.05);
		border-left: 4px solid var(--color-primary);
		border-radius: var(--radius-md);
		padding: var(--spacing-lg);
		margin-top: var(--spacing-md);
	}
	
	.info-box h4 {
		font-size: 1.125rem;
		margin-bottom: var(--spacing-sm);
		color: var(--color-primary);
	}
	
	.info-box p {
		color: var(--color-text);
		line-height: 1.7;
		margin: 0;
	}
</style>
