<script lang="ts">
	import type { TripDraft } from '$lib/stores/tripDraft.js';
	
	let { draft, autosave }: { draft: TripDraft; autosave: () => void } = $props();
	
	// Initialize meals and activities if they don't exist
	if (!draft.meals) {
		draft.meals = [];
	}
	if (!draft.activities) {
		draft.activities = [];
	}
	
	function addMeal() {
		if (!draft.meals) draft.meals = [];
		draft.meals = [
			...draft.meals,
			{ id: crypto.randomUUID(), name: '', description: '', price: '', date: '', time: '' }
		];
		autosave();
	}
	
	function removeMeal(index: number) {
		if (!draft.meals) return;
		draft.meals = draft.meals.filter((_, i) => i !== index);
		autosave();
	}
	
	function addActivity() {
		if (!draft.activities) draft.activities = [];
		draft.activities = [
			...draft.activities,
			{ id: crypto.randomUUID(), name: '', description: '', price: '', date: '', time: '' }
		];
		autosave();
	}
	
	function removeActivity(index: number) {
		if (!draft.activities) return;
		draft.activities = draft.activities.filter((_, i) => i !== index);
		autosave();
	}
</script>

<div class="step-content">
	<div class="section-header">
		<h2>Meals</h2>
		<p class="section-description">Add any planned meals for your trip</p>
	</div>
	
	<div class="items-list">
		{#if draft.meals && draft.meals.length > 0}
			{#each draft.meals as meal, index}
				<div class="item-card">
					<div class="item-header">
						<span class="item-number">Meal {index + 1}</span>
						<button type="button" class="btn-remove" onclick={() => removeMeal(index)}>
							×
						</button>
					</div>
					<div class="item-form">
						<div class="form-row">
							<div class="form-group">
								<label>Meal Name</label>
								<input
									type="text"
									bind:value={meal.name}
									oninput={autosave}
									placeholder="e.g., Welcome Dinner"
								/>
							</div>
							<div class="form-group">
								<label>Price (optional)</label>
								<input
									type="number"
									bind:value={meal.price}
									oninput={autosave}
									placeholder="0.00"
									step="0.01"
								/>
							</div>
						</div>
						<div class="form-group">
							<label>Description</label>
							<textarea
								bind:value={meal.description}
								oninput={autosave}
								rows="2"
								placeholder="Meal details..."
							></textarea>
						</div>
						<div class="form-row">
							<div class="form-group">
								<label>Date</label>
								<input
									type="date"
									bind:value={meal.date}
									oninput={autosave}
								/>
							</div>
							<div class="form-group">
								<label>Time</label>
								<input
									type="time"
									bind:value={meal.time}
									oninput={autosave}
								/>
							</div>
						</div>
					</div>
				</div>
			{/each}
		{/if}
		<button type="button" class="btn-add-item" onclick={addMeal}>
			+ Add Meal
		</button>
	</div>
	
	<div class="section-header">
		<h2>Activities</h2>
		<p class="section-description">Add any planned activities or events for your trip</p>
	</div>
	
	<div class="items-list">
		{#if draft.activities && draft.activities.length > 0}
			{#each draft.activities as activity, index}
				<div class="item-card">
					<div class="item-header">
						<span class="item-number">Activity {index + 1}</span>
						<button type="button" class="btn-remove" onclick={() => removeActivity(index)}>
							×
						</button>
					</div>
					<div class="item-form">
						<div class="form-row">
							<div class="form-group">
								<label>Activity Name</label>
								<input
									type="text"
									bind:value={activity.name}
									oninput={autosave}
									placeholder="e.g., Beach Volleyball"
								/>
							</div>
							<div class="form-group">
								<label>Price (optional)</label>
								<input
									type="number"
									bind:value={activity.price}
									oninput={autosave}
									placeholder="0.00"
									step="0.01"
								/>
							</div>
						</div>
						<div class="form-group">
							<label>Description</label>
							<textarea
								bind:value={activity.description}
								oninput={autosave}
								rows="2"
								placeholder="Activity details..."
							></textarea>
						</div>
						<div class="form-row">
							<div class="form-group">
								<label>Date</label>
								<input
									type="date"
									bind:value={activity.date}
									oninput={autosave}
								/>
							</div>
							<div class="form-group">
								<label>Time</label>
								<input
									type="time"
									bind:value={activity.time}
									oninput={autosave}
								/>
							</div>
						</div>
					</div>
				</div>
			{/each}
		{/if}
		<button type="button" class="btn-add-item" onclick={addActivity}>
			+ Add Activity
		</button>
	</div>
</div>

<style>
	.step-content {
		display: flex;
		flex-direction: column;
		gap: 2rem;
	}
	
	.section-header {
		margin-bottom: 1rem;
	}
	
	.section-header h2 {
		font-size: 1.5rem;
		font-weight: 600;
		color: var(--text);
		margin: 0 0 0.5rem 0;
	}
	
	.section-description {
		font-size: 0.875rem;
		color: var(--muted);
		margin: 0;
	}
	
	.items-list {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}
	
	.item-card {
		border: 1px solid var(--border);
		border-radius: 0;
		padding: 1.5rem;
		background: #fafafa;
	}
	
	.item-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1rem;
	}
	
	.item-number {
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--text);
	}
	
	.btn-remove {
		width: 1.75rem;
		height: 1.75rem;
		background: transparent;
		color: var(--muted);
		border: 1px solid var(--border);
		border-radius: 0;
		cursor: pointer;
		font-size: 1.25rem;
		line-height: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.2s ease;
	}
	
	.btn-remove:hover {
		background: #ef4444;
		color: white;
		border-color: #ef4444;
	}
	
	.item-form {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}
	
	.form-row {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1rem;
	}
	
	.form-group {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	
	.form-group label {
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--text);
	}
	
	.form-group input,
	.form-group textarea {
		padding: 0.5rem 0.75rem;
		border: 1px solid var(--border);
		border-radius: 0;
		font-size: 0.875rem;
		font-family: inherit;
		color: var(--text);
		background: white;
		transition: all 0.2s ease;
		width: 100%;
	}
	
	.form-group input:focus,
	.form-group textarea:focus {
		outline: none;
		border-color: var(--primary);
		box-shadow: 0 0 0 3px rgba(30, 58, 138, 0.1);
	}
	
	.form-group textarea {
		resize: vertical;
		min-height: 60px;
	}
	
	.btn-add-item {
		padding: 0.75rem 1.5rem;
		background: var(--primary);
		color: white;
		border: none;
		border-radius: 0;
		cursor: pointer;
		font-size: 0.9375rem;
		font-weight: 500;
		transition: background 0.2s ease;
		width: 100%;
		margin-top: 0.5rem;
	}
	
	.btn-add-item:hover {
		background: var(--primary-dark);
	}
	
	@media (max-width: 768px) {
		.form-row {
			grid-template-columns: 1fr;
		}
	}
</style>
