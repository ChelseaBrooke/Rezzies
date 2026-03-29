<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { tripToDraft } from '$lib/stores/tripDraft.js';
	import type { TripDraft } from '$lib/stores/tripDraft.js';
	import Step1 from '../../../../new/step/[stepNumber]/Step1.svelte';
	import AddOnsStep from '../../../../new/step/[stepNumber]/AddOnsStep.svelte';
	import Step4 from '../../../../new/step/[stepNumber]/Step4.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	/** Build a plain JSON-serializable payload from draft */
	function draftToPayload(d: TripDraft): Record<string, unknown> {
		const address = (d.propertyAddress ?? d.destinationCity ?? '').trim();
		const mealsConfig = d.meals && typeof d.meals === 'object' && 'enabled' in d.meals
			? (d.meals as { enabled: boolean })
			: null;
		const activitiesConfig = d.activities && typeof d.activities === 'object' && 'enabled' in d.activities
			? (d.activities as { enabled: boolean })
			: null;
		return {
			name: d.name,
			description: d.description ?? '',
			listingUrl: d.listingUrl ?? '',
			propertyAddress: address,
			fullAddress: address,
			locationCity: (d.locationCity ?? '').trim() || undefined,
			coverPhoto: d.coverPhoto ?? '',
			galleryPhotos: Array.isArray(d.galleryPhotos) ? d.galleryPhotos : [],
			checkInDate: d.checkInDate,
			checkOutDate: d.checkOutDate,
			rsvpByDate: d.rsvpByDate || undefined,
			totalTripCost: d.costSharingEnabled ? (d.totalTripCost || '0') : '0',
			pricingModel: d.pricingModel ?? 'per-person',
			expectedGuestCount: d.expectedGuestCount ?? null,
			maxOccupancy: d.maxOccupancy ?? null,
			partialStayAllowed: d.partialStayAllowed ?? false,
			costSharingEnabled: d.costSharingEnabled ?? false,
			gamesEnabled: d.gamesEnabled ?? false,
			activitiesEnabled: activitiesConfig?.enabled ?? true,
			mealsEnabled: mealsConfig?.enabled ?? false,
			rooms: (d.rooms ?? []).map((r) => ({
				name: r.name,
				photos: Array.isArray(r.photos) ? r.photos : [],
				beds: Array.isArray(r.beds) ? r.beds : [],
				maxOccupants: r.maxOccupants,
				notes: r.notes ?? r.customRoomDescription ?? ''
			}))
		};
	}

	const tripId = $derived(data.trip?.id ?? '');
	const stepNumber = $derived(data.stepNumber ?? 1);
	const isTripPublished = $derived(Boolean(data.trip?.isPublished));

	// Draft initialized from the live trip
	let draft = $state<TripDraft>(tripToDraft(data.trip));

	function autosave() {
		// No-op for edit mode — save only on explicit Save actions
	}

	function nextStep() {
		goto(`/trips/${tripId}/settings/step/${stepNumber + 1}`);
	}

	function prevStep() {
		if (stepNumber > 1) {
			goto(`/trips/${tripId}/settings/step/${stepNumber - 1}`);
		}
	}

	let validationError = $state<string | null>(null);

	function checkCanProceed(): boolean {
		if (stepNumber === 1) {
			if (!draft.name || !draft.checkInDate || !draft.checkOutDate || draft.rooms.length === 0) {
				return false;
			}
			if (!(Number(draft.expectedGuestCount) >= 1)) {
				return false;
			}
			return true;
		}
		return true;
	}

	const canProceed = $derived(checkCanProceed());

	$effect(() => {
		if (stepNumber === 1 && !canProceed) {
			if (
				draft.name &&
				draft.checkInDate &&
				draft.checkOutDate &&
				draft.rooms.length > 0 &&
				!(Number(draft.expectedGuestCount) >= 1)
			) {
				validationError = 'Please enter a minimum headcount (realistic low).';
			} else {
				validationError = null;
			}
		} else {
			validationError = null;
		}
	});

	function handleNextStep() {
		if (canProceed) {
			validationError = null;
			nextStep();
		}
	}

	let isSaving = $state(false);
	let saveError = $state<string | null>(null);

	async function handleSave() {
		saveError = null;
		isSaving = true;
		try {
			const payload = draftToPayload(draft);
			const res = await fetch(`/api/trips/${tripId}/update`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload)
			});
			const result = await res.json().catch(() => ({}));
			if (!res.ok) {
				console.error('[trip settings save] update failed', {
					tripId,
					status: res.status,
					result
				});
				saveError = result.error || `Save failed (${res.status})`;
				return;
			}
			await invalidateAll();
			goto(`/trips/${tripId}`);
		} catch (e) {
			console.error('[trip settings save] network or parse error', { tripId, error: e });
			saveError = e instanceof Error ? e.message : 'Failed to save trip';
		} finally {
			isSaving = false;
		}
	}

	async function handlePublishAndPay() {
		saveError = null;
		isSaving = true;
		try {
			const payload = draftToPayload(draft);
			const res = await fetch(`/api/trips/${tripId}/update`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload)
			});
			const result = await res.json().catch(() => ({}));
			if (!res.ok) {
				console.error('[trip settings save] update failed (publish path)', {
					tripId,
					status: res.status,
					result
				});
				saveError = result.error || `Save failed (${res.status})`;
				return;
			}
			await invalidateAll();
			goto(`/trips/${tripId}/publish`);
		} catch (e) {
			console.error('[trip settings save] network or parse error (publish path)', {
				tripId,
				error: e
			});
			saveError = e instanceof Error ? e.message : 'Failed to save trip';
		} finally {
			isSaving = false;
		}
	}
