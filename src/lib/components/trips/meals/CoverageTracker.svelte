<script lang="ts">
	import type { MealSlotCoverage, MealType } from './types.js';
	import { MEAL_LABELS } from './types.js';

	interface Props {
		coverage: MealSlotCoverage[];
		tripDays: string[];
		onOpenSlot: (date: string, mealType: MealType) => void;
		onScrollToMeal: (mealId: string) => void;
	}

	let { coverage, tripDays, onOpenSlot, onScrollToMeal }: Props = $props();
</script>

<section class="coverage-section" id="meal-coverage" aria-labelledby="coverage-heading">
	<div class="coverage-header">
		<h2 id="coverage-heading" class="coverage-title">Meal coverage</h2>
		<div class="coverage-legend">
			<span class="legend-dot covered"></span>
			<span class="legend-label">Covered</span>
			<span class="legend-dot open"></span>
			<span class="legend-label">Open</span>
		</div>
	</div>
	<div class="coverage-strip" role="grid" aria-label="Meal coverage by day">
		{#each tripDays as date}
			{@const dayLabel = new Date(date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
			<div class="coverage-day" role="row">
				<div class="coverage-day-label" role="rowheader">{dayLabel}</div>
				<div class="coverage-slots">
					{#each ['breakfast', 'lunch', 'dinner', 'snack'] as mealType}
						{@const slot = coverage.find((c) => c.date === date && c.mealType === mealType)}
						{#if slot?.meal}
							<button
								type="button"
								class="coverage-cell covered"
								onclick={() => onScrollToMeal(slot.meal!.id)}
								title="{slot.meal!.title || MEAL_LABELS[mealType as MealType]}"
							>
								<span class="cell-meal-name">{slot.meal!.title || MEAL_LABELS[mealType as MealType]}</span>
								{#if slot.meal!.cooks?.[0]}
									<span class="cell-avatar" aria-hidden="true">{slot.meal!.cooks[0].name.charAt(0).toUpperCase()}</span>
								{/if}
							</button>
						{:else}
							<button
								type="button"
								class="coverage-cell open"
								onclick={() => onOpenSlot(date, mealType as MealType)}
								aria-label="Add {MEAL_LABELS[mealType as MealType]} for {dayLabel}"
							>
								Add
							</button>
						{/if}
					{/each}
				</div>
			</div>
		{/each}
	</div>
</section>

<style>
	.coverage-section {
		background: var(--surfaceSolid);
		border-radius: var(--radius-2xl);
		box-shadow: var(--shadow-sm);
		border: 1px solid var(--border-soft);
		padding: 1.25rem;
		margin-bottom: 1.5rem;
	}
	.coverage-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1rem;
		flex-wrap: wrap;
		gap: 0.5rem;
	}
	.coverage-title {
		font-size: 1rem;
		font-weight: 600;
		color: var(--text);
		margin: 0;
	}
	.coverage-legend {
		display: flex;
		align-items: center;
		gap: 0.5rem 1rem;
		font-size: 0.8125rem;
		color: var(--muted);
	}
	.legend-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
	}
	.legend-dot.covered {
		background: var(--primary);
	}
	.legend-dot.open {
		background: var(--surface2);
		border: 1px solid var(--border);
	}
	.coverage-strip {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.coverage-day {
		display: grid;
		grid-template-columns: 120px 1fr;
		align-items: center;
		gap: 0.75rem;
		min-height: 2.5rem;
	}
	.coverage-day-label {
		font-size: 0.8125rem;
		color: var(--muted);
		font-weight: 500;
	}
	.coverage-slots {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 0.5rem;
	}
	.coverage-cell {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.35rem;
		padding: 0.4rem 0.5rem;
		border-radius: var(--radius-lg);
		font-size: 0.75rem;
		font-weight: 500;
		border: none;
		cursor: pointer;
		transition: background var(--transition-fast), box-shadow var(--transition-fast);
		text-align: center;
		min-height: 2rem;
	}
	.coverage-cell.covered {
		background: var(--surface2);
		color: var(--text);
		border: 1px solid var(--border-soft);
	}
	.coverage-cell.covered:hover {
		background: var(--border-soft);
		box-shadow: var(--shadow-sm);
	}
	.coverage-cell.open {
		background: var(--surface2);
		color: var(--muted);
		border: 1px dashed var(--border);
	}
	.coverage-cell.open:hover {
		background: var(--bg);
		color: var(--primary);
		border-color: var(--primary);
	}
	.cell-meal-name {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		max-width: 100%;
	}
	.cell-avatar {
		width: 1.25rem;
		height: 1.25rem;
		border-radius: 50%;
		background: var(--primary);
		color: white;
		font-size: 0.65rem;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}
	@media (max-width: 640px) {
		.coverage-day {
			grid-template-columns: 1fr;
		}
		.coverage-day-label {
			margin-bottom: -0.25rem;
		}
		.coverage-slots {
			grid-template-columns: repeat(2, 1fr);
		}
	}
</style>
