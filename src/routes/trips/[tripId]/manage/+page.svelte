<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageData } from './$types';

	let { data, form }: { data: PageData; form: any } = $props();
	
	let activeTab = $state('details');
	let showInviteModal = $state(false);
	let inviteEmail = $state('');
	let invitePhone = $state('');
	let inviteChannel = $state('email');
</script>

<div class="manage-page">
	<div class="container">
		<div class="page-header">
			<h1>Manage Trip: {data.trip.name}</h1>
			<a href="/trips/{data.trip.id}" class="btn btn-secondary">← Back to Trip</a>
		</div>

		<div class="tabs">
			<button 
				class="tab {activeTab === 'details' ? 'active' : ''}"
				onclick={() => activeTab = 'details'}
			>
				Trip Details
			</button>
			<button 
				class="tab {activeTab === 'rooms' ? 'active' : ''}"
				onclick={() => activeTab = 'rooms'}
			>
				Rooms & Pricing
			</button>
			<button 
				class="tab {activeTab === 'meals' ? 'active' : ''}"
				onclick={() => activeTab = 'meals'}
			>
				Meals
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
				class="tab {activeTab === 'invites' ? 'active' : ''}"
				onclick={() => activeTab = 'invites'}
			>
				Invites
			</button>
			<button 
				class="tab {activeTab === 'members' ? 'active' : ''}"
				onclick={() => activeTab = 'members'}
			>
				Members
			</button>
		</div>

		<div class="tab-content">
			{#if activeTab === 'details'}
				<section class="manage-section">
					<h2>Trip Details</h2>
					<form method="POST" action="?/updateTrip" use:enhance>
						<div class="form-group">
							<label for="name">Trip Name</label>
							<input type="text" id="name" name="name" value={data.trip.name} required />
						</div>
						<div class="form-group">
							<label for="description">Description</label>
							<textarea id="description" name="description">{data.trip.description || ''}</textarea>
						</div>
						<div class="form-group">
							<label for="location">Location</label>
							<input type="text" id="location" name="location" value={data.trip.location || ''} />
						</div>
						<div class="form-group">
							<label>
								<input type="checkbox" name="isPublished" value="true" checked={data.trip.isPublished} />
								Published (visible to guests)
							</label>
						</div>
						<button type="submit" class="btn btn-primary">Save Changes</button>
					</form>
				</section>
			{:else if activeTab === 'rooms'}
				<section class="manage-section">
					<h2>Rooms & Pricing</h2>
					<a href="/admin/trips/{data.trip.id}/rooms" class="btn btn-primary">Manage Rooms</a>
					<p class="help-text">Configure rooms, beds, and pricing model</p>
				</section>
			{:else if activeTab === 'meals'}
				<section class="manage-section">
					<h2>Meal Plan</h2>
					{#if data.trip.mealPlan}
						<div class="meal-plan-status">
							<p>Meal plan is <strong>{data.trip.mealPlan.enabled ? 'enabled' : 'disabled'}</strong></p>
							<p>Mode: {data.trip.mealPlan.mode}</p>
						</div>
					{:else}
						<p>No meal plan configured yet.</p>
						<form method="POST" action="?/createMealPlan" use:enhance>
							<button type="submit" class="btn btn-primary">Enable Meal Plan</button>
						</form>
					{/if}

					<div class="meal-slots-section">
						<h3>Meal Slots</h3>
						{#if data.trip.mealSlots.length > 0}
							<div class="meal-slots-list">
								{#each data.trip.mealSlots as slot}
									<div class="meal-slot-card">
										<h4>{slot.mealType.charAt(0).toUpperCase() + slot.mealType.slice(1)}</h4>
										<p>{slot.date.toLocaleDateString()}</p>
										{#if slot.time}
											<p>{slot.time}</p>
										{/if}
										{#if slot.assignedUser}
											<p>Assigned to: {slot.assignedUser.name}</p>
										{/if}
									</div>
								{/each}
							</div>
						{/if}

						<form method="POST" action="?/createMealSlot" use:enhance class="meal-slot-form">
							<h4>Add Meal Slot</h4>
							<div class="form-group">
								<label for="mealType">Meal Type</label>
								<select id="mealType" name="mealType" required>
									<option value="breakfast">Breakfast</option>
									<option value="lunch">Lunch</option>
									<option value="dinner">Dinner</option>
									<option value="snack">Snack</option>
								</select>
							</div>
							<div class="form-group">
								<label for="date">Date</label>
								<input type="date" id="date" name="date" required />
							</div>
							<div class="form-group">
								<label for="time">Time (optional)</label>
								<input type="time" id="time" name="time" />
							</div>
							<div class="form-group">
								<label for="menuText">Menu (optional)</label>
								<textarea id="menuText" name="menuText"></textarea>
							</div>
							<button type="submit" class="btn btn-primary">Add Meal Slot</button>
						</form>
					</div>
				</section>
			{:else if activeTab === 'activities'}
				<section class="manage-section">
					<h2>Activities</h2>
					{#if data.trip.activities.length > 0}
						<div class="activities-list">
							{#each data.trip.activities as activity}
								<div class="activity-card">
									<h3>{activity.title}</h3>
									<p>{activity.date.toLocaleDateString()}</p>
									{#if activity.time}
										<p>{activity.time}</p>
									{/if}
									{#if activity.location}
										<p>📍 {activity.location}</p>
									{/if}
									<p><strong>${activity.pricePerPerson}</strong> per person</p>
									<p>{activity.participants.length} participant{activity.participants.length !== 1 ? 's' : ''}</p>
								</div>
							{/each}
						</div>
					{:else}
						<p>No activities added yet.</p>
					{/if}

					<form method="POST" action="?/createActivity" use:enhance class="activity-form">
						<h3>Add Activity</h3>
						<div class="form-group">
							<label for="activityTitle">Title</label>
							<input type="text" id="activityTitle" name="title" required />
						</div>
						<div class="form-group">
							<label for="activityDate">Date</label>
							<input type="date" id="activityDate" name="date" required />
						</div>
						<div class="form-group">
							<label for="activityTime">Time (optional)</label>
							<input type="time" id="activityTime" name="time" />
						</div>
						<div class="form-group">
							<label for="activityLocation">Location (optional)</label>
							<input type="text" id="activityLocation" name="location" />
						</div>
						<div class="form-group">
							<label for="activityPrice">Price per Person</label>
							<input type="number" id="activityPrice" name="pricePerPerson" step="0.01" min="0" value="0" />
						</div>
						<div class="form-group">
							<label for="activityMaxParticipants">Max Participants (optional)</label>
							<input type="number" id="activityMaxParticipants" name="maxParticipants" min="1" />
						</div>
						<div class="form-group">
							<label for="activityNotes">Notes (optional)</label>
							<textarea id="activityNotes" name="notes"></textarea>
						</div>
						<button type="submit" class="btn btn-primary">Add Activity</button>
					</form>
				</section>
			{:else if activeTab === 'extras'}
				<section class="manage-section">
					<h2>Extra Costs</h2>
					{#if data.trip.extraCostRules.length > 0}
						<div class="extras-list">
							{#each data.trip.extraCostRules as rule}
								<div class="extra-card">
									<h3>{rule.label}</h3>
									<p>${rule.amount} ({rule.type})</p>
								</div>
							{/each}
						</div>
					{:else}
						<p>No extra costs configured yet.</p>
					{/if}

					<form method="POST" action="?/createExtraCost" use:enhance class="extra-cost-form">
						<h3>Add Extra Cost</h3>
						<div class="form-group">
							<label for="extraLabel">Label</label>
							<input type="text" id="extraLabel" name="label" placeholder="e.g., Pet Fee" required />
						</div>
						<div class="form-group">
							<label for="extraAmount">Amount</label>
							<input type="number" id="extraAmount" name="amount" step="0.01" min="0" required />
						</div>
						<div class="form-group">
							<label for="extraType">Type</label>
							<select id="extraType" name="type" required>
								<option value="flat">Flat Rate</option>
								<option value="per_pet">Per Pet</option>
								<option value="per_night">Per Night</option>
							</select>
						</div>
						<button type="submit" class="btn btn-primary">Add Extra Cost</button>
					</form>
				</section>
			{:else if activeTab === 'invites'}
				<section class="manage-section">
					<h2>Invites</h2>
					<button class="btn btn-primary" onclick={() => showInviteModal = true}>Send Invite</button>
					
					{#if showInviteModal}
						<div class="modal-overlay" onclick={() => showInviteModal = false}>
							<div class="modal" onclick={(e) => e.stopPropagation()}>
								<h3>Send Invite</h3>
								<form method="POST" action="?/createInvite" use:enhance>
									<div class="form-group">
										<label for="channel">Invite Method</label>
										<select id="channel" name="channel" bind:value={inviteChannel}>
											<option value="email">Email</option>
											<option value="sms">SMS</option>
											<option value="app">App (Divvi user)</option>
										</select>
									</div>
									{#if inviteChannel === 'email'}
										<div class="form-group">
											<label for="email">Email Address</label>
											<input type="email" id="email" name="email" bind:value={inviteEmail} required />
										</div>
									{:else if inviteChannel === 'sms'}
										<div class="form-group">
											<label for="phone">Phone Number</label>
											<input type="tel" id="phone" name="phone" bind:value={invitePhone} required />
										</div>
									{/if}
									<div class="modal-actions">
										<button type="button" class="btn btn-secondary" onclick={() => showInviteModal = false}>Cancel</button>
										<button type="submit" class="btn btn-primary">Send Invite</button>
									</div>
								</form>
							</div>
						</div>
					{/if}

					<div class="invites-list">
						{#each data.trip.invites as invite}
							<div class="invite-card">
								<p><strong>Status:</strong> {invite.status}</p>
								<p><strong>Channel:</strong> {invite.channel}</p>
								{#if invite.recipientEmail}
									<p><strong>Email:</strong> {invite.recipientEmail}</p>
								{/if}
								{#if invite.recipientPhone}
									<p><strong>Phone:</strong> {invite.recipientPhone}</p>
								{/if}
								<p><strong>Token:</strong> <code>{invite.token}</code></p>
							</div>
						{/each}
					</div>
				</section>
			{:else if activeTab === 'members'}
				<section class="manage-section">
					<h2>Members</h2>
					<div class="members-list">
						{#each data.trip.members as member}
							<div class="member-card">
								<div class="member-info">
									<p><strong>{member.user.name || member.user.email}</strong></p>
									<p>Role: {member.role} | Status: {member.inviteStatus}</p>
								</div>
							</div>
						{/each}
					</div>
				</section>
			{/if}
		</div>
	</div>
</div>

<style>
	.manage-page {
		min-height: calc(100vh - 80px);
		padding: var(--spacing-xl) var(--spacing-md);
	}

	.container {
		max-width: 1200px;
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

	.manage-section h2 {
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
	.form-group textarea,
	.form-group select {
		width: 100%;
		padding: var(--spacing-sm);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		font-size: 1rem;
	}

	.help-text {
		color: var(--color-text-light);
		margin-top: var(--spacing-sm);
	}

	.modal-overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.5);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
	}

	.modal {
		background: white;
		padding: var(--spacing-xl);
		border-radius: var(--radius-md);
		max-width: 500px;
		width: 90%;
	}

	.modal-actions {
		display: flex;
		gap: var(--spacing-md);
		justify-content: flex-end;
		margin-top: var(--spacing-lg);
	}

	.invites-list,
	.members-list,
	.activities-list,
	.extras-list {
		display: grid;
		gap: var(--spacing-md);
		margin-top: var(--spacing-lg);
	}

	.invite-card,
	.member-card,
	.activity-card,
	.extra-card {
		padding: var(--spacing-md);
		background: var(--color-bg-light);
		border-radius: var(--radius-sm);
	}

	code {
		background: var(--color-bg);
		padding: 0.25rem 0.5rem;
		border-radius: var(--radius-sm);
		font-family: monospace;
		font-size: 0.875rem;
	}
</style>
