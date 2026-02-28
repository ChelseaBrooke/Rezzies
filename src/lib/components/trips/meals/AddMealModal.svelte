<script lang="ts">
	import type { MealGuest } from './types.js';
	import { enhance } from '$app/forms';

	type MealOption = 'ordering-in' | 'cooking' | 'going-out' | 'fend-for-yourself';

	interface Props {
		open: boolean;
		members: MealGuest[];
		tripDays: { value: string; label: string }[];
		prefill?: { date: string; mealType?: string; time?: string } | null;
		formAction?: string;
		onClose: () => void;
		onSuccess: () => void;
	}

	let {
		open,
		members,
		tripDays,
		prefill = null,
		formAction = '?/createMealSlot',
		onClose,
		onSuccess
	}: Props = $props();

	const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
		const h24 = Math.floor((i * 30) / 60);
		const mins = (i * 30) % 60;
		const ampm = h24 < 12 ? 'AM' : 'PM';
		const h12 = h24 === 0 ? 12 : h24 > 12 ? h24 - 12 : h24;
		return `${h12}:${String(mins).padStart(2, '0')} ${ampm}`;
	});

	const MEAL_TYPE_LABELS: Record<string, string> = {
		breakfast: 'Breakfast',
		lunch: 'Lunch',
		dinner: 'Dinner',
		snack: 'Snack'
	};

	let date     = $state(prefill?.date ?? tripDays[0]?.value ?? '');
	let time     = $state(prefill?.time ?? '');
	let mealType = $state(prefill?.mealType ?? 'dinner');
	let option   = $state<MealOption>('cooking');
	let cookId   = $state('');
	let notes    = $state('');
	let submitting = $state(false);

	$effect(() => {
		if (open && prefill) {
			date     = prefill.date;
			time     = prefill.time ?? '';
			mealType = prefill.mealType ?? 'dinner';
		} else if (open && tripDays.length) {
			date = tripDays[0].value;
			time = '';
			mealType = 'dinner';
		}
		if (open) { option = 'cooking'; cookId = ''; notes = ''; }
	});

	// Build the title that gets stored based on the selected option + cook
	const generatedTitle = $derived.by(() => {
		const label = MEAL_TYPE_LABELS[mealType] ?? 'Meal';
		if (option === 'ordering-in')        return 'Ordering In';
		if (option === 'going-out')          return 'Going out to Eat';
		if (option === 'fend-for-yourself')  return 'Fend for yourself';
		// cooking
		const cook = members.find(m => m.id === cookId);
		return cook ? `${label} by ${cook.name}` : `${label} (Chef TBD)`;
	});
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
				<h2 id="add-meal-title">
					Add {MEAL_TYPE_LABELS[mealType] ?? 'Meal'}
				</h2>
				<button type="button" class="modal-close" onclick={onClose} aria-label="Close">×</button>
			</div>

			<form
				method="POST"
				action={formAction}
				use:enhance={() => {
					submitting = true;
					return async ({ result, update }) => {
						await update();
						submitting = false;
						if (result.type === 'success') { onSuccess(); onClose(); }
					};
				}}
				class="modal-form"
			>
				<!-- Hidden fields -->
				<input type="hidden" name="mealType" value={mealType} />
				<input type="hidden" name="date"     value={date} />
				<input type="hidden" name="title"    value={generatedTitle} />
				{#if cookId}<input type="hidden" name="assignedUserId" value={cookId} />{/if}

				<!-- Date + time row -->
				<div class="field-row">
					<div class="field">
						<label class="label" for="add-meal-date">Date</label>
						<select id="add-meal-date" name="_date_display" bind:value={date} onchange={() => {}}>
							{#each tripDays as opt}
								<option value={opt.value}>{opt.label}</option>
							{/each}
						</select>
					</div>
					<div class="field">
						<label class="label" for="add-meal-time">Time</label>
						<select id="add-meal-time" name="time" bind:value={time}>
							<option value="">— Select —</option>
							{#each TIME_OPTIONS as t}
								<option value={t}>{t}</option>
							{/each}
						</select>
					</div>
				</div>

				<!-- Meal option -->
				<div class="field">
					<label class="label">Meal plan</label>
					<div class="option-grid">
						{#each [
							{ value: 'cooking',           label: '👨‍🍳 Chef is cooking' },
							{ value: 'ordering-in',       label: '📦 Ordering In' },
							{ value: 'going-out',         label: '🍽 Going out to Eat' },
							{ value: 'fend-for-yourself', label: '🤷 Fend for yourself' }
						] as opt}
							<label class="option-card" class:selected={option === opt.value}>
								<input type="radio" name="_option" value={opt.value} bind:group={option} />
								{opt.label}
							</label>
						{/each}
					</div>
				</div>

				<!-- Cook selector (only when cooking) -->
				{#if option === 'cooking'}
					<div class="field">
						<label class="label" for="add-meal-cook">Cook</label>
						<select id="add-meal-cook" bind:value={cookId}>
							<option value="">TBD</option>
							{#each members as m}
								<option value={m.id}>{m.name}</option>
							{/each}
						</select>
					</div>
				{/if}

				<!-- Notes -->
				<div class="field">
					<label class="label" for="add-meal-notes">Notes <span class="opt">(optional)</span></label>
					<textarea id="add-meal-notes" name="notes" bind:value={notes} rows="2" placeholder="Menu, location, any details…"></textarea>
				</div>

				<p class="preview-line">Will show as: <strong>{generatedTitle}</strong></p>

				<div class="modal-actions">
					<button type="button" class="btn btn-secondary" onclick={onClose}>Cancel</button>
					<button type="submit" class="btn btn-primary" disabled={submitting || !date}>
						{submitting ? 'Adding…' : 'Add meal'}
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}

<style>
	.modal-backdrop {
		position: fixed; inset: 0;
		background: rgba(0,0,0,.4);
		display: flex; align-items: center; justify-content: center;
		z-index: 1100; padding: 1rem;
	}
	.modal {
		background: var(--surfaceSolid);
		border-radius: var(--radius-2xl);
		box-shadow: var(--shadow-xl);
		max-width: 460px; width: 100%;
		max-height: 90vh; overflow-y: auto;
	}
	.modal-header {
		display: flex; justify-content: space-between; align-items: center;
		padding: 1.25rem 1.25rem 0;
	}
	.modal-header h2 { margin: 0; font-size: 1.25rem; font-weight: 600; color: var(--text); }
	.modal-close {
		background: none; border: none; font-size: 1.5rem; line-height: 1;
		color: var(--muted); cursor: pointer; padding: .25rem;
	}
	.modal-close:hover { color: var(--text); }
	.modal-form { padding: 1.25rem; display: flex; flex-direction: column; gap: 1rem; }
	.field-row { display: grid; grid-template-columns: 1fr 1fr; gap: .75rem; }
	.field { display: flex; flex-direction: column; gap: .35rem; }
	.field .label { font-size: .875rem; font-weight: 500; color: var(--text); }
	.opt { font-weight: 400; color: var(--muted); }
	.field select,
	.field textarea {
		padding: .5rem .75rem; font-size: .9375rem;
		border: 1px solid var(--border); border-radius: var(--radius-md);
		background: var(--surfaceSolid); color: var(--text);
		font-family: inherit;
	}
	.field textarea { resize: vertical; }
	/* Meal option grid */
	.option-grid { display: grid; grid-template-columns: 1fr 1fr; gap: .5rem; }
	.option-card {
		display: flex; align-items: center; gap: .4rem;
		padding: .6rem .75rem;
		border: 1.5px solid var(--border); border-radius: var(--radius-md);
		background: var(--surface2); font-size: .875rem;
		cursor: pointer; transition: border-color .12s, background .12s;
	}
	.option-card.selected { border-color: var(--primary); background: rgba(var(--primary-rgb, 232,93,38),.08); }
	.option-card input { position: absolute; opacity: 0; pointer-events: none; }
	.preview-line { font-size: .8rem; color: var(--muted); margin: 0; }
	.modal-actions { display: flex; justify-content: flex-end; gap: .75rem; margin-top: .25rem; }
	.btn {
		padding: .5rem 1rem; font-size: .9375rem; font-weight: 500;
		border-radius: var(--radius-md); cursor: pointer; border: none;
		transition: background var(--transition-fast);
	}
	.btn-primary { background: var(--primary); color: white; }
	.btn-primary:hover:not(:disabled) { background: var(--primaryHover); }
	.btn-primary:disabled { opacity: .6; cursor: not-allowed; }
	.btn-secondary { background: var(--surface2); color: var(--text); border: 1px solid var(--border); }
	.btn-secondary:hover { background: var(--border-soft); }
</style>
