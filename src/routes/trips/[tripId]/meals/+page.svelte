<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageData } from './$types';
	import type { Meal, MealType } from '$lib/components/trips/meals/types.js';
	import CoverageTracker from '$lib/components/trips/meals/CoverageTracker.svelte';
	import MealCard from '$lib/components/trips/meals/MealCard.svelte';
	import MealDetailDrawer from '$lib/components/trips/meals/MealDetailDrawer.svelte';
	import AddMealModal from '$lib/components/trips/meals/AddMealModal.svelte';

	let { data, form }: { data: PageData; form?: Record<string, unknown> } = $props();

	let addModalOpen = $state(false);
	let addModalPrefill = $state<{ date: string; mealType: MealType; time?: string } | null>(null);
	let detailMeal = $state<Meal | null>(null);
	let detailOpen = $state(false);

	const tripDays = $derived(data.trip?.checkInDate && data.trip?.checkOutDate
		? (() => {
				const start = new Date(data.trip!.checkInDate);
				const end = new Date(data.trip!.checkOutDate);
				const out: string[] = [];
				for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
					out.push(d.toISOString().slice(0, 10));
				}
				return out;
			})()
		: []);

	const tripDayOptions = $derived(
		tripDays.map((date) => ({
			value: date,
			label: new Date(date + 'T12:00:00').toLocaleDateString('en-US', {
				weekday: 'short',
				month: 'short',
				day: 'numeric',
				year: 'numeric'
			})
		}))
	);

	function openAddModal(date?: string, mealType?: MealType, time?: string) {
		addModalPrefill = date && mealType ? { date, mealType, time } : null;
		addModalOpen = true;
	}

	function closeAddModal() {
		addModalOpen = false;
		addModalPrefill = null;
	}

	function openDetail(meal: Meal) {
		detailMeal = meal;
		detailOpen = true;
	}

	function closeDetail() {
		detailOpen = false;
		detailMeal = null;
	}

	function scrollToMeal(mealId: string) {
		const el = document.querySelector(`[data-meal-id="${mealId}"]`);
		el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
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
					result.data.createMealSuccess ||
					result.data.setMealAttendanceSuccess ||
					result.data.updateMealSlotSuccess ||
					result.data.deleteMealSlotSuccess
				) {
					closeDetail();
				}
			}
		};
	}

	const mealPlanEnabled = $derived(!!data.mealPlan?.enabled);
	const openSlotsCount = $derived(
		data.coverage?.filter((c: { meal: Meal | null }) => !c.meal).length ?? 0
	);
</script>

<svelte:head>
	<title>Meals – {data.trip?.name}</title>
</svelte:head>

