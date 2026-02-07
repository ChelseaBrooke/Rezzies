<script lang="ts">
	import SectionCard from '$lib/components/wizard/SectionCard.svelte';
	import type { TripDraft, MealsConfig, MealSlot, MealType } from '$lib/stores/tripDraft.js';
	import { getDefaultMealsConfig } from '$lib/stores/tripDraft.js';

	const MEAL_TYPES: { value: MealType; label: string }[] = [
		{ value: 'breakfast', label: 'Breakfast' },
		{ value: 'lunch', label: 'Lunch' },
		{ value: 'dinner', label: 'Dinner' },
		{ value: 'snacks', label: 'Snacks' }
	];

	let { draft, autosave }: { draft: TripDraft; autosave: () => void } = $props();

	// Ensure meals config exists and is object (run once on mount / when draft loads)
	$effect(() => {
		if (!draft.meals || Array.isArray(draft.meals) || !('enabled' in draft.meals)) {
			draft.meals = { ...getDefaultMealsConfig() };
		}
	});

	function ensureMeals() {
		if (!draft.meals || !('enabled' in draft.meals)) {
			draft.meals = { ...getDefaultMealsConfig() };
		}
		autosave();
	}

	function setEnabled(enabled: boolean) {
		ensureMeals();
		const m = draft.meals as MealsConfig;
		m.enabled = enabled;
		if (enabled) {
			if (!m.modes) m.modes = { signups: true, fund: false, informal: false };
			if (!m.expectations)
				m.expectations = {
					participationLevel: 'optional',
					allowGuestsToClaimSlots: true,
					allowGuestsToContributeInstead: true,
					allowOptOut: true
				};
			if (!m.preferences) m.preferences = { collectIndividualPreferencesLater: true };
		}
		autosave();
	}

	function setMode(key: 'signups' | 'fund' | 'informal', value: boolean) {
		ensureMeals();
		(draft.meals as MealsConfig).modes[key] = value;
		if (key === 'signups' && value && !(draft.meals as MealsConfig).signupConfig)
			(draft.meals as MealsConfig).signupConfig = { slots: [], allowHostPreassign: false, includeLunch: false };
		if (key === 'fund' && value && !(draft.meals as MealsConfig).fundConfig)
			(draft.meals as MealsConfig).fundConfig = {
				enabled: true,
				contributionStyle: 'equal',
				managers: []
			};
		if (key === 'informal' && value && !(draft.meals as MealsConfig).informalConfig)
			(draft.meals as MealsConfig).informalConfig = { createPlaceholderSlots: false, placeholderSlots: [] };
		autosave();
	}

	type MealModeValue = 'signups' | 'fund' | 'informal';

	function getSelectedMealMode(): MealModeValue {
		const m = draft.meals as MealsConfig | undefined;
		if (!m?.modes) return 'signups';
		if (m.modes.signups) return 'signups';
		if (m.modes.fund) return 'fund';
		if (m.modes.informal) return 'informal';
		return 'signups';
	}

	function setMealModeSingle(value: MealModeValue) {
		ensureMeals();
		const m = draft.meals as MealsConfig;
		m.modes = { signups: value === 'signups', fund: value === 'fund', informal: value === 'informal' };
		if (value === 'signups' && !m.signupConfig)
			m.signupConfig = { slots: [], allowHostPreassign: false, includeLunch: false };
		if (value === 'fund' && !m.fundConfig)
			m.fundConfig = { enabled: true, contributionStyle: 'equal', managers: [] };
		if (value === 'informal' && !m.informalConfig)
			m.informalConfig = { createPlaceholderSlots: false, placeholderSlots: [] };
		autosave();
	}

	// Generate default slots from check-in/check-out
	const canGenerateSlots = $derived(!!draft.checkInDate && !!draft.checkOutDate);
	const datesChangedAfterSlots = $derived.by(() => {
		const m = draft.meals as MealsConfig | undefined;
		const slots = m?.signupConfig?.slots;
		if (!slots?.length || !draft.checkInDate || !draft.checkOutDate) return false;
		const checkIn = new Date(draft.checkInDate).getTime();
		const checkOut = new Date(draft.checkOutDate).getTime();
		const slotDates = slots.map((s) => new Date(s.date).getTime());
		return slotDates.some((t) => t < checkIn || t > checkOut);
	});

	function generateDefaultSlots() {
		if (!draft.checkInDate || !draft.checkOutDate) return;
		ensureMeals();
		const m = draft.meals as MealsConfig;
		if (!m.signupConfig) m.signupConfig = { slots: [], allowHostPreassign: false, includeLunch: false };
		const start = new Date(draft.checkInDate);
		const end = new Date(draft.checkOutDate);
		const slots: MealSlot[] = [];
		for (let d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
			const dateStr = d.toISOString().slice(0, 10);
			for (const mealType of ['breakfast', 'lunch', 'dinner'] as const) {
				slots.push({
					id: crypto.randomUUID(),
					date: dateStr,
					mealType,
					title: undefined,
					notes: undefined,
					maxVolunteers: undefined,
					allowCoVolunteers: undefined
				});
			}
		}
		m.signupConfig.slots = slots;
		autosave();
	}

	function addSignupSlot() {
		ensureMeals();
		const m = draft.meals as MealsConfig;
		if (!m.signupConfig) m.signupConfig = { slots: [], allowHostPreassign: false, includeLunch: false };
		const base = draft.checkInDate ? new Date(draft.checkInDate) : new Date();
		m.signupConfig.slots = [
			...m.signupConfig.slots,
			{
				id: crypto.randomUUID(),
				date: base.toISOString().slice(0, 10),
				mealType: 'dinner',
				title: undefined,
				notes: undefined,
				maxVolunteers: undefined,
				allowCoVolunteers: undefined
			}
		];
		autosave();
	}

	function removeSignupSlot(id: string) {
		const m = draft.meals as MealsConfig;
		if (!m?.signupConfig) return;
		m.signupConfig.slots = m.signupConfig.slots.filter((s) => s.id !== id);
		autosave();
	}

