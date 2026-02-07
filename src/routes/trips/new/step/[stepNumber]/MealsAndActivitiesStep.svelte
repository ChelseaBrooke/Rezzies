<script lang="ts">
	import Step2 from './Step2.svelte';
	import ActivitiesStep from './ActivitiesStep.svelte';
	import type { TripDraft } from '$lib/stores/tripDraft.js';

	let { draft, autosave }: { draft: TripDraft; autosave: () => void } = $props();
</script>

<div class="meals-and-activities-step">
	<section class="meals-section" aria-labelledby="meals-heading">
		<h2 id="meals-heading" class="section-divider-heading">Meals</h2>
		<Step2 bind:draft {autosave} />
	</section>
	<section class="activities-section" aria-labelledby="activities-divider-heading">
		<h2 id="activities-divider-heading" class="section-divider-heading">Activities</h2>
		<ActivitiesStep bind:draft {autosave} />
	</section>
</div>

<style>
	.meals-and-activities-step {
		display: flex;
		flex-direction: column;
		gap: 2.5rem;
		width: 100%;
	}
	.section-divider-heading {
		font-size: 1.25rem;
		font-weight: 600;
		color: var(--text);
		margin: 0 0 1rem 0;
		padding-bottom: 0.5rem;
		border-bottom: 2px solid var(--border);
	}
	.meals-section,
	.activities-section {
		width: 100%;
	}
</style>
