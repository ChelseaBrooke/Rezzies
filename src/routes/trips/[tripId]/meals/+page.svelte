<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<div class="page">
	<div class="page-header">
		<h1>Meals</h1>
		<p class="subtitle">Meal sign-ups and shared food</p>
	</div>

	<div class="card">
		<div class="card-body">
			<p class="summary">Meals are enabled for this trip.</p>
			{#if data.mealSlots?.length > 0}
				<ul class="slots-list">
					{#each data.mealSlots as slot}
						<li class="slot-item">
							<span>{slot.mealType} – {new Date(slot.date).toLocaleDateString()}</span>
							<span class="assigned">{slot.assignedUser?.name ?? 'Unclaimed'}</span>
						</li>
					{/each}
				</ul>
			{:else}
				<p class="empty">No meal slots yet.</p>
			{/if}
		</div>
	</div>
</div>

<style>
	.page { padding: 0; }
	.page-header { margin-bottom: 1.5rem; }
	.page-header h1 { font-size: 1.5rem; font-weight: 600; margin: 0 0 0.25rem 0; }
	.subtitle { font-size: 0.875rem; color: var(--muted); margin: 0; }
	.card { background: white; border-radius: 1rem; border: 1px solid var(--border); overflow: hidden; }
	.card-body { padding: 1.5rem; }
	.summary { margin: 0 0 1rem 0; }
	.slots-list { list-style: none; margin: 0; padding: 0; }
	.slot-item { display: flex; justify-content: space-between; padding: 0.75rem 0; border-bottom: 1px solid var(--border); }
	.slot-item .assigned { color: var(--muted); font-size: 0.875rem; text-transform: capitalize; }
	.empty { color: var(--muted); margin: 0; }
</style>
