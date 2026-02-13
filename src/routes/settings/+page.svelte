<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { openProfileCard } from '$lib/stores/profileOverlay.js';
	import type { PageData } from './$types';

	let { data, form }: { data: PageData; form: any } = $props();

	let activeTab = $state(data.openTab ?? 'profile');
	$effect(() => {
		if (data.openTab) activeTab = data.openTab;
	});
	// Local state for security/privacy (persist via API when available)
	let profileVisibility = $state<'public' | 'trip_only' | 'private'>('public');
	let hideEmail = $state(false);
	let hidePhone = $state(false);
	let hideStats = $state(false);
	const sessions = $state([{ device: 'This device', location: 'Current', lastActive: 'Active now' }]);
</script>

<div class="settings-page">
	<div class="container">
		<div class="page-header">
			<h1>Account settings</h1>
		</div>

		<div class="tabs">
			<button 
				class="tab {activeTab === 'profile' ? 'active' : ''}"
				onclick={() => activeTab = 'profile'}
			>
				Profile
			</button>
			<button 
				class="tab {activeTab === 'notifications' ? 'active' : ''}"
				onclick={() => activeTab = 'notifications'}
			>
				Notifications
			</button>
			<button 
				class="tab {activeTab === 'security' ? 'active' : ''}"
				onclick={() => activeTab = 'security'}
			>
				Security & password
			</button>
			<button 
				class="tab {activeTab === 'blocked' ? 'active' : ''}"
				onclick={() => { activeTab = 'blocked'; goto('/settings?tab=blocked', { replaceState: true }); }}
			>
				Block list
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
				<section class="settings-section basics-section">
					<h2>Basics</h2>
					<p class="section-description">Emergency contact, dietary needs, and accessibility. Shared with trip hosts when relevant.</p>
					<form method="POST" action="?/updateProfile" use:enhance>
						<input type="hidden" name="name" value={data.user?.name || ''} />
						<input type="hidden" name="phone" value={data.user?.phone || ''} />
						<div class="form-group">
							<label for="emergencyContactName">Emergency contact name</label>
							<input type="text" id="emergencyContactName" name="emergencyContactName" value={data.user?.emergencyContactName || ''} placeholder="Name" />
						</div>
						<div class="form-group">
							<label for="emergencyContactPhone">Emergency contact phone</label>
							<input type="tel" id="emergencyContactPhone" name="emergencyContactPhone" value={data.user?.emergencyContactPhone || ''} placeholder="+1 555 000 0000" />
						</div>
						<div class="form-group checkbox-group">
							<label class="checkbox-label">
								<input
									type="checkbox"
									name="shareEmergencyWithHosts"
									value="true"
									checked={data.user?.shareEmergencyWithHosts ?? false}
								/>
								<span>Share emergency contact with trip hosts</span>
							</label>
							<small>When checked, trip hosts can see your emergency contact for safety.</small>
						</div>
						<div class="form-group">
							<label for="dietaryTags">Dietary (comma-separated)</label>
							<input type="text" id="dietaryTags" name="dietaryTags" value={data.user?.dietaryTags || ''} placeholder="e.g. Vegetarian, No dairy" />
						</div>
						<div class="form-group">
							<label for="allergiesTags">Allergies (comma-separated)</label>
							<input type="text" id="allergiesTags" name="allergiesTags" value={data.user?.allergiesTags || ''} placeholder="e.g. Tree nuts, Shellfish" />
						</div>
						<div class="form-group">
							<label for="accessibilityNotes">Accessibility notes</label>
							<textarea id="accessibilityNotes" name="accessibilityNotes" rows="3" placeholder="e.g. Prefer ground floor when possible">{data.user?.accessibilityNotes || ''}</textarea>
						</div>
						<button type="submit" class="btn btn-primary">Save basics</button>
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
			{:else if activeTab === 'security'}
				<section class="settings-section" id="security-privacy" aria-labelledby="security-title">
					<h2 id="security-title">Security & password</h2>
					<div class="security-body">
						<div class="security-subsection">
							<h3>Change password</h3>
							{#if form?.success}
								<div class="success-message">Password changed successfully!</div>
							{/if}
							{#if form?.error}
								<div class="error-message">{form.error}</div>
							{/if}
							<form method="POST" action="?/changePassword" use:enhance>
								<div class="form-group">
									<label for="currentPassword">Current password</label>
									<input type="password" id="currentPassword" name="currentPassword" required />
								</div>
								<div class="form-group">
									<label for="newPassword">New password</label>
									<input type="password" id="newPassword" name="newPassword" required minlength="8" />
									<small>Must be at least 8 characters</small>
								</div>
								<button type="submit" class="btn btn-primary">Change password</button>
							</form>
						</div>
						<hr class="section-divider" />
						<h3>Two-factor & sessions</h3>
						<div class="field-row">
							<span class="field-label">Two-factor auth</span>
							<span class="field-value">Off</span>
							<button type="button" class="btn btn-ghost btn-sm">Set up MFA</button>
						</div>
						<div class="field-row">
							<span class="field-label">Active sessions</span>
							<ul class="sessions-list">
								{#each sessions as session}
									<li class="session-item">
										<span>{session.device}</span>
										<span class="muted">{session.location} · {session.lastActive}</span>
									</li>
								{/each}
							</ul>
						</div>
						<hr class="section-divider" />
						<div class="field-row">
							<span class="field-label">Profile visibility</span>
							<select class="select" bind:value={profileVisibility}>
								<option value="public">Public</option>
								<option value="trip_only">Trip-only</option>
								<option value="private">Private</option>
							</select>
						</div>
						<div class="field-row switch-row">
							<span class="field-label">Hide email from others</span>
							<button type="button" class="toggle" class:on={hideEmail} onclick={() => (hideEmail = !hideEmail)} aria-pressed={hideEmail}><span class="toggle-thumb"></span></button>
						</div>
						<div class="field-row switch-row">
							<span class="field-label">Hide phone from others</span>
							<button type="button" class="toggle" class:on={hidePhone} onclick={() => (hidePhone = !hidePhone)} aria-pressed={hidePhone}><span class="toggle-thumb"></span></button>
						</div>
						<div class="field-row switch-row">
							<span class="field-label">Hide stats on profile</span>
							<button type="button" class="toggle" class:on={hideStats} onclick={() => (hideStats = !hideStats)} aria-pressed={hideStats}><span class="toggle-thumb"></span></button>
						</div>
						<hr class="section-divider" />
						<div class="button-row">
							<button type="button" class="btn btn-secondary">Export data</button>
							<button type="button" class="btn btn-destructive" onclick={() => data.user?.id && openProfileCard(data.user.id)}>Open profile</button>
						</div>
					</div>
				</section>
			{:else if activeTab === 'blocked'}
				<section class="settings-section" id="block-list" aria-labelledby="block-list-title">
					<h2 id="block-list-title">Block list</h2>
					{#if (data.blocked?.length ?? 0) === 0}
						<p class="section-muted">You haven’t blocked anyone. Blocked users won’t be able to invite you or see your profile.</p>
					{:else}
						<ul class="blocked-list">
							{#each data.blocked as item}
								<li>{item}</li>
							{/each}
						</ul>
					{/if}
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
	.basics-section {
		margin-top: var(--spacing-xl);
		padding-top: var(--spacing-xl);
		border-top: 1px solid var(--color-border);
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

	.security-subsection {
		margin-bottom: var(--spacing-lg);
	}
	.security-subsection h3 {
		margin: 0 0 var(--spacing-md) 0;
		font-size: 1rem;
		font-weight: 600;
	}
	.security-body h3 {
		margin: var(--spacing-sm) 0 var(--spacing-md) 0;
		font-size: 1rem;
		font-weight: 600;
	}
	.security-body h3:first-of-type {
		margin-top: 0;
	}
	.security-body .field-row {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: var(--spacing-sm);
		margin-bottom: var(--spacing-md);
	}
	.security-body .field-label {
		min-width: 140px;
		font-weight: 500;
	}
	.security-body .field-value {
		color: var(--color-text-light);
		font-size: 0.9375rem;
	}
	.security-body .section-divider {
		border: none;
		border-top: 1px solid var(--color-border);
		margin: var(--spacing-lg) 0;
	}
	.security-body .sessions-list {
		list-style: none;
		margin: 0;
		padding: 0;
		width: 100%;
	}
	.security-body .session-item {
		display: flex;
		align-items: center;
		gap: var(--spacing-sm);
		padding: var(--spacing-xs) 0;
		font-size: 0.9375rem;
	}
	.security-body .session-item .muted {
		color: var(--color-text-light);
		font-size: 0.875rem;
	}
	.security-body .switch-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}
	.security-body .toggle {
		width: 2.5rem;
		height: 1.25rem;
		border-radius: 999px;
		background: var(--color-border);
		border: none;
		cursor: pointer;
		padding: 2px;
		transition: background 0.2s;
	}
	.security-body .toggle .toggle-thumb {
		display: block;
		width: 1rem;
		height: 1rem;
		border-radius: 50%;
		background: white;
		box-shadow: 0 1px 2px rgba(0,0,0,0.2);
		transition: transform 0.2s;
	}
	.security-body .toggle.on {
		background: var(--color-primary);
	}
	.security-body .toggle.on .toggle-thumb {
		transform: translateX(1.25rem);
	}
	.security-body .select {
		padding: var(--spacing-sm);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		font-size: 1rem;
	}
	.security-body .button-row {
		display: flex;
		flex-wrap: wrap;
		gap: var(--spacing-sm);
		margin-top: var(--spacing-md);
	}
	.security-body .btn-destructive {
		background: var(--color-error);
		color: white;
		border: none;
		padding: var(--spacing-sm) var(--spacing-md);
		border-radius: var(--radius-sm);
		text-decoration: none;
		font-size: 1rem;
		cursor: pointer;
	}
	.security-body .btn-destructive:hover {
		opacity: 0.9;
	}

	.section-muted {
		color: var(--color-text-light);
		margin: 0 0 var(--spacing-md) 0;
		font-size: 0.9375rem;
	}
	.blocked-list {
		list-style: none;
		padding: 0;
		margin: 0;
	}
	.blocked-list li {
		padding: var(--spacing-xs) 0;
		border-bottom: 1px solid var(--color-border);
	}
	.blocked-list li:last-child {
		border-bottom: none;
	}
</style>
