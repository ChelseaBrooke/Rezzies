<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData } from './$types';

	let { form } = $props();
</script>

<div class="auth-page">
	<div class="auth-container">
		<div class="auth-card card">
			<h1>Sign Up</h1>
			<p class="auth-subtitle">Create your account to start hosting group vacations.</p>

			{#if form?.error}
				<div class="error-message">
					{form.error}
				</div>
			{/if}

			<form method="POST" use:enhance>
				<div class="form-group">
					<label for="email">Email</label>
					<input
						type="email"
						id="email"
						name="email"
						required
						placeholder="you@example.com"
					/>
				</div>

				<div class="form-group">
					<label for="password">Password</label>
					<input
						type="password"
						id="password"
						name="password"
						required
						placeholder="Create a password"
						minlength="8"
					/>
					<small>Must be at least 8 characters</small>
				</div>

				<div class="form-group">
					<label for="confirmPassword">Confirm Password</label>
					<input
						type="password"
						id="confirmPassword"
						name="confirmPassword"
						required
						placeholder="Confirm your password"
					/>
				</div>

				<button type="submit" class="btn btn-primary btn-large" style="width: 100%;">
					Sign Up
				</button>
			</form>

			<div class="auth-footer">
				<p>Already have an account? <a href="/login">Log in</a></p>
			</div>
		</div>
	</div>
</div>

<style>
	.auth-page {
		min-height: calc(100vh - 80px);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: var(--spacing-xl) var(--spacing-md);
		background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
		background-image: url('https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=1920&q=80');
		background-size: cover;
		background-position: center;
		position: relative;
	}

	.auth-page::before {
		content: '';
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(37, 99, 235, 0.85);
	}

	.auth-container {
		position: relative;
		z-index: 1;
		width: 100%;
		max-width: 450px;
	}

	.auth-card {
		padding: var(--spacing-xl);
		background: white;
	}

	.auth-card h1 {
		text-align: center;
		margin-bottom: var(--spacing-xs);
	}

	.auth-subtitle {
		text-align: center;
		color: var(--color-text-light);
		margin-bottom: var(--spacing-lg);
	}

	.form-group {
		margin-bottom: var(--spacing-md);
	}

	.form-group label {
		display: block;
		margin-bottom: var(--spacing-xs);
		font-weight: 500;
		color: var(--color-text);
	}

	.form-group small {
		display: block;
		margin-top: var(--spacing-xs);
		color: var(--color-text-light);
		font-size: 0.875rem;
	}

	.error-message {
		background: rgba(239, 68, 68, 0.1);
		color: var(--color-error);
		padding: var(--spacing-sm);
		border-radius: var(--radius-sm);
		margin-bottom: var(--spacing-md);
		border-left: 3px solid var(--color-error);
	}

	.auth-footer {
		text-align: center;
		margin-top: var(--spacing-lg);
		padding-top: var(--spacing-lg);
		border-top: 1px solid var(--color-border);
	}

	.auth-footer p {
		color: var(--color-text-light);
		margin: 0;
	}
</style>
