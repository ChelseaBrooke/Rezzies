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
		/** Host/co-host sees Add New Poll */
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

	const currentSortLabel = $derived(SORT_OPTIONS.find((o) => o.value === sort)?.label ?? 'Most Recent');
</script>

<div class="filters-bar">
	<div class="search-sort-row">
		<div class="search-wrap">
			<svg
				class="search-icon"
				xmlns="http://www.w3.org/2000/svg"
				width="18"
				height="18"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				aria-hidden="true"
			>
				<circle cx="11" cy="11" r="8" />
				<path d="M21 21l-4.35-4.35" />
			</svg>
			<input
				type="search"
				class="search-input"
				placeholder="Search poll title or keywords…"
				value={searchQuery}
				oninput={(e) => onSearchChange((e.target as HTMLInputElement).value)}
				aria-label="Search polls"
			/>
		</div>
		<div class="right-actions">
			{#if canCreate}
				<button type="button" class="btn-add-poll" onclick={onAddNewPoll}>
					<svg
						class="plus-icon"
						xmlns="http://www.w3.org/2000/svg"
						width="18"
						height="18"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						aria-hidden="true"
					>
						<line x1="12" y1="5" x2="12" y2="19" />
						<line x1="5" y1="12" x2="19" y2="12" />
					</svg>
					Add New Poll
				</button>
			{/if}
			<div class="sort-dropdown-wrap">
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
			</div>
		</div>
	</div>

	<nav class="category-pills" aria-label="Filter by category">
		{#each POLL_CATEGORIES as cat}
			<button
				type="button"
				class="category-pill"
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
		gap: 1rem;
		margin-bottom: 1.5rem;
	}
	.search-sort-row {
		display: flex;
		align-items: center;
		gap: 1rem;
		flex-wrap: wrap;
	}
	.search-wrap {
		flex: 1;
		min-width: 200px;
		position: relative;
	}
	.search-icon {
		position: absolute;
		left: 1rem;
		top: 50%;
		transform: translateY(-50%);
		color: var(--muted);
		pointer-events: none;
	}
	.search-input {
		width: 100%;
		padding: 0.625rem 1rem 0.625rem 2.75rem;
		border-radius: var(--radius-lg);
		border: 1px solid var(--border-strong);
		font-size: 0.9375rem;
		background: var(--surfaceSolid);
		color: var(--text);
	}
	.search-input:focus {
		outline: none;
		border-color: var(--primary);
		box-shadow: 0 0 0 3px var(--focusRing);
	}
	.search-input::placeholder {
		color: var(--muted);
	}
	.right-actions {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		flex-shrink: 0;
	}
	.btn-add-poll {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.625rem 1.25rem;
		background: var(--primary);
		color: white;
		border: none;
		border-radius: var(--radius-lg);
		font-size: 0.9375rem;
		font-weight: 600;
		cursor: pointer;
		transition: background var(--transition-fast), transform var(--transition-fast);
		white-space: nowrap;
	}
	.btn-add-poll:hover {
		background: var(--primaryHover);
		transform: translateY(-1px);
	}
	.btn-add-poll:focus-visible {
		outline: none;
		box-shadow: 0 0 0 3px var(--focusRing);
	}
	.plus-icon {
		flex-shrink: 0;
	}
	.sort-dropdown-wrap {
		position: relative;
	}
	.sort-select {
		padding: 0.625rem 2rem 0.625rem 1rem;
		border-radius: var(--radius-lg);
		border: 1px solid var(--border-strong);
		font-size: 0.9375rem;
		background: var(--surfaceSolid);
		color: var(--text);
		cursor: pointer;
		appearance: none;
		background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
		background-repeat: no-repeat;
		background-position: right 0.75rem center;
		padding-right: 2rem;
		min-width: 10rem;
	}
	.sort-select:focus {
		outline: none;
		border-color: var(--primary);
	}
	.category-pills {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}
	.category-pill {
		padding: 0.5rem 1rem;
		border-radius: 9999px;
		font-size: 0.875rem;
		font-weight: 500;
		border: 1px solid var(--border-soft);
		background: var(--surface2, #f1f5f9);
		color: var(--muted);
		cursor: pointer;
		transition: all var(--transition-fast);
	}
	.category-pill:hover {
		background: var(--surface);
		color: var(--text);
	}
	.category-pill.active {
		background: var(--primary);
		color: white;
		border-color: var(--primary);
	}
	.category-pill:focus-visible {
		outline: none;
		box-shadow: 0 0 0 2px var(--focusRing);
	}
	@media (max-width: 640px) {
		.search-sort-row {
			flex-direction: column;
			align-items: stretch;
		}
		.search-wrap {
			min-width: unset;
		}
		.right-actions {
			justify-content: flex-end;
		}
	}
</style>
