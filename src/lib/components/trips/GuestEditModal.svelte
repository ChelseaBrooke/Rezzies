<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { deserialize, applyAction } from '$app/forms';

	interface GuestRow {
		userId?: string;
		name: string;
		/** 'host' | 'co-host' | 'guest' */
		role?: string;
		rsvpStatus?: string | null;
		partySize?: number;
		priceApproved?: boolean | null;
		costApprovalStatus?: string | null;
		reApprovalDeadlineAt?: string | null;
		invoicePaid?: boolean | null;
		assignedBedIds?: string[];
		arrivalDate?: string | null;
		departureDate?: string | null;
		toPayTotal?: number | null;
	}

	interface RoomOption {
		id: number;
		name: string;
		beds: { id: string; bedType: string }[];
	}

	interface Props {
		open: boolean;
		row: GuestRow | null;
		rooms: RoomOption[];
		tripId: string;
		/** Whether the viewer of this modal is the trip host (not just co-host). */
		isHostViewer?: boolean;
		checkInDate?: string;
		checkOutDate?: string;
		allowPartialStays: boolean;
		onClose: () => void;
		onRemove?: () => void;
	}

	let {
		open,
		row,
		rooms,
		tripId,
		isHostViewer = false,
		checkInDate = '',
		checkOutDate = '',
		allowPartialStays,
		onClose,
		onRemove
	}: Props = $props();

	let selectedBedIds = $state<string[]>([]);
	let formRsvpStatus = $state('yes');
	let formPartySize = $state(1);
	let formPriceApproved = $state(true);
	let formInvoicePaid = $state(false);
	let submitError = $state<string | null>(null);
	let saving = $state(false);

	// Role change state (separate from the main form)
	let formRole = $state<'guest' | 'co-host'>('guest');
	let roleError = $state<string | null>(null);
	let roleSuccess = $state(false);
	let savingRole = $state(false);
	let savingCostHostApprove = $state(false);
	let costHostApproveError = $state<string | null>(null);

	$effect(() => {
		if (open && row) {
			selectedBedIds = [...(row.assignedBedIds ?? [])];
			formRsvpStatus = row.rsvpStatus ?? 'yes';
			formPartySize = row.partySize || 1;
			formPriceApproved = row.priceApproved ?? false;
			formInvoicePaid = row.invoicePaid ?? false;
			formRole = row.role === 'co-host' ? 'co-host' : 'guest';
			submitError = null;
			roleError = null;
			roleSuccess = false;
			costHostApproveError = null;
		}
	});

	const canChangeRole = $derived(isHostViewer && !!row?.userId && row?.role !== 'host');
	const roleChanged = $derived(formRole !== (row?.role === 'co-host' ? 'co-host' : 'guest'));

	const roleActionUrl = $derived(`/trips/${tripId}/guests?/updateMemberRole`);
	const markCostHostActionUrl = $derived(`/trips/${tripId}/guests?/markCostShareHostApproved`);

	const costReapprovalPending = $derived(row?.costApprovalStatus === 'pending');
	const costShareDisplay = $derived(
		row?.toPayTotal != null && row.toPayTotal > 0
			? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(
					row.toPayTotal
				)
			: '—'
	);
	const reApprovalDeadlineLabel = $derived.by(() => {
		const raw = row?.reApprovalDeadlineAt;
		if (!raw) return '—';
		const d = new Date(raw);
		return d.toLocaleString('en-US', {
			weekday: 'short',
			month: 'short',
			day: 'numeric',
			hour: 'numeric',
			minute: '2-digit',
			hour12: true
		});
	});

	async function handleMarkCostHostApproved() {
		if (!row?.userId || savingCostHostApprove) return;
		costHostApproveError = null;
		savingCostHostApprove = true;
		try {
			const fd = new FormData();
			fd.set('userId', row.userId);
			const res = await fetch(markCostHostActionUrl, { method: 'POST', body: fd });
			const result = deserialize(await res.text());
			if (result.type === 'success') {
				await invalidateAll();
				onClose();
			} else if (result.type === 'failure' && result.data) {
				costHostApproveError =
					(result.data as { message?: string }).message ?? 'Could not mark as approved.';
			}
		} catch (err) {
			costHostApproveError = err instanceof Error ? err.message : 'Request failed.';
		} finally {
			savingCostHostApprove = false;
		}
	}

	async function handleRoleChange() {
		if (!row?.userId || savingRole) return;
		roleError = null;
		roleSuccess = false;
		savingRole = true;
		try {
			const fd = new FormData();
			fd.set('userId', row.userId);
			fd.set('role', formRole);
			const res = await fetch(roleActionUrl, { method: 'POST', body: fd });
			const result = deserialize(await res.text());
			if (result.type === 'success') {
				await invalidateAll();
				roleSuccess = true;
			} else if (result.type === 'failure' && result.data) {
				roleError = (result.data as { message?: string }).message ?? 'Role change failed.';
			}
		} catch (err) {
			roleError = err instanceof Error ? err.message : 'Role change failed.';
		} finally {
			savingRole = false;
		}
	}

	$effect(() => {
		if (!open) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') onClose();
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	});

	function toggleBed(bedId: string) {
		if (selectedBedIds.includes(bedId)) {
			selectedBedIds = selectedBedIds.filter((id) => id !== bedId);
		} else {
			selectedBedIds = [...selectedBedIds, bedId];
		}
	}

	const formActionUrl = $derived(`/trips/${tripId}/guests?/updateGuestDetails`);

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		if (!row || saving) return;
		submitError = null;
		saving = true;
		try {
			const fd = new FormData();
			fd.set('userId', row.userId ?? '');
			fd.set('rsvpStatus', formRsvpStatus);
			fd.set('partySize', String(formPartySize));
			for (const bedId of selectedBedIds) fd.append('bedIds', bedId);
			fd.set('priceApproved', String(formPriceApproved));
			fd.set('invoicePaid', String(formInvoicePaid));
			if (allowPartialStays) {
				fd.set('startDate', row.arrivalDate ?? checkInDate);
				fd.set('endDate', row.departureDate ?? checkOutDate);
			}
			const res = await fetch(formActionUrl, { method: 'POST', body: fd });
			const result = deserialize(await res.text());
			await applyAction(result);
			if (result.type === 'success') {
				await invalidateAll();
				onClose();
			} else if (result.type === 'failure' && result.data) {
				submitError = (result.data as { message?: string }).message ?? 'Save failed. Please try again.';
			}
		} catch (err) {
			submitError = err instanceof Error ? err.message : 'Save failed. Please try again.';
		} finally {
			saving = false;
		}
	}
