<script lang="ts">
	import { goto } from '$app/navigation';
	
	let inviteCode = $state('');
</script>

<div class="find-page">
	<div class="container container-narrow">
		<div class="page-header">
			<h1>Find Your Vacation</h1>
			<p class="subtitle">Enter your invite code to access your trip's room selection</p>
		</div>

		<div class="find-card card">
			<form
				method="GET"
				action="/trip"
				onsubmit={(e) => {
					if (!inviteCode.trim()) {
						e.preventDefault();
					}
				}}
			>
				<div class="form-group">
					<label for="code">Invite Code</label>
					<input
						type="text"
						id="code"
						name="code"
						bind:value={inviteCode}
						placeholder="Enter your invite code (e.g., ABC123)"
						required
						maxlength="6"
						style="text-transform: uppercase;"
					/>
					<small>Your host should have sent you a unique invite code</small>
				</div>

				<button type="submit" class="btn btn-primary btn-large" style="width: 100%;">
					Access Trip
				</button>
			</form>
		</div>

		<div class="info-section">
			<h3>How It Works</h3>
			<div class="steps">
				<div class="step">
					<div class="step-number">1</div>
					<div class="step-content">
						<h4>Get Your Invite Code</h4>
						<p>Your trip host will send you a unique invite code via email or message.</p>
					</div>
				</div>
				<div class="step">
					<div class="step-number">2</div>
					<div class="step-content">
						<h4>Enter Code Here</h4>
						<p>Type your invite code in the field above to access your trip's room selection page.</p>
					</div>
				</div>
				<div class="step">
					<div class="step-number">3</div>
					<div class="step-content">
						<h4>Reserve Your Room</h4>
						<p>Browse available rooms and beds, then reserve your preferred accommodations.</p>
					</div>
				</div>
			</div>
		</div>
	</div>
</div>

<style>
	.find-page {
		padding: var(--spacing-2xl) 0;
		min-height: calc(100vh - 80px);
		background: var(--color-bg-light);
	}

	.page-header {
		text-align: center;
		margin-bottom: var(--spacing-xl);
	}

	.page-header h1 {
		margin-bottom: var(--spacing-sm);
	}

	.subtitle {
		font-size: 1.125rem;
		color: var(--color-text-light);
	}

	.find-card {
		max-width: 500px;
		margin: 0 auto var(--spacing-2xl);
		padding: var(--spacing-xl);
	}

	.form-group {
		margin-bottom: var(--spacing-lg);
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

	.info-section {
		text-align: center;
	}

	.info-section h3 {
		margin-bottom: var(--spacing-xl);
	}

	.steps {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
		gap: var(--spacing-lg);
		margin-top: var(--spacing-xl);
	}

	.step {
		display: flex;
		gap: var(--spacing-md);
		text-align: left;
	}

	.step-number {
		flex-shrink: 0;
		width: 48px;
		height: 48px;
		background: var(--color-primary);
		color: white;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		font-weight: 700;
		font-size: 1.25rem;
	}

	.step-content h4 {
		margin-bottom: var(--spacing-xs);
		color: var(--color-text);
	}

	.step-content p {
		color: var(--color-text-light);
		line-height: 1.7;
		margin: 0;
	}

	@media (max-width: 768px) {
		.steps {
			grid-template-columns: 1fr;
		}
	}
</style>
