<script lang="ts">
	import { goto } from '$app/navigation';

	interface TripOption {
		id: string;
		name: string;
		checkInDate: Date;
		checkOutDate: Date;
	}

	let {
		currentTripId,
		currentTripName,
		trips,
		tripsListHref = '/trips'
	}: {
		currentTripId: string;
		currentTripName: string;
		trips: TripOption[];
		tripsListHref?: string;
	} = $props();

	let open = $state(false);
	let query = $state('');

	const filtered = $derived(
		query.trim()
			? trips.filter(
					(t) =>
						t.name.toLowerCase().includes(query.toLowerCase()) ||
						t.id.toLowerCase().includes(query.toLowerCase())
				)
			: trips
	);

	function formatDate(d: Date) {
		const date = typeof d === 'string' ? new Date(d) : d;
		return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
	}

	function selectTrip(tripId: string) {
		if (tripId === currentTripId) {
			open = false;
			return;
		}
		goto(`/trips/${tripId}`);
		open = false;
		query = '';
	}
</script>

<div class="switcher">
	<button
		type="button"
		class="switcher-trigger"
		onclick={() => (open = !open)}
		aria-expanded={open}
		aria-haspopup="listbox"
	>
		<span class="switcher-label">{currentTripName || 'Select trip'}</span>
		<span class="switcher-chevron">{open ? '▲' : '▼'}</span>
	</button>
	{#if open}
		<div class="switcher-backdrop" onclick={() => (open = false)} role="presentation"></div>
		<div class="switcher-dropdown" role="listbox">
			<input
				type="search"
				class="switcher-search"
				placeholder="Search trips..."
				bind:value={query}
				autofocus
			/>
			<a href={tripsListHref} class="switcher-item switcher-goto-trips" data-label="View all trips" aria-label="View all trips"></a>
			{#each filtered as t (t.id)}
				<button
					type="button"
					class="switcher-item"
					class:current={t.id === currentTripId}
					onclick={() => selectTrip(t.id)}
					role="option"
				>
					<span class="switcher-item-name">{t.name}</span>
					<span class="switcher-item-dates">{formatDate(t.checkInDate)} – {formatDate(t.checkOutDate)}</span>
				</button>
			{/each}
			{#if filtered.length === 0}
				<div class="switcher-empty">No trips found</div>
			{/if}
		</div>
	{/if}
</div>

<style lang="css">
	.switcher {
		position: relative;
		width: 100%;
	}

	.switcher-trigger {
		display: flex;
		align-items: center;
		justify-content: space-between;
		width: 100%;
		padding: 0.5rem 0.75rem;
		border: 1px solid var(--border);
		border-radius: var(--radius-md, 0.5rem);
		background: white;
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--text);
		cursor: pointer;
		font-family: inherit;
		transition: border-color 0.2s;
	}

	.switcher-trigger:hover {
		border-color: var(--primary);
	}

	.switcher-label {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.switcher-chevron {
		font-size: 0.625rem;
		color: var(--muted);
		flex-shrink: 0;
		margin-left: 0.5rem;
	}

	.switcher-backdrop {
		position: fixed;
		inset: 0;
		z-index: 10;
	}

	.switcher-dropdown {
		position: absolute;
		top: 100%;
		left: 0;
		right: 0;
		margin-top: 0.25rem;
		background: white;
		border: 1px solid var(--border);
		border-radius: var(--radius-md, 0.5rem);
		box-shadow: var(--shadow-lg, 0 10px 15px -3px rgba(0,0,0,0.1));
		max-height: 16rem;
		overflow: auto;
		z-index: 20;
	}

	.switcher-search {
		width: 100%;
		padding: 0.5rem 0.75rem;
		border: none;
		border-bottom: 1px solid var(--border);
		border-radius: var(--radius-md) var(--radius-md) 0 0;
		font-size: 0.875rem;
		font-family: inherit;
	}

	.switcher-search:focus {
		outline: none;
	}

	.switcher-item {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		width: 100%;
		padding: 0.5rem 0.75rem;
		border: none;
		background: none;
		text-align: left;
		font-family: inherit;
		cursor: pointer;
		text-decoration: none;
		color: var(--text);
		font-size: 0.875rem;
	}

	.switcher-item:hover {
		background: var(--bg);
	}

	.switcher-item.current {
		background: rgba(30, 58, 138, 0.08);
		color: var(--primary);
		font-weight: 500;
	}

	.switcher-item.switcher-goto-trips {
		color: var(--primary);
		font-weight: 500;
		border-bottom: 1px solid var(--border);
	}

	.switcher-item.switcher-goto-trips::before {
		content: attr(data-label);
	}

	.switcher-item-name {
		font-weight: 500;
	}

	.switcher-item-dates {
		font-size: 0.75rem;
		color: var(--muted);
		margin-top: 0.125rem;
	}

	.switcher-empty {
		padding: 0.75rem;
		font-size: 0.875rem;
		color: var(--muted);
	}
</style>
