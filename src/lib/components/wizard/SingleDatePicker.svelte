<script lang="ts">
	/**
	 * Dropdown single-date picker: same structure as DateRangePicker, but for one date.
	 */
	let {
		value = '',
		onDateChange,
		placeholder = 'Select date'
	}: {
		value?: string;
		onDateChange?: (date: string) => void;
		placeholder?: string;
	} = $props();

	let open = $state(false);
	let containerEl = $state<HTMLDivElement | null>(null);
	let triggerBtn = $state<HTMLButtonElement | null>(null);
	let popoverEl = $state<HTMLDivElement | null>(null);
	let popoverPos = $state({ top: 0, left: 0 });

	function syncPopoverPosition() {
		if (!open || typeof window === 'undefined') return;
		const btn = triggerBtn;
		if (!btn) return;
		const r = btn.getBoundingClientRect();
		const gap = 6;
		const vw = window.innerWidth;
		const vh = window.innerHeight;
		const popW = Math.min(280, vw - 16);
		let left = Math.max(8, Math.min(r.left, vw - popW - 8));
		const h = popoverEl?.offsetHeight ?? 300;
		let top = r.bottom + gap;
		if (top + h > vh - 8) {
			top = Math.max(8, r.top - h - gap);
		}
		popoverPos = { top, left };
	}

	function toDateKey(d: Date): string {
		const y = d.getFullYear();
		const m = String(d.getMonth() + 1).padStart(2, '0');
		const day = String(d.getDate()).padStart(2, '0');
		return `${y}-${m}-${day}`;
	}

	const today = $derived(toDateKey(new Date()));

	const displayText = $derived(
		value
			? new Date(value + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
			: ''
	);

	let viewYear = $state(new Date().getFullYear());
	let viewMonth = $state(new Date().getMonth());

	function getMonthCells(year: number, month: number) {
		const first = new Date(year, month, 1);
		const last = new Date(year, month + 1, 0);
		const startDow = first.getDay();
		const daysInMonth = last.getDate();
		const cells: { dateKey: string; dayNum: number; isCurrentMonth: boolean }[] = [];

		for (let i = 0; i < startDow; i++) {
			const d = new Date(year, month, 1 - (startDow - i));
			cells.push({ dateKey: toDateKey(d), dayNum: d.getDate(), isCurrentMonth: false });
		}
		for (let day = 1; day <= daysInMonth; day++) {
			const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
			cells.push({ dateKey, dayNum: day, isCurrentMonth: true });
		}
		const remainder = cells.length % 7;
		const trailing = remainder === 0 ? 0 : 7 - remainder;
		for (let i = 0; i < trailing; i++) {
			const d = new Date(year, month, daysInMonth + i + 1);
			cells.push({ dateKey: toDateKey(d), dayNum: d.getDate(), isCurrentMonth: false });
		}
		return cells;
	}

	function isSelected(dateKey: string): boolean {
		return value === dateKey;
	}

	function selectCell(dateKey: string) {
		if (!dateKey) return;
		const cells = getMonthCells(viewYear, viewMonth);
		const isCurrent = cells.some((c) => c.dateKey === dateKey && c.isCurrentMonth);
		if (!isCurrent) return;
		if (dateKey < today) return;

		onDateChange?.(dateKey);
		open = false;
	}

	function prevMonth() {
		if (viewMonth === 0) {
			viewMonth = 11;
			viewYear--;
		} else {
			viewMonth--;
		}
	}

	function nextMonth() {
		if (viewMonth === 11) {
			viewMonth = 0;
			viewYear++;
		} else {
			viewMonth++;
		}
	}

	function openDropdown() {
		open = true;
		if (value) {
			const d = new Date(value + 'T12:00:00');
			viewYear = d.getFullYear();
			viewMonth = d.getMonth();
		} else {
			viewYear = new Date().getFullYear();
			viewMonth = new Date().getMonth();
		}
		queueMicrotask(() => {
			syncPopoverPosition();
			requestAnimationFrame(() => syncPopoverPosition());
		});
	}

	function handleClickOutside(e: MouseEvent) {
		const target = e.target as Node;
		if (open && containerEl && !containerEl.contains(target)) {
			open = false;
		}
	}

	$effect(() => {
		if (!open) return;
		document.addEventListener('click', handleClickOutside, true);
		return () => document.removeEventListener('click', handleClickOutside, true);
	});

	$effect(() => {
		if (open && value) {
			const d = new Date(value + 'T12:00:00');
			viewYear = d.getFullYear();
			viewMonth = d.getMonth();
		}
	});

	$effect(() => {
		if (!open) return;
		syncPopoverPosition();
		const id = requestAnimationFrame(() => syncPopoverPosition());
		function onReposition() {
			syncPopoverPosition();
		}
		window.addEventListener('scroll', onReposition, true);
		window.addEventListener('resize', onReposition);
		return () => {
			cancelAnimationFrame(id);
			window.removeEventListener('scroll', onReposition, true);
			window.removeEventListener('resize', onReposition);
		};
	});

	const monthTitle = $derived(new Date(viewYear, viewMonth, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' }));
	const cells = $derived(getMonthCells(viewYear, viewMonth));
	const dayHeaders = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
</script>

<div class="date-range-picker" bind:this={containerEl}>
	<button
		type="button"
		class="trigger-input"
		bind:this={triggerBtn}
		onclick={openDropdown}
		aria-haspopup="dialog"
		aria-expanded={open}
		aria-label="Select date"
	>
		<span class="trigger-text" class:placeholder={!displayText}>{displayText || placeholder}</span>
		<span class="trigger-icon" aria-hidden="true">
			<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
				<rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
				<line x1="16" y1="2" x2="16" y2="6"></line>
				<line x1="8" y1="2" x2="8" y2="6"></line>
				<line x1="3" y1="10" x2="21" y2="10"></line>
			</svg>
		</span>
	</button>
	{#if open}
		<div
			class="popover"
			bind:this={popoverEl}
			role="dialog"
			aria-label="Date calendar"
			style="top: {popoverPos.top}px; left: {popoverPos.left}px;"
		>
			<div class="calendar-inner">
				<div class="calendar-header">
					<button type="button" class="month-nav" onclick={prevMonth} aria-label="Previous month">‹</button>
					<span class="month-title">{monthTitle}</span>
					<button type="button" class="month-nav" onclick={nextMonth} aria-label="Next month">›</button>
				</div>
				<div class="day-headers">
					{#each dayHeaders as h}
						<span class="day-header">{h}</span>
					{/each}
				</div>
				<div class="days-grid">
					{#each cells as cell}
						{@const disabled = cell.isCurrentMonth && cell.dateKey < today}
						<button
							type="button"
							class="day-cell"
							class:other-month={!cell.isCurrentMonth}
							class:selected={cell.isCurrentMonth && isSelected(cell.dateKey)}
							class:today={cell.dateKey === today}
							class:disabled={disabled}
							disabled={disabled}
							onclick={(e) => {
								e.stopPropagation();
								if (!disabled) selectCell(cell.dateKey);
							}}
						>
							{cell.dayNum}
						</button>
					{/each}
				</div>
			</div>
		</div>
	{/if}
</div>

<style>
	.date-range-picker {
		position: relative;
		display: inline-block;
		width: 100%;
	}

	.trigger-input {
		width: 100%;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		padding: 0.375rem 0.5rem;
		padding-right: 2.25rem;
		border: 1px solid var(--border);
		border-radius: 0;
		font-size: 0.8125rem;
		font-family: inherit;
		color: var(--text);
		background: white;
		cursor: pointer;
		text-align: left;
		transition: border-color 0.2s ease, box-shadow 0.2s ease;
		position: relative;
	}

	.trigger-input:hover {
		border-color: var(--border-strong);
	}

	.trigger-input:focus {
		outline: none;
		border-color: var(--primary);
		box-shadow: 0 0 0 3px rgba(30, 58, 138, 0.1);
	}

	.trigger-text {
		flex: 1;
		min-width: 0;
	}

	.trigger-input .trigger-text.placeholder {
		color: var(--muted);
	}

	.trigger-icon {
		position: absolute;
		right: 0.5rem;
		top: 50%;
		transform: translateY(-50%);
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--muted);
		pointer-events: none;
	}

	.trigger-icon svg {
		display: block;
	}

	.popover {
		position: fixed;
		z-index: 10050;
		background: white;
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
		padding: 0.75rem;
		min-width: 260px;
		max-width: min(280px, calc(100vw - 16px));
	}

	.calendar-inner {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.calendar-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
	}

	.month-nav {
		width: 1.75rem;
		height: 1.75rem;
		display: flex;
		align-items: center;
		justify-content: center;
		border: none;
		background: var(--surface2);
		border-radius: var(--radius-sm);
		cursor: pointer;
		font-size: 1.25rem;
		line-height: 1;
		color: var(--text);
	}

	.month-nav:hover {
		background: var(--border);
	}

	.month-title {
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--text);
	}

	.day-headers {
		display: grid;
		grid-template-columns: repeat(7, 1fr);
		gap: 2px;
	}

	.day-header {
		font-size: 0.625rem;
		font-weight: 600;
		color: var(--muted);
		text-align: center;
		text-transform: uppercase;
		letter-spacing: 0.02em;
	}

	.days-grid {
		display: grid;
		grid-template-columns: repeat(7, 1fr);
		gap: 2px;
	}

	.day-cell {
		aspect-ratio: 1;
		min-width: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		border: none;
		background: transparent;
		border-radius: var(--radius-sm);
		cursor: pointer;
		font-size: 0.75rem;
		color: var(--text);
	}

	.day-cell:hover:not(:disabled) {
		background: var(--surface2);
	}

	.day-cell.other-month {
		color: var(--muted);
		opacity: 0.5;
	}

	.day-cell.selected {
		background: var(--primary);
		color: white;
	}

	.day-cell.today {
		font-weight: 700;
		box-shadow: inset 0 0 0 1px var(--primary);
	}

	.day-cell.selected.today {
		box-shadow: none;
	}

	.day-cell.disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}
</style>
