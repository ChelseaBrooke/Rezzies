<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageData } from './$types';

	let { data, form }: { data: PageData; form: any } = $props();
	
	let activeTab = $state('profile');
</script>

<div class="settings-page">
	<div class="container">
		<div class="page-header">
			<h1>Settings</h1>
		</div>

		<div class="tabs">
			<button 
				class="tab {activeTab === 'profile' ? 'active' : ''}"
				onclick={() => activeTab = 'profile'}
			>
				Profile
			</button>
			<button 
				class="tab {activeTab === 'password' ? 'active' : ''}"
				onclick={() => activeTab = 'password'}
			>
				Password
			</button>
			<button 
				class="tab {activeTab === 'notifications' ? 'active' : ''}"
				onclick={() => activeTab = 'notifications'}
			>
				Notifications
			</button>
		</div>

		<div class="tab-content">
			{#if activeTab === 'profile'}
				<section class="settings-section">
					<h2>Profile Information</h2>
					{#if form?.success}
						<div class="success-message">Profile updated successfully!</div>
					{/if}
					{#if form?.error}
						<div class="error-message">{form.error}</div>
					{/if}
					<form method="POST" action="?/updateProfile" use:enhance>
						<div class="form-group">
							<label for="email">Email</label>
							<input type="email" id="email" value={data.user?.email} disabled />
							<small>Email cannot be changed</small>
						</div>
						<div class="form-group">
							<label for="name">Name</label>
							<input type="text" id="name" name="name" value={data.user?.name || ''} />
						</div>
						<div class="form-group">
							<label for="phone">Phone</label>
							<input type="tel" id="phone" name="phone" value={data.user?.phone || ''} />
							<small>Used for SMS invites</small>
						</div>
						<button type="submit" class="btn btn-primary">Save Changes</button>
					</form>
				</section>
			{:else if activeTab === 'password'}
				<section class="settings-section">
					<h2>Change Password</h2>
					{#if form?.success}
						<div class="success-message">Password changed successfully!</div>
					{/if}
					{#if form?.error}
						<div class="error-message">{form.error}</div>
					{/if}
					<form method="POST" action="?/changePassword" use:enhance>
						<div class="form-group">
							<label for="currentPassword">Current Password</label>
							<input type="password" id="currentPassword" name="currentPassword" required />
						</div>
						<div class="form-group">
							<label for="newPassword">New Password</label>
							<input type="password" id="newPassword" name="newPassword" required minlength="8" />
							<small>Must be at least 8 characters</small>
						</div>
						<button type="submit" class="btn btn-primary">Change Password</button>
					</form>
				</section>
			{:else if activeTab === 'notifications'}
				<section class="settings-section">
					<h2>Notification settings</h2>
					<p class="section-description">Choose how you want to be notified about trip activity.</p>
					{#if form?.success && form?.from === 'notifications'}
						<div class="success-message">Notification settings saved.</div>
					{/if}
					{#if form?.error && form?.from === 'notifications'}
						<div class="error-message">{form.error}</div>
					{/if}
					<form method="POST" action="?/updateNotifications" use:enhance>
						<!-- Hidden inputs so unchecked boxes submit as false -->
						<input type="hidden" name="emailTripInvites" value="false" />
						<input type="hidden" name="emailTripUpdates" value="false" />
						<input type="hidden" name="inAppNotifications" value="false" />
						<div class="form-group checkbox-group">
							<label class="checkbox-label">
								<input
									type="checkbox"
									name="emailTripInvites"
									value="true"
									checked={data.user?.emailTripInvites ?? true}
								/>
								<span>Email when someone invites you to a trip</span>
							</label>
						</div>
						<div class="form-group checkbox-group">
							<label class="checkbox-label">
								<input
									type="checkbox"
									name="emailTripUpdates"
									value="true"
									checked={data.user?.emailTripUpdates ?? true}
								/>
								<span>Email for trip updates and activity</span>
							</label>
						</div>
						<div class="form-group checkbox-group">
							<label class="checkbox-label">
								<input
									type="checkbox"
									name="inAppNotifications"
									value="true"
									checked={data.user?.inAppNotifications ?? true}
								/>
								<span>Show in-app notifications (bell icon in the trip portal)</span>
							</label>
						</div>
						<button type="submit" class="btn btn-primary">Save notification settings</button>
					</form>
				</section>
			{/if}
		</div>
	</div>
</div>

<style>
	.settings-page {
		min-height: calc(100vh - 80px);
		padding: var(--spacing-xl) var(--spacing-md);
	}

	.container {
		max-width: 800px;
		margin: 0 auto;
	}

	.page-header {
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

	.settings-section h2 {
		margin: 0 0 var(--spacing-sm) 0;
	}
	.section-description {
		color: var(--color-text-light);
		margin: 0 0 var(--spacing-lg) 0;
		font-size: 0.9375rem;
	}
	.checkbox-group {
		margin-bottom: var(--spacing-lg);
	}
	.checkbox-label {
		display: flex;
		align-items: center;
		gap: var(--spacing-sm);
		cursor: pointer;
		font-weight: 400;
	}
	.checkbox-label input[type="checkbox"] {
		width: auto;
		margin: 0;
	}

	.form-group {
		margin-bottom: var(--spacing-md);
	}

	.form-group label {
		display: block;
		margin-bottom: var(--spacing-xs);
		font-weight: 500;
	}

	.form-group input {
		width: 100%;
		padding: var(--spacing-sm);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		font-size: 1rem;
	}

	.form-group input:disabled {
		background: var(--color-bg-light);
		color: var(--color-text-light);
	}

	.form-group small {
		display: block;
		margin-top: var(--spacing-xs);
		color: var(--color-text-light);
		font-size: 0.875rem;
	}

	.success-message {
		background: rgba(34, 197, 94, 0.1);
		color: #16a34a;
		padding: var(--spacing-sm);
		border-radius: var(--radius-sm);
		margin-bottom: var(--spacing-md);
		border-left: 3px solid #16a34a;
	}

	.error-message {
		background: rgba(239, 68, 68, 0.1);
		color: var(--color-error);
		padding: var(--spacing-sm);
		border-radius: var(--radius-sm);
		margin-bottom: var(--spacing-md);
		border-left: 3px solid var(--color-error);
	}
</style>
