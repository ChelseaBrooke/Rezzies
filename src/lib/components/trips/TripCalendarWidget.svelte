<script lang="ts">
	import WidgetCard from '$lib/components/trips/WidgetCard.svelte';

	interface Activity {
		id: string;
		title: string;
		date: Date | string;
		time?: string | null;
		location?: string | null;
	}

	interface MealSlot {
		id: string;
		mealType: string;
		date: Date | string;
		time?: string | null;
		menuText?: string | null;
		assignedUser?: { name: string | null } | null;
	}

	interface Props {
		tripId?: string;
		/** 'sidebar' = upper right, single month, no card; 'grid' = in grid with card */
		placement?: 'grid' | 'sidebar';
		checkInDate: Date | string;
		checkOutDate: Date | string;
		activities?: Activity[];
		mealSlots?: MealSlot[];
		/** When provided (sidebar), day view is shown outside; calendar stays month grid and calls this on day click */
		selectedDateKey?: string | null;
		onDaySelect?: (dateKey: string) => void;
	}

	let { tripId = '', placement = 'grid', checkInDate, checkOutDate, activities = [], mealSlots = [], selectedDateKey: controlledDateKey, onDaySelect }: Props = $props();

	/** Week starts Monday per reference */
	const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

	function toDateKey(d: Date | string): string {
		const date = typeof d === 'string' ? new Date(d) : d;
		const y = date.getFullYear();
		const m = String(date.getMonth() + 1).padStart(2, '0');
		const day = String(date.getDate()).padStart(2, '0');
		return `${y}-${m}-${day}`;
	}

	function toDate(d: Date | string): Date {
		return typeof d === 'string' ? new Date(d) : d;
	}

	function isValidDate(d: Date | string): boolean {
		if (d === null || d === undefined || d === '') return false;
		const date = toDate(d);
		return !Number.isNaN(date.getTime());
	}

	const hasValidDates = $derived(isValidDate(checkInDate) && isValidDate(checkOutDate));

	const tripStartKey = $derived(hasValidDates ? toDateKey(checkInDate) : '');
	const tripEndKey = $derived(hasValidDates ? toDateKey(checkOutDate) : '');

	function isInTripRange(dateKey: string): boolean {
		return hasValidDates && dateKey >= tripStartKey && dateKey <= tripEndKey;
	}

	/** List of { year, month } to show (all months the trip touches) */
	const monthsToShow = $derived.by(() => {
		if (!hasValidDates) return [];
		const start = toDate(checkInDate);
		const end = toDate(checkOutDate);
		const list: { year: number; month: number }[] = [];
		const cur = new Date(start.getFullYear(), start.getMonth(), 1);
		const endFirst = new Date(end.getFullYear(), end.getMonth(), 1);
		while (cur <= endFirst) {
			list.push({ year: cur.getFullYear(), month: cur.getMonth() });
			cur.setMonth(cur.getMonth() + 1);
		}
		return list;
	});

	/** In sidebar mode, which month index (0-based) we're showing */
	let sidebarMonthIndex = $state(0);
	const sidebarMonth = $derived(monthsToShow[sidebarMonthIndex] ?? null);
	function prevMonth() {
		if (sidebarMonthIndex > 0) sidebarMonthIndex -= 1;
	}
	function nextMonth() {
		if (sidebarMonthIndex < monthsToShow.length - 1) sidebarMonthIndex += 1;
	}

	/** Monday = 0. JS getDay(): Sun=0, Mon=1, ... Sat=6 → (getDay() + 6) % 7 */
	function getMondayFirstDow(d: Date): number {
		return (d.getDay() + 6) % 7;
	}

	/** For a given year/month, produce 35 or 42 cells (5–6 rows × 7): { dateKey, dayNum, isCurrentMonth, isTripDay } */
	function getMonthCells(year: number, month: number): { dateKey: string; dayNum: number; isCurrentMonth: boolean; isTripDay: boolean }[] {
		const first = new Date(year, month, 1);
		const last = new Date(year, month + 1, 0);
		const startDow = getMondayFirstDow(first);
		const daysInMonth = last.getDate();
		const cells: { dateKey: string; dayNum: number; isCurrentMonth: boolean; isTripDay: boolean }[] = [];
		// leading (previous month)
		for (let i = 0; i < startDow; i++) {
			const d = new Date(year, month, 1 - (startDow - i));
			const dateKey = toDateKey(d);
			cells.push({
				dateKey,
				dayNum: d.getDate(),
				isCurrentMonth: false,
				isTripDay: isInTripRange(dateKey)
			});
		}
		for (let day = 1; day <= daysInMonth; day++) {
			const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
			cells.push({
				dateKey,
				dayNum: day,
				isCurrentMonth: true,
				isTripDay: isInTripRange(dateKey)
			});
		}
		const total = cells.length;
		const remainder = total % 7;
		const trailing = remainder === 0 ? 0 : 7 - remainder;
		for (let i = 0; i < trailing; i++) {
			const d = new Date(year, month, daysInMonth + i + 1);
			const dateKey = toDateKey(d);
			cells.push({
				dateKey,
				dayNum: d.getDate(),
				isCurrentMonth: false,
				isTripDay: isInTripRange(dateKey)
			});
		}
		return cells;
	}

	function monthTitle(year: number, month: number): string {
		return new Date(year, month, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
	}

	let internalDateKey = $state<string | null>(null);
	const selectedDateKey = $derived(controlledDateKey !== undefined ? controlledDateKey : internalDateKey);

	function selectDay(dateKey: string) {
		if (!isInTripRange(dateKey)) return;
		if (onDaySelect) {
			onDaySelect(dateKey);
		} else {
			internalDateKey = dateKey;
		}
	}

	const activitiesForDay = $derived(
		selectedDateKey
			? (activities ?? []).filter((a) => toDateKey(a.date) === selectedDateKey)
			: []
	);
	const mealsForDay = $derived(
		selectedDateKey
			? (mealSlots ?? []).filter((m) => toDateKey(m.date) === selectedDateKey)
			: []
	);

	function formatTime(t: string | null | undefined): string {
		if (!t) return '';
		return t;
	}

	function mealLabel(type: string): string {
		return type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();
	}
</script>

{#if placement === 'sidebar'}
	<!-- Upper right: calendar (or day detail when no onDaySelect) -->
	<div class="calendar-sidebar">
		{#if !hasValidDates}
			<p class="calendar-empty-msg">Add trip dates in <a href={tripId ? `/trips/${tripId}/settings` : '#'}>trip settings</a> to see the calendar.</p>
		{:else if selectedDateKey && !onDaySelect}
			<!-- Day detail view (replaces calendar) when day view is not external -->
			<div class="day-detail-view">
				<button type="button" class="day-detail-back" onclick={() => (internalDateKey = null)} aria-label="Back to calendar">
					&larr; Back to calendar
				</button>
				<h3 class="day-detail-title">
					{new Date(selectedDateKey + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
				</h3>
				{#if activitiesForDay.length === 0 && mealsForDay.length === 0}
					<p class="day-detail-empty">No activities or meals planned.</p>
				{:else}
					{#if activitiesForDay.length > 0}
						<div class="day-detail-section">
							<span class="day-detail-label">Activities</span>
							<ul class="day-detail-list">
								{#each activitiesForDay as a}
									<li class="day-detail-item"><span class="item-title">{a.title}</span>{#if a.time}<span class="item-meta">{formatTime(a.time)}</span>{/if}</li>
								{/each}
							</ul>
						</div>
					{/if}
					{#if mealsForDay.length > 0}
						<div class="day-detail-section">
							<span class="day-detail-label">Meals</span>
							<ul class="day-detail-list">
								{#each mealsForDay as m}
									<li class="day-detail-item"><span class="item-title">{mealLabel(m.mealType)}</span>{#if m.time}<span class="item-meta">{formatTime(m.time)}</span>{/if}</li>
								{/each}
							</ul>
						</div>
					{/if}
				{/if}
				<div class="day-detail-ctas">
					<a href={tripId ? `/trips/${tripId}/activities` : '#'} class="day-detail-cta">Add activity</a>
					<a href={tripId ? `/trips/${tripId}/meals` : '#'} class="day-detail-cta">Add meal</a>
				</div>
			</div>
		{:else if sidebarMonth}
			<div class="month-calendar sidebar-style">
				<div class="month-header">
					<button type="button" class="month-chevron-btn" onclick={prevMonth} disabled={sidebarMonthIndex <= 0} aria-label="Previous month">&lsaquo;</button>
					<span class="month-title">{monthTitle(sidebarMonth.year, sidebarMonth.month)}</span>
					<button type="button" class="month-chevron-btn" onclick={nextMonth} disabled={sidebarMonthIndex >= monthsToShow.length - 1} aria-label="Next month">&rsaquo;</button>
				</div>
				<div class="day-headers">
					{#each DAY_NAMES as dayName}
						<span class="day-header">{dayName}</span>
					{/each}
				</div>
				<div class="days-grid">
					{#each getMonthCells(sidebarMonth.year, sidebarMonth.month) as cell}
						<button
							type="button"
							class="day-cell sidebar-cell"
							class:current-month={cell.isCurrentMonth}
							class:trip-day={cell.isTripDay}
							class:selected={selectedDateKey === cell.dateKey}
							disabled={!cell.isTripDay}
							onclick={() => selectDay(cell.dateKey)}
						>
							{cell.dayNum}
						</button>
					{/each}
				</div>
			</div>
			<p class="day-detail-hint">{onDaySelect ? 'Select a day to see details below.' : 'Click a highlighted day for activities and meals.'}</p>
		{/if}
	</div>
{:else}
<WidgetCard title="Trip calendar" span={2}>
	<div class="calendar-widget">
		{#if !hasValidDates}
			<p class="calendar-empty-msg">
				Add trip check-in and check-out dates in
				{#if tripId}
					<a href="/trips/{tripId}/settings">trip settings</a>
				{:else}
					trip settings
				{/if}
				to see the calendar.
			</p>
		{:else}
		<div class="calendars-row">
			{#each monthsToShow as { year, month }}
				<div class="month-calendar">
					<div class="month-header">
						<span class="month-chevron" aria-hidden="true">&lsaquo;</span>
						<span class="month-title">{monthTitle(year, month)}</span>
						<span class="month-chevron" aria-hidden="true">&rsaquo;</span>
					</div>
					<div class="day-headers">
						{#each DAY_NAMES as dayName}
							<span class="day-header">{dayName}</span>
						{/each}
					</div>
					<div class="days-grid">
						{#each getMonthCells(year, month) as cell}
							<button
								type="button"
								class="day-cell"
								class:current-month={cell.isCurrentMonth}
								class:trip-day={cell.isTripDay}
								class:selected={selectedDateKey === cell.dateKey}
								disabled={!cell.isTripDay}
								onclick={() => selectDay(cell.dateKey)}
							>
								{cell.dayNum}
							</button>
						{/each}
					</div>
				</div>
			{/each}
		</div>

		{#if selectedDateKey}
			<div class="day-detail">
				<h3 class="day-detail-title">
					{new Date(selectedDateKey + 'T12:00:00').toLocaleDateString(undefined, {
						weekday: 'long',
						month: 'short',
						day: 'numeric',
						year: 'numeric'
					})}
				</h3>
				{#if activitiesForDay.length === 0 && mealsForDay.length === 0}
					<p class="day-detail-empty">No activities or meals planned for this day.</p>
				{:else}
					{#if activitiesForDay.length > 0}
						<div class="day-detail-section">
							<span class="day-detail-label">Activities</span>
							<ul class="day-detail-list">
								{#each activitiesForDay as a}
									<li class="day-detail-item">
										<span class="item-title">{a.title}</span>
										{#if a.time}
											<span class="item-meta">{formatTime(a.time)}</span>
										{/if}
										{#if a.location}
											<span class="item-meta">{a.location}</span>
										{/if}
									</li>
								{/each}
							</ul>
						</div>
					{/if}
					{#if mealsForDay.length > 0}
						<div class="day-detail-section">
							<span class="day-detail-label">Meals</span>
							<ul class="day-detail-list">
								{#each mealsForDay as m}
									<li class="day-detail-item">
										<span class="item-title">{mealLabel(m.mealType)}</span>
										{#if m.time}
											<span class="item-meta">{formatTime(m.time)}</span>
										{/if}
										{#if m.menuText}
											<span class="item-meta menu">{m.menuText}</span>
										{/if}
										{#if m.assignedUser?.name}
											<span class="item-meta">— {m.assignedUser.name}</span>
										{/if}
									</li>
								{/each}
							</ul>
						</div>
					{/if}
				{/if}
			</div>
		{:else}
			<p class="day-detail-hint">Click a highlighted day to see activities and meals.</p>
		{/if}
		{/if}
	</div>
</WidgetCard>
{/if}

<style>
	/* Sidebar (upper right): same width as stats row (Guests + Payments), contained box */
	.calendar-sidebar {
		background: #ffffff;
		border-radius: 12px;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08), 0 1px 2px rgba(0, 0, 0, 0.06);
		padding: 0.5rem;
		width: 100%;
		max-width: 100%;
		min-width: 0;
		min-height: 200px;
		height: 100%;
		flex: 1;
		box-sizing: border-box;
		overflow-y: auto;
		overflow-x: hidden;
		display: flex;
		flex-direction: column;
	}

	.calendar-sidebar .month-calendar.sidebar-style {
		background: transparent;
		padding: 0;
		min-width: 0;
		width: 100%;
		max-width: 100%;
		flex: 1;
		min-height: 0;
		display: grid;
		grid-template-rows: auto auto 1fr;
		overflow: auto;
	}

	.calendar-sidebar .month-header {
		margin-bottom: 0.25rem;
		flex-shrink: 0;
		width: 100%;
		box-sizing: border-box;
	}

	.calendar-sidebar .day-headers {
		display: grid;
		grid-template-columns: repeat(7, minmax(0, 1fr));
		gap: 2px;
		flex-shrink: 0;
		margin-bottom: 2px;
		width: 100%;
		min-width: 0;
		box-sizing: border-box;
	}

	.calendar-sidebar .day-header {
		font-size: 0.6875rem;
		font-weight: 500;
		color: var(--muted);
		text-align: center;
	}

	.calendar-sidebar .month-title {
		font-size: 0.8125rem;
		font-weight: 700;
		color: var(--text);
	}

	.calendar-sidebar .month-chevron-btn {
		width: 1.25rem;
		height: 1.25rem;
		font-size: 0.75rem;
	}

	.month-chevron-btn {
		width: 2rem;
		height: 2rem;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 1rem;
		color: var(--muted);
		background: transparent;
		border: none;
		border-radius: 0.375rem;
		cursor: pointer;
		flex-shrink: 0;
	}

	.month-chevron-btn:hover:not(:disabled) {
		color: #64748b;
		background: var(--surface2);
	}

	.month-chevron-btn:disabled {
		opacity: 0.4;
		cursor: default;
	}

	.calendar-sidebar .days-grid {
		display: grid;
		grid-template-columns: repeat(7, minmax(0, 1fr));
		grid-auto-rows: minmax(26px, 26px);
		gap: 2px;
		width: 100%;
		min-width: 0;
		min-height: 0;
		align-content: start;
		box-sizing: border-box;
	}

	.calendar-sidebar .day-cell.sidebar-cell {
		font-size: 0.8125rem;
		font-weight: 500;
		border-radius: 6px;
		color: var(--muted);
		background: transparent;
		min-width: 0;
		width: 100%;
		height: 100%;
		min-height: 0;
		aspect-ratio: unset;
		display: flex;
		align-items: center;
		justify-content: center;
		box-sizing: border-box;
	}

	.calendar-sidebar .day-cell.sidebar-cell.current-month {
		color: var(--text);
		background: transparent;
	}

	.calendar-sidebar .day-cell.sidebar-cell.trip-day {
		color: var(--text);
		background: var(--surface2);
		cursor: pointer;
	}

	.calendar-sidebar .day-cell.sidebar-cell.trip-day:hover {
		background: var(--focusRing);
		color: var(--primary);
	}

	.calendar-sidebar .day-cell.sidebar-cell.trip-day.selected {
		background: var(--text);
		color: white;
		border-radius: 50%;
	}

	.calendar-sidebar .day-cell.sidebar-cell.trip-day.selected:hover {
		background: var(--primaryHover);
		color: white;
	}

	.calendar-sidebar .day-detail-view {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
		min-height: 0;
		overflow-y: auto;
		animation: day-view-zoom-in 0.45s cubic-bezier(0.34, 1.2, 0.64, 1) forwards;
		transform-origin: center center;
	}

	@keyframes day-view-zoom-in {
		from {
			opacity: 0;
			transform: scale(0.4);
		}
		70% {
			opacity: 1;
		}
		to {
			opacity: 1;
			transform: scale(1);
		}
	}

	.calendar-sidebar .day-detail-back {
		align-self: flex-start;
		margin-bottom: 0.125rem;
		padding: 0.25rem 0;
		font-size: 0.75rem;
	}
	.day-detail-back {
		align-self: flex-start;
		margin-bottom: 0.25rem;
		padding: 0.375rem 0;
		background: none;
		border: none;
		font-size: 0.8125rem;
		font-weight: 500;
		color: var(--primary);
		cursor: pointer;
		text-decoration: none;
	}

	.day-detail-back:hover {
		text-decoration: underline;
		color: #1d4ed8;
	}

	.calendar-sidebar .day-detail-title {
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--text);
		margin: 0 0 0.25rem 0;
	}

	.calendar-sidebar .day-detail-hint,
	.calendar-sidebar .day-detail-empty {
		font-size: 0.625rem;
		color: #64748b;
		margin: 0.075rem 0 0 0;
		text-align: center;
		flex-shrink: 0;
	}

	.calendar-sidebar .day-detail-section {
		margin-top: 0.125rem;
	}

	.calendar-sidebar .day-detail-label {
		font-size: 0.625rem;
		font-weight: 600;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		color: #64748b;
		margin-bottom: 0.125rem;
	}

	.calendar-sidebar .day-detail-list {
		list-style: none;
		margin: 0;
		padding: 0;
		min-height: 0;
		overflow-y: auto;
		flex: 1;
	}

	.calendar-sidebar .day-detail-item {
		font-size: 0.75rem;
		padding: 0.125rem 0;
		border-bottom: 1px solid var(--border);
		color: var(--text);
	}

	.calendar-sidebar .day-detail-item:last-child {
		border-bottom: none;
	}

	.calendar-sidebar .day-detail-ctas {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin-top: 0.75rem;
		padding-top: 0.5rem;
		border-top: 1px solid var(--border);
	}
	.calendar-sidebar .day-detail-cta {
		display: inline-flex;
		align-items: center;
		font-size: 0.75rem;
		font-weight: 600;
		padding: 0.4rem 0.75rem;
		background: var(--primary);
		color: white;
		border-radius: var(--radius-md);
		text-decoration: none;
		transition: background var(--transition-fast);
	}
	.calendar-sidebar .day-detail-cta:hover {
		background: var(--primaryHover);
	}

	.calendar-widget {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		min-width: 0;
		min-height: 0;
		overflow: hidden;
		background: #f8fafc;
		border-radius: 0.75rem;
		padding: 0.75rem;
		box-shadow: var(--shadow-sm);
		box-sizing: border-box;
	}

	.calendars-row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		align-items: stretch;
		min-width: 0;
		flex: 1;
		min-height: 0;
	}

	.month-calendar {
		min-width: 0;
		flex: 1 1 200px;
		max-width: 280px;
		background: #f8fafc;
		border-radius: 0.5rem;
		padding: 0.5rem;
		display: flex;
		flex-direction: column;
		min-height: 0;
		box-sizing: border-box;
	}

	.calendar-widget .days-grid {
		flex: 1;
		min-height: 0;
		grid-auto-rows: minmax(0, 1fr);
		align-content: stretch;
	}

	.calendar-widget .day-cell {
		aspect-ratio: auto;
		min-height: 1.5rem;
	}

	.month-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 0.35rem;
		flex-shrink: 0;
	}

	.month-chevron {
		width: 1.75rem;
		height: 1.75rem;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 1rem;
		color: var(--muted);
		flex-shrink: 0;
	}

	.month-title {
		font-size: 0.9375rem;
		font-weight: 700;
		color: var(--text);
		text-align: center;
		flex: 1;
	}

	.day-headers {
		display: grid;
		grid-template-columns: repeat(7, 1fr);
		gap: 1px;
		margin-bottom: 2px;
		flex-shrink: 0;
	}

	.day-header {
		font-size: 0.6875rem;
		font-weight: 500;
		letter-spacing: 0.02em;
		color: #64748b;
		text-align: center;
	}

	.days-grid {
		display: grid;
		grid-template-columns: repeat(7, 1fr);
		gap: 1px;
		min-width: 0;
	}

	.day-cell {
		aspect-ratio: 1;
		min-width: 0;
		min-height: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 0.75rem;
		font-weight: 500;
		border: none;
		border-radius: 0.375rem;
		background: transparent;
		color: var(--muted);
		cursor: default;
	}

	.day-cell.current-month {
		color: var(--text);
	}

	.day-cell.trip-day {
		cursor: pointer;
		background: var(--surface2);
		color: var(--text);
	}

	.day-cell.trip-day:hover {
		background: var(--focusRing);
		color: var(--primary);
	}

	.day-cell.trip-day.selected {
		background: var(--text);
		color: white;
		border-radius: 50%;
	}

	.day-cell.trip-day.selected:hover {
		background: var(--primaryHover);
		color: white;
	}

	.day-detail {
		border-top: 1px solid var(--border);
		padding-top: 0.5rem;
		margin-top: 0.125rem;
		min-height: 0;
		overflow: hidden;
		display: flex;
		flex-direction: column;
		flex-shrink: 0;
	}

	.day-detail-title {
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--text);
		margin: 0 0 0.5rem 0;
		flex-shrink: 0;
	}

	.calendar-empty-msg {
		font-size: 0.875rem;
		color: #64748b;
		margin: 0;
		line-height: 1.5;
	}

	.calendar-empty-msg a {
		color: var(--primary);
		text-decoration: none;
		font-weight: 500;
	}

	.calendar-empty-msg a:hover {
		text-decoration: underline;
	}

	.day-detail-empty,
	.day-detail-hint {
		font-size: 0.75rem;
		color: #64748b;
		margin: 0.25rem 0 0 0;
		text-align: center;
		flex-shrink: 0;
	}

	.day-detail-section {
		margin-bottom: 0.75rem;
	}

	.day-detail-section:last-child {
		margin-bottom: 0;
	}

	.day-detail-label {
		display: block;
		font-size: 0.6875rem;
		font-weight: 600;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		color: #64748b;
		margin-bottom: 0.375rem;
	}

	.day-detail-list {
		list-style: none;
		margin: 0;
		padding: 0;
		min-height: 0;
		overflow-y: auto;
		max-height: 12rem;
	}

	.day-detail-item {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 0.375rem;
		font-size: 0.8125rem;
		padding: 0.25rem 0;
		border-bottom: 1px solid var(--border);
		min-width: 0;
	}

	.day-detail-item:last-child {
		border-bottom: none;
	}

	.item-title {
		font-weight: 600;
		color: var(--text);
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.item-meta {
		color: #64748b;
		font-size: 0.75rem;
		flex-shrink: 0;
	}

	.item-meta.menu {
		width: 100%;
		margin-top: 0.125rem;
		font-style: italic;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
</style>
