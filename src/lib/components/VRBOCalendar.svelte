<script lang="ts">
	import { onMount } from 'svelte';

	interface Props {
		availableDates?: { start: Date | string; end: Date | string }[];
		checkInDate?: string | null;
		checkOutDate?: string | null;
		minDate?: string;
		maxDate?: string;
	}

	let {
		availableDates,
		checkInDate = $bindable(),
		checkOutDate = $bindable(),
		minDate,
		maxDate
	}: Props = $props();

	let currentMonth = $state(new Date());
	let selectingStart = $state(true);
	let hoverDate: Date | null = $state(null);

	// Convert available date ranges to a set of available dates
	let availableDateSet = $derived.by(() => {
		const set = new Set<string>();
		if (availableDates && availableDates.length > 0) {
			for (const range of availableDates) {
				// Handle both Date objects and date strings
				const start = range.start instanceof Date ? range.start : new Date(range.start);
				const end = range.end instanceof Date ? range.end : new Date(range.end);
				const current = new Date(start);
				while (current <= end) {
					set.add(current.toISOString().split('T')[0]);
					current.setDate(current.getDate() + 1);
				}
			}
		}
		return set;
	});

	// If no available dates provided, allow all dates (fallback)
	// This handles the case where VRBO calendar data isn't extracted yet
	let isDateAvailable = (date: Date): boolean => {
		const dateStr = date.toISOString().split('T')[0];
		const today = new Date().toISOString().split('T')[0];
		
		// Don't allow past dates
		if (dateStr < today) return false;
		
		// If no available dates provided, allow all future dates (fallback)
		if (availableDateSet.size === 0) {
			if (minDate && dateStr < minDate) return false;
			if (maxDate && dateStr > maxDate) return false;
			return true;
		}
		return availableDateSet.has(dateStr);
	};

	function getDaysInMonth(year: number, month: number): Date[] {
		const firstDay = new Date(year, month, 1);
		const lastDay = new Date(year, month + 1, 0);
		const days: Date[] = [];

		// Add days from previous month to fill first week
		const startDay = firstDay.getDay();
		for (let i = startDay - 1; i >= 0; i--) {
			const date = new Date(year, month, -i);
			days.push(date);
		}

		// Add days of current month
		for (let day = 1; day <= lastDay.getDate(); day++) {
			days.push(new Date(year, month, day));
		}

		// Add days from next month to fill last week (42 total days for 6 weeks)
		const remaining = 42 - days.length;
		for (let day = 1; day <= remaining; day++) {
			days.push(new Date(year, month + 1, day));
		}

		return days;
	}

	function getMonthName(date: Date): string {
		return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
	}

	function getNextMonth(date: Date): Date {
		return new Date(date.getFullYear(), date.getMonth() + 1, 1);
	}

	function previousMonth() {
		currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1);
	}

	function nextMonth() {
		currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1);
	}

	function isDateInRange(date: Date, start: Date | null, end: Date | null): boolean {
		if (!start || !end) return false;
		const dateStr = date.toISOString().split('T')[0];
		const startStr = start.toISOString().split('T')[0];
		const endStr = end.toISOString().split('T')[0];
		return dateStr >= startStr && dateStr < endStr;
	}

	function isDateSelected(date: Date): boolean {
		const dateStr = date.toISOString().split('T')[0];
		return dateStr === checkInDate || dateStr === checkOutDate;
	}

	function isDateStart(date: Date): boolean {
		return date.toISOString().split('T')[0] === checkInDate;
	}

	function isDateEnd(date: Date): boolean {
		return date.toISOString().split('T')[0] === checkOutDate;
	}

	function handleDateClick(date: Date) {
		if (!isDateAvailable(date)) return;

		const dateStr = date.toISOString().split('T')[0];
		const today = new Date().toISOString().split('T')[0];

		// Don't allow past dates
		if (dateStr < today) return;

		if (selectingStart || !checkInDate) {
			// Starting new selection
			checkInDate = dateStr;
			checkOutDate = null;
			selectingStart = false;
		} else {
			// Selecting end date
			if (dateStr <= checkInDate!) {
				// If clicked date is before start, make it the new start
				checkOutDate = checkInDate;
				checkInDate = dateStr;
			} else {
				checkOutDate = dateStr;
				selectingStart = true; // Ready for next selection
			}
		}
	}

	function handleDateHover(date: Date) {
		if (!selectingStart && checkInDate && isDateAvailable(date)) {
			hoverDate = date;
		}
	}

	function handleDateLeave() {
		hoverDate = null;
	}

	function getDateClass(date: Date): string {
		const dateStr = date.toISOString().split('T')[0];
		const today = new Date().toISOString().split('T')[0];
		const isToday = dateStr === today;
		const isPast = dateStr < today;
		const isCurrentMonth = date.getMonth() === currentMonth.getMonth();
		const isAvailable = isDateAvailable(date);
		const isSelected = isDateSelected(date);
		const isStart = isDateStart(date);
		const isEnd = isDateEnd(date);
		const isInRange = checkInDate && checkOutDate && isDateInRange(date, new Date(checkInDate), new Date(checkOutDate));
		const isInHoverRange = !selectingStart && checkInDate && hoverDate && isDateInRange(date, new Date(checkInDate), hoverDate);

		return [
			'calendar-day',
			!isCurrentMonth && 'other-month',
			isPast && 'past',
			!isAvailable && 'unavailable',
			isAvailable && 'available',
			isSelected && 'selected',
			isStart && 'start-date',
			isEnd && 'end-date',
			isInRange && 'in-range',
			isInHoverRange && 'hover-range',
			isToday && 'today'
		].filter(Boolean).join(' ');
	}

	// Initialize to show current month and next month
	onMount(() => {
		if (checkInDate) {
			currentMonth = new Date(checkInDate);
		}
	});
