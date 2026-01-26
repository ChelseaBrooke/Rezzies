<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import type { PageData } from './$types';

	let { data, form }: { data: PageData; form: any } = $props();
	
	let activeTab = $state('rsvp');
</script>

<div class="rsvp-page">
	<div class="container">
		<div class="page-header">
			<h1>RSVP & Trip Details</h1>
			<a href="/trips/{data.trip.id}" class="btn btn-secondary">← Back to Trip</a>
		</div>

		<div class="tabs">
			<button 
				class="tab {activeTab === 'rsvp' ? 'active' : ''}"
				onclick={() => activeTab = 'rsvp'}
			>
				RSVP
			</button>
			<button 
				class="tab {activeTab === 'room' ? 'active' : ''}"
				onclick={() => activeTab = 'room'}
			>
				Room Selection
			</button>
			<button 
				class="tab {activeTab === 'activities' ? 'active' : ''}"
				onclick={() => activeTab = 'activities'}
			>
				Activities
			</button>
			<button 
				class="tab {activeTab === 'extras' ? 'active' : ''}"
				onclick={() => activeTab = 'extras'}
			>
				Extras
			</button>
			<button 
				class="tab {activeTab === 'profile' ? 'active' : ''}"
				onclick={() => activeTab = 'profile'}
			>
				Guest Info
			</button>
		</div>

		<div class="tab-content">
			{#if activeTab === 'rsvp'}
				<section class="rsvp-section">
					<h2>RSVP</h2>
					{#if form?.success}
						<div class="success-message">RSVP updated!</div>
					{/if}
					<form method="POST" action="?/updateRsvp" use:enhance>
						<div class="form-group">
							<label for="status">Will you be attending?</label>
							<select id="status" name="status" required>
								<option value="yes" selected={data.currentRsvp?.status === 'yes'}>Yes</option>
								<option value="maybe" selected={data.currentRsvp?.status === 'maybe'}>Maybe</option>
								<option value="no" selected={data.currentRsvp?.status === 'no'}>No</option>
							</select>
						</div>
						<div class="form-group">
							<label for="arrivalDatetime">Arrival Date & Time</label>
							<input 
								type="datetime-local" 
								id="arrivalDatetime" 
								name="arrivalDatetime"
								value={data.currentRsvp?.arrivalDatetime ? new Date(data.currentRsvp.arrivalDatetime).toISOString().slice(0, 16) : ''}
							/>
						</div>
						<div class="form-group">
							<label for="departureDatetime">Departure Date & Time</label>
							<input 
								type="datetime-local" 
								id="departureDatetime" 
								name="departureDatetime"
								value={data.currentRsvp?.departureDatetime ? new Date(data.currentRsvp.departureDatetime).toISOString().slice(0, 16) : ''}
							/>
						</div>
						<div class="form-row">
							<div class="form-group">
								<label for="adultsCount">Adults</label>
								<input type="number" id="adultsCount" name="adultsCount" value={data.currentRsvp?.adultsCount || 1} min="1" required />
							</div>
							<div class="form-group">
								<label for="kidsCount">Kids</label>
								<input type="number" id="kidsCount" name="kidsCount" value={data.currentRsvp?.kidsCount || 0} min="0" />
							</div>
							<div class="form-group">
								<label for="petsCount">Pets</label>
								<input type="number" id="petsCount" name="petsCount" value={data.currentRsvp?.petsCount || 0} min="0" />
							</div>
						</div>
						<div class="form-group">
							<label for="notes">Notes</label>
							<textarea id="notes" name="notes">{data.currentRsvp?.notes || ''}</textarea>
						</div>
						<button type="submit" class="btn btn-primary">Save RSVP</button>
					</form>
				</section>
			{:else if activeTab === 'room'}
				<section class="rsvp-section">
					<h2>Select Your Room</h2>
					{#if data.trip.rooms.length === 0}
						<p>No rooms available yet. The host will add rooms soon.</p>
					{:else}
						<div class="rooms-grid">
							{#each data.trip.rooms as room}
								<div class="room-card {data.currentRoomAssignment?.roomId === room.id ? 'selected' : ''}">
									<h3>{room.name}</h3>
									{#if room.description}
										<p>{room.description}</p>
									{/if}
									<div class="beds-list">
										{#each room.beds as bed}
											<span class="bed-badge">{bed.bedType} ({bed.capacitySlots} slots)</span>
										{/each}
									</div>
									<form method="POST" action="?/selectRoom" use:enhance>
										<input type="hidden" name="roomId" value={room.id} />
										<button type="submit" class="btn btn-sm {data.currentRoomAssignment?.roomId === room.id ? 'btn-secondary' : 'btn-primary'}">
											{data.currentRoomAssignment?.roomId === room.id ? 'Selected' : 'Select Room'}
										</button>
									</form>
								</div>
							{/each}
						</div>
					{/if}
				</section>
			{:else if activeTab === 'activities'}
				<section class="rsvp-section">
					<h2>Activities</h2>
					{#if data.trip.activities.length === 0}
						<p>No activities planned yet.</p>
					{:else}
						<div class="activities-list">
							{#each data.trip.activities as activity}
								{@const isParticipating = activity.participants.length > 0}
								<div class="activity-card {isParticipating ? 'participating' : ''}">
									<div class="activity-info">
										<h3>{activity.title}</h3>
										<p>{activity.date.toLocaleDateString()}</p>
										{#if activity.time}
											<p>{activity.time}</p>
										{/if}
										{#if activity.location}
											<p>📍 {activity.location}</p>
										{/if}
										{#if activity.pricePerPerson > 0}
											<p><strong>${activity.pricePerPerson} per person</strong></p>
										{/if}
									</div>
									<form method="POST" action="?/toggleActivity" use:enhance>
										<input type="hidden" name="activityId" value={activity.id} />
										<input type="hidden" name="status" value={isParticipating ? 'out' : 'in'} />
										<button type="submit" class="btn btn-sm {isParticipating ? 'btn-secondary' : 'btn-primary'}">
											{isParticipating ? 'Opt Out' : 'Join'}
										</button>
									</form>
								</div>
							{/each}
						</div>
					{/if}
				</section>
			{:else if activeTab === 'extras'}
				<section class="rsvp-section">
					<h2>Extra Costs</h2>
					{#if data.trip.extraCostRules.length === 0}
						<p>No extra costs configured.</p>
					{:else}
						<div class="extras-list">
							{#each data.trip.extraCostRules as rule}
								<div class="extra-card">
									<div class="extra-info">
										<h3>{rule.label}</h3>
										<p>${rule.amount} ({rule.type})</p>
									</div>
									<form method="POST" action="?/selectExtra" use:enhance>
										<input type="hidden" name="ruleId" value={rule.id} />
										<input type="number" name="quantity" value="0" min="0" class="quantity-input" />
										<button type="submit" class="btn btn-sm btn-primary">Add</button>
									</form>
								</div>
							{/each}
						</div>
					{/if}
				</section>
			{:else if activeTab === 'profile'}
				<section class="rsvp-section">
					<h2>Guest Information</h2>
					{#if form?.success}
						<div class="success-message">Profile updated!</div>
					{/if}
					<form method="POST" action="?/updateProfile" use:enhance>
						<div class="form-group">
							<label for="dietaryRestrictions">Dietary Restrictions</label>
							<textarea id="dietaryRestrictions" name="dietaryRestrictions">{data.currentProfile?.dietaryRestrictions || ''}</textarea>
						</div>
						<div class="form-group">
							<label for="allergies">Allergies</label>
							<textarea id="allergies" name="allergies">{data.currentProfile?.allergies || ''}</textarea>
						</div>
						<div class="form-group">
							<label for="phone">Phone Number</label>
							<input type="tel" id="phone" name="phone" value={data.currentProfile?.phone || ''} />
						</div>
						<div class="form-group">
							<label for="emergencyContact">Emergency Contact</label>
							<input type="text" id="emergencyContact" name="emergencyContact" value={data.currentProfile?.emergencyContact || ''} />
						</div>
						<button type="submit" class="btn btn-primary">Save Profile</button>
					</form>
				</section>
			{/if}
		</div>
	</div>
</div>

<style>
	.rsvp-page {
		min-height: calc(100vh - 80px);
		padding: var(--spacing-xl) var(--spacing-md);
	}

	.container {
		max-width: 1000px;
		margin: 0 auto;
	}

	.page-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: var(--spacing-xl);
	}

	.tabs {
		display: flex;
		gap: var(--spacing-sm);
		border-bottom: 2px solid var(--color-border);
		margin-bottom: var(--spacing-xl);
		overflow-x: auto;
	}

	.tab {
		padding: var(--spacing-md) var(--spacing-lg);
		background: none;
		border: none;
		border-bottom: 2px solid transparent;
		cursor: pointer;
		font-size: 1rem;
		color: var(--color-text-light);
		transition: all 0.2s;
		white-space: nowrap;
	}

	.tab:hover {
		color: var(--color-text);
	}

	.tab.active {
		color: var(--color-primary);
		border-bottom-color: var(--color-primary);
	}

	.tab-content {
		background: white;
		padding: var(--spacing-xl);
		border-radius: var(--radius-md);
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
	}

	.rsvp-section h2 {
		margin: 0 0 var(--spacing-lg) 0;
	}

	.form-group {
		margin-bottom: var(--spacing-md);
	}

	.form-group label {
		display: block;
		margin-bottom: var(--spacing-xs);
		font-weight: 500;
	}

	.form-group input,
	.form-group select,
	.form-group textarea {
		width: 100%;
		padding: var(--spacing-sm);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		font-size: 1rem;
	}

	.form-row {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
		gap: var(--spacing-md);
	}

	.rooms-grid,
	.activities-list,
	.extras-list {
		display: grid;
		gap: var(--spacing-md);
	}

	.room-card,
	.activity-card,
	.extra-card {
		padding: var(--spacing-md);
		border: 2px solid var(--color-border);
		border-radius: var(--radius-sm);
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: var(--spacing-md);
	}

	.room-card.selected,
	.activity-card.participating {
		border-color: var(--color-primary);
		background: rgba(102, 126, 234, 0.05);
	}

	.beds-list {
		display: flex;
		gap: var(--spacing-xs);
		flex-wrap: wrap;
		margin: var(--spacing-sm) 0;
	}

	.bed-badge {
		background: var(--color-bg-light);
		padding: 0.25rem 0.5rem;
		border-radius: var(--radius-sm);
		font-size: 0.875rem;
	}

	.activity-info,
	.extra-info {
		flex: 1;
	}

	.quantity-input {
		width: 80px;
		margin-right: var(--spacing-sm);
	}

	.success-message {
		background: rgba(34, 197, 94, 0.1);
		color: #16a34a;
		padding: var(--spacing-sm);
		border-radius: var(--radius-sm);
		margin-bottom: var(--spacing-md);
		border-left: 3px solid #16a34a;
	}

	.btn-sm {
		padding: var(--spacing-xs) var(--spacing-md);
		font-size: 0.875rem;
	}
</style>
