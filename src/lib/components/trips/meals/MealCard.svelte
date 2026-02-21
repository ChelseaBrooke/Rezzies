<script lang="ts">
	import type { Meal, MealType } from './types.js';
	import { MEAL_LABELS } from './types.js';

	interface Props {
		meal: Meal;
		currentUserId: string;
		isHost: boolean;
		onOpenDetail: (meal: Meal) => void;
	}

	let { meal, currentUserId, onOpenDetail }: Props = $props();

	const isCook = $derived(meal.cookIds.includes(currentUserId));
	const allergyCount = $derived(Object.keys(meal.allergySummary).length);
	const allergyLabel = $derived(meal.attendingCount > 0 && allergyCount > 0 ? `${allergyCount} flag${allergyCount === 1 ? '' : 's'}` : '');
	const timeLabel = $derived(meal.time || '');
</script>

<article
	class="meal-card"
	class:you-cook={isCook}
	data-meal-id={meal.id}
	role="button"
	tabindex="0"
	onclick={() => onOpenDetail(meal)}
	onkeydown={(e) => e.key === 'Enter' && onOpenDetail(meal)}
	aria-label="View {meal.title || MEAL_LABELS[meal.mealType]} details"
>
	<div class="meal-card-main">
		<div class="meal-card-head">
			<span class="meal-time-chip">{timeLabel || MEAL_LABELS[meal.mealType]}</span>
			<span class="meal-type-pill">{MEAL_LABELS[meal.mealType]}</span>
			{#if isCook}
				<span class="meal-badge you-cook">You're cooking</span>
			{/if}
		</div>
		<h3 class="meal-title">{meal.title || MEAL_LABELS[meal.mealType]}</h3>
		{#if meal.cooks.length > 0}
			<p class="meal-cooks">
				Cooked by
				{#each meal.cooks as cook, i}
					<span class="cook-name">{cook.name}</span>{#if i < meal.cooks.length - 1}, {/if}
				{/each}
			</p>
		{/if}
		{#if meal.description}
			<p class="meal-description">{meal.description}</p>
		{/if}
		<div class="meal-chips">
			<span class="chip headcount">Cooking for {meal.attendingCount}</span>
			{#if allergyLabel}
				<span class="chip allergies">Allergies: {allergyLabel}</span>
			{/if}
			{#if meal.optedOutCount > 0}
				<span class="chip opt-outs">Opted out: {meal.optedOutCount}</span>
			{/if}
		</div>
	</div>
	<div class="meal-card-actions">
		<button type="button" class="btn-detail" aria-label="View details">
			<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M9 18l6-6-6-6"/></svg>
		</button>
	</div>
</article>

<style>
	.meal-card {
		display: flex;
		align-items: stretch;
		gap: 1rem;
		background: var(--surfaceSolid);
		border-radius: var(--radius-2xl);
		border: 1px solid var(--border-soft);
		box-shadow: var(--shadow-sm);
		padding: 1.25rem;
		cursor: pointer;
		transition: box-shadow var(--transition-base), border-color var(--transition-base);
		text-align: left;
	}
	.meal-card:hover {
		box-shadow: var(--shadow-md);
		border-color: var(--border);
	}
	.meal-card.you-cook {
		border-left: 3px solid var(--primary);
	}
	.meal-card-main {
		flex: 1;
		min-width: 0;
	}
	.meal-card-head {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 0.35rem;
	}
	.meal-time-chip {
		font-size: 0.8125rem;
		color: var(--muted);
		font-weight: 500;
	}
	.meal-type-pill {
		font-size: 0.75rem;
		padding: 0.2rem 0.5rem;
		border-radius: 999px;
		background: var(--surface2);
		color: var(--muted);
		font-weight: 500;
	}
	.meal-badge.you-cook {
		font-size: 0.75rem;
		padding: 0.2rem 0.5rem;
		border-radius: 999px;
		background: rgba(41, 76, 96, 0.12);
		color: var(--primary);
		font-weight: 500;
	}
	.meal-title {
		font-size: 1.125rem;
		font-weight: 600;
		color: var(--text);
		margin: 0 0 0.25rem 0;
	}
	.meal-cooks {
		font-size: 0.875rem;
		color: var(--muted);
		margin: 0 0 0.5rem 0;
	}
	.cook-name {
		font-weight: 500;
		color: var(--text);
	}
	.meal-description {
		font-size: 0.875rem;
		color: var(--text);
		margin: 0 0 0.75rem 0;
		line-height: 1.4;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
	.meal-chips {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}
	.meal-chips .chip {
		font-size: 0.75rem;
		padding: 0.25rem 0.5rem;
		border-radius: var(--radius-md);
		background: var(--surface2);
		color: var(--muted);
	}
	.meal-card-actions {
		display: flex;
		align-items: center;
	}
	.btn-detail {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 2.5rem;
		height: 2.5rem;
		border: none;
		background: transparent;
		color: var(--muted);
		border-radius: var(--radius-md);
		cursor: pointer;
		transition: background var(--transition-fast), color var(--transition-fast);
	}
	.btn-detail:hover {
		background: var(--surface2);
		color: var(--text);
	}
</style>
