<script lang="ts">
	import { getContext } from 'svelte';
	import { invalidateAll, goto } from '$app/navigation';

	export type CostReapprovalBlock = {
		tripName: string;
		originalRangeMinCents: number;
		originalRangeMaxCents: number;
		currentShareCents: number;
		reasonLine: string;
		reApprovalDeadline: string;
		breakdown: { rooms?: { amount: number; nights: number }[] } | null;
	};

	function formatDeadlineLabel(d: Date): string {
		return d.toLocaleString('en-US', {
			weekday: 'short',
			month: 'short',
			day: 'numeric',
			hour: 'numeric',
			minute: '2-digit',
			hour12: true
		});
	}

	interface Props {
		tripId: string;
		block: CostReapprovalBlock;
	}

	let { tripId, block }: Props = $props();

	type QuickActions = { showToast?: (msg: string) => void };
	const quick = getContext<QuickActions | undefined>('tripQuickActions');

	let confirmingBackOut = $state(false);
	let busy = $state(false);
	let errorMsg = $state<string | null>(null);

	function formatCents(cents: number): string {
		return new Intl.NumberFormat('en-US', {
			style: 'currency',
			currency: 'USD',
			minimumFractionDigits: 0,
			maximumFractionDigits: 0
		}).format(cents / 100);
	}

	const deadlineDate = $derived(new Date(block.reApprovalDeadline));
	const within24h = $derived.by(() => {
		const ms = deadlineDate.getTime() - Date.now();
		return ms > 0 && ms <= 24 * 60 * 60 * 1000;
	});

	const nightlyLine = $derived.by(() => {
		const b = block.breakdown;
		if (!b?.rooms?.length) return null;
		const r = b.rooms[0];
		if (!r.nights || r.nights <= 0) return null;
		const perNight = r.amount / r.nights;
		return `${formatCents(Math.round(perNight * 100))} × ${r.nights} night${r.nights === 1 ? '' : 's'}`;
	});

	async function onApprove() {
		if (busy) return;
		busy = true;
		errorMsg = null;
		try {
			const res = await fetch(`/api/trips/${tripId}/cost-reapproval/approve`, { method: 'POST' });
			const body = await res.json().catch(() => ({}));
			if (!res.ok) {
				errorMsg = (body as { error?: string }).error ?? 'Could not save. Try again.';
				return;
			}
			const cents = (body as { approvedCostShareCents?: number }).approvedCostShareCents ?? block.currentShareCents;
			quick?.showToast?.(`You're confirmed. Your share is ${formatCents(cents)}.`);
			await invalidateAll();
		} catch {
			errorMsg = 'Something went wrong. Try again.';
		} finally {
			busy = false;
		}
	}

	async function onWithdrawConfirm() {
		if (busy) return;
		busy = true;
		errorMsg = null;
		try {
			const res = await fetch(`/api/trips/${tripId}/cost-reapproval/withdraw`, { method: 'POST' });
			const body = await res.json().catch(() => ({}));
			if (!res.ok) {
				errorMsg = (body as { error?: string }).error ?? 'Could not complete. Try again.';
				return;
			}
			const redirect = (body as { redirect?: string }).redirect;
			if (redirect) await goto(redirect);
			else await invalidateAll();
		} catch {
			errorMsg = 'Something went wrong. Try again.';
		} finally {
			busy = false;
		}
	}
</script>

