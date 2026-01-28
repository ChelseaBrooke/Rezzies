<script lang="ts">
	interface Props {
		formData: any;
		nextStep: () => void;
		prevStep: () => void;
	}
	
	let { formData, nextStep, prevStep }: Props = $props();
	
	const pricingModels = [
		{ value: 'PER_PERSON', label: 'Per Person' },
		{ value: 'PER_ROOM', label: 'Per Room' },
		{ value: 'PER_BED', label: 'Per Bed' }
	];
	
	if (!formData.paymentDueDates) {
		formData.paymentDueDates = [];
	}
	
	function addPaymentDueDate() {
		formData.paymentDueDates = [...formData.paymentDueDates, ''];
	}
	
	function removePaymentDueDate(index: number) {
		formData.paymentDueDates = formData.paymentDueDates.filter((_: any, i: number) => i !== index);
	}
</script>

<div class="step-content">
	<h1 class="step-title">Pricing, Invites & Policies</h1>
	
	<!-- Total Trip Cost -->
	<div class="form-section">
		<label class="section-label">Total Trip Cost</label>
		<div class="cost-breakdown">
			<input
				type="number"
				bind:value={formData.totalCost}
				min="0"
				step="0.01"
				class="form-input"
				placeholder="Base cost"
			/>
			<input
				type="number"
				bind:value={formData.cleaningFees}
				min="0"
				step="0.01"
				class="form-input"
				placeholder="Cleaning fees"
			/>
			<input
				type="number"
				bind:value={formData.serviceFees}
				min="0"
				step="0.01"
				class="form-input"
				placeholder="Service fees"
			/>
			<input
				type="number"
				bind:value={formData.taxes}
				min="0"
				step="0.01"
				class="form-input"
				placeholder="Taxes"
			/>
		</div>
	</div>
	
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
					/>
					<span>{model.label}</span>
				</label>
			{/each}
		</div>
	</div>
	
	<!-- Partial Stay -->
	<div class="form-section">
		<label class="toggle-label">
			<input
				type="checkbox"
				bind:checked={formData.allowPartialStays}
				class="toggle-input"
			/>
			<span class="toggle-text">Partial stay allowed?</span>
		</label>
	</div>
	
	<!-- Payment Rules -->
	<div class="form-section">
		<h2 class="subsection-title">Payment Rules</h2>
		
		<div class="form-group">
			<label class="section-label">Payment Due Dates</label>
			{#each formData.paymentDueDates as date, index}
				<div class="inline-input-group">
					<input
						type="date"
						bind:value={formData.paymentDueDates[index]}
						class="form-input"
					/>
					<button
						type="button"
						class="remove-btn"
						onclick={() => removePaymentDueDate(index)}
					>
						×
					</button>
				</div>
			{/each}
			<button
				type="button"
				class="add-btn"
				onclick={addPaymentDueDate}
			>
				+ Add Due Date
			</button>
		</div>
		
		<div class="form-group">
			<label class="toggle-label">
				<input
					type="checkbox"
					bind:checked={formData.installments}
					class="toggle-input"
				/>
				<span class="toggle-text">Allow installments</span>
			</label>
		</div>
		
		<div class="form-group">
			<label class="section-label">Refund Policy</label>
			<textarea
				bind:value={formData.refundPolicy}
				rows="3"
				class="form-textarea"
				placeholder="Describe your refund policy..."
			></textarea>
		</div>
		
		<div class="form-group">
			<label class="section-label">Cancellation Cutoff</label>
			<input
				type="date"
				bind:value={formData.cancellationCutoff}
				class="form-input"
			/>
		</div>
		
		<div class="form-group">
			<label class="section-label">Late Payment Handling</label>
			<textarea
				bind:value={formData.latePaymentHandling}
				rows="2"
				class="form-textarea"
				placeholder="How will late payments be handled?"
			></textarea>
		</div>
	</div>
	
	<!-- Invites & RSVP -->
	<div class="form-section">
		<h2 class="subsection-title">Invites & RSVP</h2>
		
		<div class="form-group">
			<label class="section-label">RSVP Deadline</label>
			<input
				type="date"
				bind:value={formData.rsvpDeadline}
				class="form-input"
			/>
		</div>
		
		<div class="form-group">
			<label class="toggle-label">
				<input
					type="checkbox"
					bind:checked={formData.autoReminders}
					class="toggle-input"
				/>
				<span class="toggle-text">Auto-reminders</span>
			</label>
		</div>
		
		<div class="form-group">
			<label class="toggle-label">
				<input
					type="checkbox"
					bind:checked={formData.overbookingAllowed}
					class="toggle-input"
				/>
				<span class="toggle-text">Overbooking allowed</span>
			</label>
		</div>
	</div>
	
	<!-- House Rules -->
	<div class="form-section">
		<h2 class="subsection-title">House Rules</h2>
		
		<div class="form-group">
			<label class="section-label">House Rules Text</label>
			<textarea
				bind:value={formData.houseRules}
				rows="4"
				class="form-textarea"
				placeholder="General house rules..."
			></textarea>
		</div>
		
		<div class="form-group">
			<label class="section-label">Quiet Hours</label>
			<input
				type="text"
				bind:value={formData.quietHours}
				class="form-input"
				placeholder="e.g., 10 PM - 8 AM"
			/>
		</div>
		
		<div class="form-group">
			<label class="section-label">Pet Policy</label>
			<textarea
				bind:value={formData.petPolicy}
				rows="2"
				class="form-textarea"
				placeholder="Pet policy details..."
			></textarea>
		</div>
		
		<div class="form-group">
			<label class="section-label">Smoking Policy</label>
			<textarea
				bind:value={formData.smokingPolicy}
				rows="2"
				class="form-textarea"
				placeholder="Smoking policy details..."
			></textarea>
		</div>
		
		<div class="form-group">
			<label class="section-label">Accessibility Notes</label>
			<textarea
				bind:value={formData.accessibilityNotes}
				rows="2"
				class="form-textarea"
				placeholder="Accessibility information..."
			></textarea>
		</div>
		
		<div class="form-group">
			<label class="section-label">Check-in Instructions</label>
			<textarea
				bind:value={formData.checkInInstructions}
				rows="3"
				class="form-textarea"
				placeholder="Check-in instructions..."
			></textarea>
		</div>
		
		<div class="form-group">
			<label class="section-label">Check-out Instructions</label>
			<textarea
				bind:value={formData.checkOutInstructions}
				rows="3"
				class="form-textarea"
				placeholder="Check-out instructions..."
			></textarea>
		</div>
	</div>
	
	<div class="step-actions">
		<button type="button" class="btn-secondary" onclick={prevStep}>
			Back
		</button>
		<button type="button" class="btn-primary" onclick={nextStep}>
			Continue
		</button>
	</div>
</div>

<style>
	.step-title {
		font-size: 3rem;
		font-weight: 700;
		margin-bottom: 3rem;
		color: #000;
		letter-spacing: -0.02em;
		line-height: 1.1;
	}
	
	.form-section {
		margin-bottom: 3rem;
	}
	
	.subsection-title {
		font-size: 1.5rem;
		font-weight: 600;
		margin-bottom: 1.5rem;
		color: #000;
		border-bottom: 1px solid rgba(0, 0, 0, 0.1);
		padding-bottom: 0.75rem;
	}
	
	.section-label {
		font-size: 0.875rem;
		color: rgba(0, 0, 0, 0.5);
		font-weight: 400;
		margin-bottom: 0.75rem;
		display: block;
	}
	
	.cost-breakdown {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}
	
	.form-input {
		width: 100%;
		padding: 1rem 0;
		border: none;
		border-bottom: 1px solid rgba(0, 0, 0, 0.1);
		font-size: 1.125rem;
		font-family: inherit;
		background: transparent;
		color: #000;
		transition: border-color 0.2s ease;
	}
	
	.form-input:focus {
		outline: none;
		border-bottom-color: #000;
	}
	
	.form-input::placeholder {
		color: rgba(0, 0, 0, 0.3);
		font-weight: 400;
	}
	
	.form-textarea {
		width: 100%;
		padding: 1rem 0;
		border: none;
		border-bottom: 1px solid rgba(0, 0, 0, 0.1);
		font-size: 1rem;
		font-family: inherit;
		background: transparent;
		color: #000;
		resize: none;
		transition: border-color 0.2s ease;
		line-height: 1.6;
	}
	
	.form-textarea:focus {
		outline: none;
		border-bottom-color: #000;
	}
	
	.form-textarea::placeholder {
		color: rgba(0, 0, 0, 0.3);
	}
	
	.pricing-options {
		display: flex;
		gap: 1.5rem;
		flex-wrap: wrap;
	}
	
	.pricing-option {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		cursor: pointer;
	}
	
	.pricing-option input[type="radio"] {
		width: 18px;
		height: 18px;
		cursor: pointer;
	}
	
	.toggle-label {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		cursor: pointer;
	}
	
	.toggle-input {
		width: 18px;
		height: 18px;
		cursor: pointer;
	}
	
	.toggle-text {
		font-size: 1rem;
		color: rgba(0, 0, 0, 0.7);
	}
	
	.form-group {
		margin-bottom: 2rem;
	}
	
	.inline-input-group {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		margin-bottom: 0.75rem;
	}
	
	.inline-input-group .form-input {
		flex: 1;
	}
	
	.remove-btn {
		width: 28px;
		height: 28px;
		border-radius: 50%;
		background: rgba(0, 0, 0, 0.1);
		color: rgba(0, 0, 0, 0.6);
		border: none;
		font-size: 1.25rem;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		line-height: 1;
		transition: all 0.2s ease;
	}
	
	.remove-btn:hover {
		background: rgba(0, 0, 0, 0.15);
		color: rgba(0, 0, 0, 0.8);
	}
	
	.add-btn {
		padding: 0.75rem 1.5rem;
		background: transparent;
		border: 1px solid rgba(0, 0, 0, 0.2);
		border-radius: 8px;
		color: rgba(0, 0, 0, 0.7);
		font-size: 0.95rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s ease;
	}
	
	.add-btn:hover {
		border-color: rgba(0, 0, 0, 0.4);
		color: rgba(0, 0, 0, 0.9);
		background: rgba(0, 0, 0, 0.02);
	}
	
	.step-actions {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		margin-top: 4rem;
		padding-top: 2rem;
		border-top: 1px solid rgba(0, 0, 0, 0.08);
	}
	
	.btn-primary,
	.btn-secondary {
		padding: 1rem 2rem;
		border-radius: 8px;
		font-size: 1rem;
		font-weight: 500;
		cursor: pointer;
		font-family: inherit;
		transition: all 0.2s ease;
		border: none;
	}
	
	.btn-primary {
		background: #000;
		color: white;
	}
	
	.btn-primary:hover {
		background: #333;
	}
	
	.btn-secondary {
		background: transparent;
		color: rgba(0, 0, 0, 0.6);
	}
	
	.btn-secondary:hover {
		color: rgba(0, 0, 0, 0.8);
	}
</style>
