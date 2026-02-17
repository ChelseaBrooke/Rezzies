<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageData } from './$types';

	let { data, form }: { data: PageData; form?: Record<string, unknown> } = $props();

	const MEAL_LABELS: Record<string, string> = {
		breakfast: 'Breakfast',
		lunch: 'Lunch',
		dinner: 'Dinner',
		snack: 'Snacks'
	};

	const slotsByDay = $derived.by(() => {
		const map = new Map<string, typeof data.mealSlots>();
		for (const slot of data.mealSlots ?? []) {
			const key = new Date(slot.date).toISOString().slice(0, 10);
			if (!map.has(key)) map.set(key, []);
			map.get(key)!.push(slot);
		}
		for (const arr of map.values()) {
			arr.sort((a, b) => {
				const order = { breakfast: 0, lunch: 1, dinner: 2, snack: 3 };
				return (order[a.mealType as keyof typeof order] ?? 4) - (order[b.mealType as keyof typeof order] ?? 4);
			});
		}
		const entries = [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
		return entries;
	});

	let editingSlotId = $state<string | null>(null);
	let addSlotDate = $state('');
	let addSlotMealType = $state('dinner');
	let addSlotTime = $state('');
	let addSlotMenu = $state('');
	let addSlotNotes = $state('');

	function closeEdit() {
		editingSlotId = null;
	}

	function handleMealsResult() {
		return async ({
			result,
			update
		}: {
			result: { data?: Record<string, unknown>; type: string };
			update: (opts?: { reset?: boolean }) => Promise<void>;
		}) => {
			await update();
			if (result.type === 'success' && result.data) {
				if (
					result.data.setMealPlanSuccess ||
					result.data.createMealSlotSuccess ||
					result.data.updateMealSlotSuccess ||
					result.data.deleteMealSlotSuccess ||
					result.data.generateSlotsSuccess ||
					result.data.assignMealMakerSuccess
				) {
					closeEdit();
					addSlotDate = '';
					addSlotTime = '';
					addSlotMenu = '';
					addSlotNotes = '';
				}
			}
		};
	}
</script>

<div class="meals-page">
	<div class="container">
		<div class="page-header">
			<h1>Meals: {data.trip.name}</h1>
			<a href="/trips/{data.trip.id}" class="btn btn-secondary">← Back to Trip</a>
		</div>

		<div class="trip-dates">
			<p>
				📅 {data.trip.checkInDate.toLocaleDateString()} - {data.trip.checkOutDate.toLocaleDateString()}
			</p>
		</div>

		<div class="tab-panel">
			{#if !data.mealPlan || !data.mealPlan.enabled}
				<div class="card off-state">
					<div class="card-body">
						<p class="summary">Meal planning is off for this trip.</p>
						{#if form?.setMealPlanError}
							<p class="error-message" role="alert">{form.setMealPlanError as string}</p>
						{/if}
						{#if data.isHost}
							<form method="POST" action="?/setMealPlanEnabled" use:enhance={handleMealsResult()}>
								<input type="hidden" name="enabled" value="true" />
								<button type="submit" class="btn-primary">Enable meal planning</button>
							</form>
						{:else}
							<p class="muted">Ask the host to enable meals if you'd like to plan or sign up for meals.</p>
						{/if}
					</div>
				</div>
			{:else}
				{#if data.isHost}
					<div class="card toolbar">
						<div class="card-body">
							<form method="POST" action="?/setMealPlanEnabled" use:enhance={handleMealsResult()} class="toggle-form">
								<input type="hidden" name="enabled" value="false" />
								<button type="submit" class="btn-secondary">Turn off meal planning</button>
							</form>
							{#if data.trip?.checkInDate && data.trip?.checkOutDate}
								<form method="POST" action="?/generateSlots" use:enhance={handleMealsResult()} class="generate-form">
									<button type="submit" class="btn-secondary">Generate slots from trip dates</button>
								</form>
							{/if}
						</div>
					</div>
				{/if}

				{#if slotsByDay.length === 0 && !data.isHost}
					<div class="card">
						<div class="card-body">
							<p class="empty">No meal slots yet. The host can add a schedule.</p>
						</div>
					</div>
				{:else}
					{#each slotsByDay as [dateKey, slots]}
						{@const dateLabel = new Date(dateKey + 'T12:00:00').toLocaleDateString(undefined, {
							weekday: 'long',
							month: 'short',
							day: 'numeric',
							year: 'numeric'
						})}
						<div class="day-card card">
							<div class="meals-day-header">
								<h2 class="day-title">{dateLabel}</h2>
								{#if data.isHost}
									<button
										type="button"
										class="btn-add-slot"
										onclick={() => {
											addSlotDate = dateKey;
											editingSlotId = 'new-' + dateKey;
										}}
									>
										+ Add slot
									</button>
								{/if}
							</div>
							<div class="card-body">
								<ul class="slots-list">
									{#each slots as slot (slot.id)}
										<li class="slot-item">
											{#if editingSlotId === slot.id}
												<form method="POST" action="?/updateMealSlot" use:enhance={handleMealsResult()} class="slot-edit-form">
													<input type="hidden" name="slotId" value={slot.id} />
													<div class="slot-edit-row">
														<select name="mealType" class="input-sm">
															{#each Object.entries(MEAL_LABELS) as [value, label]}
																<option value={value} selected={slot.mealType === value}>{label}</option>
															{/each}
														</select>
														<input type="date" name="date" value={new Date(slot.date).toISOString().slice(0, 10)} class="input-sm" />
														<input type="time" name="time" value={slot.time ?? ''} class="input-sm" />
													</div>
													<input type="text" name="menuText" value={slot.menuText ?? ''} placeholder="Menu (optional)" class="input-full" />
													<input type="text" name="notes" value={slot.notes ?? ''} placeholder="Notes (optional)" class="input-full" />
													<select name="assignedUserId" class="input-sm assign-select">
														<option value="">Unclaimed</option>
														{#each data.members as member}
															<option value={member.id} selected={slot.assignedUserId === member.id}>
																{member.name}
															</option>
														{/each}
													</select>
													<div class="slot-edit-actions">
														<button type="submit" class="btn-primary btn-sm">Save</button>
														<button type="button" class="btn-secondary btn-sm" onclick={closeEdit}>Cancel</button>
													</div>
												</form>
											{:else}
												<div class="slot-display">
													<span class="slot-type">{MEAL_LABELS[slot.mealType] ?? slot.mealType}</span>
													{#if slot.time}
														<span class="slot-time">{slot.time}</span>
													{/if}
													{#if slot.menuText}
														<span class="slot-menu">{slot.menuText}</span>
													{/if}
													{#if slot.notes}
														<span class="slot-notes">{slot.notes}</span>
													{/if}
													<div class="slot-assign">
														<form method="POST" action="?/updateMealSlot" use:enhance={handleMealsResult()} class="assign-form">
															<input type="hidden" name="slotId" value={slot.id} />
															<input type="hidden" name="mealType" value={slot.mealType} />
															<input type="hidden" name="date" value={new Date(slot.date).toISOString().slice(0, 10)} />
															<input type="hidden" name="time" value={slot.time ?? ''} />
															<input type="hidden" name="menuText" value={slot.menuText ?? ''} />
															<input type="hidden" name="notes" value={slot.notes ?? ''} />
															<select name="assignedUserId" class="assign-select" onchange={(e) => (e.currentTarget as HTMLSelectElement).form?.requestSubmit()}>
																<option value="" selected={!slot.assignedUserId}>Unclaimed</option>
																{#each data.members as member}
																	<option value={member.id} selected={slot.assignedUserId === member.id}>
																		{member.name}
																	</option>
																{/each}
															</select>
														</form>
													</div>
													{#if data.isHost}
														<div class="slot-actions">
															<button type="button" class="btn-icon" onclick={() => (editingSlotId = slot.id)} aria-label="Edit slot">✎</button>
															<form method="POST" action="?/deleteMealSlot" use:enhance={handleMealsResult()} class="inline-form">
																<input type="hidden" name="slotId" value={slot.id} />
																<button type="submit" class="btn-icon btn-danger" aria-label="Delete slot">×</button>
															</form>
														</div>
													{/if}
												</div>
											{/if}
										</li>
									{/each}
								</ul>

								{#if data.isHost && editingSlotId === 'new-' + dateKey}
									<form method="POST" action="?/createMealSlot" use:enhance={handleMealsResult()} class="add-slot-form">
										<input type="hidden" name="date" value={addSlotDate} />
										<input type="hidden" name="mealType" value={addSlotMealType} />
										<input type="hidden" name="time" value={addSlotTime} />
										<input type="hidden" name="menuText" value={addSlotMenu} />
										<input type="hidden" name="notes" value={addSlotNotes} />
										<div class="add-slot-row">
											<select bind:value={addSlotMealType} name="mealType" class="input-sm">
												{#each Object.entries(MEAL_LABELS) as [value, label]}
													<option value={value}>{label}</option>
												{/each}
											</select>
											<input type="time" bind:value={addSlotTime} name="time" class="input-sm" />
											<input type="text" bind:value={addSlotMenu} name="menuText" placeholder="Menu (optional)" class="input-flex" />
											<button type="submit" class="btn-primary btn-sm">Add</button>
											<button type="button" class="btn-secondary btn-sm" onclick={closeEdit}>Cancel</button>
										</div>
									</form>
								{/if}
							</div>
						</div>
					{/each}
				{/if}
			{/if}
		</div>
	</div>
</div>

<style>
	.meals-page {
		min-height: calc(100vh - 80px);
		padding: var(--spacing-xl) var(--spacing-md);
	}

	.container {
		max-width: 1000px;
		margin: 0 auto;
	}

	.page-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: var(--spacing-lg);
	}

	.trip-dates {
		background: white;
		padding: var(--spacing-md);
		border-radius: var(--radius-md);
		margin-bottom: var(--spacing-xl);
		text-align: center;
	}

	.tab-panel {
		min-height: 200px;
	}

	.error-message {
		color: var(--danger, #b91c1c);
		font-size: 0.9rem;
		margin: 0 0 0.75rem 0;
	}

	.card {
		background: var(--surface);
		border-radius: var(--radius-lg);
		border: 1px solid var(--border);
		overflow: hidden;
		margin-bottom: 1rem;
	}

	.card-body {
		padding: 1.25rem;
	}

	.off-state .summary {
		margin: 0 0 1rem 0;
	}

	.muted {
		color: var(--muted);
		font-size: 0.875rem;
		margin: 0;
	}

	.btn-primary {
		padding: 0.5rem 1rem;
		background: var(--primary);
		color: white;
		border: none;
		border-radius: 0.5rem;
		font-weight: 500;
		cursor: pointer;
		font-size: 0.875rem;
	}

	.btn-primary:hover {
		opacity: 0.9;
	}

	.btn-secondary {
		padding: 0.5rem 1rem;
		background: transparent;
		border: 1px solid var(--border);
		border-radius: 0.5rem;
		cursor: pointer;
		font-size: 0.875rem;
		color: var(--text);
	}

	.btn-secondary:hover {
		background: var(--surface2);
	}

	.btn-sm {
		padding: 0.35rem 0.75rem;
		font-size: 0.8125rem;
	}

	.toolbar .card-body {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		align-items: center;
	}

	.toggle-form,
	.generate-form {
		display: inline;
	}

	.meals-day-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.5rem;
		padding: 1rem 1.25rem 0 1.25rem;
	}

	.day-title {
		font-size: 1.125rem;
		font-weight: 600;
		margin: 0;
	}

	.btn-add-slot {
		padding: 0.35rem 0.75rem;
		font-size: 0.8125rem;
		background: var(--primary);
		color: white;
		border: none;
		border-radius: 0.375rem;
		cursor: pointer;
	}

	.btn-add-slot:hover {
		opacity: 0.9;
	}

	.slots-list {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.slot-item {
		padding: 0.75rem 0;
		border-bottom: 1px solid var(--border);
	}

	.slot-item:last-child {
		border-bottom: none;
	}

	.slot-display {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem 1rem;
	}

	.slot-type {
		font-weight: 500;
		min-width: 5rem;
	}

	.slot-time {
		font-size: 0.875rem;
		color: var(--muted);
	}

	.slot-menu,
	.slot-notes {
		font-size: 0.875rem;
		color: var(--muted);
	}

	.slot-assign {
		margin-left: auto;
	}

	.assign-form {
		display: inline;
	}

	.assign-select {
		padding: 0.35rem 0.5rem;
		font-size: 0.8125rem;
		border: 1px solid var(--border);
		border-radius: 0.375rem;
		background: white;
		min-width: 8rem;
		cursor: pointer;
	}

	.slot-actions {
		display: flex;
		gap: 0.25rem;
		align-items: center;
	}

	.btn-icon {
		width: 1.75rem;
		height: 1.75rem;
		padding: 0;
		border: 1px solid var(--border);
		background: white;
		border-radius: 0.25rem;
		cursor: pointer;
		font-size: 0.875rem;
		line-height: 1;
		color: var(--muted);
	}

	.btn-icon:hover {
		background: var(--surface2);
		color: var(--text);
	}

	.btn-icon.btn-danger:hover {
		background: #fef2f2;
		color: #b91c1c;
		border-color: #fecaca;
	}

	.inline-form {
		display: inline;
	}

	.slot-edit-form {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.slot-edit-row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.slot-edit-actions {
		display: flex;
		gap: 0.5rem;
	}

	.input-sm {
		padding: 0.35rem 0.5rem;
		font-size: 0.8125rem;
		border: 1px solid var(--border);
		border-radius: 0.375rem;
		min-width: 0;
	}

	.input-full {
		padding: 0.35rem 0.5rem;
		font-size: 0.875rem;
		border: 1px solid var(--border);
		border-radius: 0.375rem;
		width: 100%;
		max-width: 20rem;
	}

	.input-flex {
		flex: 1;
		min-width: 6rem;
		padding: 0.35rem 0.5rem;
		font-size: 0.8125rem;
		border: 1px solid var(--border);
		border-radius: 0.375rem;
	}

	.add-slot-form {
		margin-top: 0.75rem;
		padding-top: 0.75rem;
		border-top: 1px solid var(--border);
	}

	.add-slot-row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem;
	}

	.empty {
		color: var(--muted);
		margin: 0;
	}

	.btn {
		display: inline-block;
		padding: 0.5rem 1rem;
		font-size: 0.875rem;
		font-weight: 500;
		border-radius: 0.5rem;
		text-decoration: none;
		cursor: pointer;
	}
</style>