</script>

<div class="vrbo-calendar">
	<div class="calendar-container">
		<!-- First Month -->
		<div class="calendar-month">
			<div class="calendar-header">
				<button type="button" class="nav-button" onclick={previousMonth} aria-label="Previous month">
					<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M15 18l-6-6 6-6" />
					</svg>
				</button>
				<h3 class="month-title">{getMonthName(currentMonth)}</h3>
				<div class="spacer"></div>
			</div>
			<div class="calendar-grid">
				<div class="calendar-weekdays">
					<div class="weekday">Su</div>
					<div class="weekday">Mo</div>
					<div class="weekday">Tu</div>
					<div class="weekday">We</div>
					<div class="weekday">Th</div>
					<div class="weekday">Fr</div>
					<div class="weekday">Sa</div>
				</div>
				<div class="calendar-days">
					{#each getDaysInMonth(currentMonth.getFullYear(), currentMonth.getMonth()) as date}
						<button
							type="button"
							class={getDateClass(date)}
							onclick={() => handleDateClick(date)}
							onmouseenter={() => handleDateHover(date)}
							onmouseleave={handleDateLeave}
							disabled={!isDateAvailable(date) || date.toISOString().split('T')[0] < new Date().toISOString().split('T')[0]}
							aria-label={date.toLocaleDateString()}
						>
							{date.getDate()}
						</button>
					{/each}
				</div>
			</div>
		</div>

		<!-- Second Month -->
		<div class="calendar-month">
			<div class="calendar-header">
				<h3 class="month-title">{getMonthName(getNextMonth(currentMonth))}</h3>
				<button type="button" class="nav-button" onclick={nextMonth} aria-label="Next month">
					<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M9 18l6-6-6-6" />
					</svg>
				</button>
			</div>
			<div class="calendar-grid">
				<div class="calendar-weekdays">
					<div class="weekday">Su</div>
					<div class="weekday">Mo</div>
					<div class="weekday">Tu</div>
					<div class="weekday">We</div>
					<div class="weekday">Th</div>
					<div class="weekday">Fr</div>
					<div class="weekday">Sa</div>
				</div>
				<div class="calendar-days">
					{#each getDaysInMonth(getNextMonth(currentMonth).getFullYear(), getNextMonth(currentMonth).getMonth()) as date}
						<button
							type="button"
							class={getDateClass(date)}
							onclick={() => handleDateClick(date)}
							onmouseenter={() => handleDateHover(date)}
							onmouseleave={handleDateLeave}
							disabled={!isDateAvailable(date) || date.toISOString().split('T')[0] < new Date().toISOString().split('T')[0]}
							aria-label={date.toLocaleDateString()}
						>
							{date.getDate()}
						</button>
					{/each}
				</div>
			</div>
		</div>
	</div>

	{#if checkInDate && checkOutDate}
		<div class="selected-dates">
			<div class="date-info">
				<span class="date-label">Check-in:</span>
				<span class="date-value">{new Date(checkInDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
			</div>
			<div class="date-info">
				<span class="date-label">Check-out:</span>
				<span class="date-value">{new Date(checkOutDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
			</div>
		</div>
	{/if}
</div>

<style>
	.vrbo-calendar {
		width: 100%;
		max-width: 700px;
		margin: 1rem 0;
	}

	.calendar-container {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 2rem;
		background: white;
		border: 1px solid #e0e0e0;
		border-radius: 8px;
		padding: 1.5rem;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
	}

	.calendar-month {
		display: flex;
		flex-direction: column;
	}

	.calendar-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 1rem;
	}

	.month-title {
		font-size: 1.125rem;
		font-weight: 600;
		color: #1a1a1a;
		margin: 0;
		flex: 1;
		text-align: center;
	}

	.nav-button {
		background: none;
		border: none;
		cursor: pointer;
		padding: 0.5rem;
		border-radius: 4px;
		color: #666;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: background-color 0.2s;
	}

	.nav-button:hover {
		background-color: #f5f5f5;
		color: #1a1a1a;
	}

	.nav-button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.spacer {
		width: 40px;
	}

	.calendar-grid {
		display: flex;
		flex-direction: column;
	}

	.calendar-weekdays {
		display: grid;
		grid-template-columns: repeat(7, 1fr);
		gap: 0.25rem;
		margin-bottom: 0.5rem;
	}

	.weekday {
		text-align: center;
		font-size: 0.75rem;
		font-weight: 600;
		color: #666;
		padding: 0.5rem 0;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.calendar-days {
		display: grid;
		grid-template-columns: repeat(7, 1fr);
		gap: 0.25rem;
	}

	.calendar-day {
		aspect-ratio: 1;
		border: 1px solid transparent;
		background: white;
		color: #1a1a1a;
		font-size: 0.875rem;
		cursor: pointer;
		border-radius: 4px;
		transition: all 0.2s;
		display: flex;
		align-items: center;
		justify-content: center;
		position: relative;
	}

	.calendar-day:hover:not(:disabled) {
		background-color: #f0f7ff;
		border-color: #0066cc;
	}

	.calendar-day.other-month {
		color: #ccc;
		background: #fafafa;
	}

	.calendar-day.past {
		color: #ccc;
		cursor: not-allowed;
	}

	.calendar-day.unavailable {
		color: #ccc;
		background: #f5f5f5;
		cursor: not-allowed;
		text-decoration: line-through;
	}

	.calendar-day.available {
		color: #1a1a1a;
	}

	.calendar-day.today {
		font-weight: 600;
		border-color: #0066cc;
	}

	.calendar-day.selected {
		background: #0066cc;
		color: white;
		font-weight: 600;
		border-color: #0066cc;
		z-index: 2;
	}

	.calendar-day.start-date {
		background: #0066cc;
		color: white;
		border-radius: 4px 0 0 4px;
	}

	.calendar-day.end-date {
		background: #0066cc;
		color: white;
		border-radius: 0 4px 4px 0;
	}

	.calendar-day.in-range {
		background: #e6f2ff;
		color: #0066cc;
		border-radius: 0;
	}

	.calendar-day.hover-range {
		background: #f0f7ff;
	}

	.calendar-day:disabled {
		cursor: not-allowed;
		opacity: 0.5;
	}

	.selected-dates {
		margin-top: 1rem;
		padding: 1rem;
		background: #f8f9fa;
		border-radius: 6px;
		display: flex;
		gap: 2rem;
		justify-content: center;
	}

	.date-info {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.date-label {
		font-size: 0.75rem;
		color: #666;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.date-value {
		font-size: 1rem;
		font-weight: 600;
		color: #1a1a1a;
	}

	@media (max-width: 768px) {
		.calendar-container {
			grid-template-columns: 1fr;
			gap: 1rem;
		}

		.selected-dates {
			flex-direction: column;
			gap: 1rem;
		}
	}
</style>
