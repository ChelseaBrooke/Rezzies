<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let query = $state('');
	let searching = $state(false);
	// Results can be wired to /api/activities/search when you're ready
	let results = $state<{ name: string; placeId?: string }[]>([]);

	async function search() {
		if (!query.trim()) return;
		searching = true;
		results = [];
		try {
			// Placeholder: call your API when ready, e.g. /api/activities/search?q=...&tripId=...
			// const res = await fetch(`/api/activities/search?q=${encodeURIComponent(query)}&tripId=${data.trip?.id}`);
			// const json = await res.json();
			// results = json.results ?? [];
			await new Promise((r) => setTimeout(r, 300));
		} finally {
			searching = false;
		}
	}
</script>

<div class="page">
	<div class="page-header">
		<h1>Activities</h1>
		<p class="subtitle">Discover nearby activities and add them to your trip.</p>
	</div>

	<div class="card search-card">
		<div class="card-body">
			<form class="search-form" onsubmit={(e) => { e.preventDefault(); search(); }}>
				<input
					type="search"
					placeholder="Search for activities, restaurants, things to do…"
					bind:value={query}
					class="search-input"
				/>
				<button type="submit" class="btn btn-primary" disabled={searching}>
					{searching ? 'Searching…' : 'Search'}
				</button>
			</form>
		</div>
	</div>

	<div class="card">
		<div class="card-body">
			{#if results.length > 0}
				<ul class="results-list">
					{#each results as r}
						<li class="result-item">{r.name}</li>
					{/each}
				</ul>
			{:else}
				<p class="empty">Search for nearby activities above. Results will appear here once the discover API is wired up.</p>
			{/if}
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
	.search-card { margin-bottom: 1rem; }
	.search-form { display: flex; gap: 0.75rem; flex-wrap: wrap; }
	.search-input { flex: 1; min-width: 200px; padding: 0.75rem 1rem; border: 1px solid var(--border-strong); border-radius: var(--radius-md); font-size: 0.9375rem; }
	.search-input:focus { outline: none; border-color: var(--primary); box-shadow: 0 0 0 3px var(--focusRing); }
	.results-list { list-style: none; margin: 0; padding: 0; }
	.result-item { padding: 0.75rem 0; border-bottom: 1px solid var(--border); font-size: 0.9375rem; }
	.result-item:last-child { border-bottom: none; }
	.empty { color: var(--muted); margin: 0; }
</style>
