<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	
	interface Props {
		formData: any;
		prevStep: () => void;
		numberOfNights?: number;
	}
	
	let { formData, prevStep, numberOfNights = 0 }: Props = $props();
	
	let isSubmitting = $state(false);
	
	function formatDate(dateStr: string) {
		if (!dateStr) return 'Not set';
		const date = new Date(dateStr);
		return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
	}
	
	function formatCurrency(amount: string | number) {
		const num = typeof amount === 'string' ? parseFloat(amount) : amount;
		return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num);
	}
	
	const pricingModelLabels: Record<string, string> = {
		'PER_PERSON': 'Per Person',
		'PER_ROOM': 'Per Room',
		'PER_BED': 'Per Bed',
		'PER_PERSON_PER_NIGHT': 'Per Person Per Night'
	};
	
	const roomTypeLabels: Record<string, string> = {
		'PRIVATE': 'Private',
		'SHARED': 'Shared',
		'COMMON': 'Common Area'
	};
	
	const bedTypeLabels: Record<string, string> = {
		'KING': 'King',
		'QUEEN': 'Queen',
		'TWIN': 'Twin',
		'BUNK': 'Bunk',
		'SOFA_BED': 'Sofa Bed',
		'CUSTOM': 'Custom'
	};
</script>

<div class="step-content">
	<h1 class="step-title">Review & Publish</h1>
	<p class="step-subtitle">Review your trip details before publishing</p>
	
	<div class="review-sections">
		<!-- Trip Basics -->
		<section class="review-section">
			<h2>Trip Basics</h2>
			<div class="review-grid">
				<div class="review-item">
					<span class="review-label">Trip Name</span>
					<span class="review-value">{formData.name || 'Not set'}</span>
				</div>
				<div class="review-item">
					<span class="review-label">Destination</span>
					<span class="review-value">{formData.destination || 'Not set'}</span>
				</div>
				<div class="review-item">
					<span class="review-label">Check-in Date</span>
					<span class="review-value">{formatDate(formData.checkInDate)}</span>
				</div>
				<div class="review-item">
					<span class="review-label">Check-out Date</span>
					<span class="review-value">{formatDate(formData.checkOutDate)}</span>
				</div>
				<div class="review-item">
					<span class="review-label">Number of Nights</span>
					<span class="review-value">{numberOfNights} night{numberOfNights !== 1 ? 's' : ''}</span>
				</div>
				<div class="review-item">
					<span class="review-label">Flexible Dates</span>
					<span class="review-value">{formData.flexibleDates ? 'Yes' : 'No'}</span>
				</div>
			</div>
			{#if formData.description}
				<div class="review-description">
					<span class="review-label">Description</span>
					<p>{formData.description}</p>
				</div>
			{/if}
		</section>
		
		<!-- Rooms -->
		<section class="review-section">
			<h2>Rooms & Beds</h2>
			<div class="rooms-review">
				{#each formData.rooms as room}
					<div class="room-review-card">
						<div class="room-review-header">
							<h3>{room.name}</h3>
							<span class="room-type-badge">{roomTypeLabels[room.roomType] || room.roomType}</span>
						</div>
						<div class="room-review-details">
							<p><strong>Max Occupants:</strong> {room.maxOccupants}</p>
							{#if room.beds && room.beds.length > 0}
								<div class="beds-review">
									<strong>Beds:</strong>
									<ul>
										{#each room.beds as bed}
											<li>
												{bedTypeLabels[bed.bedType] || bed.bedType}
												{#if bed.bedType === 'CUSTOM' && bed.customType}
													({bed.customType})
												{/if}
												× {bed.quantity}
											</li>
										{/each}
									</ul>
								</div>
							{/if}
							{#if room.photos && room.photos.length > 0}
								<div class="photos-review">
									<strong>Photos:</strong> {room.photos.length} photo{room.photos.length !== 1 ? 's' : ''}
								</div>
							{/if}
						</div>
					</div>
				{/each}
			</div>
		</section>
		
		<!-- Pricing Breakdown -->
		<section class="review-section">
			<h2>Pricing Breakdown</h2>
			<div class="review-grid">
				<div class="review-item">
					<span class="review-label">Base Cost</span>
					<span class="review-value">{formatCurrency(formData.totalCost || 0)}</span>
				</div>
				{#if formData.cleaningFees}
					<div class="review-item">
						<span class="review-label">Cleaning Fees</span>
						<span class="review-value">{formatCurrency(formData.cleaningFees || 0)}</span>
					</div>
				{/if}
				{#if formData.serviceFees}
					<div class="review-item">
						<span class="review-label">Service Fees</span>
						<span class="review-value">{formatCurrency(formData.serviceFees || 0)}</span>
					</div>
				{/if}
				{#if formData.taxes}
					<div class="review-item">
						<span class="review-label">Taxes</span>
						<span class="review-value">{formatCurrency(formData.taxes || 0)}</span>
					</div>
				{/if}
				<div class="review-item full-width">
					<span class="review-label">Total Cost</span>
					<span class="review-value large">
						{formatCurrency(
							(parseFloat(formData.totalCost || 0) +
							parseFloat(formData.cleaningFees || 0) +
							parseFloat(formData.serviceFees || 0) +
							parseFloat(formData.taxes || 0))
						)}
					</span>
				</div>
				<div class="review-item">
					<span class="review-label">Pricing Model</span>
					<span class="review-value">{pricingModelLabels[formData.pricingModel] || formData.pricingModel}</span>
				</div>
				<div class="review-item">
					<span class="review-label">Partial Stay Allowed</span>
					<span class="review-value">{formData.allowPartialStays ? 'Yes' : 'No'}</span>
				</div>
			</div>
		</section>
		
		<!-- Payment Rules -->
		{#if formData.paymentDueDates?.length > 0 || formData.installments || formData.refundPolicy || formData.cancellationCutoff || formData.latePaymentHandling}
			<section class="review-section">
				<h2>Payment Rules</h2>
				<div class="review-grid">
					{#if formData.paymentDueDates?.length > 0}
						<div class="review-item full-width">
							<span class="review-label">Payment Due Dates</span>
							<div class="dates-list">
								{#each formData.paymentDueDates as date}
									<span class="date-badge">{formatDate(date)}</span>
								{/each}
							</div>
						</div>
					{/if}
					<div class="review-item">
						<span class="review-label">Installments</span>
						<span class="review-value">{formData.installments ? 'Allowed' : 'Not allowed'}</span>
					</div>
					{#if formData.refundPolicy}
						<div class="review-item full-width">
							<span class="review-label">Refund Policy</span>
							<p class="review-text">{formData.refundPolicy}</p>
						</div>
					{/if}
					{#if formData.cancellationCutoff}
						<div class="review-item">
							<span class="review-label">Cancellation Cutoff</span>
							<span class="review-value">{formatDate(formData.cancellationCutoff)}</span>
						</div>
					{/if}
					{#if formData.latePaymentHandling}
						<div class="review-item full-width">
							<span class="review-label">Late Payment Handling</span>
							<p class="review-text">{formData.latePaymentHandling}</p>
						</div>
					{/if}
				</div>
			</section>
		{/if}
		
		<!-- RSVP Settings -->
		{#if formData.rsvpDeadline || formData.autoReminders || formData.overbookingAllowed}
			<section class="review-section">
				<h2>RSVP Settings</h2>
				<div class="review-grid">
					{#if formData.rsvpDeadline}
						<div class="review-item">
							<span class="review-label">RSVP Deadline</span>
							<span class="review-value">{formatDate(formData.rsvpDeadline)}</span>
						</div>
					{/if}
					<div class="review-item">
						<span class="review-label">Auto-reminders</span>
						<span class="review-value">{formData.autoReminders ? 'Enabled' : 'Disabled'}</span>
					</div>
					<div class="review-item">
						<span class="review-label">Overbooking Allowed</span>
						<span class="review-value">{formData.overbookingAllowed ? 'Yes' : 'No'}</span>
					</div>
				</div>
			</section>
		{/if}
		
		<!-- House Rules -->
		{#if formData.houseRules || formData.quietHours || formData.petPolicy || formData.smokingPolicy || formData.accessibilityNotes || formData.checkInInstructions || formData.checkOutInstructions}
			<section class="review-section">
				<h2>House Rules</h2>
				<div class="review-grid">
					{#if formData.houseRules}
						<div class="review-item full-width">
							<span class="review-label">House Rules</span>
							<p class="review-text">{formData.houseRules}</p>
						</div>
					{/if}
					{#if formData.quietHours}
						<div class="review-item">
							<span class="review-label">Quiet Hours</span>
							<span class="review-value">{formData.quietHours}</span>
						</div>
					{/if}
					{#if formData.petPolicy}
						<div class="review-item full-width">
							<span class="review-label">Pet Policy</span>
							<p class="review-text">{formData.petPolicy}</p>
						</div>
					{/if}
					{#if formData.smokingPolicy}
						<div class="review-item full-width">
							<span class="review-label">Smoking Policy</span>
							<p class="review-text">{formData.smokingPolicy}</p>
						</div>
					{/if}
					{#if formData.accessibilityNotes}
						<div class="review-item full-width">
							<span class="review-label">Accessibility Notes</span>
							<p class="review-text">{formData.accessibilityNotes}</p>
						</div>
					{/if}
					{#if formData.checkInInstructions}
						<div class="review-item full-width">
							<span class="review-label">Check-in Instructions</span>
							<p class="review-text">{formData.checkInInstructions}</p>
						</div>
					{/if}
					{#if formData.checkOutInstructions}
						<div class="review-item full-width">
							<span class="review-label">Check-out Instructions</span>
							<p class="review-text">{formData.checkOutInstructions}</p>
						</div>
					{/if}
				</div>
			</section>
		{/if}
		
		<!-- Invites -->
		{#if formData.inviteEmails && formData.inviteEmails.length > 0}
			<section class="review-section">
				<h2>Invite People</h2>
				<div class="review-item full-width">
					<span class="review-label">Guest Emails</span>
					<div class="emails-review">
						{#each formData.inviteEmails as email}
							<span class="email-badge">{email}</span>
						{/each}
					</div>
				</div>
				{#if formData.inviteMessage}
					<div class="review-item full-width">
						<span class="review-label">Invite Message</span>
						<p class="review-text">{formData.inviteMessage}</p>
					</div>
				{/if}
			</section>
		{/if}
	</div>
	
	<form method="POST" action="?/create" use:enhance={() => {
		isSubmitting = true;
		return async ({ result, update }) => {
			if (result.type === 'redirect') {
				await goto(result.location);
			}
			isSubmitting = false;
			await update();
		};
	}}>
		<!-- Hidden fields for form submission -->
		<input type="hidden" name="formData" value={JSON.stringify(formData)} />
		
		<div class="step-actions">
			<button type="button" class="btn-secondary" onclick={prevStep} disabled={isSubmitting}>
				Back
			</button>
			<div>
				<button type="button" class="btn-secondary" onclick={() => goto('/trips')} disabled={isSubmitting}>
					Save as Draft
				</button>
				<button type="submit" class="btn-primary" disabled={isSubmitting}>
					{isSubmitting ? 'Publishing...' : 'Publish Trip'}
				</button>
			</div>
		</div>
	</form>
</div>

<style>
	.step-title {
		font-size: 3rem;
		font-weight: 700;
		margin-bottom: 1rem;
		color: #000;
		letter-spacing: -0.02em;
		line-height: 1.1;
	}
	
	.step-subtitle {
		font-size: 1rem;
		color: rgba(0, 0, 0, 0.5);
		margin-bottom: 3rem;
	}
	
	.review-sections {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-2xl);
		margin-bottom: var(--spacing-2xl);
	}
	
	.review-section {
		background: var(--color-bg-light);
		border-radius: var(--radius-lg);
		padding: var(--spacing-xl);
	}
	
	.review-section h2 {
		font-size: 1.5rem;
		margin-bottom: var(--spacing-lg);
		color: var(--color-text);
		border-bottom: 2px solid var(--color-border);
		padding-bottom: var(--spacing-sm);
	}
	
	.review-grid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: var(--spacing-md);
	}
	
	.review-item {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-xs);
	}
	
	.review-item.full-width {
		grid-column: 1 / -1;
	}
	
	.review-label {
		font-size: 0.875rem;
		color: var(--color-text-light);
		font-weight: 500;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}
	
	.review-value {
		font-size: 1.125rem;
		color: var(--color-text);
		font-weight: 500;
	}
	
	.review-value.large {
		font-size: 1.5rem;
		font-weight: 700;
	}
	
	.review-text {
		margin-top: 0.5rem;
		color: var(--color-text);
		line-height: 1.7;
	}
	
	.dates-list {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin-top: 0.5rem;
	}
	
	.date-badge {
		background: rgba(0, 0, 0, 0.05);
		color: rgba(0, 0, 0, 0.8);
		padding: 0.5rem 1rem;
		border-radius: 20px;
		font-size: 0.95rem;
	}
	
	.review-description {
		margin-top: var(--spacing-md);
		padding-top: var(--spacing-md);
		border-top: 1px solid var(--color-border);
	}
	
	.review-description p {
		margin-top: var(--spacing-sm);
		color: var(--color-text);
		line-height: 1.7;
	}
	
	.rooms-review {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-lg);
	}
	
	.room-review-card {
		background: white;
		border: 2px solid var(--color-border);
		border-radius: var(--radius-md);
		padding: var(--spacing-lg);
	}
	
	.room-review-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: var(--spacing-md);
	}
	
	.room-review-header h3 {
		font-size: 1.25rem;
		margin: 0;
	}
	
	.room-type-badge {
		background: var(--color-primary);
		color: white;
		padding: var(--spacing-xs) var(--spacing-md);
		border-radius: var(--radius-md);
		font-size: 0.875rem;
		font-weight: 500;
	}
	
	.room-review-details {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-sm);
	}
	
	.beds-review ul {
		margin: var(--spacing-xs) 0 0 var(--spacing-lg);
		list-style: disc;
	}
	
	.beds-review li {
		margin-bottom: var(--spacing-xs);
	}
	
	.meals-review {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-md);
	}
	
	.meal-review-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: var(--spacing-md);
		background: white;
		border-radius: var(--radius-md);
		border: 1px solid var(--color-border);
	}
	
	.empty-state {
		color: var(--color-text-light);
		font-style: italic;
	}
	
	.emails-review {
		display: flex;
		flex-wrap: wrap;
		gap: var(--spacing-sm);
		margin-top: var(--spacing-sm);
	}
	
	.email-badge {
		background: var(--color-primary);
		color: white;
		padding: var(--spacing-xs) var(--spacing-md);
		border-radius: var(--radius-md);
		font-size: 0.875rem;
	}
	
	.step-actions {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		margin-top: 4rem;
		padding-top: 2rem;
		border-top: 1px solid rgba(0, 0, 0, 0.08);
	}
	
	.step-actions > div {
		display: flex;
		gap: 1rem;
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
	
	.btn-primary:hover:not(:disabled) {
		background: #333;
	}
	
	.btn-primary:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}
	
	.btn-secondary {
		background: transparent;
		color: rgba(0, 0, 0, 0.6);
	}
	
	.btn-secondary:hover:not(:disabled) {
		color: rgba(0, 0, 0, 0.8);
	}
	
	.btn-secondary:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}
	
	@media (max-width: 768px) {
		.review-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
