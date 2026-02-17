<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageData } from './$types';

	let { data, form }: { data: PageData; form?: Record<string, unknown> } = $props();

	let activitiesQuery = $state('');
	let activitiesSearching = $state(false);
	let activitiesResults = $state<{ name: string; placeId?: string }[]>([]);

	function handleResult() {
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
					result.data.addActivityParticipantSuccess ||
					result.data.removeActivityParticipantSuccess ||
					result.data.moveActivitySuccess
				) {
					// no-op; list will refresh via invalidation
				}
			}
		};
	}

	async function searchActivities() {
		if (!activitiesQuery.trim()) return;
		activitiesSearching = true;
		activitiesResults = [];
		try {
			await new Promise((r) => setTimeout(r, 300));
		} finally {
			activitiesSearching = false;
		}
	}
</script>

<div class="activities-page">
	<div class="container">
		<div class="page-header">
			<h1>Activities: {data.trip.name}</h1>
			<a href="/trips/{data.trip.id}" class="btn btn-secondary">← Back to Trip</a>
		</div>

		<div class="trip-dates">
			<p>
				📅 {data.trip.checkInDate.toLocaleDateString()} - {data.trip.checkOutDate.toLocaleDateString()}
			</p>
		</div>

		<div class="tab-panel">
			<div class="card search-card">
				<div class="card-body">
					<form class="search-form" onsubmit={(e) => { e.preventDefault(); searchActivities(); }}>
						<input
							type="search"
							placeholder="Search for activities, restaurants, things to do…"
							bind:value={activitiesQuery}
							class="search-input"
						/>
						<button type="submit" class="btn btn-primary" disabled={activitiesSearching}>
							{activitiesSearching ? 'Searching…' : 'Search'}
						</button>
					</form>
				</div>
			</div>
			<div class="card">
				<div class="card-body">
					{#if activitiesResults.length > 0}
						<ul class="results-list">
							{#each activitiesResults as r}
								<li class="result-item">{r.name}</li>
							{/each}
						</ul>
					{:else}
						<p class="empty">Search for nearby activities above. Results will appear here once the discover API is wired up.</p>
					{/if}
				</div>
			</div>
		</div>
	</div>
</div>

<style>
	.activities-page {
		min-height: calc(100vh - 80px);
		padding: var(--spacing-xl) var(--spacing-md);
	}

	.container {
		max-width: 1000px;
		margin: 0 auto;
	}

	.page-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: var(--spacing-lg);
	}

	.trip-dates {
		background: white;
		padding: var(--spacing-md);
		border-radius: var(--radius-md);
		margin-bottom: var(--spacing-xl);
		text-align: center;
	}

	.tab-panel {
		min-height: 200px;
	}

	.card {
		background: var(--surface);
		border-radius: var(--radius-lg);
		border: 1px solid var(--border);
		overflow: hidden;
		margin-bottom: 1rem;
	}

	.card-body {
		padding: 1.25rem;
	}

	.search-card {
		margin-bottom: 1rem;
	}

	.search-form {
		display: flex;
		gap: 0.75rem;
		flex-wrap: wrap;
	}

	.search-input {
		flex: 1;
		min-width: 200px;
		padding: 0.75rem 1rem;
		border: 1px solid var(--border-strong);
		border-radius: var(--radius-md);
		font-size: 0.9375rem;
	}

	.search-input:focus {
		outline: none;
		border-color: var(--primary);
		box-shadow: 0 0 0 3px var(--focusRing);
	}

	.results-list {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.result-item {
		padding: 0.75rem 0;
		border-bottom: 1px solid var(--border);
		font-size: 0.9375rem;
	}

	.result-item:last-child {
		border-bottom: none;
	}

	.empty {
		color: var(--muted);
		margin: 0;
	}

	.btn-primary {
		padding: 0.5rem 1rem;
		background: var(--primary);
		color: white;
		border: none;
		border-radius: 0.5rem;
		font-weight: 500;
		cursor: pointer;
		font-size: 0.875rem;
	}

	.btn-primary:hover {
		opacity: 0.9;
	}

	.btn-secondary {
		padding: 0.5rem 1rem;
		background: transparent;
		border: 1px solid var(--border);
		border-radius: 0.5rem;
		cursor: pointer;
		font-size: 0.875rem;
		color: var(--text);
	}

	.btn-secondary:hover {
		background: var(--surface2);
	}

	.btn {
		display: inline-block;
		padding: 0.5rem 1rem;
		font-size: 0.875rem;
		font-weight: 500;
		border-radius: 0.5rem;
		text-decoration: none;
		cursor: pointer;
	}
</style>
