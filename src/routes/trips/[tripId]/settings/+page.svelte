<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<div class="page">
	<div class="page-header">
		<h1>Trip Settings</h1>
		<p class="subtitle">Basics, policies, and permissions</p>
	</div>

	<div class="card" id="basics">
		<div class="card-body">
			<h2 class="section-heading">Basics</h2>
			<p class="muted">Trip name, dates, location (placeholder)</p>
			<div class="form-placeholder">
				<label><input type="text" placeholder="Trip name" value={data.trip?.name ?? ''} disabled /> Trip name</label>
				<label><input type="checkbox" /> Flexible dates</label>
			</div>
		</div>
	</div>

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
	.page-header h1 { font-size: 1.5rem; font-weight: 600; margin: 0 0 0.25rem 0; }
	.subtitle { font-size: 0.875rem; color: var(--muted); margin: 0; }
	.card { background: white; border-radius: 1rem; border: 1px solid var(--border); overflow: hidden; margin-bottom: 1rem; }
	.card-body { padding: 1.5rem; }
	.section-heading { font-size: 1rem; font-weight: 600; margin: 0 0 0.25rem 0; }
	.muted { font-size: 0.875rem; color: var(--muted); margin: 0 0 0.75rem 0; }
	.form-placeholder { display: flex; flex-direction: column; gap: 0.5rem; }
	.form-placeholder input[type="text"], .form-placeholder textarea { padding: 0.5rem 0.75rem; border: 1px solid var(--border); border-radius: 0.5rem; font-size: 0.875rem; }
	.form-placeholder textarea { resize: vertical; font-family: inherit; }
</style>
