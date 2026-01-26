<script lang="ts">
	import { goto } from '$app/navigation';
	
	let selectedOption = $state<'scratch' | 'autofill' | null>(null);
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
			<div class="info-box card">
				<h4>📋 How Autofill Works</h4>
				<p>Simply paste your VRBO or Airbnb listing URL, and we'll automatically extract:</p>
				<ul>
					<li>Property name and photos</li>
					<li>Maximum number of guests</li>
					<li>Check-in and check-out dates (if in URL)</li>
					<li>Total price with taxes (if available)</li>
				</ul>
				<p class="note">
					<strong>Tip:</strong> For best results, select your dates and number of guests on the listing page before copying the URL.
				</p>
			</div>
		{/if}

		{#if selectedOption}
			<div class="action-buttons">
				<button
					class="btn btn-primary btn-large"
					onclick={() => {
						if (selectedOption === 'autofill') {
							goto('/admin/trips/new?autofill=true');
						} else {
							goto('/admin/trips/new');
						}
					}}
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

	.info-box {
		margin-bottom: var(--spacing-xl);
		background: rgba(37, 99, 235, 0.05);
		border-left: 4px solid var(--color-primary);
	}

	.info-box h4 {
		margin-bottom: var(--spacing-sm);
		color: var(--color-primary);
	}

	.info-box ul {
		margin: var(--spacing-md) 0;
		padding-left: var(--spacing-lg);
		color: var(--color-text-light);
	}

	.info-box li {
		margin-bottom: var(--spacing-xs);
		line-height: 1.7;
	}

	.note {
		margin-top: var(--spacing-md);
		padding: var(--spacing-sm);
		background: rgba(245, 158, 11, 0.1);
		border-radius: var(--radius-sm);
		color: var(--color-text);
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
