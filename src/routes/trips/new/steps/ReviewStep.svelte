<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	
	interface Props {
		formData: any;
		prevStep: () => void;
	}
	
	let { formData, prevStep }: Props = $props();
	
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
	<h1 class="step-title">Review & Create</h1>
	<p class="step-subtitle">Review your trip details before creating</p>
	
	<div class="review-sections">
		<!-- Overview -->
		<section class="review-section">
			<h2>Overview</h2>
			<div class="review-grid">
				<div class="review-item">
					<span class="review-label">Trip Title</span>
					<span class="review-value">{formData.name || 'Not set'}</span>
				</div>
				<div class="review-item">
					<span class="review-label">Location</span>
					<span class="review-value">{formData.location || 'Not set'}</span>
				</div>
				<div class="review-item">
					<span class="review-label">Start Date</span>
					<span class="review-value">{formatDate(formData.checkInDate)}</span>
				</div>
				<div class="review-item">
					<span class="review-label">End Date</span>
					<span class="review-value">{formatDate(formData.checkOutDate)}</span>
				</div>
				<div class="review-item">
					<span class="review-label">Max Guests</span>
					<span class="review-value">{formData.maxGuests || 'Not set'}</span>
				</div>
				<div class="review-item">
					<span class="review-label">Total Cost</span>
					<span class="review-value">{formatCurrency(formData.totalCost || 0)}</span>
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
		
		<!-- Pricing -->
		<section class="review-section">
			<h2>Pricing</h2>
			<div class="review-grid">
				<div class="review-item">
					<span class="review-label">Pricing Model</span>
					<span class="review-value">{pricingModelLabels[formData.pricingModel] || formData.pricingModel}</span>
				</div>
				<div class="review-item">
					<span class="review-label">RSVP By</span>
					<span class="review-value">{formatDate(formData.rsvpByDate)}</span>
				</div>
				<div class="review-item">
					<span class="review-label">Allow Partial Stays</span>
					<span class="review-value">{formData.allowPartialStays ? 'Yes' : 'No'}</span>
				</div>
				<div class="review-item">
					<span class="review-label">Round Up</span>
					<span class="review-value">{formData.roundUp ? 'Yes' : 'No'}</span>
				</div>
			</div>
		</section>
		
		<!-- Meals -->
		{#if formData.enableMeals}
			<section class="review-section">
				<h2>Meals</h2>
				{#if formData.meals && formData.meals.length > 0}
					<div class="meals-review">
						{#each formData.meals as meal}
							<div class="meal-review-item">
								<strong>{meal.name || 'Unnamed Meal'}</strong>
								<span>{formatDate(meal.date)}</span>
								{#if meal.cost > 0}
									<span>{formatCurrency(meal.cost)}</span>
								{/if}
							</div>
						{/each}
					</div>
				{:else}
					<p class="empty-state">No meals added yet</p>
				{/if}
			</section>
		{/if}
		
		<!-- Invites -->
		<section class="review-section">
			<h2>Invites</h2>
			<div class="review-grid">
				<div class="review-item">
					<span class="review-label">Send Invites</span>
					<span class="review-value">
						{formData.inviteNow === 'true' || formData.inviteNow === true ? 'Now' : 'Later'}
					</span>
				</div>
				{#if (formData.inviteNow === 'true' || formData.inviteNow === true) && formData.inviteEmails && formData.inviteEmails.length > 0}
					<div class="review-item full-width">
						<span class="review-label">Guest Emails</span>
						<div class="emails-review">
							{#each formData.inviteEmails as email}
								<span class="email-badge">{email}</span>
							{/each}
						</div>
					</div>
				{/if}
			</div>
		</section>
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
			<button type="button" class="btn btn-secondary" onclick={prevStep} disabled={isSubmitting}>
				← Back
			</button>
			<button type="submit" class="btn btn-primary btn-large" disabled={isSubmitting}>
				{isSubmitting ? 'Creating...' : 'Create Trip'}
			</button>
		</div>
	</form>
</div>

<style>
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
	
	@media (max-width: 768px) {
		.review-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
