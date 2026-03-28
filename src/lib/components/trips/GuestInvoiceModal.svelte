<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import type { InvoiceBreakdown } from '$lib/server/invoice-calculator.js';

	interface Props {
		open: boolean;
		guestName: string;
		breakdown: InvoiceBreakdown | null;
		total: number;
		tripId: string;
		userId: string;
		canMarkAsPaid: boolean;
		onClose: () => void;
	}

	let {
		open,
		guestName,
		breakdown,
		total,
		tripId,
		userId,
		canMarkAsPaid,
		onClose
	}: Props = $props();

	$effect(() => {
		if (!open) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') onClose();
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	});

	// Room/bed lines for details section: "Room 1, Queen bed"
	const roomBedLines = $derived(
		(breakdown?.rooms ?? []).map((r) => {
			const bedPart = r.bedType ? `, ${r.bedType.charAt(0).toUpperCase() + r.bedType.slice(1)} bed` : '';
			return `${r.roomName}${bedPart}`;
		})
	);
</script>

{#if open}
	<div class="modal-backdrop" onclick={onClose} role="presentation"></div>
	<div class="invoice-modal" role="dialog" aria-labelledby="guest-invoice-title" aria-modal="true" onclick={(e) => e.stopPropagation()}>
		<div class="invoice-card">
			<button type="button" class="btn-close" onclick={onClose} aria-label="Close">×</button>

			<div class="invoice-confirm">
				<div class="invoice-icon" aria-hidden="true">
					<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
						<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
						<polyline points="14 2 14 8 20 8"/>
						<path d="M9 15l2 2 4-4"/>
					</svg>
				</div>
				<h2 id="guest-invoice-title" class="invoice-title">Invoice</h2>
				<p class="invoice-amount">${total.toFixed(2)}</p>
			</div>

			<div class="invoice-details">
				{#each roomBedLines as line}
					<div class="detail-row">
						<span class="detail-label">Accommodation</span>
						<span class="detail-value">{line}</span>
					</div>
				{/each}
				{#each breakdown?.meals ?? [] as meal}
					<div class="detail-row">
						<span class="detail-label">Food fund</span>
						<span class="detail-value">{meal.partySize} × ${meal.perPerson.toFixed(2)}</span>
					</div>
				{/each}
				{#each breakdown?.activities ?? [] as activity}
					<div class="detail-row">
						<span class="detail-label">Activity</span>
						<span class="detail-value">{activity.activityName}</span>
					</div>
				{/each}
				{#each breakdown?.extras ?? [] as extra}
					<div class="detail-row">
						<span class="detail-label">{extra.label}</span>
						<span class="detail-value">× {extra.quantity}, ${extra.amount.toFixed(2)}</span>
					</div>
				{/each}
				{#if roomBedLines.length === 0 && !(breakdown?.meals?.length) && !(breakdown?.activities?.length) && !(breakdown?.extras?.length)}
					<div class="detail-row">
						<span class="detail-label">Total due</span>
						<span class="detail-value">${total.toFixed(2)}</span>
					</div>
				{/if}
			</div>

			<div class="invoice-total-row">
				<span class="total-label">Total due</span>
				<span class="total-amount">${total.toFixed(2)}</span>
			</div>

			{#if canMarkAsPaid && total > 0}
				<form
					method="POST"
					action="?/markInvoicePaid"
					class="invoice-actions"
					use:enhance={async ({ result }) => {
						if (result.type === 'success') {
							await invalidateAll();
							onClose();
						}
					}}
				>
					<input type="hidden" name="userId" value={userId} />
					<button type="submit" class="btn-mark-paid">Mark as paid</button>
				</form>
			{/if}
		</div>
	</div>
{/if}

<style>
	.modal-backdrop {
		position: fixed;
		inset: 0;
		z-index: 1000;
		background: rgba(0, 0, 0, 0.4);
		backdrop-filter: blur(4px);
	}
	.invoice-modal {
		position: fixed;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		z-index: 1001;
		width: 90%;
		max-width: 420px;
	}
	.invoice-card {
		position: relative;
		background: var(--surfaceSolid, #fff);
		border-radius: 16px;
		box-shadow: 0 20px 50px rgba(0, 0, 0, 0.2);
		padding: 2rem 1.75rem;
	}
	.btn-close {
		position: absolute;
		top: 1rem;
		right: 1rem;
		background: none;
		border: none;
		font-size: 1.5rem;
		line-height: 1;
		color: var(--muted, #666);
		cursor: pointer;
		padding: 0.25rem;
		border-radius: 8px;
	}
	.btn-close:hover {
		color: var(--text, #222);
		background: var(--surface2, #f5f5f5);
	}
	.invoice-confirm {
		text-align: center;
		margin-bottom: 1.5rem;
		padding-top: 0.5rem;
	}
	.invoice-icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 64px;
		height: 64px;
		margin-bottom: 1rem;
		background: rgba(34, 197, 94, 0.12);
		color: #16a34a;
		border-radius: 50%;
	}
	.invoice-title {
		margin: 0 0 0.35rem 0;
		font-size: 1.25rem;
		font-weight: 600;
		color: var(--text, #222);
	}
	.invoice-amount {
		margin: 0;
		font-size: 2rem;
		font-weight: 700;
		color: var(--text, #222);
	}
	.invoice-details {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		padding: 1.25rem 0;
		border-top: 1px solid var(--border-soft, #eee);
		border-bottom: 1px solid var(--border-soft, #eee);
	}
	.detail-row {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 1rem;
		font-size: 0.9375rem;
	}
	.detail-label {
		color: var(--muted, #666);
		flex-shrink: 0;
		min-width: 6rem;
	}
	.detail-value {
		text-align: right;
		color: var(--text, #222);
		font-weight: 500;
	}
	.invoice-total-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1.25rem 0 0 0;
		margin-top: 1rem;
	}
	.total-label {
		font-size: 1rem;
		font-weight: 700;
		color: var(--text, #222);
	}
	.total-amount {
		font-size: 1.5rem;
		font-weight: 700;
		color: var(--text, #222);
	}
	.invoice-actions {
		margin-top: 1.5rem;
		padding-top: 1rem;
		border-top: 1px solid var(--border-soft, #eee);
	}
	.btn-mark-paid {
		width: 100%;
		padding: 0.75rem 1.25rem;
		font-size: 1rem;
		font-weight: 600;
		background: var(--text, #222);
		color: white;
		border: none;
		border-radius: 10px;
		cursor: pointer;
		transition: background 0.2s, opacity 0.2s;
	}
	.btn-mark-paid:hover {
		background: #333;
	}
	.btn-mark-paid:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}
</style>