</script>

<div class="step-content meals-step">
	<!-- Section 1: Enable Meals -->
	<SectionCard title="Include shared meals" icon="🍽️">
		<div class="section-1-body">
			<label class="toggle-row">
				<input
					type="checkbox"
					checked={(draft.meals as MealsConfig)?.enabled ?? false}
					onchange={(e) => setEnabled((e.currentTarget as HTMLInputElement).checked)}
				/>
				<span class="toggle-title">Include shared meals for this trip?</span>
			</label>
			<p class="helper-copy">Set expectations for cooking, chipping in, or planning meals together.</p>
		</div>
	</SectionCard>

	{#if (draft.meals as MealsConfig)?.enabled}
		<!-- Section 2: Choose Meal Setup Style (single select, all options visible) -->
		<SectionCard title="How do you want to handle meals?" icon="📋">
			<div class="section-2-body">
				<label class="meal-mode-option">
					<input
						type="radio"
						name="meal-mode"
						value="signups"
						checked={getSelectedMealMode() === 'signups'}
						onchange={() => setMealModeSingle('signups')}
					/>
					<span class="meal-mode-label">Meal sign-ups (people volunteer for specific meals)</span>
				</label>
				<label class="meal-mode-option">
					<input
						type="radio"
						name="meal-mode"
						value="fund"
						checked={getSelectedMealMode() === 'fund'}
						onchange={() => setMealModeSingle('fund')}
					/>
					<span class="meal-mode-label">Shared food fund (everyone chips in for groceries/food)</span>
				</label>
				<label class="meal-mode-option">
					<input
						type="radio"
						name="meal-mode"
						value="informal"
						checked={getSelectedMealMode() === 'informal'}
						onchange={() => setMealModeSingle('informal')}
					/>
					<span class="meal-mode-label">Informal (no assignments or money—just notes/visibility)</span>
				</label>
			</div>
		</SectionCard>

		<!-- Section 3: Configure (conditional) -->
		{#if (draft.meals as MealsConfig)?.modes?.signups}
			<SectionCard title="Meal sign-ups" icon="📅">
				<div class="section-3-body">
					{#if !canGenerateSlots}
						<p class="helper-copy muted">Set dates in Basics & Rooms first to generate default slots.</p>
					{:else}
						<button type="button" class="btn-secondary" onclick={generateDefaultSlots}>Generate default slots</button>
						{#if datesChangedAfterSlots}
							<p class="warning-copy">Dates changed—review your meal slots.</p>
						{/if}
					{/if}
					<div class="slots-list">
						{#each ((draft.meals as MealsConfig)?.signupConfig?.slots ?? []) as slot (slot.id)}
							<div class="slot-row">
								<input type="date" bind:value={slot.date} oninput={autosave} class="input-small" />
								<select bind:value={slot.mealType} onchange={autosave} class="input-small">
									{#each MEAL_TYPES as opt}
										<option value={opt.value}>{opt.label}</option>
									{/each}
								</select>
								<input type="text" bind:value={slot.title} oninput={autosave} placeholder="Title (optional)" class="input-flex" />
								<input type="text" bind:value={slot.notes} oninput={autosave} placeholder="Notes (optional)" class="input-flex" />
								<button type="button" class="btn-remove-slot" onclick={() => removeSignupSlot(slot.id)} title="Remove slot">×</button>
							</div>
						{/each}
					</div>
					<button type="button" class="btn-add" onclick={addSignupSlot}>+ Add slot</button>
					<div class="toggles-inline">
						<label class="toggle-small">
							<input
								type="checkbox"
								checked={(draft.meals as MealsConfig)?.signupConfig?.slots?.some((s) => s.allowCoVolunteers) ?? false}
								onchange={(e) => {
									ensureMeals();
									const m = draft.meals as MealsConfig;
									if (m.signupConfig)
										m.signupConfig.slots = (m.signupConfig.slots ?? []).map((s) => ({
											...s,
											allowCoVolunteers: (e.currentTarget as HTMLInputElement).checked
										}));
									autosave();
								}}
							/>
							<span>Allow co-volunteers</span>
						</label>
					</div>
				</div>
			</SectionCard>
		{/if}

		{#if (draft.meals as MealsConfig)?.modes?.fund}
			<SectionCard title="Shared food fund" icon="💰">
				<div class="section-3-body">
					<div class="form-group">
						<label class="form-label">Contribution per person ($)</label>
						<input
							type="number"
							value={(draft.meals as MealsConfig)?.fundConfig?.suggestedContributionPerPerson ?? ''}
							oninput={(e) => {
								ensureMeals();
								const v = (e.currentTarget as HTMLInputElement).valueAsNumber;
								(draft.meals as MealsConfig).fundConfig!.suggestedContributionPerPerson = isNaN(v) ? undefined : v;
								autosave();
							}}
							placeholder="0.00"
							min="0"
							step="0.01"
							class="form-input contribution-input"
						/>
						<p class="fund-note">This will be added to every guest's tab automatically if this option is chosen.</p>
					</div>
					<div class="form-group">
						<label class="form-label">What does the fund cover?</label>
						<textarea
							value={(draft.meals as MealsConfig)?.fundConfig?.notes ?? ''}
							oninput={(e) => {
								ensureMeals();
								(draft.meals as MealsConfig).fundConfig!.notes = (e.currentTarget as HTMLTextAreaElement).value;
								autosave();
							}}
							placeholder="e.g., groceries, group dinners"
							class="form-textarea"
							rows="2"
						></textarea>
					</div>
				</div>
			</SectionCard>
		{/if}

		{#if (draft.meals as MealsConfig)?.modes?.informal}
			<SectionCard title="Informal meals" icon="📝">
				<div class="section-3-body">
					<div class="form-group">
						<label class="form-label">Any meal expectations? (e.g., “we’ll mostly eat out”)</label>
						<textarea
							value={(draft.meals as MealsConfig)?.informalConfig?.notes ?? ''}
							oninput={(e) => {
								ensureMeals();
								if (!(draft.meals as MealsConfig).informalConfig) (draft.meals as MealsConfig).informalConfig = { createPlaceholderSlots: false, placeholderSlots: [] };
								(draft.meals as MealsConfig).informalConfig!.notes = (e.currentTarget as HTMLTextAreaElement).value;
								autosave();
							}}
							placeholder="Optional notes"
							class="form-textarea"
							rows="2"
						></textarea>
					</div>
				</div>
			</SectionCard>
		{/if}

	{/if}
</div>

<style>
	.meals-step {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
		width: 100%;
		max-width: 100%;
	}
	.section-1-body,
	.section-2-body,
	.section-3-body,
	.section-4-body {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}
	.helper-copy {
		font-size: 0.875rem;
		color: var(--muted);
		margin: 0;
	}
	.helper-copy.muted {
		color: var(--muted);
		font-style: italic;
	}
	.warning-copy {
		font-size: 0.875rem;
		color: #b45309;
		margin: 0;
	}
	.toggle-row,
	.checkbox-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		cursor: pointer;
		font-size: 0.9375rem;
		color: var(--text);
	}
	.toggle-title {
		font-weight: 500;
	}
	.tag.recommended {
		font-size: 0.7rem;
		padding: 0.15rem 0.4rem;
		background: rgba(30, 58, 138, 0.12);
		color: var(--primary);
		border-radius: 4px;
		margin-left: 0.25rem;
	}
	.btn-secondary {
		padding: 0.5rem 1rem;
		background: white;
		border: 1px solid var(--border);
		border-radius: 0.5rem;
		font-size: 0.875rem;
		cursor: pointer;
		color: var(--text);
		align-self: flex-start;
	}
	.btn-secondary:hover {
		background: var(--bg);
	}
	.slots-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.slot-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
	}
	.input-small {
		width: 8rem;
		min-width: 0;
		padding: 0.375rem 0.5rem;
		border: 1px solid var(--border);
		border-radius: 0.25rem;
		font-size: 0.8125rem;
	}
	.input-flex {
		flex: 1;
		min-width: 6rem;
		padding: 0.375rem 0.5rem;
		border: 1px solid var(--border);
		border-radius: 0.25rem;
		font-size: 0.8125rem;
	}
	.input-tiny {
		width: 4rem;
		padding: 0.375rem 0.5rem;
		border: 1px solid var(--border);
		border-radius: 0.25rem;
		font-size: 0.8125rem;
	}
	.btn-remove-slot {
		width: 1.75rem;
		height: 1.75rem;
		padding: 0;
		border: 1px solid var(--border);
		background: white;
		color: var(--muted);
		border-radius: 0.25rem;
		cursor: pointer;
		font-size: 1.1rem;
		line-height: 1;
		flex-shrink: 0;
	}
	.btn-remove-slot:hover {
		background: #fef2f2;
		color: var(--danger);
		border-color: #fecaca;
	}
	.btn-add {
		padding: 0.5rem 1rem;
		background: var(--primary);
		color: white;
		border: none;
		border-radius: 0.5rem;
		font-size: 0.875rem;
		cursor: pointer;
		align-self: flex-start;
	}
	.btn-add:hover {
		opacity: 0.9;
	}
	.btn-add.small {
		font-size: 0.8125rem;
		padding: 0.375rem 0.75rem;
	}
	.toggles-inline,
	.toggle-small {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.875rem;
		color: var(--text);
		cursor: pointer;
	}
	.toggles-inline {
		flex-wrap: wrap;
		gap: 1rem;
	}
	.form-group {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}
	.form-label {
		font-size: 0.8125rem;
		font-weight: 500;
		color: var(--text);
	}
	.form-input,
	.form-select,
	.form-textarea {
		padding: 0.5rem 0.6rem;
		border: 1px solid var(--border);
		border-radius: 0.25rem;
		font-size: 0.875rem;
		color: var(--text);
		background: white;
		width: 100%;
		max-width: 320px;
	}
	.meal-mode-option {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		cursor: pointer;
		font-size: 0.9375rem;
		color: var(--text);
		padding: 0.35rem 0;
	}
	.meal-mode-option input[type="radio"] {
		width: 1rem;
		height: 1rem;
		cursor: pointer;
		accent-color: var(--primary);
		flex-shrink: 0;
	}
	.meal-mode-label {
		flex: 1;
	}
	.form-textarea {
		resize: vertical;
		min-height: 60px;
	}
	.fund-note {
		font-size: 0.8125rem;
		color: var(--muted);
		margin: 0.35rem 0 0 0;
		line-height: 1.4;
	}
	.managers-block {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.manager-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	.input-half {
		flex: 1;
		min-width: 0;
		padding: 0.375rem 0.5rem;
		border: 1px solid var(--border);
		border-radius: 0.25rem;
		font-size: 0.8125rem;
	}
	.radio-group {
		display: flex;
		gap: 1rem;
	}
	.radio-label {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		cursor: pointer;
		font-size: 0.875rem;
		color: var(--text);
	}
</style>
