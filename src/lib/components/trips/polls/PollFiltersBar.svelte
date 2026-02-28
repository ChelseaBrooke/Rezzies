<script lang="ts">
	import type { PollCategory, PollSort } from './types.js';
	import { POLL_CATEGORIES, SORT_OPTIONS } from './types.js';

	interface Props {
		searchQuery: string;
		onSearchChange: (value: string) => void;
		category: PollCategory;
		onCategoryChange: (cat: PollCategory) => void;
		sort: PollSort;
		onSortChange: (s: PollSort) => void;
		onAddNewPoll: () => void;
		canCreate: boolean;
	}

	let {
		searchQuery,
		onSearchChange,
		category,
		onCategoryChange,
		sort,
		onSortChange,
		onAddNewPoll,
		canCreate = false
	}: Props = $props();
</script>

<div class="filters-bar">
	<!-- Top row: search + sort -->
	<div class="top-row">
		<div class="search-wrap">
			<svg class="search-icon" width="15" height="15" viewBox="0 0 24 24" fill="none"
				stroke="currentColor" stroke-width="2" aria-hidden="true">
				<circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
			</svg>
			<input
				type="search"
				class="search-input"
				placeholder="Search polls…"
				value={searchQuery}
				oninput={(e) => onSearchChange((e.target as HTMLInputElement).value)}
				aria-label="Search polls"
			/>
		</div>
		<div class="right-controls">
			<select
				class="sort-select"
				value={sort}
				onchange={(e) => onSortChange((e.target as HTMLSelectElement).value as PollSort)}
				aria-label="Sort polls"
			>
				{#each SORT_OPTIONS as opt}
					<option value={opt.value}>{opt.label}</option>
				{/each}
			</select>
			{#if canCreate}
				<button type="button" class="btn-add-poll" onclick={onAddNewPoll}>
					<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
						<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
					</svg>
					New Poll
				</button>
			{/if}
		</div>
	</div>

	<!-- Category pills -->
	<nav class="category-pills" aria-label="Filter by category">
		{#each POLL_CATEGORIES as cat}
			<button
				type="button"
				class="cat-pill"
				class:active={category === cat}
				onclick={() => onCategoryChange(cat)}
			>
				{cat}
			</button>
		{/each}
	</nav>
</div>

<style>
	.filters-bar {
		display: flex;
		flex-direction: column;
		gap: .75rem;
	}

	/* ── Top row ── */
	.top-row {
		display: flex;
		align-items: center;
		gap: .75rem;
		flex-wrap: wrap;
	}
	.search-wrap {
		flex: 1;
		min-width: 180px;
		position: relative;
	}
	.search-icon {
		position: absolute;
		left: .75rem;
		top: 50%;
		transform: translateY(-50%);
		color: #94a3b8;
		pointer-events: none;
	}
	.search-input {
		width: 100%;
		padding: .5rem .75rem .5rem 2.25rem;
		border: 1px solid #e2e8f0;
		border-radius: 8px;
		font-size: .875rem;
		background: white;
		color: #1e293b;
		box-sizing: border-box;
	}
	.search-input:focus {
		outline: none;
		border-color: #E85D26;
		box-shadow: 0 0 0 3px rgba(232,93,38,.1);
	}
	.search-input::placeholder { color: #94a3b8; }

	.right-controls {
		display: flex;
		align-items: center;
		gap: .5rem;
		flex-shrink: 0;
	}
	.sort-select {
		padding: .5rem 2rem .5rem .75rem;
		border: 1px solid #e2e8f0;
		border-radius: 8px;
		font-size: .8125rem;
		background: white;
		color: #475569;
		cursor: pointer;
		appearance: none;
		background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='11' height='11' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
		background-repeat: no-repeat;
		background-position: right .6rem center;
	}
	.sort-select:focus { outline: none; border-color: #E85D26; }

	.btn-add-poll {
		display: inline-flex;
		align-items: center;
		gap: .35rem;
		padding: .5rem 1rem;
		background: #E85D26;
		color: white;
		border: none;
		border-radius: 8px;
		font-size: .8125rem;
		font-weight: 600;
		cursor: pointer;
		white-space: nowrap;
		transition: background .12s;
	}
	.btn-add-poll:hover { background: #d04e1f; }

	/* ── Category pills ── */
	.category-pills {
		display: flex;
		flex-wrap: wrap;
		gap: .4rem;
	}
	.cat-pill {
		padding: .3rem .8rem;
		border-radius: 999px;
		font-size: .78rem;
		font-weight: 500;
		border: 1px solid #e2e8f0;
		background: white;
		color: #64748b;
		cursor: pointer;
		transition: all .12s;
	}
	.cat-pill:hover { background: #f1f5f9; color: #1e293b; }
	.cat-pill.active {
		background: #001B2E;
		color: white;
		border-color: #001B2E;
		font-weight: 600;
	}
	.cat-pill:focus-visible { outline: none; box-shadow: 0 0 0 2px rgba(232,93,38,.35); }

	@media (max-width: 600px) {
		.top-row { flex-direction: column; align-items: stretch; }
		.right-controls { justify-content: flex-end; }
	}
</style>
