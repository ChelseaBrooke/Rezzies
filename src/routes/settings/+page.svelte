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
