<script lang="ts">
	import { goto } from '$app/navigation';
	
	let selectedOption = $state<'scratch' | 'autofill' | null>(null);
	let listingUrl = $state('');
	let isAutofilling = $state(false);
	let autofillError = $state<string | null>(null);
	
	async function handleAutofill() {
		if (!listingUrl.trim()) {
			autofillError = 'Please enter a listing URL';
			return;
		}

		isAutofilling = true;
		autofillError = null;

		try {
			// Store the URL and redirect to loading page
			const urlToStore = listingUrl.trim();
			console.log('[Host Vacation] Storing URL in sessionStorage:', urlToStore);
			sessionStorage.setItem('autofillUrl', urlToStore);
			
			// Verify it was stored
			const stored = sessionStorage.getItem('autofillUrl');
			console.log('[Host Vacation] Verified stored URL:', stored);
			
			console.log('[Host Vacation] Redirecting to /trips/new?autofill=true');
			await goto('/trips/new?autofill=true');
		} catch (error) {
			autofillError = 'Failed to start autofill. Please try again.';
			console.error('[Host Vacation] Autofill error:', error);
			isAutofilling = false;
		}
	}
</script>

<div class="host-page">
	<div class="container container-narrow">
		<div class="page-header">
			<h1>Host a Vacation</h1>
			<p class="subtitle">Choose how you'd like to set up your trip</p>
		</div>

		<div class="options-grid">
			<button
				class="option-card card"
				class:selected={selectedOption === 'scratch'}
				onclick={() => selectedOption = 'scratch'}
			>
				<div class="option-icon">✏️</div>
				<h3>From Scratch</h3>
				<p>Manually enter all trip details, rooms, and pricing information.</p>
			</button>

			<button
				class="option-card card"
				class:selected={selectedOption === 'autofill'}
				onclick={() => selectedOption = 'autofill'}
			>
				<div class="option-icon">🔗</div>
				<h3>Autofill with Link</h3>
				<p>Import details automatically from your VRBO or Airbnb listing URL.</p>
			</button>
		</div>

		{#if selectedOption === 'autofill'}
			<div class="autofill-section card">
				<h4>🔗 Paste Your Listing URL</h4>
				<p class="instructions">
					Paste your VRBO or Airbnb listing URL below. For best results, select your dates and number of guests on the listing page before copying the URL.
				</p>
				
				<div class="url-input-group">
					<input
						type="url"
						placeholder="https://www.vrbo.com/123456 or https://www.airbnb.com/rooms/123456"
						bind:value={listingUrl}
						class="url-input"
						disabled={isAutofilling}
						onkeydown={(e) => {
							if (e.key === 'Enter' && listingUrl.trim()) {
								handleAutofill();
							}
						}}
					/>
					<button
						class="btn btn-primary btn-large"
						onclick={handleAutofill}
						disabled={isAutofilling || !listingUrl.trim()}
					>
						{isAutofilling ? 'Processing...' : 'Autofill'}
					</button>
				</div>

				{#if autofillError}
					<p class="error-message">{autofillError}</p>
				{/if}

				<div class="info-box">
					<h5>What we'll extract:</h5>
					<ul>
						<li>Property name and photos</li>
						<li>Maximum number of guests</li>
						<li>Check-in and check-out dates (if in URL)</li>
						<li>Total price with taxes (if available)</li>
						<li>Room types and bed configurations</li>
					</ul>
				</div>
			</div>
		{/if}

		{#if selectedOption === 'scratch'}
			<div class="action-buttons">
				<button
					class="btn btn-primary btn-large"
					onclick={() => goto('/trips/new')}
				>
					Continue
				</button>
				<button
					class="btn btn-secondary"
					onclick={() => selectedOption = null}
				>
					Back
				</button>
			</div>
		{/if}
	</div>
</div>

<style>
	.host-page {
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

	.options-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
		gap: var(--spacing-lg);
		margin-bottom: var(--spacing-xl);
	}

	.option-card {
		text-align: center;
		padding: var(--spacing-xl);
		cursor: pointer;
		border: 3px solid transparent;
		transition: all var(--transition-base);
		background: white;
	}

	.option-card:hover {
		transform: translateY(-4px);
		box-shadow: var(--shadow-xl);
	}

	.option-card.selected {
		border-color: var(--color-primary);
		background: rgba(37, 99, 235, 0.05);
	}

	.option-icon {
		font-size: 3.5rem;
		margin-bottom: var(--spacing-md);
	}

	.option-card h3 {
		margin-bottom: var(--spacing-sm);
		color: var(--color-text);
	}

	.option-card p {
		color: var(--color-text-light);
		line-height: 1.7;
	}

	.autofill-section {
		margin-bottom: var(--spacing-xl);
	}

	.autofill-section h4 {
		margin-bottom: var(--spacing-sm);
		color: var(--color-primary);
	}

	.instructions {
		color: var(--color-text-light);
		margin-bottom: var(--spacing-lg);
		line-height: 1.7;
	}

	.url-input-group {
		display: flex;
		gap: var(--spacing-md);
		margin-bottom: var(--spacing-md);
	}

	.url-input {
		flex: 1;
		padding: var(--spacing-md);
		border: 2px solid var(--color-border);
		border-radius: var(--radius-md);
		font-size: 1rem;
		font-family: inherit;
		transition: border-color var(--transition-base);
	}

	.url-input:focus {
		outline: none;
		border-color: var(--color-primary);
	}

	.url-input:disabled {
		background: var(--color-bg-light);
		cursor: not-allowed;
	}

	.error-message {
		color: var(--color-error);
		margin-top: var(--spacing-sm);
		font-size: 0.9rem;
	}

	.info-box {
		margin-top: var(--spacing-lg);
		padding: var(--spacing-md);
		background: rgba(37, 99, 235, 0.05);
		border-left: 4px solid var(--color-primary);
		border-radius: var(--radius-sm);
	}

	.info-box h5 {
		margin-bottom: var(--spacing-sm);
		color: var(--color-primary);
		font-size: 0.95rem;
	}

	.info-box ul {
		margin: var(--spacing-sm) 0 0 0;
		padding-left: var(--spacing-lg);
		color: var(--color-text-light);
		font-size: 0.9rem;
	}

	.info-box li {
		margin-bottom: var(--spacing-xs);
		line-height: 1.6;
	}

	@media (max-width: 768px) {
		.url-input-group {
			flex-direction: column;
		}
	}

	.action-buttons {
		display: flex;
		gap: var(--spacing-md);
		justify-content: center;
		flex-wrap: wrap;
	}

	@media (max-width: 768px) {
		.options-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