<div class="meals-page">
	<div class="container">
		<!-- A) Top Header -->
		<header class="page-header">
			<div class="header-text">
				<h1>Meals</h1>
				<p class="subtext">Meals created here automatically appear on everyone's itinerary.</p>
			</div>
			<div class="header-actions">
				<a href="#meal-coverage" class="btn btn-secondary">Meal coverage</a>
				<button type="button" class="btn btn-primary" onclick={() => openAddModal()}>
					Add meal
				</button>
			</div>
		</header>

		{#if form?.createMealSuccess}
			<div class="toast success" role="status">Meal added to itinerary.</div>
		{/if}
		{#if form?.createMealError}
			<div class="toast error" role="alert">{form.createMealError}</div>
		{/if}
		{#if form?.setMealAttendanceError}
			<div class="toast error" role="alert">{form.setMealAttendanceError}</div>
		{/if}

		{#if !mealPlanEnabled}
			<!-- Off state: enable meal planning -->
			<div class="card off-state">
				<div class="card-body">
					<p class="summary">Meal planning is off for this trip.</p>
					{#if form?.setMealPlanError}
						<p class="error-message" role="alert">{form.setMealPlanError}</p>
					{/if}
					{#if data.isHost}
						<form method="POST" action="?/setMealPlanEnabled" use:enhance={handleMealsResult()}>
							<input type="hidden" name="enabled" value="true" />
							<button type="submit" class="btn btn-primary">Enable meal planning</button>
						</form>
					{:else}
						<p class="muted">Ask the host to enable meals to plan or sign up for meals.</p>
					{/if}
				</div>
			</div>
		{:else}
			<!-- B) Coverage Tracker -->
			{#if tripDays.length > 0}
				<CoverageTracker
					coverage={data.coverage ?? []}
					tripDays={tripDays}
					onOpenSlot={openAddModal}
					onScrollToMeal={scrollToMeal}
				/>
			{/if}

			<!-- C) Meal Timeline by Day -->
			{#if data.daySections && data.daySections.length > 0}
				{#if openSlotsCount > 0}
					<p class="open-slots-hint">{openSlotsCount} meal slot{openSlotsCount === 1 ? '' : 's'} still open</p>
				{/if}
				<div class="day-sections">
					{#each data.daySections as section (section.date)}
						<section class="day-section" data-day={section.date}>
							<h2 class="day-header">{section.label}</h2>
							<div class="meal-cards">
								{#each section.meals as meal (meal.id)}
									<MealCard
										meal={meal}
										currentUserId={data.user?.id ?? ''}
										isHost={data.isHost ?? false}
										onOpenDetail={openDetail}
									/>
								{/each}
							</div>
						</section>
					{/each}
				</div>
			{:else}
				<!-- E) Empty state -->
				<div class="empty-state">
					<div class="empty-icon" aria-hidden="true">🍽️</div>
					<p class="empty-title">No meals yet</p>
					<p class="empty-hint">Add your first meal and it'll show on everyone's itinerary.</p>
					<button type="button" class="btn btn-primary" onclick={() => openAddModal()}>
						Add first meal
					</button>
				</div>
			{/if}
		{/if}
	</div>

	<!-- Add Meal Modal -->
	<AddMealModal
		open={addModalOpen}
		members={data.members ?? []}
		tripDays={tripDayOptions}
		prefill={addModalPrefill}
		onClose={closeAddModal}
		onSuccess={() => {}}
	/>

	<!-- Meal Detail Drawer -->
	<MealDetailDrawer
		meal={detailMeal}
		open={detailOpen}
		currentUserId={data.user?.id ?? ''}
		isHost={data.isHost ?? false}
		onClose={closeDetail}
		onUpdate={() => {}}
	/>
</div>

<style>
	.meals-page {
		min-height: calc(100vh - 80px);
		padding: var(--spacing-lg) var(--spacing-md) 2rem;
		background: var(--bg);
	}
	.container {
		max-width: 900px;
		margin: 0 auto;
	}
	.page-header {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		align-items: flex-start;
		gap: 1rem;
		margin-bottom: 1.5rem;
	}
	.header-text h1 {
		font-size: 1.75rem;
		font-weight: 600;
		color: var(--text);
		margin: 0 0 0.25rem 0;
	}
	.subtext {
		font-size: 0.9375rem;
		color: var(--muted);
		margin: 0;
	}
	.header-actions {
		display: flex;
		gap: 0.5rem;
		align-items: center;
	}
	.btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0.5rem 1rem;
		font-size: 0.9375rem;
		font-weight: 500;
		border-radius: var(--radius-lg);
		border: none;
		cursor: pointer;
		text-decoration: none;
		transition: background var(--transition-fast);
	}
	.btn-primary {
		background: var(--primary);
		color: white;
	}
	.btn-primary:hover {
		background: var(--primaryHover);
	}
	.btn-secondary {
		background: var(--surfaceSolid);
		color: var(--text);
		border: 1px solid var(--border);
	}
	.btn-secondary:hover {
		background: var(--surface2);
	}
	.toast {
		padding: 0.75rem 1rem;
		border-radius: var(--radius-lg);
		margin-bottom: 1rem;
		font-size: 0.9375rem;
	}
	.toast.success {
		background: rgba(41, 76, 96, 0.1);
		border: 1px solid var(--border-soft);
		color: var(--text);
	}
	.toast.error {
		background: rgba(115, 44, 44, 0.08);
		border: 1px solid rgba(115, 44, 44, 0.2);
		color: var(--danger);
	}
	.card {
		background: var(--surfaceSolid);
		border-radius: var(--radius-2xl);
		border: 1px solid var(--border-soft);
		box-shadow: var(--shadow-sm);
		margin-bottom: 1rem;
	}
	.card-body {
		padding: 1.5rem;
	}
	.off-state .summary {
		margin: 0 0 1rem 0;
		font-size: 1rem;
		color: var(--text);
	}
	.error-message {
		color: var(--danger);
		font-size: 0.875rem;
		margin: 0 0 0.75rem 0;
	}
	.muted {
		font-size: 0.875rem;
		color: var(--muted);
		margin: 0;
	}
	.open-slots-hint {
		font-size: 0.875rem;
		color: var(--muted);
		margin: -0.5rem 0 1rem 0;
	}
	.day-sections {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}
	.day-section {
		background: var(--surfaceSolid);
		border-radius: var(--radius-2xl);
		border: 1px solid var(--border-soft);
		box-shadow: var(--shadow-sm);
		overflow: hidden;
	}
	.day-header {
		position: sticky;
		top: 0;
		z-index: 1;
		background: var(--surface2);
		padding: 0.75rem 1.25rem;
		font-size: 1rem;
		font-weight: 600;
		color: var(--text);
		margin: 0;
		border-bottom: 1px solid var(--border-soft);
	}
	.meal-cards {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		padding: 1rem 1.25rem;
	}
	.empty-state {
		text-align: center;
		padding: 3rem 1.5rem;
		background: var(--surfaceSolid);
		border-radius: var(--radius-2xl);
		border: 1px solid var(--border-soft);
	}
	.empty-icon {
		font-size: 3rem;
		margin-bottom: 1rem;
		opacity: 0.8;
	}
	.empty-title {
		font-size: 1.125rem;
		font-weight: 600;
		color: var(--text);
		margin: 0 0 0.5rem 0;
	}
	.empty-hint {
		font-size: 0.9375rem;
		color: var(--muted);
		margin: 0 0 1.25rem 0;
	}
	@media (max-width: 640px) {
		.page-header {
			flex-direction: column;
		}
		.header-actions {
			width: 100%;
			justify-content: flex-end;
		}
	}
</style>
