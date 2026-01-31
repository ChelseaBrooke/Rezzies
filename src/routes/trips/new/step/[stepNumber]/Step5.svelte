<script lang="ts">
	import SectionCard from '$lib/components/wizard/SectionCard.svelte';
	import type { TripDraft } from '$lib/stores/tripDraft.js';
	
	let { draft, autosave }: { draft: TripDraft; autosave: () => void } = $props();
	
	function addPaymentDueDate() {
		draft.paymentDueDates = [
			...draft.paymentDueDates,
			{ date: '', amount: '' }
		];
		autosave();
	}
	
	function removePaymentDueDate(index: number) {
		draft.paymentDueDates = draft.paymentDueDates.filter((_, i) => i !== index);
		autosave();
	}
	
	function addInstallment() {
		draft.installmentSchedule = [
			...draft.installmentSchedule,
			{ date: '', amount: '' }
		];
		autosave();
	}
	
	function removeInstallment(index: number) {
		draft.installmentSchedule = draft.installmentSchedule.filter((_, i) => i !== index);
		autosave();
	}
	
	function addGuest() {
		draft.guests = [
			...draft.guests,
			{ name: '', email: '', role: 'guest' }
		];
		autosave();
	}
	
	function removeGuest(index: number) {
		draft.guests = draft.guests.filter((_, i) => i !== index);
		autosave();
	}
</script>

