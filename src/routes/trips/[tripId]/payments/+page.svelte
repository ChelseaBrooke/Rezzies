<script lang="ts">
	import { page } from '$app/stores';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	let invoiceModalOpen = $state($page.url.searchParams.get('invoice') === '1' && !!data.myInvoice);

	const breakdown = $derived(
		data.myInvoice?.breakdownJson
			? (JSON.parse(data.myInvoice.breakdownJson) as {
					rooms?: Array<{ roomName: string; nights: number; amount: number }>;
					activities?: Array<{ activityName: string; amount: number }>;
					extras?: Array<{ label: string; quantity: number; amount: number }>;
					total?: number;
				})
			: {}
	);

	function openInvoiceModal() {
		invoiceModalOpen = true;
	}
	function closeInvoiceModal() {
		invoiceModalOpen = false;
	}
</script>

<div class="page">
	<div class="page-header">
		<h1>Payments</h1>
		<p class="subtitle">Pricing summary and payment tracking (no processing)</p>
	</div>

	<div class="card">
		<div class="card-body">
			<div class="summary-row">
				<span class="label">Total trip cost</span>
				<span class="value">
					{data.trip?.totalCost != null ? `$${Number(data.trip.totalCost).toFixed(2)}` : '$0.00'}
				</span>
			</div>
			{#if data.myInvoice}
				<div class="my-invoice-row">
					<span class="label">Your invoice</span>
					<button type="button" class="btn btn-primary btn-small" onclick={openInvoiceModal}>
						View my invoice
					</button>
				</div>
			{/if}
			{#if data.invoices?.length > 0}
				<h3 class="section-title">Invoices</h3>
				<ul class="invoice-list">
					{#each data.invoices as inv}
						<li class="invoice-item">
							<span>Invoice #{inv.id.slice(0, 8)}</span>
							<span class="status">{inv.status}</span>
							{#if data.myInvoice && inv.id === data.myInvoice.id}
								<button type="button" class="btn-stub" onclick={openInvoiceModal}>View</button>
							{:else}
								<button type="button" class="btn-stub">Mark as paid</button>
							{/if}
						</li>
					{/each}
				</ul>
			{:else if !data.myInvoice}
				<p class="empty">No invoices yet. Payment tracking is placeholder only.</p>
			{/if}
		</div>
	</div>
</div>

<!-- Invoice modal -->
{#if invoiceModalOpen && data.myInvoice}
	<div class="modal-backdrop" onclick={closeInvoiceModal} role="presentation"></div>
	<div class="invoice-modal" role="dialog" aria-labelledby="invoice-modal-title" aria-modal="true">
		<div class="invoice-modal-header">
			<h2 id="invoice-modal-title">Your Invoice</h2>
			<button type="button" class="btn-close" onclick={closeInvoiceModal} aria-label="Close">×</button>
		</div>
		<div class="invoice-modal-body">
			<div class="invoice-card-inner">
				<div class="invoice-header">
					<div>
						<h3>Invoice #{data.myInvoice.id.slice(0, 8)}</h3>
						<p class="invoice-status status-{data.myInvoice.status}">{data.myInvoice.status.toUpperCase()}</p>
					</div>
					<div class="invoice-total">
						<p class="total-label">Total Amount</p>
						<p class="total-amount">${data.myInvoice.totalAmount.toFixed(2)}</p>
					</div>
				</div>

				<div class="invoice-breakdown">
					{#if breakdown.rooms && breakdown.rooms.length > 0}
						<section class="breakdown-section">
							<h4>Rooms</h4>
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
							<h4>Activities</h4>
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
							<h4>Extras</h4>
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
						<p class="total-amount">${(breakdown.total ?? data.myInvoice.totalAmount).toFixed(2)}</p>
					</div>
				</div>

				{#if data.myInvoice.status === 'due'}
					<div class="payment-section">
						<h4>Payment</h4>
						{#if data.myInvoice.stripePaymentIntentId}
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
{/if}

<style>
	.page { padding: 0; }
	.page-header { margin-bottom: 1.5rem; }
	.page-header h1 { font-size: 1.5rem; font-weight: 600; margin: 0 0 0.25rem 0; }
	.subtitle { font-size: 0.875rem; color: var(--muted); margin: 0; }
	.card { background: var(--surface); border-radius: var(--radius-lg); border: 1px solid var(--border); overflow: hidden; }
	.card-body { padding: 1.5rem; }
	.summary-row { display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 0; border-bottom: 1px solid var(--border); }
	.my-invoice-row { display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 0; border-bottom: 1px solid var(--border); }
	.label { color: var(--muted); }
	.value { font-weight: 600; }
	.btn-small { padding: 0.35rem 0.75rem; font-size: 0.8125rem; }
	.section-title { font-size: 1rem; margin: 1rem 0 0.5rem 0; }
	.invoice-list { list-style: none; margin: 0; padding: 0; }
	.invoice-item { display: flex; align-items: center; gap: 1rem; padding: 0.75rem 0; border-bottom: 1px solid var(--border); }
	.invoice-item .status { text-transform: capitalize; color: var(--muted); font-size: 0.875rem; }
	.btn-stub { padding: 0.25rem 0.5rem; font-size: 0.8125rem; background: var(--surface2); border: 1px solid var(--border); border-radius: var(--radius-sm); cursor: pointer; transition: background var(--transition-fast); }
	.btn-stub:hover { background: var(--surface); }
	.empty { color: var(--muted); margin: 1rem 0 0 0; }

	/* Modal */
	.modal-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.5);
		z-index: 1000;
	}
	.invoice-modal {
		position: fixed;
		inset: 1rem;
		max-width: 560px;
		max-height: calc(100vh - 2rem);
		margin: 0 auto;
		background: var(--surface);
		border-radius: var(--radius-lg);
		box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
		z-index: 1001;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}
	.invoice-modal-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1rem 1.25rem;
		border-bottom: 1px solid var(--border);
		flex-shrink: 0;
	}
	.invoice-modal-header h2 { font-size: 1.25rem; margin: 0; }
	.btn-close {
		width: 2rem;
		height: 2rem;
		padding: 0;
		border: none;
		background: transparent;
		font-size: 1.5rem;
		line-height: 1;
		color: var(--muted);
		cursor: pointer;
		border-radius: var(--radius-sm);
	}
	.btn-close:hover { color: var(--text); background: var(--surface2); }
	.invoice-modal-body {
		padding: 1.25rem;
		overflow-y: auto;
		flex: 1;
	}
	.invoice-card-inner { background: var(--surface2); border-radius: var(--radius-md); padding: 1.25rem; }
	.invoice-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: 1.25rem;
		padding-bottom: 1rem;
		border-bottom: 2px solid var(--border);
	}
	.invoice-header h3 { font-size: 1.125rem; margin: 0; }
	.invoice-status {
		display: inline-block;
		padding: 0.25rem 0.75rem;
		border-radius: var(--radius-sm);
		font-size: 0.75rem;
		font-weight: 500;
		margin-top: 0.25rem;
	}
	.status-due { background: rgba(239, 68, 68, 0.1); color: var(--danger); }
	.status-paid { background: rgba(34, 197, 94, 0.1); color: #16a34a; }
	.invoice-total { text-align: right; }
	.invoice-total .total-label { margin: 0 0 0.25rem 0; color: var(--muted); font-size: 0.875rem; }
	.invoice-total .total-amount { margin: 0; font-size: 1.5rem; font-weight: 700; color: var(--primary); }
	.breakdown-section { margin-bottom: 1rem; }
	.breakdown-section h4 { margin: 0 0 0.5rem 0; font-size: 1rem; }
	.breakdown-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.5rem 0.75rem;
		background: var(--surface);
		border-radius: var(--radius-sm);
		margin-bottom: 0.5rem;
	}
	.item-name { margin: 0 0 0.125rem 0; font-weight: 500; }
	.item-details { margin: 0; color: var(--muted); font-size: 0.8125rem; }
	.item-amount { margin: 0; font-weight: 600; }
	.breakdown-total {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1rem;
		background: var(--primary);
		color: white;
		border-radius: var(--radius-sm);
		margin-top: 1rem;
	}
	.breakdown-total .total-label,
	.breakdown-total .total-amount { color: white; }
	.payment-section { margin-top: 1.25rem; padding-top: 1.25rem; border-top: 2px solid var(--border); }
	.payment-section h4 { margin: 0 0 0.5rem 0; }
</style>