</script>

<div class="edit-trip-body">
	<div class="edit-trip-scroll">
		<div class="step-wrapper" class:step-wrapper--grow={stepNumber === 1}>
			{#if stepNumber === 1}
				{#if validationError}
					<div class="validation-error">{validationError}</div>
				{/if}
				<Step1 bind:draft {autosave} {prevStep} handleNextStep={handleNextStep} {canProceed} />
			{:else if stepNumber === 2}
				<AddOnsStep bind:draft {autosave} showHeader={false} />
			{:else if stepNumber === 3}
				<Step4 {draft} />
			{/if}
		</div>
	</div>

	<div class="edit-trip-footer">
		{#if saveError}
			<div class="validation-error validation-error--footer">{saveError}</div>
		{/if}
		<div class="card-footer" class:card-footer--addons={stepNumber === 2}>
			<button type="button" class="btn-back" onclick={prevStep} disabled={stepNumber === 1}>
				Back
			</button>
			<div class="footer-right">
				{#if stepNumber < 3}
					<button
						type="button"
						class="btn-save-exit"
						onclick={handleSave}
						disabled={isSaving || !canProceed}
					>
						{isSaving ? 'Saving…' : 'Save & exit'}
					</button>
					<button
						type="button"
						class="btn-next"
						onclick={handleNextStep}
						disabled={!canProceed}
					>
						Next
					</button>
				{:else}
					{#if !isTripPublished}
						<button
							type="button"
							class="btn-save-exit"
							onclick={handleSave}
							disabled={isSaving}
						>
							{isSaving ? 'Saving…' : 'Save changes'}
						</button>
						<button
							type="button"
							class="btn-publish"
							onclick={handlePublishAndPay}
							disabled={isSaving}
						>
							Publish
						</button>
					{:else}
						<button
							type="button"
							class="btn-publish"
							onclick={handleSave}
							disabled={isSaving}
						>
							{isSaving ? 'Saving…' : 'Save changes'}
						</button>
					{/if}
				{/if}
			</div>
		</div>
	</div>
</div>

<style>
	.edit-trip-body {
		display: flex;
		flex-direction: column;
		flex: 1;
		min-height: 0;
		overflow: hidden;
	}

	.edit-trip-scroll {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		overflow-x: hidden;
		-webkit-overflow-scrolling: touch;
		/* Gutter inside scrollport so add-on neon / shadows aren’t clipped */
		padding-left: 1.25rem;
		padding-right: 1.25rem;
		box-sizing: border-box;
	}

	.edit-trip-footer {
		flex-shrink: 0;
		background: white;
	}

	.step-wrapper {
		display: flex;
		flex-direction: column;
	}

	.step-wrapper--grow {
		flex: 1;
		min-height: 0;
	}

	.card-footer {
		box-sizing: border-box;
		min-height: 4.25rem;
		padding: 1rem 0 1.25rem;
		border-top: 1px solid var(--border);
		background: white;
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	/* Trip Add-Ons (step 2): no divider line */
	.card-footer--addons {
		border-top: none;
		padding-top: 0.5rem;
	}

	.footer-right {
		display: flex;
		flex-direction: row;
		align-items: center;
		gap: 0.75rem;
	}

	.validation-error {
		color: var(--danger);
		font-size: 0.875rem;
		margin: 0;
		text-align: right;
	}

	.validation-error--footer {
		padding: 0.5rem 0 0;
		margin: 0;
		text-align: left;
	}

	.btn-back,
	.btn-save-exit,
	.btn-next,
	.btn-publish {
		padding: 0.75rem 1.5rem;
		border-radius: 0.5rem;
		font-size: 0.9375rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s ease;
		border: none;
		font-family: inherit;
	}

	.btn-back {
		background: transparent;
		color: var(--muted);
	}

	.btn-back:hover:not(:disabled) {
		color: var(--text);
	}

	.btn-back:disabled {
		opacity: 0.5;
		cursor: default;
	}

	.btn-save-exit {
		background: white;
		color: var(--text);
		border: 1px solid var(--border);
	}

	.btn-save-exit:hover:not(:disabled) {
		background: var(--bg);
	}

	.btn-save-exit:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.btn-next,
	.btn-publish {
		background: var(--primary);
		color: white;
	}

	.btn-next:hover:not(:disabled),
	.btn-publish:hover:not(:disabled) {
		background: var(--primary-dark);
	}

	.btn-next:disabled,
	.btn-publish:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	@media (max-width: 768px) {
		.card-footer {
			flex-wrap: wrap;
			gap: 0.75rem;
		}

		.footer-right {
			width: 100%;
			justify-content: flex-end;
		}
	}
</style>
