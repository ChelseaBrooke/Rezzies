<script lang="ts">
	interface Props {
		formData: any;
		nextStep: () => void;
		prevStep: () => void;
	}
	
	let { formData, nextStep, prevStep }: Props = $props();
	
	interface Meal {
		id: string;
		name: string;
		date: string;
		cost: number;
	}
	
	if (!formData.meals) {
		formData.meals = [];
	}
	// Meal planning is always on for new trips (legacy wizard path).
	formData.enableMeals = true;
	
	function addMeal() {
		const newMeal: Meal = {
			id: crypto.randomUUID(),
			name: '',
			date: '',
			cost: 0
		};
		formData.meals = [...formData.meals, newMeal];
	}
	
	function removeMeal(mealId: string) {
		formData.meals = formData.meals.filter((m: Meal) => m.id !== mealId);
	}
</script>

<div class="step-content">
	<h1 class="step-title">Meals</h1>
	<p class="step-subtitle">Optionally plan and track meal costs for your trip</p>
	
	<div class="meals-form">
		<p class="meals-intro">
			Meal planning is included on every trip. Optionally list starter meals below; you can always add or edit them later.
		</p>

			<div class="meals-list">
				{#each formData.meals as meal (meal.id)}
					<div class="meal-card">
						<div class="meal-header">
							<h3>Meal {formData.meals.indexOf(meal) + 1}</h3>
							<button
								type="button"
								class="remove-meal-btn"
								onclick={() => removeMeal(meal.id)}
							>
								×
							</button>
						</div>
						
						<div class="meal-fields">
							<div class="form-group">
								<label>Meal Name</label>
								<input
									type="text"
									bind:value={meal.name}
									placeholder="e.g., Welcome Dinner"
									class="meal-input"
								/>
							</div>
							
							<div class="form-group">
								<label>Date</label>
								<input
									type="date"
									bind:value={meal.date}
									class="meal-input"
								/>
							</div>
							
							<div class="form-group">
								<label>Cost (Optional)</label>
								<input
									type="number"
									bind:value={meal.cost}
									min="0"
									step="0.01"
									placeholder="0.00"
									class="meal-input"
								/>
							</div>
						</div>
					</div>
				{/each}
				
				<button
					type="button"
					class="btn btn-secondary add-meal-btn"
					onclick={addMeal}
				>
					+ Add Meal
				</button>
			</div>
			
			<div class="info-box">
				<p>
					<strong>Note:</strong> You can add meals now or manage them later from the trip management page.
					Guest contributions can be enabled after trip creation.
				</p>
			</div>
	</div>
	
	<div class="step-actions">
		<button type="button" class="btn btn-secondary" onclick={prevStep}>
			← Back
		</button>
		<button type="button" class="btn btn-primary" onclick={nextStep}>
			Continue to Invites →
		</button>
	</div>
</div>

<style>
	.meals-form {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-xl);
	}

	.meals-intro {
		margin: 0;
		font-size: 0.95rem;
		color: var(--color-text-light);
		line-height: 1.6;
	}
	
	.toggle-label {
		display: flex;
		align-items: flex-start;
		gap: var(--spacing-md);
		cursor: pointer;
		padding: var(--spacing-lg);
		border: 2px solid var(--color-border);
		border-radius: var(--radius-lg);
		background: white;
		transition: all var(--transition-base);
	}
	
	.toggle-label:hover {
		border-color: var(--color-primary);
		background: rgba(37, 99, 235, 0.02);
	}
	
	.toggle-input {
		margin-top: 2px;
		accent-color: var(--color-primary);
		width: 20px;
		height: 20px;
	}
	
	.toggle-content {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: var(--spacing-xs);
	}
	
	.toggle-title {
		font-weight: 600;
		font-size: 1.125rem;
		color: var(--color-text);
	}
	
	.toggle-description {
		font-size: 0.95rem;
		color: var(--color-text-light);
	}
	
	.meals-list {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-lg);
	}
	
	.meal-card {
		background: var(--color-bg-light);
		border: 2px solid var(--color-border);
		border-radius: var(--radius-lg);
		padding: var(--spacing-xl);
	}
	
	.meal-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: var(--spacing-lg);
	}
	
	.meal-header h3 {
		font-size: 1.25rem;
		margin: 0;
	}
	
	.remove-meal-btn {
		width: 32px;
		height: 32px;
		border-radius: 50%;
		background: var(--color-error);
		color: white;
		border: none;
		font-size: 1.5rem;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		line-height: 1;
	}
	
	.meal-fields {
		display: grid;
		grid-template-columns: 2fr 1fr 1fr;
		gap: var(--spacing-md);
	}
	
	.form-group {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-xs);
	}
	
	.form-group label {
		font-weight: 500;
		font-size: 0.875rem;
		color: var(--color-text);
	}
	
	.meal-input {
		padding: var(--spacing-md);
		border: 2px solid var(--color-border);
		border-radius: var(--radius-md);
		font-size: 1rem;
		font-family: inherit;
	}
	
	.meal-input:focus {
		outline: none;
		border-color: var(--color-primary);
	}
	
	.add-meal-btn {
		width: 100%;
		margin-top: var(--spacing-md);
	}
	
	.info-box {
		background: rgba(37, 99, 235, 0.05);
		border-left: 4px solid var(--color-primary);
		border-radius: var(--radius-md);
		padding: var(--spacing-lg);
		margin-top: var(--spacing-md);
	}
	
	.info-box p {
		color: var(--color-text);
		line-height: 1.7;
		margin: 0;
	}
	
	@media (max-width: 768px) {
		.meal-fields {
			grid-template-columns: 1fr;
		}
	}
</style>
