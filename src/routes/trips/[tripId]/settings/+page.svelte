<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageData } from './$types';

	let { data, form }: { data: PageData; form: import('./$types').ActionData } = $props();

	let name = $state(data.trip?.name ?? '');
	let location = $state(data.trip?.location ?? '');
	let description = $state(data.trip?.description ?? '');

	// Sync when data changes (e.g. after navigation)
	$effect(() => {
		name = data.trip?.name ?? '';
		location = data.trip?.location ?? '';
		description = data.trip?.description ?? '';
	});

	const updateResult = $derived(form?.updateBasics);
</script>

<div class="page">
	<form method="POST" action="?/updateBasics" use:enhance={() => {
		return async ({ result }) => {
			if (result.type === 'success' && result.data?.updateBasics?.success) {
				await import('$app/navigation').then(({ invalidateAll }) => invalidateAll());
			}
		};
	}}>
		<div class="page-header">
			<div class="page-header-top">
				<div>
					<h1>Trip Settings</h1>
					<p class="subtitle">Basics, policies, and permissions</p>
				</div>
				<button type="submit" class="btn btn-primary">Save</button>
			</div>
		</div>

		<div class="card" id="basics">
			<div class="card-body">
				<h2 class="section-heading">Basics</h2>
				<p class="muted">Trip name, dates, and destination. Changes show on the trip overview.</p>
				{#if updateResult?.error}
					<p class="form-error">{updateResult.error}</p>
				{/if}
				{#if updateResult?.success}
					<p class="form-success">Saved. Your trip overview will update.</p>
				{/if}
				<div class="form-placeholder">
					<label for="trip-name">Trip name</label>
					<input id="trip-name" name="name" type="text" placeholder="Trip name" bind:value={name} />
					<label for="trip-location">Destination</label>
					<input id="trip-location" name="location" type="text" placeholder="e.g. Lake Tahoe" bind:value={location} />
					<label for="trip-description">Description (optional)</label>
					<textarea id="trip-description" name="description" placeholder="A short note about the trip" rows="3" bind:value={description}></textarea>
				</div>
			</div>
		</div>
	</form>

	<div class="card" id="policies">
		<div class="card-body">
			<h2 class="section-heading">Policies</h2>
			<p class="muted">House rules, cancellation (placeholder)</p>
			<div class="form-placeholder">
				<textarea placeholder="House rules" rows="3" disabled></textarea>
			</div>
		</div>
	</div>

	<div class="card" id="permissions">
		<div class="card-body">
			<h2 class="section-heading">Permissions</h2>
			<p class="muted">Who can edit, invite (placeholder)</p>
			<div class="form-placeholder">
				<label><input type="checkbox" checked disabled /> Only hosts can edit</label>
			</div>
		</div>
	</div>
</div>

<style>
	.page { padding: 0; }
	.page-header { margin-bottom: 1.5rem; }
	.page-header-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; flex-wrap: wrap; }
	.page-header-top .btn { flex-shrink: 0; }
	.page-header h1 { font-size: 1.5rem; font-weight: 600; margin: 0 0 0.25rem 0; }
	.subtitle { font-size: 0.875rem; color: var(--muted); margin: 0; }
	.card { background: var(--surface); border-radius: var(--radius-lg); border: 1px solid var(--border); overflow: hidden; margin-bottom: 1rem; }
	.card-body { padding: 1.5rem; }
	.section-heading { font-size: 1rem; font-weight: 600; margin: 0 0 0.25rem 0; }
	.muted { font-size: 0.875rem; color: var(--muted); margin: 0 0 0.75rem 0; }
	.form-placeholder { display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 1rem; }
	.form-placeholder label { font-size: 0.875rem; font-weight: 500; }
	.form-placeholder input[type="text"], .form-placeholder textarea { padding: 0.5rem 0.75rem; border: 1px solid var(--border-strong); border-radius: var(--radius-md); font-size: 0.875rem; }
	.form-placeholder input:focus, .form-placeholder textarea:focus { outline: none; border-color: var(--primary); box-shadow: 0 0 0 3px var(--focusRing); }
	.form-placeholder textarea { resize: vertical; font-family: inherit; }
	.form-error { font-size: 0.875rem; color: var(--danger); margin: 0 0 0.75rem 0; }
	.form-success { font-size: 0.875rem; color: var(--muted); margin: 0 0 0.75rem 0; }
</style>
