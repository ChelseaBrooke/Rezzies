<script lang="ts">
	import SectionCard from '$lib/components/wizard/SectionCard.svelte';
	import type { TripDraft, MealsConfig } from '$lib/stores/tripDraft.js';
	
	let { draft }: { draft: TripDraft } = $props();
	
	const mealsConfig = $derived(
		draft.meals && typeof draft.meals === 'object' && 'enabled' in draft.meals ? (draft.meals as MealsConfig) : null
	);
	
	const numberOfNights = $derived(() => {
		if (!draft.checkInDate || !draft.checkOutDate) return 0;
		const checkIn = new Date(draft.checkInDate);
		const checkOut = new Date(draft.checkOutDate);
		const diffTime = checkOut.getTime() - checkIn.getTime();
		const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
		return diffDays > 0 ? diffDays : 0;
	});
	
	const validationErrors = $derived(() => {
		const errors: string[] = [];
		if (!draft.name) errors.push('Trip name is required');
		if (!draft.checkInDate) errors.push('Check-in date is required');
		if (!draft.checkOutDate) errors.push('Check-out date is required');
		if (!draft.coverPhoto) errors.push('Cover photo is required');
		if (draft.rooms.length === 0) errors.push('At least one room is required');
		if (!draft.totalTripCost) errors.push('Total trip cost is required');
		return errors;
	});
</script>