<div class="crm-backdrop" role="presentation"></div>
<div class="crm-wrap" role="dialog" aria-modal="true" aria-labelledby="crm-title">
	<div class="crm-card">
		{#if confirmingBackOut}
			<h2 id="crm-title" class="crm-title">Are you sure?</h2>
			<p class="crm-muted">Backing out may affect the cost for everyone else on the trip.</p>
			<div class="crm-actions">
				<button type="button" class="crm-btn crm-btn--danger" disabled={busy} onclick={onWithdrawConfirm}>
					{busy ? 'Working…' : 'Yes, remove me from the trip'}
				</button>
				<button type="button" class="crm-btn crm-btn--primary" disabled={busy} onclick={() => (confirmingBackOut = false)}>
					Never mind, stay in
				</button>
			</div>
		{:else}
			<h2 id="crm-title" class="crm-title">Your share has changed</h2>
			<p class="crm-expl">{block.reasonLine}</p>

			<div class="crm-compare">
				<p class="crm-muted">
					You agreed to: {formatCents(block.originalRangeMinCents)} – {formatCents(block.originalRangeMaxCents)}
				</p>
				<p class="crm-now">Your share now: {formatCents(block.currentShareCents)}</p>
				{#if nightlyLine}
					<p class="crm-muted crm-muted--small">{nightlyLine}</p>
				{/if}
			</div>

			<p class:crm-deadline--urgent={within24h} class="crm-deadline">
				{#if within24h}
					⚠️{' '}
				{/if}
				Please respond by {formatDeadlineLabel(deadlineDate)}.
			</p>

			{#if errorMsg}
				<p class="crm-error" role="alert">{errorMsg}</p>
			{/if}

			<div class="crm-actions">
				<button type="button" class="crm-btn crm-btn--primary crm-btn--block" disabled={busy} onclick={onApprove}>
					{busy ? 'Saving…' : `I'm in — I'll pay ${formatCents(block.currentShareCents)}`}
				</button>
				<button
					type="button"
					class="crm-btn crm-btn--ghost-danger crm-btn--block"
					disabled={busy}
					onclick={() => (confirmingBackOut = true)}
				>
					I need to back out
				</button>
			</div>
		{/if}
	</div>
</div>

<style>
	.crm-backdrop {
		position: fixed;
		inset: 0;
		z-index: 2000;
		background: rgba(15, 23, 42, 0.55);
		backdrop-filter: blur(6px);
	}
	.crm-wrap {
		position: fixed;
		inset: 0;
		z-index: 2001;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1.25rem;
		pointer-events: none;
	}
	.crm-card {
		pointer-events: auto;
		width: 100%;
		max-width: 420px;
		background: var(--surfaceSolid, #fff);
		border-radius: 20px;
		padding: 1.75rem 1.5rem;
		box-shadow: 0 24px 64px rgba(0, 0, 0, 0.18);
	}
	.crm-title {
		font-family: 'Fraunces', Georgia, serif;
		font-size: 22px;
		font-weight: 700;
		margin: 0 0 0.75rem 0;
		color: var(--text, #111);
		letter-spacing: -0.02em;
	}
	.crm-expl {
		font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
		font-size: 14px;
		line-height: 1.5;
		color: var(--textMuted, #64748b);
		margin: 0 0 1rem 0;
	}
	.crm-compare {
		margin-bottom: 1rem;
	}
	.crm-muted {
		font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
		font-size: 14px;
		color: var(--textMuted, #64748b);
		margin: 0 0 0.35rem 0;
	}
	.crm-muted--small {
		font-size: 13px;
	}
	.crm-now {
		font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
		font-size: 16px;
		font-weight: 600;
		color: var(--teal, #0d9488);
		margin: 0.25rem 0 0 0;
	}
	.crm-deadline {
		font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
		font-size: 13px;
		color: var(--textSecondary, #475569);
		margin: 0 0 1.25rem 0;
	}
	.crm-deadline--urgent {
		color: #c2410c;
		font-weight: 600;
	}
	.crm-error {
		color: #b91c1c;
		font-size: 0.875rem;
		margin: 0 0 0.75rem 0;
	}
	.crm-actions {
		display: flex;
		flex-direction: column;
		gap: 0.65rem;
	}
	.crm-btn {
		font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
		font-size: 15px;
		font-weight: 600;
		border-radius: 12px;
		padding: 0.75rem 1rem;
		border: none;
		cursor: pointer;
	}
	.crm-btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}
	.crm-btn--block {
		width: 100%;
	}
	.crm-btn--primary {
		background: var(--teal, #0d9488);
		color: #fff;
	}
	.crm-btn--primary:hover:not(:disabled) {
		filter: brightness(1.05);
	}
	.crm-btn--ghost-danger {
		background: transparent;
		color: var(--textMuted, #64748b);
		border: 1px solid rgba(185, 28, 28, 0.45);
	}
	.crm-btn--ghost-danger:hover:not(:disabled) {
		background: rgba(185, 28, 28, 0.06);
	}
	.crm-btn--danger {
		background: rgba(185, 28, 28, 0.12);
		color: #991b1b;
		border: 1px solid rgba(185, 28, 28, 0.35);
	}
</style>
