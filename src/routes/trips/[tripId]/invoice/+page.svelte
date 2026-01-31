<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	
	const breakdown = JSON.parse(data.invoice.breakdownJson || '{}');
</script>

<div class="invoice-page">
	<div class="container">
		<div class="page-header">
			<h1>Your Invoice</h1>
			<a href="/trips/{data.invoice.tripId}" class="btn btn-secondary">← Back to Trip</a>
		</div>

		<div class="invoice-card">
			<div class="invoice-header">
				<div>
					<h2>Invoice #{data.invoice.id.slice(0, 8)}</h2>
					<p class="invoice-status status-{data.invoice.status}">{data.invoice.status.toUpperCase()}</p>
				</div>
				<div class="invoice-total">
					<p class="total-label">Total Amount</p>
					<p class="total-amount">${data.invoice.totalAmount.toFixed(2)}</p>
				</div>
			</div>

			<div class="invoice-breakdown">
				{#if breakdown.rooms && breakdown.rooms.length > 0}
					<section class="breakdown-section">
						<h3>Rooms</h3>
						{#each breakdown.rooms as room}
							<div class="breakdown-item">
								<div>
									<p class="item-name">{room.roomName}</p>
									<p class="item-details">{room.nights} night{room.nights !== 1 ? 's' : ''}</p>
								</div>
								<p class="item-amount">${room.amount.toFixed(2)}</p>
							</div>
						{/each}
					</section>
				{/if}

				{#if breakdown.activities && breakdown.activities.length > 0}
					<section class="breakdown-section">
						<h3>Activities</h3>
						{#each breakdown.activities as activity}
							<div class="breakdown-item">
								<div>
									<p class="item-name">{activity.activityName}</p>
								</div>
								<p class="item-amount">${activity.amount.toFixed(2)}</p>
							</div>
						{/each}
					</section>
				{/if}

				{#if breakdown.extras && breakdown.extras.length > 0}
					<section class="breakdown-section">
						<h3>Extras</h3>
						{#each breakdown.extras as extra}
							<div class="breakdown-item">
								<div>
									<p class="item-name">{extra.label}</p>
									<p class="item-details">Quantity: {extra.quantity}</p>
								</div>
								<p class="item-amount">${extra.amount.toFixed(2)}</p>
							</div>
						{/each}
					</section>
				{/if}

				<div class="breakdown-total">
					<p class="total-label">Total</p>
					<p class="total-amount">${breakdown.total?.toFixed(2) || data.invoice.totalAmount.toFixed(2)}</p>
				</div>
			</div>

			{#if data.invoice.status === 'due'}
				<div class="payment-section">
					<h3>Payment</h3>
					{#if data.invoice.stripePaymentIntentId}
						<p>Payment processing...</p>
					{:else}
						<p>Payment options will be available here once Stripe is configured.</p>
						<button class="btn btn-primary" disabled>Pay Now (Coming Soon)</button>
					{/if}
				</div>
			{/if}
		</div>
	</div>
</div>

<style>
	.invoice-page {
		min-height: calc(100vh - 80px);
		padding: var(--spacing-xl) var(--spacing-md);
	}

	.container {
		max-width: 800px;
		margin: 0 auto;
	}

	.page-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: var(--spacing-xl);
	}

	.invoice-card {
		background: white;
		padding: var(--spacing-xl);
		border-radius: var(--radius-md);
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
	}

	.invoice-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: var(--spacing-xl);
		padding-bottom: var(--spacing-lg);
		border-bottom: 2px solid var(--color-border);
	}

	.invoice-status {
		display: inline-block;
		padding: 0.25rem 0.75rem;
		border-radius: var(--radius-sm);
		font-size: 0.875rem;
		font-weight: 500;
		margin-top: var(--spacing-xs);
	}

	.status-due {
		background: rgba(239, 68, 68, 0.1);
		color: var(--danger);
	}

	.status-paid {
		background: rgba(34, 197, 94, 0.1);
		color: #16a34a;
	}

	.invoice-total {
		text-align: right;
	}

	.total-label {
		margin: 0 0 var(--spacing-xs) 0;
		color: var(--color-text-light);
		font-size: 0.875rem;
	}

	.total-amount {
		margin: 0;
		font-size: 2rem;
		font-weight: 700;
		color: var(--color-primary);
	}

	.breakdown-section {
		margin-bottom: var(--spacing-lg);
	}

	.breakdown-section h3 {
		margin: 0 0 var(--spacing-md) 0;
		font-size: 1.25rem;
	}

	.breakdown-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: var(--spacing-md);
		background: var(--color-bg-light);
		border-radius: var(--radius-sm);
		margin-bottom: var(--spacing-sm);
	}

	.item-name {
		margin: 0 0 var(--spacing-xs) 0;
		font-weight: 500;
	}

	.item-details {
		margin: 0;
		color: var(--color-text-light);
		font-size: 0.875rem;
	}

	.item-amount {
		margin: 0;
		font-weight: 600;
	}

	.breakdown-total {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: var(--spacing-lg);
		background: var(--color-primary);
		color: white;
		border-radius: var(--radius-sm);
		margin-top: var(--spacing-lg);
	}

	.breakdown-total .total-label,
	.breakdown-total .total-amount {
		color: white;
	}

	.payment-section {
		margin-top: var(--spacing-xl);
		padding-top: var(--spacing-xl);
		border-top: 2px solid var(--color-border);
	}

	.payment-section h3 {
		margin: 0 0 var(--spacing-md) 0;
	}
</style>
