<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { page } from '$app/stores';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const MEAL_LABELS: Record<string, string> = {
		breakfast: 'Breakfast',
		lunch: 'Lunch',
		dinner: 'Dinner',
		snack: 'Snacks'
	};

	type TabId = 'meals' | 'activities' | 'itinerary';
	const TAB_IDS: TabId[] = ['meals', 'activities', 'itinerary'];

	const tabParam = $derived($page.url.searchParams.get('tab'));
	const activeTab = $derived(
		(TAB_IDS.includes(tabParam as TabId) ? tabParam : 'itinerary') as TabId
	);

	function setTab(tab: TabId) {
		const url = new URL($page.url);
		url.searchParams.set('tab', tab);
		return url.pathname + url.search;
	}

	const sortedDates = $derived(Object.keys(data.eventsByDate).sort());

	const slotsByDay = $derived.by(() => {
		const map = new Map<string, typeof data.mealSlots>();
		for (const slot of data.mealSlots ?? []) {
			const key = new Date(slot.date).toISOString().slice(0, 10);
			if (!map.has(key)) map.set(key, []);
			map.get(key)!.push(slot);
		}
		for (const arr of map.values()) {
			arr.sort((a, b) => {
				const order = { breakfast: 0, lunch: 1, dinner: 2, snack: 3 };
				return (order[a.mealType as keyof typeof order] ?? 4) - (order[b.mealType as keyof typeof order] ?? 4);
			});
		}
		const entries = [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
		return entries;
	});

	let editingSlotId = $state<string | null>(null);
	let addSlotDate = $state('');
	let addSlotMealType = $state('dinner');
	let addSlotTime = $state('');
	let addSlotMenu = $state('');
	let addSlotNotes = $state('');

	let activitiesQuery = $state('');
	let activitiesSearching = $state(false);
	let activitiesResults = $state<{ name: string; placeId?: string }[]>([]);

	function closeEdit() {
		editingSlotId = null;
	}

	function handleMealsResult() {
		return async ({ result }: { result: { data?: Record<string, unknown>; type: string } }) => {
			if (result.type === 'success' && result.data) {
				if (
					result.data.setMealPlanSuccess ||
					result.data.createMealSlotSuccess ||
					result.data.updateMealSlotSuccess ||
					result.data.deleteMealSlotSuccess ||
					result.data.generateSlotsSuccess
				) {
					await invalidateAll();
					closeEdit();
					addSlotDate = '';
					addSlotTime = '';
					addSlotMenu = '';
					addSlotNotes = '';
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

<div class="itinerary-page">
	<div class="container">
		<div class="page-header">
			<h1>Itinerary: {data.trip.name}</h1>
			<a href="/trips/{data.trip.id}" class="btn btn-secondary">← Back to Trip</a>
		</div>

		<div class="tabs">
			<a href={setTab('meals')} class="tab" class:active={activeTab === 'meals'}>Meals</a>
			<a href={setTab('activities')} class="tab" class:active={activeTab === 'activities'}>Activities</a>
			<a href={setTab('itinerary')} class="tab" class:active={activeTab === 'itinerary'}>Itinerary</a>
		</div>

		<div class="trip-dates">
			<p>
				📅 {data.trip.checkInDate.toLocaleDateString()} - {data.trip.checkOutDate.toLocaleDateString()}
			</p>
		</div>

		{#if activeTab === 'meals'}
			<!-- Meals Tab -->
			<div class="tab-panel">
				{#if !data.mealPlan || !data.mealPlan.enabled}
					<div class="card off-state">
						<div class="card-body">
							<p class="summary">Meal planning is off for this trip.</p>
							{#if data.isHost}
								<form method="POST" action="?/setMealPlanEnabled" use:enhance={handleMealsResult()}>
									<input type="hidden" name="enabled" value="true" />
									<button type="submit" class="btn-primary">Enable meal planning</button>
								</form>
							{:else}
								<p class="muted">Ask the host to enable meals if you'd like to plan or sign up for meals.</p>
							{/if}
						</div>
					</div>
				{:else}
					{#if data.isHost}
						<div class="card toolbar">
							<div class="card-body">
								<form method="POST" action="?/setMealPlanEnabled" use:enhance={handleMealsResult()} class="toggle-form">
									<input type="hidden" name="enabled" value="false" />
									<button type="submit" class="btn-secondary">Turn off meal planning</button>
								</form>
								{#if data.trip?.checkInDate && data.trip?.checkOutDate}
									<form method="POST" action="?/generateSlots" use:enhance={handleMealsResult()} class="generate-form">
										<button type="submit" class="btn-secondary">Generate slots from trip dates</button>
									</form>
								{/if}
							</div>
						</div>
					{/if}

					{#if slotsByDay.length === 0 && !data.isHost}
						<div class="card">
							<div class="card-body">
								<p class="empty">No meal slots yet. The host can add a schedule.</p>
							</div>
						</div>
					{:else}
						{#each slotsByDay as [dateKey, slots]}
							{@const dateLabel = new Date(dateKey + 'T12:00:00').toLocaleDateString(undefined, {
								weekday: 'long',
								month: 'short',
								day: 'numeric',
								year: 'numeric'
							})}
							<div class="day-card card">
								<div class="meals-day-header">
									<h2 class="day-title">{dateLabel}</h2>
									{#if data.isHost}
										<button
											type="button"
											class="btn-add-slot"
											onclick={() => {
												addSlotDate = dateKey;
												editingSlotId = 'new-' + dateKey;
											}}
										>
											+ Add slot
										</button>
									{/if}
								</div>
								<div class="card-body">
									<ul class="slots-list">
										{#each slots as slot (slot.id)}
											<li class="slot-item">
												{#if editingSlotId === slot.id}
													<form method="POST" action="?/updateMealSlot" use:enhance={handleMealsResult()} class="slot-edit-form">
														<input type="hidden" name="slotId" value={slot.id} />
														<div class="slot-edit-row">
															<select name="mealType" class="input-sm">
																{#each Object.entries(MEAL_LABELS) as [value, label]}
																	<option value={value} selected={slot.mealType === value}>{label}</option>
																{/each}
															</select>
															<input type="date" name="date" value={new Date(slot.date).toISOString().slice(0, 10)} class="input-sm" />
															<input type="time" name="time" value={slot.time ?? ''} class="input-sm" />
														</div>
														<input type="text" name="menuText" value={slot.menuText ?? ''} placeholder="Menu (optional)" class="input-full" />
														<input type="text" name="notes" value={slot.notes ?? ''} placeholder="Notes (optional)" class="input-full" />
														<select name="assignedUserId" class="input-sm assign-select">
															<option value="">Unclaimed</option>
															{#each data.members as member}
																<option value={member.id} selected={slot.assignedUserId === member.id}>
																	{member.name}
																</option>
															{/each}
														</select>
														<div class="slot-edit-actions">
															<button type="submit" class="btn-primary btn-sm">Save</button>
															<button type="button" class="btn-secondary btn-sm" onclick={closeEdit}>Cancel</button>
														</div>
													</form>
												{:else}
													<div class="slot-display">
														<span class="slot-type">{MEAL_LABELS[slot.mealType] ?? slot.mealType}</span>
														{#if slot.time}
															<span class="slot-time">{slot.time}</span>
														{/if}
														{#if slot.menuText}
															<span class="slot-menu">{slot.menuText}</span>
														{/if}
														{#if slot.notes}
															<span class="slot-notes">{slot.notes}</span>
														{/if}
														<div class="slot-assign">
															<form method="POST" action="?/updateMealSlot" use:enhance={handleMealsResult()} class="assign-form">
																<input type="hidden" name="slotId" value={slot.id} />
																<input type="hidden" name="mealType" value={slot.mealType} />
																<input type="hidden" name="date" value={new Date(slot.date).toISOString().slice(0, 10)} />
																<input type="hidden" name="time" value={slot.time ?? ''} />
																<input type="hidden" name="menuText" value={slot.menuText ?? ''} />
																<input type="hidden" name="notes" value={slot.notes ?? ''} />
																<select name="assignedUserId" class="assign-select" onchange={(e) => (e.currentTarget as HTMLSelectElement).form?.requestSubmit()}>
																	<option value="" selected={!slot.assignedUserId}>Unclaimed</option>
																	{#each data.members as member}
																		<option value={member.id} selected={slot.assignedUserId === member.id}>
																			{member.name}
																		</option>
																	{/each}
																</select>
															</form>
														</div>
														{#if data.isHost}
															<div class="slot-actions">
																<button type="button" class="btn-icon" onclick={() => (editingSlotId = slot.id)} aria-label="Edit slot">✎</button>
																<form method="POST" action="?/deleteMealSlot" use:enhance={handleMealsResult()} class="inline-form">
																	<input type="hidden" name="slotId" value={slot.id} />
																	<button type="submit" class="btn-icon btn-danger" aria-label="Delete slot">×</button>
																</form>
															</div>
														{/if}
													</div>
												{/if}
											</li>
										{/each}
									</ul>

									{#if data.isHost && editingSlotId === 'new-' + dateKey}
										<form method="POST" action="?/createMealSlot" use:enhance={handleMealsResult()} class="add-slot-form">
											<input type="hidden" name="date" value={addSlotDate} />
											<input type="hidden" name="mealType" value={addSlotMealType} />
											<input type="hidden" name="time" value={addSlotTime} />
											<input type="hidden" name="menuText" value={addSlotMenu} />
											<input type="hidden" name="notes" value={addSlotNotes} />
											<div class="add-slot-row">
												<select bind:value={addSlotMealType} name="mealType" class="input-sm">
													{#each Object.entries(MEAL_LABELS) as [value, label]}
														<option value={value}>{label}</option>
													{/each}
												</select>
												<input type="time" bind:value={addSlotTime} name="time" class="input-sm" />
												<input type="text" bind:value={addSlotMenu} name="menuText" placeholder="Menu (optional)" class="input-flex" />
												<button type="submit" class="btn-primary btn-sm">Add</button>
												<button type="button" class="btn-secondary btn-sm" onclick={closeEdit}>Cancel</button>
											</div>
										</form>
									{/if}
								</div>
							</div>
						{/each}
					{/if}
				{/if}
			</div>

		{:else if activeTab === 'activities'}
			<!-- Activities Tab -->
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

		{:else}
			<!-- Itinerary Tab -->
			<div class="tab-panel">
				{#if sortedDates.length === 0}
					<div class="empty-state">
						<p>No events scheduled yet.</p>
					</div>
				{:else}
					<div class="itinerary-timeline">
						{#each sortedDates as date}
							<div class="day-section">
								<h2 class="day-header">{new Date(date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</h2>
								<div class="events-list">
									{#each data.eventsByDate[date] as event}
										<div class="event-card event-{event.type}">
											{#if event.type === 'arrival'}
												<div class="event-icon">✈️</div>
												<div class="event-content">
													<h3>{event.user.name || 'Guest'} Arrives</h3>
													{#if event.time}
														<p class="event-time">{new Date(event.time).toLocaleTimeString()}</p>
													{/if}
												</div>
											{:else if event.type === 'departure'}
												<div class="event-icon">🚪</div>
												<div class="event-content">
													<h3>{event.user.name || 'Guest'} Departs</h3>
													{#if event.time}
														<p class="event-time">{new Date(event.time).toLocaleTimeString()}</p>
													{/if}
												</div>
											{:else if event.type === 'meal'}
												<div class="event-icon">🍽️</div>
												<div class="event-content">
													<h3>{event.mealType.charAt(0).toUpperCase() + event.mealType.slice(1)}</h3>
													{#if event.time}
														<p class="event-time">{event.time}</p>
													{/if}
													{#if event.assignedUser}
														<p class="event-assigned">Assigned to: {event.assignedUser.name}</p>
													{/if}
													{#if event.menuText}
														<p class="event-menu">{event.menuText}</p>
													{/if}
													{#if event.notes}
														<p class="event-notes">{event.notes}</p>
													{/if}
												</div>
											{:else if event.type === 'activity'}
												<div class="event-icon">🎯</div>
												<div class="event-content">
													<h3>{event.title}</h3>
													{#if event.time}
														<p class="event-time">{event.time}</p>
													{/if}
													{#if event.location}
														<p class="event-location">📍 {event.location}</p>
													{/if}
													{#if event.pricePerPerson > 0}
														<p class="event-price">${event.pricePerPerson} per person</p>
													{/if}
													{#if event.participants.length > 0}
														<p class="event-participants">
															Participants: {event.participants.map(p => p.name).join(', ')}
														</p>
													{/if}
												</div>
											{/if}
										</div>
									{/each}
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		{/if}
	</div>
</div>

<style>
	.itinerary-page {
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

	.tabs {
		display: flex;
		gap: 0.25rem;
		margin-bottom: var(--spacing-lg);
		border-bottom: 2px solid var(--border);
	}

	.tab {
		padding: 0.75rem 1.25rem;
		font-weight: 500;
		color: var(--muted);
		text-decoration: none;
		border-bottom: 2px solid transparent;
		margin-bottom: -2px;
		transition: color 0.2s, border-color 0.2s;
	}

	.tab:hover {
		color: var(--text);
	}

	.tab.active {
		color: var(--primary);
		border-bottom-color: var(--primary);
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

	.empty-state {
		text-align: center;
		padding: var(--spacing-xl);
		background: white;
		border-radius: var(--radius-md);
	}

	.itinerary-timeline {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-xl);
	}

	.day-section {
		background: white;
		border-radius: var(--radius-md);
		padding: var(--spacing-lg);
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
	}

	.day-header {
		margin: 0 0 var(--spacing-lg) 0;
		padding-bottom: var(--spacing-md);
		border-bottom: 2px solid var(--color-border);
		font-size: 1.5rem;
	}

	.events-list {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-md);
	}

	.event-card {
		display: flex;
		gap: var(--spacing-md);
		padding: var(--spacing-md);
		background: var(--color-bg-light);
		border-radius: var(--radius-sm);
		border-left: 4px solid var(--color-primary);
	}

	.event-icon {
		font-size: 2rem;
		flex-shrink: 0;
	}

	.event-content {
		flex: 1;
	}

	.event-content h3 {
		margin: 0 0 var(--spacing-xs) 0;
		font-size: 1.1rem;
	}

	.event-time,
	.event-location,
	.event-price,
	.event-assigned,
	.event-participants,
	.event-menu,
	.event-notes {
		margin: var(--spacing-xs) 0;
		color: var(--color-text-light);
		font-size: 0.9rem;
	}

	.event-menu {
		font-style: italic;
	}

	.event-arrival {
		border-left-color: #10b981;
	}

	.event-departure {
		border-left-color: var(--danger);
	}

	.event-meal {
		border-left-color: #f59e0b;
	}

	.event-activity {
		border-left-color: #3b82f6;
	}

	/* Meals tab styles */
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

	.off-state .summary {
		margin: 0 0 1rem 0;
	}

	.muted {
		color: var(--muted);
		font-size: 0.875rem;
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

	.btn-sm {
		padding: 0.35rem 0.75rem;
		font-size: 0.8125rem;
	}

	.toolbar .card-body {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		align-items: center;
	}

	.toggle-form,
	.generate-form {
		display: inline;
	}

	.meals-day-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.5rem;
		padding: 1rem 1.25rem 0 1.25rem;
	}

	.day-title {
		font-size: 1.125rem;
		font-weight: 600;
		margin: 0;
	}

	.btn-add-slot {
		padding: 0.35rem 0.75rem;
		font-size: 0.8125rem;
		background: var(--primary);
		color: white;
		border: none;
		border-radius: 0.375rem;
		cursor: pointer;
	}

	.btn-add-slot:hover {
		opacity: 0.9;
	}

	.slots-list {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.slot-item {
		padding: 0.75rem 0;
		border-bottom: 1px solid var(--border);
	}

	.slot-item:last-child {
		border-bottom: none;
	}

	.slot-display {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem 1rem;
	}

	.slot-type {
		font-weight: 500;
		min-width: 5rem;
	}

	.slot-time {
		font-size: 0.875rem;
		color: var(--muted);
	}

	.slot-menu,
	.slot-notes {
		font-size: 0.875rem;
		color: var(--muted);
	}

	.slot-assign {
		margin-left: auto;
	}

	.assign-form {
		display: inline;
	}

	.assign-select {
		padding: 0.35rem 0.5rem;
		font-size: 0.8125rem;
		border: 1px solid var(--border);
		border-radius: 0.375rem;
		background: white;
		min-width: 8rem;
		cursor: pointer;
	}

	.slot-actions {
		display: flex;
		gap: 0.25rem;
		align-items: center;
	}

	.btn-icon {
		width: 1.75rem;
		height: 1.75rem;
		padding: 0;
		border: 1px solid var(--border);
		background: white;
		border-radius: 0.25rem;
		cursor: pointer;
		font-size: 0.875rem;
		line-height: 1;
		color: var(--muted);
	}

	.btn-icon:hover {
		background: var(--surface2);
		color: var(--text);
	}

	.btn-icon.btn-danger:hover {
		background: #fef2f2;
		color: #b91c1c;
		border-color: #fecaca;
	}

	.inline-form {
		display: inline;
	}

	.slot-edit-form {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.slot-edit-row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.slot-edit-actions {
		display: flex;
		gap: 0.5rem;
	}

	.input-sm {
		padding: 0.35rem 0.5rem;
		font-size: 0.8125rem;
		border: 1px solid var(--border);
		border-radius: 0.375rem;
		min-width: 0;
	}

	.input-full {
		padding: 0.35rem 0.5rem;
		font-size: 0.875rem;
		border: 1px solid var(--border);
		border-radius: 0.375rem;
		width: 100%;
		max-width: 20rem;
	}

	.input-flex {
		flex: 1;
		min-width: 6rem;
		padding: 0.35rem 0.5rem;
		font-size: 0.8125rem;
		border: 1px solid var(--border);
		border-radius: 0.375rem;
	}

	.add-slot-form {
		margin-top: 0.75rem;
		padding-top: 0.75rem;
		border-top: 1px solid var(--border);
	}

	.add-slot-row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem;
	}

	.empty {
		color: var(--muted);
		margin: 0;
	}

	/* Activities tab styles */
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

	.btn {
		display: inline-block;
		padding: 0.5rem 1rem;
		font-size: 0.875rem;
		font-weight: 500;
		border-radius: 0.5rem;
		text-decoration: none;
		cursor: pointer;
	}

	.day-section .day-header {
		margin: 0 0 var(--spacing-lg) 0;
		padding-bottom: var(--spacing-md);
		border-bottom: 2px solid var(--color-border);
		font-size: 1.5rem;
	}
</style>
