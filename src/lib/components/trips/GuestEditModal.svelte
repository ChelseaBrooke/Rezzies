<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';

	interface GuestRow {
		userId?: string;
		name: string;
		rsvpStatus?: string | null;
		partySize?: number;
		priceApproved?: boolean | null;
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
		checkInDate?: string;
		checkOutDate?: string;
		allowPartialStays: boolean;
		onClose: () => void;
	}

	let {
		open,
		row,
		rooms,
		tripId,
		checkInDate = '',
		checkOutDate = '',
		allowPartialStays,
		onClose
	}: Props = $props();

	let selectedBedIds = $state<string[]>([]);
	let formRsvpStatus = $state('yes');
	let formPartySize = $state(1);
	let formPriceApproved = $state(true);
	let formInvoicePaid = $state(false);

	$effect(() => {
		if (open && row) {
			selectedBedIds = [...(row.assignedBedIds ?? [])];
			formRsvpStatus = row.rsvpStatus ?? 'yes';
			formPartySize = row.partySize || 1;
			formPriceApproved = row.priceApproved ?? false;
			formInvoicePaid = row.invoicePaid ?? false;
		}
	});

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
</script>

{#if open && row}
	<div class="modal-backdrop" onclick={onClose} role="presentation"></div>
	<div class="edit-modal" role="dialog" aria-labelledby="guest-edit-title" aria-modal="true" onclick={(e) => e.stopPropagation()}>
		<div class="edit-card">
			<button type="button" class="btn-close" onclick={onClose} aria-label="Close">×</button>
			<h2 id="guest-edit-title" class="edit-title">Edit {row.name}</h2>

			<form
				method="POST"
				action="?/updateGuestDetails"
				class="edit-form"
				use:enhance={async ({ result }) => {
					if (result.type === 'success') {
						await invalidateAll();
						onClose();
					}
				}}
			>
				<input type="hidden" name="userId" value={row.userId ?? ''} />
				<input type="hidden" name="rsvpStatus" value={formRsvpStatus} />
				<input type="hidden" name="partySize" value={formPartySize} />
				{#each selectedBedIds as bedId}
					<input type="hidden" name="bedIds" value={bedId} />
				{/each}
				<input type="hidden" name="priceApproved" value={String(formPriceApproved)} />
				<input type="hidden" name="invoicePaid" value={String(formInvoicePaid)} />
				{#if allowPartialStays}
					<input type="hidden" name="startDate" value={row.arrivalDate ?? checkInDate} />
					<input type="hidden" name="endDate" value={row.departureDate ?? checkOutDate} />
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

				{#if row.rsvpStatus === 'yes' || row.priceApproved != null}
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

				<div class="modal-actions">
					<button type="button" class="btn-secondary" onclick={onClose}>Cancel</button>
					<button type="submit" class="btn-primary">Save</button>
				</div>
			</form>
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
		gap: 0.75rem;
		margin-top: 0.5rem;
		padding-top: 1rem;
		border-top: 1px solid var(--border-soft, #eee);
	}
</style>
