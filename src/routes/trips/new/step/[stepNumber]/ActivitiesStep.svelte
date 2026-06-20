<script lang="ts">
	import SectionCard from '$lib/components/wizard/SectionCard.svelte';
	import type { TripDraft, ActivitiesConfig, ActivityItem, ActivityCost } from '$lib/stores/tripDraft.js';
	import { getDefaultActivitiesConfig } from '$lib/stores/tripDraft.js';
	import type { ActivitySearchResult } from '$lib/activities/providers/types.js';

	let { draft, autosave }: { draft: TripDraft; autosave: () => void } = $props();

	// Normalize activities config; activity planning is always on for every trip.
	$effect(() => {
		if (!draft.activities || !('enabled' in draft.activities) || !Array.isArray((draft.activities as ActivitiesConfig).items)) {
			draft.activities = { ...getDefaultActivitiesConfig() };
		}
		(draft.activities as ActivitiesConfig).enabled = true;
	});

	const activities = $derived((draft.activities ?? getDefaultActivitiesConfig()) as ActivitiesConfig);
	const items = $derived(activities.items ?? []);

	let activeTab = $state<'manual' | 'nearby'>('manual');
	let searchAvailable = $state<boolean>(false);
	let searchLoading = $state(false);
	let searchResults = $state<ActivitySearchResult[]>([]);
	let searchMessage = $state<string | null>(null);

	// Manual form state (reset after add)
	let manualForm = $state({
		title: '',
		date: '',
		time: '',
		locationName: '',
		address: '',
		linkUrl: '',
		notes: '',
		hasCost: false,
		totalAmount: '',
		paidBy: 'host' as 'host' | 'other',
		paidByName: ''
	});

	// Nearby search state
	let searchQuery = $state('');
	let searchCategory = $state('');
	let searchRadiusMeters = $state(16093); // 10 mi default
	const RADIUS_OPTIONS = [
		{ label: '5 mi', value: 8046 },
		{ label: '10 mi', value: 16093 },
		{ label: '25 mi', value: 40233 }
	];
	const CATEGORY_CHIPS = ['Restaurants', 'Outdoors', 'Attractions', 'Nightlife', 'Wellness'];

	// Edit modal
	let editingItem = $state<ActivityItem | null>(null);
	let editForm = $state<Partial<ActivityItem>>({});

	// Check if nearby search is available on mount
	$effect(() => {
		fetch('/api/activities/search')
			.then((r) => r.json())
			.then((data) => {
				searchAvailable = data.searchAvailable === true;
			})
			.catch(() => (searchAvailable = false));
	});

	function ensureActivities() {
		if (!draft.activities || !('items' in draft.activities)) {
			draft.activities = { ...getDefaultActivitiesConfig() };
		}
		const a = draft.activities as ActivitiesConfig;
		a.items = a.items ?? [];
		a.enabled = true;
	}

	function addManualActivity() {
		if (!manualForm.title.trim()) return;
		ensureActivities();
		const cost: ActivityCost | undefined = manualForm.hasCost &&
			manualForm.totalAmount &&
			parseFloat(manualForm.totalAmount) > 0
			? {
					totalAmount: parseFloat(manualForm.totalAmount),
					currency: 'USD',
					paidBy: manualForm.paidBy,
					paidByName: manualForm.paidBy === 'other' ? manualForm.paidByName : undefined,
					splitMethod: 'even_among_attendees'
				}
			: undefined;
		const item: ActivityItem = {
			id: crypto.randomUUID(),
			source: 'manual',
			title: manualForm.title.trim(),
			date: manualForm.date || undefined,
			time: manualForm.time || undefined,
			locationName: manualForm.locationName.trim() || undefined,
			address: manualForm.address.trim() || undefined,
			linkUrl: manualForm.linkUrl.trim() || undefined,
			notes: manualForm.notes.trim() || undefined,
			hasCost: !!cost,
			cost
		};
		(draft.activities as ActivitiesConfig).items = [...(draft.activities as ActivitiesConfig).items, item];
		manualForm = {
			title: '',
			date: '',
			time: '',
			locationName: '',
			address: '',
			linkUrl: '',
			notes: '',
			hasCost: false,
			totalAmount: '',
			paidBy: 'host',
			paidByName: ''
		};
		autosave();
	}

	function addNearbyResult(result: ActivitySearchResult) {
		ensureActivities();
		const item: ActivityItem = {
			id: crypto.randomUUID(),
			source: 'nearby',
			provider: result.provider,
			providerPlaceId: result.placeId,
			title: result.title,
			category: result.category,
			address: result.address,
			lat: result.lat,
			lng: result.lng,
			linkUrl: result.linkUrl,
			hasCost: false
		};
		(draft.activities as ActivitiesConfig).items = [...(draft.activities as ActivitiesConfig).items, item];
		autosave();
	}

	async function runSearch() {
		searchLoading = true;
		searchMessage = null;
		searchResults = [];
		const destinationText =
			[draft.destinationCity, draft.destinationState, draft.destinationCountry].filter(Boolean).join(', ') ||
			draft.propertyAddress ||
			'';
		try {
			const res = await fetch('/api/activities/search', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					query: searchQuery.trim() || undefined,
					category: searchCategory || undefined,
					radiusMeters: searchRadiusMeters,
					destinationText: destinationText.trim() || undefined
				})
			});
			const data = await res.json();
			searchResults = data.results ?? [];
			searchMessage = data.message ?? null;
		} catch (e) {
			searchMessage = 'Search failed. Try again or add manually.';
		} finally {
			searchLoading = false;
		}
	}

	function removeItem(id: string) {
		ensureActivities();
		(draft.activities as ActivitiesConfig).items = (draft.activities as ActivitiesConfig).items.filter((i) => i.id !== id);
		editingItem = null;
		autosave();
	}

	function openEdit(item: ActivityItem) {
		editingItem = item;
		editForm = {
			title: item.title,
			date: item.date ?? '',
			time: item.time ?? '',
			locationName: item.locationName ?? '',
			address: item.address ?? '',
			linkUrl: item.linkUrl ?? '',
			notes: item.notes ?? '',
			hasCost: item.hasCost,
			cost: item.cost
				? {
						totalAmount: item.cost.totalAmount,
						currency: item.cost.currency,
						paidBy: item.cost.paidBy,
						paidByName: item.cost.paidByName,
						splitMethod: 'even_among_attendees' as const
					}
				: undefined
		};
	}

	function saveEdit() {
		if (!editingItem) return;
		ensureActivities();
		const list = (draft.activities as ActivitiesConfig).items;
		const idx = list.findIndex((i) => i.id === editingItem!.id);
		if (idx === -1) return;
		const cost: ActivityCost | undefined =
			editForm.hasCost && editForm.cost && editForm.cost.totalAmount > 0
				? {
						totalAmount: editForm.cost.totalAmount,
						currency: editForm.cost.currency ?? 'USD',
						paidBy: editForm.cost.paidBy ?? 'host',
						paidByName: editForm.cost.paidBy === 'other' ? editForm.cost.paidByName : undefined,
						splitMethod: 'even_among_attendees'
					}
				: undefined;
		list[idx] = {
			...list[idx],
			title: (editForm.title ?? '').trim() || list[idx].title,
			date: (editForm.date as string)?.trim() || undefined,
			time: (editForm.time as string)?.trim() || undefined,
			locationName: (editForm.locationName as string)?.trim() || undefined,
			address: (editForm.address as string)?.trim() || undefined,
			linkUrl: (editForm.linkUrl as string)?.trim() || undefined,
			notes: (editForm.notes as string)?.trim() || undefined,
			hasCost: !!cost,
			cost
		};
		editingItem = null;
		editForm = {};
		autosave();
	}

	const hasDestination = $derived(
		!!(draft.destinationCity?.trim() || draft.propertyAddress?.trim() || (draft.destinationState && draft.destinationCountry))
	);
