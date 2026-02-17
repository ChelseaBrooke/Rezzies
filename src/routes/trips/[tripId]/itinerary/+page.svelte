<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageData } from './$types';

	let { data, form }: { data: PageData; form?: Record<string, unknown> } = $props();

	let dragOverTarget = $state<string | null>(null); // 'meal-SLOTID' | 'activity-ACTIVITYID'

	const tripDays = $derived(data.tripDays ?? []);
	const goingUsers = $derived(data.goingUsers ?? []);

	// Schedule grid: 6am–10pm, 1hr slots
	const HOUR_START = 6;
	const HOUR_END = 22;
	const SLOT_HEIGHT = 48;
	const timeSlots = $derived(
		Array.from({ length: HOUR_END - HOUR_START }, (_, i) => {
			const h = HOUR_START + i;
			return `${h.toString().padStart(2, '0')}:00`;
		})
	);

	function parseTimeToSlot(time: string | Date | null | undefined): number {
		if (!time) return 0;
		if (time instanceof Date) return time.getHours() + time.getMinutes() / 60;
		const m = /^(\d{1,2}):(\d{2})/.exec(String(time));
		return m ? parseInt(m[1], 10) + parseInt(m[2], 10) / 60 : 0;
	}

	const defaultTime: Record<string, number> = { breakfast: 8, lunch: 12, dinner: 18, snack: 10 };
	function eventTop(event: { type: string; time?: string | Date | null; mealType?: string }): number {
		const hour = event.time ? parseTimeToSlot(event.time) : (defaultTime[event.mealType ?? ''] ?? 12);
		return Math.max(0, (hour - HOUR_START) * SLOT_HEIGHT);
	}
	function eventHeight(event: { type: string }): number {
		return event.type === 'activity' ? SLOT_HEIGHT * 2 : SLOT_HEIGHT;
	}

	const todayKey = $derived(new Date().toISOString().slice(0, 10));
	const calendarMonth = $derived.by(() => {
		if (tripDays.length === 0) return { year: new Date().getFullYear(), month: new Date().getMonth() };
		const d = new Date(tripDays[0] + 'T12:00:00');
		return { year: d.getFullYear(), month: d.getMonth() };
	});
	const calendarDays = $derived.by(() => {
		const { year, month } = calendarMonth;
		const first = new Date(year, month, 1);
		const last = new Date(year, month + 1, 0);
		const startPad = first.getDay();
		const days: { date: string; day: number; isTrip: boolean; isToday: boolean }[] = [];
		for (let i = 0; i < startPad; i++) days.push({ date: '', day: 0, isTrip: false, isToday: false });
		const tripSet = new Set(tripDays);
		for (let d = 1; d <= last.getDate(); d++) {
			const date = `${year}-${(month + 1).toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
			days.push({ date, day: d, isTrip: tripSet.has(date), isToday: date === todayKey });
		}
		return days;
	});
	const monthLabel = $derived(
		new Date(calendarMonth.year, calendarMonth.month).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
	);

	function handleScheduleResult() {
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
					result.data.assignMealMakerSuccess ||
					result.data.addActivityParticipantSuccess ||
					result.data.removeActivityParticipantSuccess ||
					result.data.moveMealSlotSuccess ||
					result.data.moveActivitySuccess
				) {
					// list refreshes via invalidation
				}
			}
		};
	}

	function handleDragStart(e: DragEvent, payload: { type: string; id: string; name?: string }) {
		e.dataTransfer?.setData('application/json', JSON.stringify(payload));
		e.dataTransfer!.effectAllowed = 'copy';
	}

	function handleDropMeal(e: DragEvent, slotId: string) {
		e.preventDefault();
		const raw = e.dataTransfer?.getData('application/json');
		if (!raw) return;
		const payload = JSON.parse(raw) as { type: string; id: string };
		if (payload.type !== 'person') return;
		const form = document.getElementById(`assign-meal-${slotId}`) as HTMLFormElement;
		if (form) {
			(form.querySelector('input[name="assignedUserId"]') as HTMLInputElement).value = payload.id;
			form.requestSubmit();
		}
	}

	function handleDropActivity(e: DragEvent, activityId: string) {
		e.preventDefault();
		const raw = e.dataTransfer?.getData('application/json');
		if (!raw) return;
		const payload = JSON.parse(raw) as { type: string; id: string };
		if (payload.type !== 'person') return;
		const form = document.getElementById(`add-participant-${activityId}`) as HTMLFormElement;
		if (form) {
			(form.querySelector('input[name="userId"]') as HTMLInputElement).value = payload.id;
			form.requestSubmit();
		}
	}

	function handleDragOver(e: DragEvent) {
		e.preventDefault();
		e.dataTransfer!.dropEffect = 'copy';
	}

	function setDragOver(id: string | null) {
		dragOverTarget = id;
	}
</script>

<div class="itinerary-page">
	<div class="container wide">
		<div class="page-header">
			<h1>Itinerary: {data.trip.name}</h1>
			<a href="/trips/{data.trip.id}" class="btn btn-secondary">← Back to Trip</a>
		</div>

		<div class="sub-nav">
			<a href="/trips/{data.trip.id}/meals" class="sub-nav-link">Meals</a>
			<a href="/trips/{data.trip.id}/activities" class="sub-nav-link">Activities</a>
		</div>

		<div class="trip-dates">
			<p>
				📅 {data.trip.checkInDate.toLocaleDateString()} - {data.trip.checkOutDate.toLocaleDateString()}
			</p>
		</div>

		<div class="tab-panel schedule-panel">
				{#if tripDays.length === 0}
					<div class="empty-state">
						<p>Set trip check-in and check-out dates to see the daily schedule.</p>
					</div>
				{:else}
					<div class="schedule-layout ckdulz-style">
						<!-- Left sidebar: mini-calendar + Going -->
						<aside class="schedule-sidebar">
							<div class="mini-calendar">
								<div class="mini-cal-header">{monthLabel}</div>
								<div class="mini-cal-grid">
									{#each ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as letter}
										<span class="cal-dow">{letter}</span>
									{/each}
									{#each calendarDays as d}
										<span
											class="cal-day"
											class:trip-day={d.isTrip}
											class:today={d.isToday}
											class:empty={!d.date}
										>
											{d.day || ''}
										</span>
									{/each}
								</div>
							</div>
							<div class="sidebar-categories">
								<h3 class="sidebar-title">Going</h3>
								<p class="sidebar-hint">Drag to assign meals or activities</p>
								{#if goingUsers.length === 0}
									<p class="sidebar-empty">No one has RSVP'd yes yet.</p>
								{:else}
									<ul class="going-list">
										{#each goingUsers as person (person.id)}
											<li
												class="going-chip"
												draggable="true"
												ondragstart={(e) => handleDragStart(e, { type: 'person', id: person.id!, name: person.name })}
											>
												{person.name}
											</li>
										{/each}
									</ul>
								{/if}
							</div>
						</aside>

						<div class="schedule-main">
							<!-- Header: date range, view, + Add -->
							<div class="schedule-header">
								<span class="schedule-date-range">
									{new Date(tripDays[0] + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
									– {new Date(tripDays[tripDays.length - 1] + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
								</span>
								<span class="schedule-view-badge">Week</span>
								<div class="schedule-add-buttons">
									<a href="/trips/{data.trip.id}/meals" class="btn-add-schedule">+ Add meal</a>
									<a href="/trips/{data.trip.id}/activities" class="btn-add-schedule">+ Add activity</a>
								</div>
							</div>

							<!-- Grid: time × days -->
							<div class="schedule-grid-wrapper" style="--day-cols: {tripDays.length}">
								<div class="schedule-scroll-inner">
									<div class="schedule-grid">
										<!-- Day headers -->
										<div class="grid-corner"></div>
										{#each tripDays as date, colIdx}
											{@const d = new Date(date + 'T12:00:00')}
											<div
												class="grid-day-header"
												class:today={date === todayKey}
											>
												<span class="day-name">{d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()}</span>
												<span class="day-num">{d.getDate()}</span>
											</div>
										{/each}

										<!-- Time slots + day columns -->
										{#each timeSlots as slot, rowIdx}
											<div class="grid-time-label">{slot}</div>
											{#each tripDays as date, colIdx}
												<div class="grid-cell" data-row={rowIdx} data-col={colIdx}></div>
											{/each}
										{/each}
									</div>

									<!-- Event blocks (absolutely positioned) -->
									<div class="schedule-events-layer">
									{#each tripDays as date, colIdx}
										{@const events = (data.eventsByDate?.[date] ?? []).filter((e: { type: string }) => e.type === 'meal' || e.type === 'activity')}
										<div class="day-events-col" style="--day-col: {colIdx};">
											{#each events as event}
												{@const top = eventTop(event)}
												{@const height = eventHeight(event)}
												{@const isMeal = event.type === 'meal'}
												<div
													class="schedule-event-block"
													class:meal={isMeal}
													class:activity={event.type === 'activity'}
													class:droppable={isMeal || event.type === 'activity'}
													class:drag-over={dragOverTarget === (isMeal ? `meal-${event.slotId}` : `activity-${event.activityId}`)}
													style="top: {top}px; height: {height}px;"
													ondragover={isMeal || event.type === 'activity' ? handleDragOver : undefined}
													ondragenter={isMeal || event.type === 'activity' ? () => setDragOver(isMeal ? `meal-${event.slotId}` : `activity-${event.activityId}`) : undefined}
													ondragleave={isMeal || event.type === 'activity' ? () => setDragOver(null) : undefined}
													ondrop={isMeal ? (e) => { setDragOver(null); handleDropMeal(e, event.slotId); } : event.type === 'activity' ? (e) => { setDragOver(null); handleDropActivity(e, event.activityId); } : undefined}
													title={isMeal || event.type === 'activity' ? 'Drop person to assign' : ''}
												>
													{#if isMeal}
														<span class="event-title">{event.mealType?.charAt(0).toUpperCase() + event.mealType?.slice(1)}</span>
														<span class="event-time">{event.time || ''}</span>
														{#if event.assignedUser}
															<span class="event-meta">Making: {event.assignedUser.name}</span>
														{:else}
															<span class="event-meta unassigned">Drop to assign</span>
														{/if}
														<form id="assign-meal-{event.slotId}" method="POST" action="?/assignMealMaker" use:enhance={handleScheduleResult()} class="assign-form-hidden">
															<input type="hidden" name="slotId" value={event.slotId} />
															<input type="hidden" name="assignedUserId" value="" />
														</form>
													{:else}
														<span class="event-title">{event.title}</span>
														<span class="event-time">{event.time || ''}</span>
														{#if event.participants?.length > 0}
															<span class="event-meta">Attending: {event.participants.slice(0, 2).map((p: { name: string }) => p.name).join(', ')}{event.participants.length > 2 ? '…' : ''}</span>
														{:else}
															<span class="event-meta unassigned">Drop to add</span>
														{/if}
														<form id="add-participant-{event.activityId}" method="POST" action="?/addActivityParticipant" use:enhance={handleScheduleResult()} class="assign-form-hidden">
															<input type="hidden" name="activityId" value={event.activityId} />
															<input type="hidden" name="userId" value="" />
														</form>
													{/if}
												</div>
											{/each}
										</div>
									{/each}
									</div>
								</div>
							</div>

							<!-- Bottom: Going avatars -->
							<div class="schedule-footer">
								<div class="footer-users">
									{#each goingUsers.slice(0, 5) as person (person.id)}
										<span class="user-avatar" title={person.name}>{person.name.charAt(0).toUpperCase()}</span>
									{/each}
									{#if goingUsers.length > 5}
										<span class="user-avatar more">+{goingUsers.length - 5}</span>
									{/if}
									<span class="view-all-users">View All</span>
								</div>
							</div>
						</div>
					</div>
				{/if}
		</div>
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
	.container.wide {
		max-width: 1400px;
	}

	.page-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: var(--spacing-lg);
	}

	.sub-nav {
		display: flex;
		gap: 1rem;
		margin-bottom: var(--spacing-lg);
	}

	.sub-nav-link {
		padding: 0.5rem 1rem;
		font-weight: 500;
		color: var(--primary);
		text-decoration: none;
		border-radius: var(--radius-md);
		background: var(--surface2);
		transition: background 0.2s;
	}

	.sub-nav-link:hover {
		background: var(--border);
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

	.error-message {
		color: var(--danger, #b91c1c);
		font-size: 0.9rem;
		margin: 0 0 0.75rem 0;
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

	/* Calendar-style schedule (Ckdulz) */
	.schedule-panel {
		min-height: 400px;
	}

	.schedule-layout.ckdulz-style {
		display: flex;
		gap: var(--spacing-lg);
		background: var(--surface);
		border-radius: var(--radius-lg);
		border: 1px solid var(--border);
		padding: var(--spacing-md);
		overflow: hidden;
	}

	.schedule-sidebar {
		flex-shrink: 0;
		width: 200px;
		display: flex;
		flex-direction: column;
		gap: var(--spacing-lg);
	}

	.mini-calendar {
		background: var(--color-bg-light, #f8fafc);
		border-radius: var(--radius-md);
		padding: var(--spacing-sm);
	}

	.mini-cal-header {
		font-weight: 600;
		font-size: 0.9rem;
		text-align: center;
		margin-bottom: 0.5rem;
		color: var(--text);
	}

	.mini-cal-grid {
		display: grid;
		grid-template-columns: repeat(7, 1fr);
		gap: 2px;
		font-size: 0.75rem;
	}

	.cal-dow {
		text-align: center;
		color: var(--muted);
		font-weight: 500;
	}

	.cal-day {
		aspect-ratio: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 6px;
		color: var(--text);
	}
	.cal-day.empty {
		visibility: hidden;
	}
	.cal-day.trip-day {
		background: rgba(59, 130, 246, 0.15);
		color: var(--primary);
	}
	.cal-day.today {
		background: var(--primary);
		color: white;
		font-weight: 600;
	}

	.sidebar-categories .sidebar-title {
		margin: 0 0 0.25rem 0;
		font-size: 0.875rem;
		font-weight: 600;
	}
	.sidebar-categories .sidebar-hint {
		font-size: 0.7rem;
		color: var(--muted);
		margin: 0 0 0.5rem 0;
	}
	.sidebar-categories .sidebar-empty {
		font-size: 0.8rem;
		color: var(--muted);
		margin: 0;
	}

	.going-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}
	.going-chip {
		padding: 0.4rem 0.6rem;
		background: var(--color-bg-light, #f1f5f9);
		border: 1px solid var(--border);
		border-radius: 6px;
		font-size: 0.8rem;
		cursor: grab;
		transition: box-shadow 0.2s;
	}
	.going-chip:hover {
		box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
	}
	.going-chip:active {
		cursor: grabbing;
	}

	.schedule-main {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: var(--spacing-sm);
	}

	.schedule-header {
		display: flex;
		align-items: center;
		gap: var(--spacing-md);
		flex-wrap: wrap;
	}
	.schedule-date-range {
		font-weight: 600;
		font-size: 1rem;
		color: var(--text);
	}
	.schedule-view-badge {
		padding: 0.25rem 0.5rem;
		background: var(--color-bg-light);
		border-radius: 6px;
		font-size: 0.8rem;
		color: var(--muted);
	}
	.schedule-add-buttons {
		display: flex;
		gap: 0.5rem;
		margin-left: auto;
	}

	.btn-add-schedule {
		padding: 0.5rem 1rem;
		background: var(--primary);
		color: white;
		border-radius: 8px;
		font-size: 0.875rem;
		font-weight: 500;
		text-decoration: none;
		transition: opacity 0.2s;
	}
	.btn-add-schedule:hover {
		opacity: 0.9;
	}

	.schedule-grid-wrapper {
		overflow-x: auto;
		overflow-y: auto;
		max-height: 520px;
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		background: white;
	}

	.schedule-scroll-inner {
		position: relative;
		display: inline-block;
		min-width: 100%;
	}

	.schedule-grid {
		display: grid;
		grid-template-columns: 52px repeat(var(--day-cols, 7), minmax(100px, 1fr));
		grid-template-rows: 36px repeat(16, 48px);
		min-width: max-content;
	}

	:global(.schedule-grid-wrapper) {
		--day-cols: 7;
	}

	.grid-corner {
		background: var(--color-bg-light);
		border-right: 1px solid var(--border);
		border-bottom: 1px solid var(--border);
		border-radius: 4px 0 0 0;
	}

	.grid-day-header {
		padding: 0.5rem;
		text-align: center;
		background: var(--color-bg-light);
		border-bottom: 1px solid var(--border);
		border-right: 1px solid var(--border);
	}
	.grid-day-header.today {
		background: var(--primary);
		color: white;
	}
	.grid-day-header .day-name {
		display: block;
		font-size: 0.7rem;
		font-weight: 600;
		letter-spacing: 0.02em;
		color: inherit;
		opacity: 0.9;
	}
	.grid-day-header.today .day-name { opacity: 1; }
	.grid-day-header .day-num {
		display: block;
		font-size: 1.1rem;
		font-weight: 700;
	}

	.grid-time-label {
		padding: 0 0.5rem;
		font-size: 0.75rem;
		color: var(--muted);
		display: flex;
		align-items: center;
		background: var(--color-bg-light);
		border-right: 1px solid var(--border);
		border-bottom: 1px solid var(--border);
	}

	.grid-cell {
		border-right: 1px solid var(--border);
		border-bottom: 1px solid var(--border);
		min-height: 48px;
	}

	.schedule-events-layer {
		position: absolute;
		inset: 36px 0 0 52px;
		pointer-events: none;
	}
	.schedule-events-layer > * {
		pointer-events: auto;
	}

	.day-events-col {
		position: absolute;
		top: 0;
		left: calc(var(--day-col) * (100% / var(--day-cols, 1)));
		width: calc(100% / var(--day-cols, 1));
		height: 100%;
		padding: 0 4px;
		box-sizing: border-box;
	}
	.schedule-event-block {
		position: absolute;
		left: 2px;
		right: 2px;
		margin: 2px 0;
		border-radius: 8px;
		padding: 0.5rem 0.6rem;
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		font-size: 0.8rem;
		overflow: hidden;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
		cursor: default;
	}
	.schedule-event-block.meal {
		background: linear-gradient(135deg, #a78bfa 0%, #8b5cf6 100%);
		color: white;
	}
	.schedule-event-block.activity {
		background: linear-gradient(135deg, #67e8f9 0%, #22d3ee 100%);
		color: #0e7490;
	}
	.schedule-event-block.droppable {
		cursor: copy;
	}
	.schedule-event-block.drag-over {
		box-shadow: 0 0 0 2px var(--primary);
		transform: scale(1.02);
	}

	.schedule-event-block .event-title {
		font-weight: 600;
		font-size: 0.85rem;
	}
	.schedule-event-block .event-time {
		font-size: 0.7rem;
		opacity: 0.9;
	}
	.schedule-event-block .event-meta {
		font-size: 0.7rem;
		opacity: 0.9;
	}
	.schedule-event-block .event-meta.unassigned {
		opacity: 0.7;
		font-style: italic;
	}

	.schedule-footer {
		padding: 0.75rem 0;
		border-top: 1px solid var(--border);
		display: flex;
		align-items: center;
	}
	.footer-users {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	.user-avatar {
		width: 32px;
		height: 32px;
		border-radius: 50%;
		background: var(--primary);
		color: white;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 0.8rem;
		font-weight: 600;
	}
	.user-avatar.more {
		background: var(--color-bg-light);
		color: var(--muted);
		font-size: 0.7rem;
	}
	.view-all-users {
		margin-left: 0.5rem;
		font-size: 0.85rem;
		color: var(--primary);
		cursor: pointer;
	}

	.assign-form-hidden {
		position: absolute;
		opacity: 0;
		pointer-events: none;
	}
</style>