<div class="step-content">
	{#if validationErrors().length > 0}
		<SectionCard title="Validation Errors" icon="⚠️">
			<div class="errors-list">
				{#each validationErrors() as error}
					<div class="error-item">{error}</div>
				{/each}
			</div>
		</SectionCard>
	{/if}
	
	<SectionCard title="Trip Summary" icon="📋">
		<div class="summary-grid">
			<div class="summary-item">
				<span class="summary-label">Trip Name:</span>
				<span class="summary-value">{draft.name || 'Not set'}</span>
			</div>
			<div class="summary-item">
				<span class="summary-label">Destination:</span>
				<span class="summary-value">
					{draft.destinationCity || ''} {draft.destinationState || ''} {draft.destinationCountry || ''}
				</span>
			</div>
			<div class="summary-item">
				<span class="summary-label">Dates:</span>
				<span class="summary-value">
					{draft.checkInDate ? new Date(draft.checkInDate).toLocaleDateString() : 'Not set'} - 
					{draft.checkOutDate ? new Date(draft.checkOutDate).toLocaleDateString() : 'Not set'}
					{#if numberOfNights() > 0}
						({numberOfNights()} night{numberOfNights() !== 1 ? 's' : ''})
					{/if}
				</span>
			</div>
			<div class="summary-item">
				<span class="summary-label">Property:</span>
				<span class="summary-value">
					{draft.bedrooms || 0} bedrooms, {draft.bathrooms || 0} bathrooms, 
					Max occupancy: {draft.maxOccupancy || 0}
				</span>
			</div>
			<div class="summary-item">
				<span class="summary-label">Rooms:</span>
				<span class="summary-value">{draft.rooms.length} room{draft.rooms.length !== 1 ? 's' : ''}</span>
			</div>
			<div class="summary-item">
				<span class="summary-label">Total Cost:</span>
				<span class="summary-value">
					${draft.totalTripCost ? parseFloat(draft.totalTripCost).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
				</span>
			</div>
			<div class="summary-item">
				<span class="summary-label">Pricing Model:</span>
				<span class="summary-value">{draft.pricingModel} ({draft.pricingType})</span>
			</div>
			{#if mealsConfig?.enabled}
				<div class="summary-item">
					<span class="summary-label">Meals:</span>
					<span class="summary-value">Enabled</span>
				</div>
			{/if}
			{#if draft.activities && draft.activities.length > 0}
				<div class="summary-item">
					<span class="summary-label">Activities:</span>
					<span class="summary-value">{draft.activities.length} activit{draft.activities.length !== 1 ? 'ies' : 'y'}</span>
				</div>
			{/if}
		</div>
	</SectionCard>
	
	{#if draft.description}
		<SectionCard title="Description" icon="📝">
			<p class="description-text">{draft.description}</p>
		</SectionCard>
	{/if}
	
	{#if draft.rooms.length > 0}
		<SectionCard title="Rooms" icon="🛏️">
			<div class="rooms-summary">
				{#each draft.rooms as room}
					<div class="room-summary-item">
						<h4>{room.name || 'Unnamed Room'}</h4>
						<p>Type: {room.type}, Max Occupants: {room.maxOccupants}</p>
						{#if room.beds.length > 0}
							<p>Beds: {room.beds.map(b => `${b.count}x ${b.bedType}`).join(', ')}</p>
						{/if}
					</div>
				{/each}
			</div>
		</SectionCard>
	{/if}
	
	{#if mealsConfig?.enabled}
		<SectionCard title="Meals" icon="🍽️">
			<div class="meals-summary">
				<div class="meal-summary-modes">
					{#if mealsConfig.modes?.signups}
						<span class="mode-tag">Meal sign-ups</span>
					{/if}
					{#if mealsConfig.modes?.fund}
						<span class="mode-tag">Shared food fund</span>
					{/if}
					{#if mealsConfig.modes?.informal}
						<span class="mode-tag">Informal</span>
					{/if}
				</div>
				{#if mealsConfig.modes?.signups && mealsConfig.signupConfig?.slots?.length}
					<p class="summary-line"><strong>Sign-up slots:</strong> {mealsConfig.signupConfig.slots.length}</p>
				{/if}
				{#if mealsConfig.modes?.fund && mealsConfig.fundConfig}
					{#if mealsConfig.fundConfig.suggestedContributionPerPerson != null}
						<p class="summary-line"><strong>Contribution per person:</strong> ${Number(mealsConfig.fundConfig.suggestedContributionPerPerson).toFixed(2)}</p>
					{/if}
					{#if mealsConfig.fundConfig.notes}
						<p class="summary-line notes">{mealsConfig.fundConfig.notes}</p>
					{/if}
				{/if}
				{#if mealsConfig.modes?.informal && mealsConfig.informalConfig?.notes}
					<p class="summary-line notes">{mealsConfig.informalConfig.notes}</p>
				{/if}
			</div>
		</SectionCard>
	{/if}
	
	{#if draft.activities && draft.activities.length > 0}
		<SectionCard title="Activities" icon="🎯">
			<div class="activities-summary">
				{#each draft.activities as activity}
					<div class="activity-summary-item">
						<h4>{activity.name || 'Unnamed Activity'}</h4>
						{#if activity.date}
							<p>Date: {new Date(activity.date).toLocaleDateString()}</p>
						{/if}
						{#if activity.time}
							<p>Time: {activity.time}</p>
						{/if}
						{#if activity.price}
							<p>Price: ${parseFloat(activity.price || '0').toFixed(2)}</p>
						{/if}
						{#if activity.description}
							<p>{activity.description}</p>
						{/if}
					</div>
				{/each}
			</div>
		</SectionCard>
	{/if}
</div>

<style>
	.step-content {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}
	
	.errors-list {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}
	
	.error-item {
		padding: 0.75rem 1rem;
		background: rgba(239, 68, 68, 0.1);
		color: #ef4444;
		border-radius: 0.5rem;
		font-size: 0.9375rem;
	}
	
	.summary-grid {
		display: grid;
		grid-template-columns: repeat(1, 1fr);
		gap: 1rem;
	}
	
	@media (min-width: 768px) {
		.summary-grid {
			grid-template-columns: repeat(2, 1fr);
		}
	}
	
	.summary-item {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		padding: 0.75rem;
		background: rgba(30, 58, 138, 0.02);
		border-radius: 0.5rem;
	}
	
	.summary-label {
		font-size: 0.875rem;
		color: var(--muted);
		font-weight: 500;
	}
	
	.summary-value {
		font-size: 0.9375rem;
		color: var(--text);
	}
	
	.description-text {
		color: var(--text);
		line-height: 1.6;
		white-space: pre-wrap;
	}
	
	.rooms-summary,
	.meals-summary,
	.activities-summary {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}
	
	.meal-summary-modes {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin-bottom: 0.5rem;
	}
	
	.mode-tag {
		font-size: 0.8125rem;
		padding: 0.25rem 0.5rem;
		background: rgba(30, 58, 138, 0.1);
		color: var(--primary);
		border-radius: 0.25rem;
		font-weight: 500;
	}
	
	.summary-line {
		font-size: 0.875rem;
		color: var(--text);
		margin: 0.25rem 0;
	}
	
	.summary-line.notes {
		color: var(--muted);
		font-style: italic;
	}
	
	.room-summary-item,
	.meal-summary-item,
	.activity-summary-item {
		padding: 1rem;
		background: rgba(30, 58, 138, 0.02);
		border-radius: 0.5rem;
		border: 1px solid var(--border);
	}
	
	.room-summary-item h4,
	.meal-summary-item h4,
	.activity-summary-item h4 {
		font-size: 1rem;
		font-weight: 600;
		color: var(--text);
		margin: 0 0 0.5rem 0;
	}
	
	.room-summary-item p,
	.meal-summary-item p,
	.activity-summary-item p {
		font-size: 0.875rem;
		color: var(--muted);
		margin: 0.25rem 0;
	}
</style>