</script>

<div class="step-content activities-step">
	<SectionCard title="Activities" icon="🎯">
		<div class="section-1-body">
			<p class="helper-copy">
				Every trip includes activity planning. Add ideas now or later; guests can help fill the itinerary when you allow
				suggestions below.
			</p>
			<label class="toggle-row">
				<input
					type="checkbox"
					checked={activities.allowGuestSuggestions}
					onchange={(e) => {
						ensureActivities();
						(draft.activities as ActivitiesConfig).allowGuestSuggestions = (e.currentTarget as HTMLInputElement).checked;
						autosave();
					}}
				/>
				<span class="toggle-title">Allow guests to suggest activities later</span>
			</label>
		</div>
	</SectionCard>

		<!-- Tabs -->
		<SectionCard title="Add to itinerary" icon="➕">
			<div class="tabs">
				<button
					type="button"
					class="tab"
					class:active={activeTab === 'manual'}
					onclick={() => (activeTab = 'manual')}
				>
					Add manually
				</button>
				<button
					type="button"
					class="tab"
					class:active={activeTab === 'nearby'}
					onclick={() => (activeTab = 'nearby')}
				>
					Find nearby
				</button>
			</div>

			{#if activeTab === 'manual'}
				<div class="manual-form">
					<div class="form-group">
						<label class="form-label">Activity name <span class="required">*</span></label>
						<input type="text" bind:value={manualForm.title} placeholder="e.g., Beach volleyball" class="form-input" />
					</div>
					<div class="form-row">
						<div class="form-group">
							<label class="form-label">Date (optional)</label>
							<input type="date" bind:value={manualForm.date} class="form-input" />
						</div>
						<div class="form-group">
							<label class="form-label">Time (optional)</label>
							<input type="time" bind:value={manualForm.time} class="form-input" />
						</div>
					</div>
					<div class="form-group">
						<label class="form-label">Location / venue name (optional)</label>
						<input type="text" bind:value={manualForm.locationName} placeholder="e.g., Main Beach" class="form-input" />
					</div>
					<div class="form-group">
						<label class="form-label">Address (optional)</label>
						<input type="text" bind:value={manualForm.address} placeholder="Street, city" class="form-input" />
					</div>
					<div class="form-group">
						<label class="form-label">Link (optional)</label>
						<input type="url" bind:value={manualForm.linkUrl} placeholder="https://..." class="form-input" />
					</div>
					<div class="form-group">
						<label class="form-label">Notes (optional)</label>
						<textarea bind:value={manualForm.notes} rows="2" placeholder="Details..." class="form-textarea"></textarea>
					</div>
					<div class="cost-panel">
						<label class="toggle-row">
							<input type="checkbox" bind:checked={manualForm.hasCost} />
							<span>This activity has a cost</span>
						</label>
						{#if manualForm.hasCost}
							<div class="form-group">
								<label class="form-label">Total cost ($)</label>
								<input type="number" bind:value={manualForm.totalAmount} min="0" step="0.01" class="form-input" />
							</div>
							<p class="cost-helper">Costs will be split evenly and added to all guest tabs.</p>
						{/if}
					</div>
					<button type="button" class="btn-add-itinerary" onclick={addManualActivity} disabled={!manualForm.title.trim()}>
						Add to itinerary
					</button>
				</div>
			{:else}
				<!-- Nearby tab -->
				<div class="nearby-panel">
					{#if !searchAvailable}
						<p class="inline-message muted">Nearby search isn't configured yet, add activities manually or paste a link above.</p>
					{:else if !hasDestination}
						<p class="inline-message muted">Set destination on Overview to enable search.</p>
					{:else}
						<div class="search-controls">
							<div class="form-group">
								<label class="form-label">Search (optional)</label>
								<input type="text" bind:value={searchQuery} placeholder="e.g., hike, brunch, museum" class="form-input" />
							</div>
							<div class="form-group">
								<label class="form-label">Category</label>
								<div class="chips">
									{#each CATEGORY_CHIPS as chip}
										<button
											type="button"
											class="chip"
											class:active={searchCategory === chip}
											onclick={() => (searchCategory = searchCategory === chip ? '' : chip)}
										>
											{chip}
										</button>
									{/each}
								</div>
							</div>
							<div class="form-group">
								<label class="form-label">Radius</label>
								<select bind:value={searchRadiusMeters} class="form-select">
									{#each RADIUS_OPTIONS as opt}
										<option value={opt.value}>{opt.label}</option>
									{/each}
								</select>
							</div>
							<button type="button" class="btn-search" onclick={runSearch} disabled={searchLoading}>
								{searchLoading ? 'Searching...' : 'Search'}
							</button>
						</div>
						{#if searchMessage && !searchResults.length}
							<p class="inline-message">{searchMessage}</p>
						{/if}
						{#if searchResults.length > 0}
							<div class="results-list">
								{#each searchResults as result (result.placeId)}
									<div class="result-card">
										<div class="result-main">
											<strong>{result.title}</strong>
											{#if result.category}
												<span class="result-meta">{result.category}</span>
											{/if}
											{#if result.address}
												<span class="result-address">{result.address}</span>
											{/if}
											{#if result.priceLevel != null}
												<span class="result-meta">Price: {'$'.repeat(result.priceLevel)}</span>
											{/if}
										</div>
										<button type="button" class="btn-add-result" onclick={() => addNearbyResult(result)}>
											Add
										</button>
									</div>
								{/each}
							</div>
						{/if}
					{/if}
				</div>
			{/if}
		</SectionCard>

		<!-- Itinerary Preview -->
		<SectionCard title="Itinerary preview" icon="📋">
			{#if items.length === 0}
				<p class="empty-message">No activities yet. Add some above.</p>
			{:else}
				<div class="itinerary-list">
					{#each items as item (item.id)}
						<div class="itinerary-card" role="button" tabindex="0" onclick={() => openEdit(item)} onkeydown={(e) => e.key === 'Enter' && openEdit(item)}>
							<div class="itinerary-main">
								<span class="itinerary-title">{item.title}</span>
								{#if item.date || item.time}
									<span class="itinerary-meta">{[item.date, item.time].filter(Boolean).join(' • ')}</span>
								{/if}
								{#if item.locationName || item.address}
									<span class="itinerary-meta">{item.locationName || item.address}</span>
								{/if}
							</div>
							{#if item.hasCost && item.cost}
								<span class="cost-pill">Cost</span>
							{/if}
							<button
								type="button"
								class="btn-remove-item"
								onclick={(e) => {
									e.stopPropagation();
									removeItem(item.id);
								}}
								title="Remove"
							>
								×
							</button>
						</div>
					{/each}
				</div>
			{/if}
		</SectionCard>
</div>

<!-- Edit modal -->
{#if editingItem}
	<div class="modal-backdrop" role="presentation" onclick={() => (editingItem = null)} onkeydown={(e) => e.key === 'Escape' && (editingItem = null)}>
		<div class="modal" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.stopPropagation()}>
			<div class="modal-header">
				<h3>Edit activity</h3>
				<button type="button" class="modal-close" onclick={() => (editingItem = null)}>×</button>
			</div>
			<div class="modal-body">
				<div class="form-group">
					<label class="form-label">Activity name</label>
					<input type="text" bind:value={editForm.title} class="form-input" />
				</div>
				<div class="form-row">
					<div class="form-group">
						<label class="form-label">Date</label>
						<input type="date" bind:value={editForm.date} class="form-input" />
					</div>
					<div class="form-group">
						<label class="form-label">Time</label>
						<input type="time" bind:value={editForm.time} class="form-input" />
					</div>
				</div>
				<div class="form-group">
					<label class="form-label">Location / venue</label>
					<input type="text" bind:value={editForm.locationName} class="form-input" />
				</div>
				<div class="form-group">
					<label class="form-label">Address</label>
					<input type="text" bind:value={editForm.address} class="form-input" />
				</div>
				<div class="form-group">
					<label class="form-label">Link</label>
					<input type="url" bind:value={editForm.linkUrl} class="form-input" />
				</div>
				<div class="form-group">
					<label class="form-label">Notes</label>
					<textarea bind:value={editForm.notes} rows="2" class="form-textarea"></textarea>
				</div>
				<div class="cost-panel">
					<label class="toggle-row">
						<input type="checkbox" bind:checked={editForm.hasCost} />
						<span>This activity has a cost</span>
					</label>
						{#if editForm.hasCost}
						<div class="form-group">
							<label class="form-label">Total cost ($)</label>
							<input
								type="number"
								value={editForm.cost?.totalAmount ?? ''}
								oninput={(e) => {
									const v = (e.currentTarget as HTMLInputElement).valueAsNumber;
									editForm.cost = editForm.cost ?? { totalAmount: 0, currency: 'USD', paidBy: 'host', splitMethod: 'even_among_attendees' };
									editForm.cost.totalAmount = isNaN(v) ? 0 : v;
								}}
								min="0"
								step="0.01"
								class="form-input"
							/>
						</div>
						<p class="cost-helper">Costs will be split evenly and added to all guest tabs.</p>
					{/if}
				</div>
			</div>
			<div class="modal-footer">
				<button type="button" class="btn-secondary" onclick={() => (editingItem = null)}>Cancel</button>
				<button type="button" class="btn-primary" onclick={saveEdit}>Save</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.activities-step {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
		width: 100%;
		max-width: 100%;
	}
	.section-1-body {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}
	.helper-copy {
		font-size: 0.875rem;
		color: var(--muted);
		margin: 0;
		line-height: 1.5;
	}
	.toggle-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		cursor: pointer;
		font-size: 0.9375rem;
		color: var(--text);
	}
	.toggle-title {
		font-weight: 500;
	}
	.tabs {
		display: flex;
		gap: 0.5rem;
		margin-bottom: 1rem;
	}
	.tab {
		padding: 0.5rem 1rem;
		background: white;
		border: 1px solid var(--border);
		border-radius: 0.5rem;
		font-size: 0.875rem;
		cursor: pointer;
		color: var(--text);
	}
	.tab.active {
		background: var(--primary);
		color: white;
		border-color: var(--primary);
	}
	.manual-form,
	.nearby-panel {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}
	.form-group {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}
	.form-label {
		font-size: 0.8125rem;
		font-weight: 500;
		color: var(--text);
	}
	.required {
		color: var(--danger);
	}
	.form-input,
	.form-select,
	.form-textarea {
		padding: 0.5rem 0.6rem;
		border: 1px solid var(--border);
		border-radius: 0.25rem;
		font-size: 0.875rem;
		color: var(--text);
		background: white;
		width: 100%;
		max-width: 100%;
	}
	.form-textarea {
		resize: vertical;
		min-height: 60px;
	}
	.form-row {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1rem;
	}
	.cost-panel {
		padding: 0.75rem;
		background: #fafafa;
		border-radius: 0.5rem;
		border: 1px solid var(--border);
	}
	.cost-helper {
		font-size: 0.8125rem;
		color: var(--muted);
		margin: 0.35rem 0 0 0;
	}
	.radio-row {
		display: flex;
		gap: 1rem;
	}
	.radio-row label {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		cursor: pointer;
		font-size: 0.875rem;
	}
	.btn-add-itinerary,
	.btn-search {
		padding: 0.6rem 1.25rem;
		background: var(--primary);
		color: white;
		border: none;
		border-radius: 0.5rem;
		font-size: 0.875rem;
		font-weight: 500;
		cursor: pointer;
		align-self: flex-start;
	}
	.btn-add-itinerary:disabled,
	.btn-search:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}
	.inline-message {
		font-size: 0.875rem;
		color: var(--muted);
		margin: 0;
	}
	.inline-message.muted {
		font-style: italic;
	}
	.search-controls {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}
	.chip {
		padding: 0.35rem 0.75rem;
		background: white;
		border: 1px solid var(--border);
		border-radius: 999px;
		font-size: 0.8125rem;
		cursor: pointer;
		color: var(--text);
	}
	.chip.active {
		background: var(--primary);
		color: white;
		border-color: var(--primary);
	}
	.results-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		max-height: 320px;
		overflow-y: auto;
	}
	.result-card {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 0.75rem;
		padding: 0.75rem;
		border: 1px solid var(--border);
		border-radius: 0.5rem;
		background: #fafafa;
	}
	.result-main {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		min-width: 0;
	}
	.result-main strong {
		font-size: 0.9375rem;
	}
	.result-meta,
	.result-address {
		font-size: 0.8125rem;
		color: var(--muted);
	}
	.btn-add-result {
		padding: 0.35rem 0.75rem;
		background: var(--primary);
		color: white;
		border: none;
		border-radius: 0.25rem;
		font-size: 0.8125rem;
		cursor: pointer;
		flex-shrink: 0;
	}
	.empty-message {
		font-size: 0.875rem;
		color: var(--muted);
		margin: 0;
	}
	.itinerary-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.itinerary-card {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.75rem 1rem;
		border: 1px solid var(--border);
		border-radius: 0.5rem;
		background: white;
		cursor: pointer;
		transition: background 0.2s;
	}
	.itinerary-card:hover {
		background: #fafafa;
	}
	.itinerary-main {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		flex: 1;
		min-width: 0;
	}
	.itinerary-title {
		font-weight: 500;
		font-size: 0.9375rem;
	}
	.itinerary-meta {
		font-size: 0.8125rem;
		color: var(--muted);
	}
	.cost-pill {
		font-size: 0.7rem;
		padding: 0.2rem 0.5rem;
		background: rgba(47, 119, 120, 0.12);
		color: var(--primary);
		border-radius: 999px;
		font-weight: 500;
	}
	.btn-remove-item {
		width: 1.75rem;
		height: 1.75rem;
		padding: 0;
		background: transparent;
		border: 1px solid var(--border);
		border-radius: 0.25rem;
		color: var(--muted);
		font-size: 1.2rem;
		line-height: 1;
		cursor: pointer;
		flex-shrink: 0;
	}
	.btn-remove-item:hover {
		background: #fef2f2;
		color: var(--danger);
		border-color: #fecaca;
	}
	.modal-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.4);
		z-index: 9999;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1rem;
	}
	.modal {
		background: white;
		border-radius: 0.75rem;
		box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
		max-width: 480px;
		width: 100%;
		max-height: 90vh;
		overflow: hidden;
		display: flex;
		flex-direction: column;
	}
	.modal-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 1rem 1.25rem;
		border-bottom: 1px solid var(--border);
	}
	.modal-header h3 {
		margin: 0;
		font-size: 1.125rem;
		font-weight: 600;
		color: var(--text);
	}
	.modal-close {
		width: 2rem;
		height: 2rem;
		padding: 0;
		background: transparent;
		border: none;
		font-size: 1.5rem;
		color: var(--muted);
		cursor: pointer;
		line-height: 1;
	}
	.modal-body {
		padding: 1.25rem;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}
	.modal-footer {
		display: flex;
		justify-content: flex-end;
		gap: 0.5rem;
		padding: 1rem 1.25rem;
		border-top: 1px solid var(--border);
	}
	.btn-secondary {
		padding: 0.5rem 1rem;
		background: white;
		border: 1px solid var(--border);
		border-radius: 0.5rem;
		font-size: 0.875rem;
		cursor: pointer;
		color: var(--text);
	}
	.btn-primary {
		padding: 0.5rem 1rem;
		background: var(--primary);
		color: white;
		border: none;
		border-radius: 0.5rem;
		font-size: 0.875rem;
		font-weight: 500;
		cursor: pointer;
	}
	@media (max-width: 768px) {
		.form-row {
			grid-template-columns: 1fr;
		}
	}
</style>
