<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<div class="page">
	<div class="page-header">
		<h1>Polls</h1>
		<p class="subtitle">Create polls for the group (e.g. dinner votes, activity choices).</p>
	</div>

	<div class="card">
		<div class="card-body">
			<p class="empty">Polls will go here. You can add and manage polls later.</p>
		</div>
	</div>
</div>

<style>
	.page { padding: 0; }
	.page-header { margin-bottom: 1.5rem; }
	.page-header h1 { font-size: 1.5rem; font-weight: 600; margin: 0 0 0.25rem 0; }
	.subtitle { font-size: 0.875rem; color: var(--muted); margin: 0; }
	.card { background: var(--surface); border-radius: var(--radius-lg); border: 1px solid var(--border); overflow: hidden; }
	.card-body { padding: 1.5rem; }
	.empty { color: var(--muted); margin: 0; }
</style>