</script>

{#if open && row}
	<div class="modal-backdrop" onclick={onClose} role="presentation"></div>
	<div class="edit-modal" role="dialog" aria-labelledby="guest-edit-title" aria-modal="true" onclick={(e) => e.stopPropagation()}>
		<div class="edit-card">
			<button type="button" class="btn-close" onclick={onClose} aria-label="Close">×</button>
			<h2 id="guest-edit-title" class="edit-title">Edit {row.name}</h2>

			<form
				method="POST"
				action={formActionUrl}
				class="edit-form"
				onsubmit={handleSubmit}
			>

				{#if submitError}
					<p class="form-error" role="alert">{submitError}</p>
				{/if}

				<div class="form-group">
					<label for="edit-rsvp">RSVP Status</label>
					<select id="edit-rsvp" bind:value={formRsvpStatus} class="form-select">
						<option value="yes">Going</option>
						<option value="no">Not going</option>
						<option value="no-response">No response</option>
					</select>
				</div>

				<div class="form-group">
					<label for="edit-party-size">Party size</label>
					<input
						id="edit-party-size"
						type="number"
						min="1"
						max="20"
						bind:value={formPartySize}
						class="form-input"
					/>
				</div>

				<div class="form-group">
					<label>Room / bed</label>
					<div class="beds-options">
						{#each rooms as room}
							<div class="beds-room">
								<div class="beds-room-name">{room.name?.trim() || `Room ${room.id}`}</div>
								{#each room.beds as bed}
									<label class="beds-option">
										<input
											type="checkbox"
											checked={selectedBedIds.includes(bed.id)}
											onchange={() => toggleBed(bed.id)}
										/>
										<span>{bed.bedType}</span>
									</label>
								{/each}
							</div>
						{/each}
					</div>
				</div>

			{#if costReapprovalPending}
				<div class="cost-reapproval-section">
					<div class="cost-reapproval-title">Cost Re-Approval</div>
					<hr class="cost-reapproval-rule" />
					<p class="cost-reapproval-copy">
						This guest hasn't approved their updated share of {costShareDisplay}.
					</p>
					<p class="cost-reapproval-deadline">Deadline: {reApprovalDeadlineLabel}</p>
					{#if costHostApproveError}
						<p class="form-error" role="alert">{costHostApproveError}</p>
					{/if}
					<button
						type="button"
						class="modal-btn modal-btn--primary cost-reapproval-btn"
						disabled={savingCostHostApprove}
						onclick={handleMarkCostHostApproved}
					>
						{savingCostHostApprove ? 'Saving…' : 'Mark as approved'}
					</button>
				</div>
			{/if}

			{#if (row.rsvpStatus === 'yes' || row.priceApproved != null) && !costReapprovalPending}
				<div class="form-group">
					<label class="checkbox-label">
						<input type="checkbox" bind:checked={formPriceApproved} />
						Price approved
					</label>
				</div>
			{/if}

			{#if row.toPayTotal != null || row.invoicePaid}
				<div class="form-group">
					<label class="checkbox-label">
						<input type="checkbox" bind:checked={formInvoicePaid} />
						Paid
					</label>
				</div>
			{/if}

			<div class="modal-actions modal-actions--top">
				{#if onRemove && row.userId}
					<button type="button" class="modal-btn modal-btn--danger-ghost" onclick={() => { onRemove(); }} disabled={saving}>Remove from trip</button>
				{/if}
			</div>
			<div class="modal-actions">
				<button type="button" class="modal-btn modal-btn--ghost" onclick={onClose} disabled={saving}>Cancel</button>
				<button type="submit" class="modal-btn modal-btn--primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
			</div>
		</form>

		{#if canChangeRole}
			<div class="role-section">
				<div class="role-section-label">Trip role</div>
				<div class="role-row">
					<select
						id="edit-role"
						bind:value={formRole}
						class="form-select role-select"
						disabled={savingRole}
					>
						<option value="guest">Guest</option>
						<option value="co-host">Co-host</option>
					</select>
					<button
						type="button"
						class="modal-btn modal-btn--secondary"
						onclick={handleRoleChange}
						disabled={savingRole || !roleChanged}
					>
						{savingRole ? 'Saving…' : 'Change'}
					</button>
				</div>
				{#if roleSuccess}
					<p class="role-feedback role-feedback--success">Role updated.</p>
				{/if}
				{#if roleError}
					<p class="role-feedback role-feedback--error" role="alert">{roleError}</p>
				{/if}
				{#if formRole === 'co-host'}
					<p class="role-hint">Co-hosts can manage guests, assign rooms, and view invoices.</p>
				{/if}
			</div>
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
	.edit-modal {
		position: fixed;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		z-index: 1001;
		width: 90%;
		max-width: 420px;
	}
	.edit-card {
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
	.edit-title {
		margin: 0 0 1.5rem 0;
		font-size: 1.25rem;
		font-weight: 600;
		color: var(--text, #222);
	}
	.edit-form {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}
	.form-error {
		color: var(--error, #b91c1c);
		font-size: 0.875rem;
		margin: 0 0 0.25rem 0;
	}
	.form-group label {
		display: block;
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--text, #222);
		margin-bottom: 0.35rem;
	}
	.form-select,
	.form-input {
		width: 100%;
		padding: 0.5rem 0.75rem;
		border: 1px solid var(--border, #ddd);
		border-radius: 8px;
		font-size: 0.9375rem;
	}
	.beds-options {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		max-height: 12rem;
		overflow-y: auto;
		padding: 0.5rem;
		border: 1px solid var(--border, #ddd);
		border-radius: 8px;
		background: var(--surface2, #f9fafb);
	}
	.beds-room {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}
	.beds-room-name {
		font-size: 0.8125rem;
		font-weight: 600;
		color: var(--muted, #666);
	}
	.beds-option {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.875rem;
		cursor: pointer;
	}
	.checkbox-label {
		display: flex !important;
		align-items: center;
		gap: 0.5rem;
		cursor: pointer;
		margin-bottom: 0 !important;
	}
	.modal-actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.625rem;
		margin-top: 0.5rem;
		padding-top: 1rem;
		border-top: 1px solid var(--border-soft, #eee);
	}
	.modal-actions--top {
		justify-content: flex-start;
		border-top: none;
		padding-top: 0;
		margin-top: 0;
		margin-bottom: 0.5rem;
	}
	.modal-btn--danger-ghost {
		background: transparent;
		color: var(--error, #b91c1c);
		border: none;
		font-weight: 500;
	}
	.modal-btn--danger-ghost:hover:not(:disabled) {
		background: rgba(185, 28, 28, 0.08);
	}
	.modal-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.4rem;
		padding: 0.5rem 0.875rem;
		font-size: 0.875rem;
		font-weight: 600;
		border-radius: 8px;
		cursor: pointer;
		transition: background 140ms, transform 140ms, box-shadow 140ms;
		border: none;
		font-family: inherit;
	}
	.modal-btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}
	.modal-btn--ghost {
		background: var(--surfaceSolid, #fff);
		color: var(--text, #222);
		border: 1px solid var(--border-soft, #e5e7eb);
	}
	.modal-btn--ghost:hover:not(:disabled) {
		background: var(--surface2, #f3f4f6);
	}
	.modal-btn--primary {
		background: var(--warm, #ce5612);
		color: #fff;
		box-shadow: 0 3px 12px rgba(206, 86, 18, 0.22);
	}
	.modal-btn--primary:hover:not(:disabled) {
		background: var(--chocolate, #a84510);
		transform: translateY(-1px);
	}
	.cost-reapproval-section {
		margin-top: 0.25rem;
		padding: 1rem 0 0.25rem 0;
		border-top: 1px solid var(--border-soft, #eee);
	}
	.cost-reapproval-title {
		font-size: 0.8125rem;
		font-weight: 700;
		color: var(--text, #222);
		letter-spacing: 0.02em;
		text-transform: uppercase;
		margin-bottom: 0.35rem;
	}
	.cost-reapproval-rule {
		border: none;
		border-top: 1px solid var(--border, #ddd);
		margin: 0 0 0.75rem 0;
	}
	.cost-reapproval-copy,
	.cost-reapproval-deadline {
		font-size: 0.875rem;
		color: var(--muted, #666);
		margin: 0 0 0.35rem 0;
		line-height: 1.45;
	}
	.cost-reapproval-btn.modal-btn--primary {
		width: 100%;
		margin-top: 0.35rem;
		background: var(--teal, #0d9488);
		box-shadow: 0 3px 12px rgba(13, 148, 136, 0.25);
	}
	.cost-reapproval-btn.modal-btn--primary:hover:not(:disabled) {
		background: #0f766e;
	}
	.modal-btn--secondary {
		background: var(--surface2, #f3f4f6);
		color: var(--text, #222);
		border: 1px solid var(--border-soft, #e5e7eb);
		white-space: nowrap;
	}
	.modal-btn--secondary:hover:not(:disabled) {
		background: var(--border, #e2e8f0);
	}
	.role-section {
		margin-top: 1.25rem;
		padding-top: 1.25rem;
		border-top: 1px dashed var(--border-soft, #eee);
	}
	.role-section-label {
		font-size: 0.8125rem;
		font-weight: 600;
		color: var(--muted, #888);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		margin-bottom: 0.6rem;
	}
	.role-row {
		display: flex;
		gap: 0.5rem;
		align-items: center;
	}
	.role-select {
		flex: 1;
		min-width: 0;
	}
	.role-feedback {
		font-size: 0.8125rem;
		margin: 0.4rem 0 0;
	}
	.role-feedback--success {
		color: var(--success, #15803d);
	}
	.role-feedback--error {
		color: var(--error, #b91c1c);
	}
	.role-hint {
		font-size: 0.8rem;
		color: var(--muted, #888);
		margin: 0.4rem 0 0;
		line-height: 1.4;
	}
</style>
