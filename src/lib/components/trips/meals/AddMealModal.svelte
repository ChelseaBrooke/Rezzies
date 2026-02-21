<script lang="ts">
	import type { MealType, MealGuest } from './types.js';
	import { MEAL_TYPES, MEAL_LABELS } from './types.js';

	interface Props {
		open: boolean;
		members: MealGuest[];
		tripDays: { value: string; label: string }[];
		prefill?: { date: string; mealType: MealType; time?: string } | null;
		onClose: () => void;
		onSuccess: () => void;
	}

	let { open, members, tripDays, prefill = null, onClose, onSuccess }: Props = $props();

	let mealType = $state<MealType>(prefill?.mealType ?? 'dinner');
	let date = $state(prefill?.date ?? tripDays[0]?.value ?? '');
	let time = $state(prefill?.time ?? '');
	let title = $state('');
	let cookId = $state('');
	let description = $state('');
	let tagVegetarian = $state(false);
	let tagGlutenFree = $state(false);
	let submitting = $state(false);

	$effect(() => {
		if (open && prefill) {
			mealType = prefill.mealType;
			date = prefill.date;
			time = prefill.time ?? '';
		} else if (open && tripDays.length) {
			date = tripDays[0].value;
			mealType = 'dinner';
			time = '';
		}
	});

	const tagsJson = $derived(JSON.stringify([tagVegetarian && 'vegetarian_option', tagGlutenFree && 'gluten_free_option'].filter(Boolean)));
</script>

{#if open}
	<div
		class="modal-backdrop"
		role="dialog"
		aria-modal="true"
		aria-labelledby="add-meal-title"
		onclick={(e) => e.target === e.currentTarget && onClose()}
	>
		<div class="modal">
			<div class="modal-header">
				<h2 id="add-meal-title">Add meal</h2>
				<button type="button" class="modal-close" onclick={onClose} aria-label="Close">×</button>
			</div>
			<form
				method="POST"
				action="?/createMeal"
				use:enhance={() => {
					submitting = true;
					return async ({ result, update }) => {
						await update();
						submitting = false;
						if (result.type === 'success' && result.data?.createMealSuccess) {
							onSuccess();
							onClose();
						}
					};
				}}
				class="modal-form"
			>
				<div class="field">
					<label class="label">Meal type</label>
					<div class="segmented" role="group" aria-label="Meal type">
						{#each MEAL_TYPES as type}
							<label class="segmented-option">
								<input type="radio" name="mealType" value={type} bind:group={mealType} />
								<span>{MEAL_LABELS[type]}</span>
							</label>
						{/each}
					</div>
				</div>
				<div class="field-row">
					<div class="field">
						<label class="label" for="add-meal-date">Date</label>
						<select id="add-meal-date" name="date" bind:value={date} required>
							{#each tripDays as opt}
								<option value={opt.value}>{opt.label}</option>
							{/each}
						</select>
					</div>
					<div class="field">
						<label class="label" for="add-meal-time">Time</label>
						<input id="add-meal-time" type="text" name="time" bind:value={time} placeholder="e.g. 7:00 PM" />
					</div>
				</div>
				<div class="field">
					<label class="label" for="add-meal-title-input">Meal name</label>
					<input id="add-meal-title-input" type="text" name="title" bind:value={title} placeholder="e.g. Taco Night" />
				</div>
				<div class="field">
					<label class="label" for="add-meal-cook">Cook</label>
					<select id="add-meal-cook" name="cookId">
						<option value="">Me (default)</option>
						{#each members as m}
							<option value={m.id}>{m.name}</option>
						{/each}
					</select>
				</div>
				<div class="field">
					<label class="label" for="add-meal-desc">What we're making</label>
					<textarea id="add-meal-desc" name="description" bind:value={description} rows="3" placeholder="Brief description or menu..."></textarea>
				</div>
				<div class="field">
					<span class="label">Options</span>
					<div class="tag-toggles">
						<label class="tag-toggle">
							<input type="checkbox" bind:checked={tagVegetarian} />
							<span>Vegetarian option</span>
						</label>
						<label class="tag-toggle">
							<input type="checkbox" bind:checked={tagGlutenFree} />
							<span>Gluten-free option</span>
						</label>
					</div>
					<input type="hidden" name="tags" value={tagsJson} />
				</div>
				<div class="modal-actions">
					<button type="button" class="btn btn-secondary" onclick={onClose}>Cancel</button>
					<button type="submit" class="btn btn-primary" disabled={submitting || !date}>
						{submitting ? 'Creating…' : 'Create meal'}
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}

<style>
	.modal-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.4);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1100;
		padding: 1rem;
	}
	.modal {
		background: var(--surfaceSolid);
		border-radius: var(--radius-2xl);
		box-shadow: var(--shadow-xl);
		max-width: 440px;
		width: 100%;
		max-height: 90vh;
		overflow-y: auto;
	}
	.modal-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1.25rem 1.25rem 0;
	}
	.modal-header h2 {
		margin: 0;
		font-size: 1.25rem;
		font-weight: 600;
		color: var(--text);
	}
	.modal-close {
		background: none;
		border: none;
		font-size: 1.5rem;
		line-height: 1;
		color: var(--muted);
		cursor: pointer;
		padding: 0.25rem;
	}
	.modal-close:hover {
		color: var(--text);
	}
	.modal-form {
		padding: 1.25rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}
	.field label.label {
		display: block;
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--text);
		margin-bottom: 0.35rem;
	}
	.field input,
	.field select,
	.field textarea {
		width: 100%;
		padding: 0.5rem 0.75rem;
		font-size: 0.9375rem;
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		background: var(--surfaceSolid);
		color: var(--text);
	}
	.field-row {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.75rem;
	}
	.segmented {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem;
	}
	.segmented-option {
		display: inline-flex;
		align-items: center;
		padding: 0.4rem 0.75rem;
		border-radius: var(--radius-md);
		border: 1px solid var(--border);
		background: var(--surface2);
		font-size: 0.8125rem;
		cursor: pointer;
		transition: background var(--transition-fast), border-color var(--transition-fast);
	}
	.segmented-option:has(input:checked) {
		background: var(--primary);
		border-color: var(--primary);
		color: white;
	}
	.segmented-option input {
		position: absolute;
		opacity: 0;
		pointer-events: none;
	}
	.tag-toggles {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}
	.tag-toggle {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		font-size: 0.875rem;
		cursor: pointer;
		color: var(--text);
	}
	.modal-actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.75rem;
		margin-top: 0.5rem;
	}
	.btn {
		padding: 0.5rem 1rem;
		font-size: 0.9375rem;
		font-weight: 500;
		border-radius: var(--radius-md);
		cursor: pointer;
		border: none;
		transition: background var(--transition-fast);
	}
	.btn-primary {
		background: var(--primary);
		color: white;
	}
	.btn-primary:hover:not(:disabled) {
		background: var(--primaryHover);
	}
	.btn-secondary {
		background: var(--surface2);
		color: var(--text);
		border: 1px solid var(--border);
	}
	.btn-secondary:hover {
		background: var(--border-soft);
	}
</style>
