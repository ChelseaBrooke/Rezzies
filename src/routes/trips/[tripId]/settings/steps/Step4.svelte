<script lang="ts">
	interface Props {
		formData: {
			name: string;
			description: string;
			location: string;
			checkInDate: string;
			checkOutDate: string;
			totalCost: string;
			pricingModel: string;
			allowPartialStays: boolean;
		};
		tripId: string;
		numberOfNights: number;
	}

	let { formData, tripId, numberOfNights }: Props = $props();

	function formatDate(dateStr: string) {
		if (!dateStr) return 'Not set';
		const date = new Date(dateStr);
		return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
	}

	function formatCurrency(amount: string) {
		const num = parseFloat(amount);
		if (isNaN(num)) return 'Not set';
		return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num);
	}

	const pricingModelLabels: Record<string, string> = {
		'PER_PERSON': 'Per Person',
		'PER_ROOM': 'Per Room',
		'PER_BED': 'Per Bed',
		'PER_PERSON_PER_NIGHT': 'Per Person Per Night'
	};
</script>

<div class="step-content">
	<h1 class="step-title">Review Changes</h1>
	<p class="step-subtitle">Review your trip settings before saving</p>
	
	<div class="review-sections">
		<section class="review-section">
			<h2>Trip Basics</h2>
			<div class="review-grid">
				<div class="review-item">
					<span class="review-label">Trip Name</span>
					<span class="review-value">{formData.name || 'Not set'}</span>
				</div>
				<div class="review-item">
					<span class="review-label">Destination</span>
					<span class="review-value">{formData.location || 'Not set'}</span>
				</div>
				<div class="review-item">
					<span class="review-label">Check-in Date</span>
					<span class="review-value">{formatDate(formData.checkInDate)}</span>
				</div>
				<div class="review-item">
					<span class="review-label">Check-out Date</span>
					<span class="review-value">{formatDate(formData.checkOutDate)}</span>
				</div>
				<div class="review-item">
					<span class="review-label">Number of Nights</span>
					<span class="review-value">{numberOfNights} night{numberOfNights !== 1 ? 's' : ''}</span>
				</div>
			</div>
			{#if formData.description}
				<div class="review-description">
					<span class="review-label">Description</span>
					<p>{formData.description}</p>
				</div>
			{/if}
		</section>
		
		<section class="review-section">
			<h2>Pricing</h2>
			<div class="review-grid">
				<div class="review-item">
					<span class="review-label">Total Trip Cost</span>
					<span class="review-value">{formatCurrency(formData.totalCost)}</span>
				</div>
				<div class="review-item">
					<span class="review-label">Pricing Model</span>
					<span class="review-value">{pricingModelLabels[formData.pricingModel] || formData.pricingModel}</span>
				</div>
				<div class="review-item">
					<span class="review-label">Partial Stays</span>
					<span class="review-value">{formData.allowPartialStays ? 'Allowed' : 'Not allowed'}</span>
				</div>
			</div>
		</section>
	</div>
</div>

<style>
	.step-content {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.step-title {
		font-size: 1.5rem;
		font-weight: 600;
		margin: 0 0 0.5rem 0;
		color: var(--text);
	}

	.step-subtitle {
		font-size: 0.875rem;
		color: var(--muted);
		margin: 0 0 1.5rem 0;
	}

	.review-sections {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.review-section {
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		padding: 1.5rem;
	}

	.review-section h2 {
		font-size: 1rem;
		font-weight: 600;
		margin: 0 0 1rem 0;
		color: var(--text);
	}

	.review-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 1rem;
	}

	.review-item {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.review-label {
		font-size: 0.8125rem;
		font-weight: 500;
		color: var(--muted);
	}

	.review-value {
		font-size: 0.875rem;
		color: var(--text);
	}

	.review-description {
		margin-top: 1rem;
		padding-top: 1rem;
		border-top: 1px solid var(--border);
	}

	.review-description .review-label {
		display: block;
		margin-bottom: 0.5rem;
	}

	.review-description p {
		font-size: 0.875rem;
		color: var(--text);
		margin: 0;
		white-space: pre-wrap;
	}
</style>