<div class="step-content">
	<SectionCard title="Payments" icon="💳">
		<div class="form-grid">
			<div class="form-group full-width">
				<label>Payment Due Dates</label>
				<div class="payment-dates-list">
					{#each draft.paymentDueDates as payment, index}
						<div class="payment-item">
							<input
								type="date"
								bind:value={payment.date}
								oninput={autosave}
							/>
							<input
								type="number"
								bind:value={payment.amount}
								oninput={autosave}
								placeholder="Amount"
								step="0.01"
							/>
							<button
								type="button"
								class="btn-remove-small"
								onclick={() => removePaymentDueDate(index)}
							>
								×
							</button>
						</div>
					{/each}
					<button type="button" class="btn-add-item" onclick={addPaymentDueDate}>
						+ Add Payment Date
					</button>
				</div>
			</div>
			<div class="form-group full-width">
				<label class="checkbox-label">
					<input
						type="checkbox"
						bind:checked={draft.installmentsEnabled}
						onchange={autosave}
					/>
					<span>Enable Installments</span>
				</label>
			</div>
			{#if draft.installmentsEnabled}
				<div class="form-group full-width">
					<label>Installment Schedule</label>
					<div class="installments-list">
						{#each draft.installmentSchedule as installment, index}
							<div class="installment-item">
								<input
									type="date"
									bind:value={installment.date}
									oninput={autosave}
								/>
								<input
									type="number"
									bind:value={installment.amount}
									oninput={autosave}
									placeholder="Amount"
									step="0.01"
								/>
								<button
									type="button"
									class="btn-remove-small"
									onclick={() => removeInstallment(index)}
								>
									×
								</button>
							</div>
						{/each}
						<button type="button" class="btn-add-item" onclick={addInstallment}>
							+ Add Installment
						</button>
					</div>
				</div>
			{/if}
			<div class="form-group full-width">
				<label for="refundPolicy">Refund Policy</label>
				<textarea
					id="refundPolicy"
					bind:value={draft.refundPolicy}
					oninput={autosave}
					rows="3"
					placeholder="Describe your refund policy..."
				></textarea>
			</div>
			<div class="form-group">
				<label for="cancellationCutoffDate">Cancellation Cutoff Date</label>
				<input
					type="date"
					id="cancellationCutoffDate"
					bind:value={draft.cancellationCutoffDate}
					oninput={autosave}
				/>
			</div>
			<div class="form-group">
				<label for="latePaymentHandling">Late Payment Handling</label>
				<select id="latePaymentHandling" bind:value={draft.latePaymentHandling} onchange={autosave}>
					<option value="reminder">Send Reminder</option>
					<option value="penalty">Apply Penalty</option>
					<option value="cancel">Cancel Reservation</option>
				</select>
			</div>
		</div>
	</SectionCard>
	
	<SectionCard title="Invites" icon="✉️">
		<div class="form-grid">
			<div class="form-group">
				<label for="inviteMethod">Invite Method</label>
				<select id="inviteMethod" bind:value={draft.inviteMethod} onchange={autosave}>
					<option value="email">Email Only</option>
					<option value="link">Share Link Only</option>
					<option value="both">Both</option>
				</select>
			</div>
			<div class="form-group">
				<label for="rsvpDeadline">RSVP Deadline</label>
				<input
					type="date"
					id="rsvpDeadline"
					bind:value={draft.rsvpDeadline}
					oninput={autosave}
				/>
			</div>
			<div class="form-group full-width">
				<label class="checkbox-label">
					<input
						type="checkbox"
						bind:checked={draft.autoReminders}
						onchange={autosave}
					/>
					<span>Enable Auto Reminders</span>
				</label>
			</div>
			<div class="form-group full-width">
				<label>Guests</label>
				<div class="guests-list">
					{#each draft.guests as guest, index}
						<div class="guest-item">
							<input
								type="text"
								bind:value={guest.name}
								oninput={autosave}
								placeholder="Name"
							/>
							<input
								type="email"
								bind:value={guest.email}
								oninput={autosave}
								placeholder="Email"
							/>
							<select bind:value={guest.role} onchange={autosave}>
								<option value="guest">Guest</option>
								<option value="co-host">Co-Host</option>
							</select>
							<button
								type="button"
								class="btn-remove-small"
								onclick={() => removeGuest(index)}
							>
								×
							</button>
						</div>
					{/each}
					<button type="button" class="btn-add-item" onclick={addGuest}>
						+ Add Guest
					</button>
				</div>
			</div>
			<div class="form-group full-width">
				<label for="inviteMessage">Invite Message</label>
				<textarea
					id="inviteMessage"
					bind:value={draft.inviteMessage}
					oninput={autosave}
					rows="4"
					placeholder="Custom message to include with invites..."
				></textarea>
			</div>
			<div class="form-group full-width">
				<label class="checkbox-label">
					<input
						type="checkbox"
						bind:checked={draft.sendInvitesNow}
						onchange={autosave}
					/>
					<span>Send invites now (otherwise send later)</span>
				</label>
			</div>
		</div>
	</SectionCard>
	
	<SectionCard title="House Rules & Policies" icon="📋">
		<div class="form-grid">
			<div class="form-group full-width">
				<label for="houseRules">House Rules</label>
				<textarea
					id="houseRules"
					bind:value={draft.houseRules}
					oninput={autosave}
					rows="4"
					placeholder="List house rules..."
				></textarea>
			</div>
			<div class="form-group">
				<label for="quietHours">Quiet Hours</label>
				<input
					type="text"
					id="quietHours"
					bind:value={draft.quietHours}
					oninput={autosave}
					placeholder="e.g., 10 PM - 7 AM"
				/>
			</div>
			<div class="form-group">
				<label for="petPolicy">Pet Policy</label>
				<input
					type="text"
					id="petPolicy"
					bind:value={draft.petPolicy}
					oninput={autosave}
					placeholder="e.g., No pets allowed"
				/>
			</div>
			<div class="form-group">
				<label for="smokingPolicy">Smoking Policy</label>
				<input
					type="text"
					id="smokingPolicy"
					bind:value={draft.smokingPolicy}
					oninput={autosave}
					placeholder="e.g., No smoking"
				/>
			</div>
			<div class="form-group full-width">
				<label for="checkInInstructions">Check-in Instructions</label>
				<textarea
					id="checkInInstructions"
					bind:value={draft.checkInInstructions}
					oninput={autosave}
					rows="3"
					placeholder="Instructions for check-in..."
				></textarea>
			</div>
			<div class="form-group full-width">
				<label for="checkOutInstructions">Check-out Instructions</label>
				<textarea
					id="checkOutInstructions"
					bind:value={draft.checkOutInstructions}
					oninput={autosave}
					rows="3"
					placeholder="Instructions for check-out..."
				></textarea>
			</div>
			<div class="form-group full-width">
				<label for="accessibilityNotes">Accessibility Notes</label>
				<textarea
					id="accessibilityNotes"
					bind:value={draft.accessibilityNotes}
					oninput={autosave}
					rows="3"
					placeholder="Accessibility information..."
				></textarea>
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
	
	.payment-dates-list,
	.installments-list,
	.guests-list {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}
	
	.payment-item,
	.installment-item,
	.guest-item {
		display: grid;
		grid-template-columns: 1fr auto auto;
		gap: 0.75rem;
		align-items: center;
	}
	
	.guest-item {
		grid-template-columns: 1fr 1fr auto auto;
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
		background: var(--danger);
		color: white;
		border-color: var(--danger);
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
