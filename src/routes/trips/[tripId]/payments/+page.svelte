<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
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
			{#if data.invoices?.length > 0}
				<h3 class="section-title">Invoices</h3>
				<ul class="invoice-list">
					{#each data.invoices as inv}
						<li class="invoice-item">
							<span>Invoice #{inv.id.slice(0, 8)}</span>
							<span class="status">{inv.status}</span>
							<button type="button" class="btn-stub">Mark as paid</button>
						</li>
					{/each}
				</ul>
			{:else}
				<p class="empty">No invoices yet. Payment tracking is placeholder only.</p>
			{/if}
		</div>
	</div>
</div>

<style>
	.page { padding: 0; }
	.page-header { margin-bottom: 1.5rem; }
	.page-header h1 { font-size: 1.5rem; font-weight: 600; margin: 0 0 0.25rem 0; }
	.subtitle { font-size: 0.875rem; color: var(--muted); margin: 0; }
	.card { background: white; border-radius: 1rem; border: 1px solid var(--border); overflow: hidden; }
	.card-body { padding: 1.5rem; }
	.summary-row { display: flex; justify-content: space-between; padding: 0.75rem 0; border-bottom: 1px solid var(--border); }
	.label { color: var(--muted); }
	.value { font-weight: 600; }
	.section-title { font-size: 1rem; margin: 1rem 0 0.5rem 0; }
	.invoice-list { list-style: none; margin: 0; padding: 0; }
	.invoice-item { display: flex; align-items: center; gap: 1rem; padding: 0.75rem 0; border-bottom: 1px solid var(--border); }
	.invoice-item .status { text-transform: capitalize; color: var(--muted); font-size: 0.875rem; }
	.btn-stub { padding: 0.25rem 0.5rem; font-size: 0.8125rem; background: var(--bg); border: 1px solid var(--border); border-radius: 0.375rem; cursor: pointer; }
	.empty { color: var(--muted); margin: 1rem 0 0 0; }
</style>
