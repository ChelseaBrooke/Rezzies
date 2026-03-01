<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { enhance } from '$app/forms';
	import type { PageData } from './$types';
	import {
		computeOverlapLayout,
		parseTimeToMinutes,
		formatMinutes,
		snapToGrid,
		clamp
	} from '$lib/itinerary/overlap.js';
	import EventDetailsDrawer, {
		type DrawerEvent
	} from '$lib/components/itinerary/EventDetailsDrawer.svelte';
	import AddMealModal from '$lib/components/trips/meals/AddMealModal.svelte';

	let { data }: { data: PageData } = $props();

	// ── Grid constants ─────────────────────────────────────────────────────
	const SLOT_HEIGHT = 60; // px per hour
	const HEADER_HEIGHT = 58; // day-header row px
	const TIME_COL_WIDTH = 64; // left time gutter px
	const DEFAULT_DURATION_MEAL = 60; // minutes
	const DEFAULT_DURATION_ACTIVITY = 90; // minutes
	const MIN_DURATION = 30;


	// ── Server data refs ───────────────────────────────────────────────────
	const tripDays    = $derived(data.tripDays ?? []);
	const goingUsers  = $derived(data.goingUsers ?? []);
	const mealPlanOn  = $derived((data.mealPlan as { enabled: boolean } | null)?.enabled === true);

	// Set of "date|mealType" keys for existing meal slots (used by placeholders)
	// data.mealSlots is a flat array from the server
	const existingMealKeys = $derived.by(() => {
		const keys = new Set<string>();
		const slots = (data.mealSlots ?? []) as Array<{ date: Date | string; mealType: string }>;
		for (const s of slots) {
			const dateStr = s.date instanceof Date
				? s.date.toISOString().slice(0, 10)
				: String(s.date).slice(0, 10);
			keys.add(`${dateStr}|${s.mealType}`);
		}
		return keys;
	});

	// Members list for the AddMealModal cook picker
	const mealModalMembers = $derived(
		(data.members ?? data.goingUsers ?? []) as Array<{ id: string; name: string }>
	);

	// tripDays formatted for the modal date selector
	const mealModalDays = $derived(
		tripDays.map((d: string) => ({
			value: d,
			label: new Date(d + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
		}))
	);

	// ── Dynamic visible hour range ─────────────────────────────────────────
	// Always shows at least 9am–5pm; expands to include the earliest/latest
	// event across all trip days.
	const hourRange = $derived.by(() => {
		let minMin = 9 * 60;
		let maxMin = 17 * 60;
		for (const date of tripDays) {
			const raw = (data.eventsByDate?.[date] ?? []) as Record<string, unknown>[];
			for (const ev of raw) {
				if (ev.type !== 'meal' && ev.type !== 'activity') continue;
				const isMeal = ev.type === 'meal';
				const startMin = parseTimeToMinutes(
					ev.time as string | null,
					isMeal ? (ev.mealType as string) : undefined
				);
				const dur = isMeal ? DEFAULT_DURATION_MEAL : DEFAULT_DURATION_ACTIVITY;
				minMin = Math.min(minMin, startMin);
				maxMin = Math.max(maxMin, startMin + dur);
			}
		}
		return {
			start: Math.max(0,  Math.min(Math.floor(minMin / 60), 9)),
			end:   Math.min(24, Math.max(Math.ceil(maxMin  / 60), 17))
		};
	});
	const HOUR_START = $derived(hourRange.start);
	const HOUR_END   = $derived(hourRange.end);

	// ── Add Custom Activity modal ──────────────────────────────────────────
	const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
		const h24 = Math.floor((i * 30) / 60);
		const mins = (i * 30) % 60;
		const ampm = h24 < 12 ? 'AM' : 'PM';
		const h12 = h24 === 0 ? 12 : h24 > 12 ? h24 - 12 : h24;
		return `${h12}:${String(mins).padStart(2, '0')} ${ampm}`;
	});

	let showAddActivity = $state(false);
	let addActivitySubmitting = $state(false);
	let editActivityId  = $state<string | null>(null);
	let editActivityTitle    = $state('');
	let editActivityDate     = $state('');
	let editActivityTime     = $state('9:00 AM');
	let editActivityLocation = $state('');
	let editActivityNotes    = $state('');

	function openAddActivity() {
		editActivityId = null;
		showAddActivity = true;
	}
	function closeAddActivity() {
		showAddActivity = false;
		editActivityId = null;
	}

	// ── Add Meal modal (triggered from placeholders) ────────────────────────
	let showAddMeal = $state(false);
	let addMealPrefill = $state<{
		slotId?: string;
		date: string;
		mealType: string;
		time: string;
		notes?: string;
		option?: string;
		assignedUserId?: string;
	} | null>(null);

	function openAddMeal(date: string, mealType: string, defaultTime: string) {
		addMealPrefill = { date, mealType, time: defaultTime };
		showAddMeal = true;
	}
	function closeAddMeal() {
		showAddMeal = false;
		addMealPrefill = null;
	}

	// ── Edit handlers (called from drawer Edit button) ──────────────────────
	function handleEditEvent() {
		if (!drawerEvent) return;
		const ev = drawerEvent;
		drawerEvent = null;
		if (ev.type === 'meal') {
			const title = ev.title ?? '';
			let option = 'cooking';
			if (title === 'Ordering In') option = 'ordering-in';
			else if (title.startsWith('Going out')) option = 'going-out';
			else if (title === 'Fend for yourself') option = 'fend-for-yourself';
			addMealPrefill = {
				slotId: ev.id,
				date: ev.date,
				mealType: ev.mealType ?? 'dinner',
				time: ev.time ?? '',
				notes: ev.notes ?? '',
				option,
				assignedUserId: ev.assignedUser?.id ?? ''
			};
			showAddMeal = true;
		} else {
			editActivityId       = ev.id;
			editActivityTitle    = ev.title ?? '';
			editActivityDate     = ev.date;
			editActivityTime     = ev.time ?? '9:00 AM';
			editActivityLocation = ev.location ?? '';
			editActivityNotes    = ev.notes ?? '';
			showAddActivity = true;
		}
	}

	// ── Filters ────────────────────────────────────────────────────────────
	let filterType    = $state<'all' | 'meal' | 'activity'>('all');
	let hideSkipping  = $state(false);

	function eventMatchesFilters(ev: Record<string, unknown>): boolean {
		if (filterType !== 'all' && ev.type !== filterType) return false;
		if (hideSkipping) {
			if (ev.type === 'activity' && ev.currentUserRsvp === 'skip') return false;
			if (ev.type === 'meal'     && ev.currentUserOptedOut === true) return false;
		}
		return true;
	}

	// ── Mini-calendar derived state ────────────────────────────────────────
	const todayKey = $derived(new Date().toISOString().slice(0, 10));

	// All unique months spanned by the trip, in order
	const tripMonths = $derived.by(() => {
		if (!tripDays.length) return [{ year: new Date().getFullYear(), month: new Date().getMonth() }];
		const seen = new Set<string>();
		const months: { year: number; month: number }[] = [];
		for (const day of tripDays) {
			const d = new Date(day + 'T12:00:00');
			const key = `${d.getFullYear()}-${d.getMonth()}`;
			if (!seen.has(key)) {
				seen.add(key);
				months.push({ year: d.getFullYear(), month: d.getMonth() });
			}
		}
		return months;
	});

	// Which month the mini-cal is showing (index into tripMonths)
	let calMonthOffset = $state(0);

	const calendarMonth = $derived(
		tripMonths[calMonthOffset] ?? tripMonths[0] ?? { year: new Date().getFullYear(), month: new Date().getMonth() }
	);
	const canGoPrev = $derived(calMonthOffset > 0);
	const canGoNext = $derived(calMonthOffset < tripMonths.length - 1);
	function prevCalMonth() { if (canGoPrev) calMonthOffset--; }
	function nextCalMonth() { if (canGoNext) calMonthOffset++; }

	const calendarDays = $derived.by(() => {
		const { year, month } = calendarMonth;
		const first = new Date(year, month, 1);
		const last = new Date(year, month + 1, 0);
		const days: { date: string; day: number; isTrip: boolean; isToday: boolean }[] = [];
		for (let i = 0; i < first.getDay(); i++)
			days.push({ date: '', day: 0, isTrip: false, isToday: false });
		const tripSet = new Set(tripDays);
		for (let d = 1; d <= last.getDate(); d++) {
			const date = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
			days.push({ date, day: d, isTrip: tripSet.has(date), isToday: date === todayKey });
		}
		return days;
	});
	const monthLabel = $derived(
		new Date(calendarMonth.year, calendarMonth.month).toLocaleDateString('en-US', {
			month: 'short',
			year: 'numeric'
		})
	);

	// ── Time slots (left axis) ─────────────────────────────────────────────
	const timeSlots = $derived(
		Array.from({ length: HOUR_END - HOUR_START + 1 }, (_, i) => {
			const h = HOUR_START + i;
			return h < 12 ? `${h}:00 AM` : h === 12 ? '12:00 PM' : `${h - 12}:00 PM`;
		})
	);

	// ── "Now" indicator ────────────────────────────────────────────────────
	const nowTopPx = $derived.by(() => {
		if (!tripDays.includes(todayKey)) return null;
		const now = new Date();
		const hour = now.getHours() + now.getMinutes() / 60;
		if (hour < HOUR_START || hour > HOUR_END) return null;
		return (hour - HOUR_START) * SLOT_HEIGHT;
	});

	// ── Optimistic event store ─────────────────────────────────────────────
	// Keyed by event id (activityId or slotId), stores overrides applied client-side
	type EventOverride = {
		date?: string;
		time?: string | null;
		participants?: { id: string; name: string; rsvpStatus: 'going' | 'skip' }[];
		currentUserRsvp?: 'going' | 'skip';
		currentUserOptedOut?: boolean;
	};
	let overrides = $state<Record<string, EventOverride>>({});

	function mergedEvent(ev: Record<string, unknown>): Record<string, unknown> {
		const id = (ev.activityId ?? ev.slotId) as string | undefined;
		if (!id || !overrides[id]) return ev;
		return { ...ev, ...overrides[id] };
	}

	// ── Derived positioned events (overlap layout per day) ────────────────
	const positionedByDate = $derived.by(() => {
		const result: Record<
			string,
			{
				ev: Record<string, unknown>;
				startMin: number;
				endMin: number;
				col: number;
				totalCols: number;
				topPx: number;
				heightPx: number;
			}[]
		> = {};

		for (const date of tripDays) {
			const raw = (data.eventsByDate?.[date] ?? []) as Record<string, unknown>[];
			const calEvents = raw
				.filter((e) => e.type === 'meal' || e.type === 'activity')
				.filter(eventMatchesFilters);

			const layoutInputs = calEvents.map((ev) => {
				const m = mergedEvent(ev);
				const isMeal = m.type === 'meal';
				const startMin = parseTimeToMinutes(
					m.time as string | null,
					isMeal ? (m.mealType as string) : undefined
				);
				const dur = isMeal ? DEFAULT_DURATION_MEAL : DEFAULT_DURATION_ACTIVITY;
				return {
					id: ((m.activityId ?? m.slotId) as string) ?? '',
					startMin,
					endMin: startMin + dur
				};
			});

			const positioned = computeOverlapLayout(layoutInputs);
			const posMap = Object.fromEntries(positioned.map((p) => [p.id, p]));

			result[date] = calEvents.map((ev) => {
				const m = mergedEvent(ev);
				const id = ((m.activityId ?? m.slotId) as string) ?? '';
				const p = posMap[id] ?? {
					startMin: 12 * 60,
					endMin: 12 * 60 + DEFAULT_DURATION_ACTIVITY,
					col: 0,
					totalCols: 1
				};
				const topPx = Math.max(0, (p.startMin - HOUR_START * 60) / 60) * SLOT_HEIGHT;
				const heightPx = Math.max(MIN_DURATION / 60, (p.endMin - p.startMin) / 60) * SLOT_HEIGHT;
				return { ev: m, ...p, topPx, heightPx };
			});
		}
		return result;
	});

	// ── Drawer state ───────────────────────────────────────────────────────
	let drawerEvent = $state<DrawerEvent | null>(null);

	function openDrawer(ev: Record<string, unknown>) {
		const isMeal = ev.type === 'meal';
		const id = ((ev.activityId ?? ev.slotId) as string) ?? '';
		const startMin = parseTimeToMinutes(
			ev.time as string | null,
			isMeal ? (ev.mealType as string) : undefined
		);
		const dur = isMeal ? DEFAULT_DURATION_MEAL : DEFAULT_DURATION_ACTIVITY;

		drawerEvent = {
			id,
			type: ev.type as 'activity' | 'meal',
			date: ev.date as string,
			time: ev.time as string | null,
			durationMinutes: dur,
			title: ev.title as string | null,
			mealType: ev.mealType as string | undefined,
			menuText: ev.menuText as string | null,
			notes: ev.notes as string | null,
			location: ev.location as string | null,
			assignedUser: ev.assignedUser as { id: string; name: string } | null | undefined,
			participants: ev.participants as DrawerEvent['participants'],
			currentUserRsvp: ev.currentUserRsvp as 'going' | 'skip' | undefined,
			attendance: ev.attendance as DrawerEvent['attendance'],
			currentUserOptedOut: ev.currentUserOptedOut as boolean | undefined,
			guestDietaryNotes: ev.guestDietaryNotes as DrawerEvent['guestDietaryNotes']
		};
		// Attach the resolved date from the current rendering
		if (!drawerEvent.date) drawerEvent.date = '';
	}

	function handleLocalRsvpUpdate(eventId: string, status: 'going' | 'skip' | 'meal-in' | 'meal-out') {
		if (!drawerEvent || drawerEvent.id !== eventId) return;

		if (drawerEvent.type === 'activity') {
			const rsvp = status as 'going' | 'skip';
			// Update participants list optimistically
			const existing = drawerEvent.participants ?? [];
			const userId = data.user.id;
			const filtered = existing.filter((p) => p.id !== userId);
			const updated =
				rsvp === 'skip'
					? filtered
					: [...filtered, { id: userId, name: data.user.name ?? 'You', rsvpStatus: rsvp }];
			drawerEvent = { ...drawerEvent, participants: updated, currentUserRsvp: rsvp };
			overrides[eventId] = { ...overrides[eventId], participants: updated, currentUserRsvp: rsvp };
		} else {
			const optedOut = status === 'meal-out';
			drawerEvent = { ...drawerEvent, currentUserOptedOut: optedOut };
			overrides[eventId] = { ...overrides[eventId], currentUserOptedOut: optedOut };
		}
		// Sync with server in background
		invalidateAll();
	}

	// ── Drag-to-move state ─────────────────────────────────────────────────
	type DragState = {
		eventId: string;
		type: 'meal' | 'activity';
		origDate: string;
		origStartMin: number;
		duration: number;
		pointerOffsetY: number; // px from top of card when pointer went down
	};

	let dragState = $state<DragState | null>(null);
	let ghostDate = $state<string | null>(null);
	let ghostStartMin = $state<number | null>(null);
	let gridWrapperEl = $state<HTMLElement | null>(null);

	function onEventPointerDown(
		e: PointerEvent,
		ev: Record<string, unknown>,
		topPx: number,
		date: string
	) {
		// Only left button; ignore resize-handle clicks
		if (e.button !== 0) return;
		const target = e.target as HTMLElement;
		if (target.closest('.resize-handle')) return;

		// Don't drag if not host (only host can move events)
		if (!data.isHost) return;

		e.preventDefault();
		const isMeal = ev.type === 'meal';
		const id = ((ev.activityId ?? ev.slotId) as string) ?? '';
		const startMin = parseTimeToMinutes(
			ev.time as string | null,
			isMeal ? (ev.mealType as string) : undefined
		);
		const dur = isMeal ? DEFAULT_DURATION_MEAL : DEFAULT_DURATION_ACTIVITY;

		dragState = {
			eventId: id,
			type: ev.type as 'meal' | 'activity',
			origDate: date,
			origStartMin: startMin,
			duration: dur,
			pointerOffsetY: e.clientY - (e.currentTarget as HTMLElement).getBoundingClientRect().top
		};
		// Ghost is intentionally NOT set here — it only appears once the pointer moves.
		ghostDate = null;
		ghostStartMin = null;

		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
	}

	function onGridPointerMove(e: PointerEvent) {
		if (!dragState || !gridWrapperEl) return;
		e.preventDefault();

		const rect = gridWrapperEl.getBoundingClientRect();
		const scrollTop = gridWrapperEl.scrollTop;
		const scrollLeft = gridWrapperEl.scrollLeft;

		// Y position within the time area (below header, accounting for scroll)
		const yInGrid =
			e.clientY - rect.top + scrollTop - HEADER_HEIGHT - dragState.pointerOffsetY;
		const rawMin = HOUR_START * 60 + (yInGrid / SLOT_HEIGHT) * 60;
		const snapped = clamp(snapToGrid(rawMin), HOUR_START * 60, (HOUR_END - 1) * 60);

		// X → which day column
		const xInDays = e.clientX - rect.left + scrollLeft - TIME_COL_WIDTH;
		const numDays = tripDays.length;
		const dayColWidth = (gridWrapperEl.scrollWidth - TIME_COL_WIDTH) / numDays;
		const dayIdx = clamp(Math.floor(xInDays / dayColWidth), 0, numDays - 1);

		ghostDate = tripDays[dayIdx] ?? dragState.origDate;
		ghostStartMin = snapped;
	}

	async function onGridPointerUp(e: PointerEvent) {
		if (!dragState) return;

		const ds = dragState;
		const newDate = ghostDate ?? ds.origDate;
		const newStartMin = ghostStartMin ?? ds.origStartMin;

		dragState = null;
		ghostDate = null;
		ghostStartMin = null;

		const movedDate = newDate !== ds.origDate;
		const movedTime = Math.abs(newStartMin - ds.origStartMin) >= 15;
		if (!movedDate && !movedTime) return; // no real change

		// Format new time as "HH:MM" (24-hr) for server
		const hh = String(Math.floor(newStartMin / 60)).padStart(2, '0');
		const mm = String(newStartMin % 60).padStart(2, '0');
		const newTime = `${hh}:${mm}`;

		// Optimistic update
		overrides[ds.eventId] = { ...overrides[ds.eventId], date: newDate, time: newTime };

		// Persist
		const fd = new FormData();
		fd.set('date', newDate);
		fd.set('time', newTime);
		if (ds.type === 'meal') {
			fd.set('slotId', ds.eventId);
			await fetch(`?/moveMealSlot`, { method: 'POST', body: fd });
		} else {
			fd.set('activityId', ds.eventId);
			await fetch(`?/moveActivity`, { method: 'POST', body: fd });
		}
		await invalidateAll();
	}

	function onGridPointerLeave() {
		// Don't cancel drag on leave — pointer capture keeps it alive
	}

	// ── Ghost event dimensions ─────────────────────────────────────────────
	const ghostTopPx = $derived.by(() => {
		if (ghostStartMin === null) return 0;
		return Math.max(0, (ghostStartMin - HOUR_START * 60) / 60) * SLOT_HEIGHT;
	});
	const ghostHeightPx = $derived.by(() => {
		if (!dragState) return 60;
		return (dragState.duration / 60) * SLOT_HEIGHT;
	});
	const ghostDayIdx = $derived.by(() => {
		if (!ghostDate) return -1;
		return tripDays.indexOf(ghostDate);
	});

	// ── Helpers for event card coloring ───────────────────────────────────
	type EventType = {
		bg: string;
		border: string;
		titleColor: string;
		subColor: string;
	};
	const EVENT_STYLES: Record<string, EventType> = {
		meal: {
			bg: 'rgba(232,93,38,.12)', border: '#E85D26',
			titleColor: '#7c2d12', subColor: '#c2410c'
		},
		activity: {
			bg: 'rgba(74,167,91,.13)', border: '#3a9e53',
			titleColor: '#14532d', subColor: '#166534'
		}
	};
	function evStyle(ev: Record<string, unknown>): EventType {
		return ev.type === 'meal' ? EVENT_STYLES.meal : EVENT_STYLES.activity;
	}

	// ── Assign-meal / add-participant (existing drag-person flow) ─────────
	let dragOverTarget = $state<string | null>(null);

	function handlePersonDragStart(e: DragEvent, payload: { type: string; id: string; name?: string }) {
		e.dataTransfer?.setData('application/json', JSON.stringify(payload));
		e.dataTransfer!.effectAllowed = 'copy';
	}

	function handleDropMeal(e: DragEvent, slotId: string) {
		e.preventDefault();
		const raw = e.dataTransfer?.getData('application/json');
		if (!raw) return;
		const payload = JSON.parse(raw) as { type: string; id: string };
		if (payload.type !== 'person') return;
		const form = document.getElementById(`assign-meal-${slotId}`) as HTMLFormElement | null;
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
		const form = document.getElementById(`add-participant-${activityId}`) as HTMLFormElement | null;
		if (form) {
			(form.querySelector('input[name="userId"]') as HTMLInputElement).value = payload.id;
			form.requestSubmit();
		}
	}

	function handleScheduleResult() {
		return async ({
			result,
			update
		}: {
			result: { data?: Record<string, unknown>; type: string };
			update: () => Promise<void>;
		}) => {
			await update();
		};
	}

	// ── Helpers ────────────────────────────────────────────────────────────
	function initial(name: string): string {
		return (name ?? '?').charAt(0).toUpperCase();
	}

	function goingCount(ev: Record<string, unknown>): number {
		const p = ev.participants as { rsvpStatus: string }[] | undefined;
		return p?.filter((x) => x.rsvpStatus === 'going').length ?? 0;
	}
</script>

<div class="itinerary-page">
	{#if tripDays.length === 0}
		<div class="empty-state">
			<p>Set trip check-in and check-out dates to see the daily schedule.</p>
		</div>
	{:else}
		<div class="schedule-card">
			<!-- ── Left Sidebar ────────────────────────────────────────── -->
			<aside class="schedule-sidebar">
				<!-- Mini calendar -->
				<div class="mini-calendar">
					<div class="mini-cal-header">
						<span class="mini-cal-month">{monthLabel}</span>
						<div class="mini-cal-nav">
							<button
								class="mini-cal-arrow"
								onclick={prevCalMonth}
								disabled={!canGoPrev}
								aria-label="Previous month"
							>‹</button>
							<button
								class="mini-cal-arrow"
								onclick={nextCalMonth}
								disabled={!canGoNext}
								aria-label="Next month"
							>›</button>
						</div>
					</div>
					<div class="mini-cal-grid">
						{#each ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'] as letter}
							<span class="cal-dow">{letter}</span>
						{/each}
						{#each calendarDays as d}
							<span class="cal-day" class:trip-day={d.isTrip} class:today={d.isToday} class:empty={!d.date}>
								{d.day || ''}
							</span>
						{/each}
					</div>
				</div>

				<!-- Legend -->
				<div class="sidebar-section">
					<div class="sidebar-section-header">
						<span class="sidebar-section-title">Key</span>
					</div>
					<ul class="legend-list">
					<li class="legend-item"><span class="legend-dot" style="background:#E85D26"></span>Meal</li>
					<li class="legend-item"><span class="legend-dot" style="background:#3a9e53"></span>Activity</li>
					</ul>
				</div>
			</aside>

			<!-- ── Main area ───────────────────────────────────────────── -->
			<div class="schedule-main">
				<!-- Header row -->
				<div class="schedule-header">
					<div class="schedule-header-left">
						<h2 class="schedule-date-range">
							{new Date(tripDays[0] + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
							–
							{new Date(tripDays[tripDays.length - 1] + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
						</h2>
						<label class="skip-toggle">
							<span class="skip-toggle-track" class:on={hideSkipping}>
								<input
									type="checkbox"
									bind:checked={hideSkipping}
									aria-label="Hide events I'm skipping"
								/>
								<span class="skip-toggle-thumb"></span>
							</span>
							<span class="skip-toggle-label">Hide events I'm skipping</span>
						</label>
					</div>
				<div class="schedule-header-right">
						<button class="btn-add-activity" onclick={openAddActivity}>+ Custom Activity</button>
					</div>
				</div>

				<!-- Calendar grid -->
				<div
					class="schedule-grid-wrapper"
					style="--day-cols:{tripDays.length}; --slot-h:{SLOT_HEIGHT}px; --time-w:{TIME_COL_WIDTH}px; --hdr-h:{HEADER_HEIGHT}px;"
					bind:this={gridWrapperEl}
					onpointermove={onGridPointerMove}
					onpointerup={onGridPointerUp}
				>
					<div class="schedule-scroll-inner">
						<!-- Background grid -->
						<div class="schedule-grid">
							<!-- Corner -->
							<div class="grid-corner"></div>
							<!-- Day headers -->
							{#each tripDays as date}
								{@const d = new Date(date + 'T12:00:00')}
								<div class="grid-day-header" class:today={date === todayKey}>
									<span class="day-num" class:today-num={date === todayKey}>{d.getDate()}</span>
									<span class="day-name">{d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()}</span>
								</div>
							{/each}
							<!-- Time rows -->
							{#each timeSlots as slot}
								<div class="grid-time-label">{slot}</div>
								{#each tripDays as _date}
									<div class="grid-cell"></div>
								{/each}
							{/each}
						</div>


					<!-- "Now" line -->
						{#if nowTopPx !== null}
							{@const nowDayIdx = tripDays.indexOf(todayKey)}
							{#if nowDayIdx >= 0}
								<div
									class="now-line"
									style="
										top:{HEADER_HEIGHT + nowTopPx}px;
										left:calc({TIME_COL_WIDTH}px + {nowDayIdx} * (100% - {TIME_COL_WIDTH}px) / {tripDays.length});
										width:calc((100% - {TIME_COL_WIDTH}px) / {tripDays.length});
									"
								>
									<span class="now-dot"></span>
								</div>
							{/if}
						{/if}

						<!-- Drag ghost -->
						{#if dragState && ghostDate && ghostStartMin !== null && ghostDayIdx >= 0}
							<div
								class="drag-ghost"
								style="
									top:{HEADER_HEIGHT + ghostTopPx}px;
									height:{ghostHeightPx}px;
									left:calc({TIME_COL_WIDTH}px + {ghostDayIdx} * (100% - {TIME_COL_WIDTH}px) / {tripDays.length} + 6px);
									width:calc((100% - {TIME_COL_WIDTH}px) / {tripDays.length} - 12px);
								"
							>
								<span class="ghost-time">{formatMinutes(ghostStartMin)}</span>
							</div>
						{/if}

						<!-- Meal placeholders (only when meal planning is on) -->
						{#if mealPlanOn && data.isHost}
							{#each [
								{ mealType: 'breakfast', defaultMin: 9 * 60,  defaultTime: '9:00 AM',  label: '🍳 Breakfast' },
								{ mealType: 'lunch',     defaultMin: 13 * 60, defaultTime: '1:00 PM',  label: '🥗 Lunch' },
								{ mealType: 'dinner',    defaultMin: 17 * 60, defaultTime: '5:00 PM',  label: '🍽 Dinner' }
							] as slot}
								{#each tripDays as date, colIdx}
									{@const key = `${date}|${slot.mealType}`}
									{@const topPx = HEADER_HEIGHT + ((slot.defaultMin - HOUR_START * 60) / 60) * SLOT_HEIGHT}
									{#if !existingMealKeys.has(key)}
										<button
											class="meal-placeholder"
											style="
												top:{topPx}px;
												left:calc({TIME_COL_WIDTH}px + {colIdx} * ((100% - {TIME_COL_WIDTH}px) / {tripDays.length}) + 4px);
												width:calc((100% - {TIME_COL_WIDTH}px) / {tripDays.length} - 8px);
											"
											onclick={() => openAddMeal(date, slot.mealType, slot.defaultTime)}
											title="Add {slot.mealType}"
										>
											<span class="placeholder-label">{slot.label} not set</span>
										</button>
									{/if}
								{/each}
							{/each}
						{/if}

						<!-- Events layer -->
						<div class="schedule-events-layer">
							{#each tripDays as date, colIdx}
								{@const dayEvents = positionedByDate[date] ?? []}
								{#each dayEvents as { ev, col, totalCols, topPx, heightPx }}
								{@const isMeal = ev.type === 'meal'}
								{@const evId = (ev.activityId ?? ev.slotId) as string}
								{@const style = evStyle(ev)}
								{@const isDragging = dragState?.eventId === evId}
								{@const gCount = goingCount(ev)}
								{@const isNotGoing = isMeal
									? ev.currentUserOptedOut === true
									: ev.currentUserRsvp === 'skip'}

								<!-- Event card -->
								<div
									class="event-block"
									class:is-dragging={isDragging}
									class:not-going={isNotGoing}
										style="
											top:{topPx}px;
											height:{heightPx}px;
											left:calc({colIdx} * (100% / {tripDays.length}) + {(col / totalCols) * 100}% / {tripDays.length} + 4px);
											width:calc((100% / {tripDays.length}) / {totalCols} - 8px);
										background:{style.bg};
										"
										onpointerdown={(e) => onEventPointerDown(e, ev, topPx, date)}
										onclick={(e) => {
											// Only open drawer on click (not after a drag)
											if (!isDragging) openDrawer({ ...ev, date });
										}}
										ondragover={(e) => { e.preventDefault(); dragOverTarget = evId; }}
										ondragleave={() => { dragOverTarget = null; }}
										ondrop={isMeal
											? (e) => { dragOverTarget = null; handleDropMeal(e, ev.slotId as string); }
											: (e) => { dragOverTarget = null; handleDropActivity(e, ev.activityId as string); }}
										role="button"
										tabindex="0"
										onkeydown={(e) => e.key === 'Enter' && openDrawer({ ...ev, date })}
										title={isMeal ? `${ev.mealType}` : (ev.title as string)}
									>
										<!-- Title -->
										<span class="evt-title" style="color:{style.titleColor}">
											{isMeal
												? (ev.mealType as string).charAt(0).toUpperCase() + (ev.mealType as string).slice(1) + (ev.title ? ` – ${ev.title}` : '')
												: ev.title}
										</span>

										<!-- Time -->
										{#if ev.time}
											<span class="evt-time" style="color:{style.subColor}">{formatMinutes(parseTimeToMinutes(ev.time as string))}</span>
										{/if}

									<!-- Meal: assigned cook (pinned bottom-right) -->
									{#if isMeal && (ev.assignedUser as { name: string } | null)}
										<span class="evt-chef" style="color:{style.subColor}">
											🍳 {(ev.assignedUser as { name: string }).name}
										</span>
									{/if}

									<!-- Activity: going count indicator -->
									{#if !isMeal && gCount > 0}
										<span class="evt-rsvp-pill" style="color:{style.subColor}">✓{gCount}</span>
									{/if}

										<!-- Drag hint for host -->
										{#if data.isHost}
											<div class="drag-handle" title="Drag to move"></div>
										{/if}

										<!-- Hidden forms for person-drop assignment -->
										<form id="assign-meal-{ev.slotId}" method="POST" action="?/assignMealMaker" use:enhance={handleScheduleResult()} class="form-hidden">
											<input type="hidden" name="slotId" value={ev.slotId} />
											<input type="hidden" name="assignedUserId" value="" />
										</form>
										<form id="add-participant-{ev.activityId}" method="POST" action="?/addActivityParticipant" use:enhance={handleScheduleResult()} class="form-hidden">
											<input type="hidden" name="activityId" value={ev.activityId} />
											<input type="hidden" name="userId" value="" />
										</form>
									</div>
								{/each}
							{/each}
						</div>
					</div>
				</div>

					<!-- Footer -->
				<div class="schedule-footer">
					<button
						class="footer-btn"
						class:footer-btn-active={filterType === 'meal'}
						onclick={() => (filterType = filterType === 'meal' ? 'all' : 'meal')}
					>
						<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v21M3 9h18M3 15h18"/></svg>
						Meals
					</button>
					<button
						class="footer-btn"
						class:footer-btn-active={filterType === 'activity'}
						onclick={() => (filterType = filterType === 'activity' ? 'all' : 'activity')}
					>
						<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/></svg>
						Activities
					</button>
				</div>
			</div>
		</div>
	{/if}
</div>

<!-- Add Custom Activity Modal -->
{#if showAddActivity}
	<div
		class="modal-backdrop"
		role="presentation"
		onclick={(e) => e.target === e.currentTarget && closeAddActivity()}
	>
		<div class="modal-box" role="dialog" aria-modal="true" aria-label="{editActivityId ? 'Edit' : 'Add'} activity">
			<div class="modal-header">
				<h2 class="modal-title">{editActivityId ? 'Edit Activity' : 'Add Custom Activity'}</h2>
				<button class="modal-close" onclick={closeAddActivity} aria-label="Close">✕</button>
			</div>

			<form
				method="POST"
				action={editActivityId ? '?/updateActivity' : '?/createActivity'}
				use:enhance={() => {
					addActivitySubmitting = true;
					return async ({ result, update }) => {
						await update();
						addActivitySubmitting = false;
						if (result.type === 'success') closeAddActivity();
					};
				}}
				class="modal-form"
			>
				{#if editActivityId}
					<input type="hidden" name="activityId" value={editActivityId} />
				{/if}

				<label class="modal-label">Activity name <span class="req">*</span></label>
				<input class="modal-input" type="text" name="title" required placeholder="e.g. Morning hike"
					value={editActivityId ? editActivityTitle : ''} />

				<label class="modal-label">Day <span class="req">*</span></label>
				<select class="modal-select" name="date" required>
					{#each tripDays as day}
						<option value={day} selected={editActivityId ? day === editActivityDate : false}>
							{new Date(day + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
						</option>
					{/each}
				</select>

				<label class="modal-label">Time <span class="req">*</span></label>
				<select class="modal-select" name="time" required>
					{#each TIME_OPTIONS as t}
						<option value={t} selected={editActivityId ? t === editActivityTime : t === '9:00 AM'}>{t}</option>
					{/each}
				</select>

				<label class="modal-label">Location <span class="modal-optional">(optional)</span></label>
				<input class="modal-input" type="text" name="location" placeholder="e.g. Trailhead parking lot"
					value={editActivityId ? editActivityLocation : ''} />

				<label class="modal-label">Notes <span class="modal-optional">(optional)</span></label>
				<textarea class="modal-textarea" name="notes" rows="2" placeholder="Any details…"
					>{editActivityId ? editActivityNotes : ''}</textarea>

				<div class="modal-actions">
					<button type="button" class="modal-btn-cancel" onclick={closeAddActivity}>Cancel</button>
					<button type="submit" class="modal-btn-submit" disabled={addActivitySubmitting}>
						{addActivitySubmitting
							? (editActivityId ? 'Saving…' : 'Adding…')
							: (editActivityId ? 'Save changes' : 'Add to itinerary')}
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}

<!-- Add / Edit Meal Modal -->
{#if mealPlanOn || addMealPrefill?.slotId}
	<AddMealModal
		open={showAddMeal}
		members={mealModalMembers}
		tripDays={mealModalDays}
		prefill={addMealPrefill}
		formAction={addMealPrefill?.slotId ? '?/updateMealSlot' : '?/createMealSlot'}
		onClose={closeAddMeal}
		onSuccess={async () => { await invalidateAll(); }}
	/>
{/if}

<!-- Event Details Drawer -->
{#if drawerEvent}
	<EventDetailsDrawer
		event={drawerEvent}
		currentUserId={data.user.id}
		isHost={data.isHost}
		tripId={data.trip.id}
		onClose={() => (drawerEvent = null)}
		onLocalRsvpUpdate={handleLocalRsvpUpdate}
		onEdit={handleEditEvent}
	/>
{/if}

<style>
	/* ── Page shell ── */
	.itinerary-page {
		padding: 3rem 0 2rem;
	}

	.empty-state {
		text-align: center;
		padding: 3rem 1.5rem;
		background: white;
		border-radius: 16px;
		color: var(--muted);
	}

	/* ── Main card ── */
	.schedule-card {
		display: flex;
		gap: 0;
		background: white;
		border-radius: 20px;
		box-shadow: 0 4px 32px rgba(17,24,39,.07), 0 1px 6px rgba(17,24,39,.04);
		overflow: hidden;
		min-height: 680px;
	}

	/* ── Sidebar ── */
	.schedule-sidebar {
		flex-shrink: 0;
		width: 220px;
		background: #fff;
		border-right: 1px solid #f0f2f5;
		padding: 1.5rem 1.25rem;
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}
	.mini-calendar { background: #f8fafc; border-radius: 14px; padding: 1rem; }
	.mini-cal-header {
		display: flex; align-items: center; justify-content: space-between; margin-bottom: .75rem;
	}
	.mini-cal-month { font-size: .875rem; font-weight: 700; color: #1e293b; }
	.mini-cal-nav { display: flex; gap: .25rem; }
	.mini-cal-arrow {
		width: 22px; height: 22px; display: flex; align-items: center; justify-content: center;
		border-radius: 6px; font-size: 1rem; color: #64748b; cursor: pointer;
		background: none; border: none; padding: 0; line-height: 1;
		transition: background .12s, opacity .12s;
	}
	.mini-cal-arrow:hover:not(:disabled) { background: #e2e8f0; }
	.mini-cal-arrow:disabled { opacity: .25; cursor: default; }
	.mini-cal-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 1px; font-size: .7rem; }
	.cal-dow { text-align: center; color: #94a3b8; font-weight: 600; padding-bottom: .35rem; }
	.cal-day {
		aspect-ratio: 1; display: flex; align-items: center; justify-content: center;
		border-radius: 6px; color: #374151; font-size: .7rem;
	}
	.cal-day.empty { visibility: hidden; }
	.cal-day.trip-day { background: rgba(47,119,120,.12); color: var(--slate); font-weight: 600; }
	.cal-day.today   {
		color: #E85D26; font-weight: 700;
		position: relative;
	}
	.cal-day.today::after {
		content: '';
		position: absolute;
		bottom: 1px;
		left: 50%;
		transform: translateX(-50%);
		width: 4px; height: 4px;
		border-radius: 50%;
		background: #E85D26;
	}

	.sidebar-section { display: flex; flex-direction: column; gap: .5rem; }
	.sidebar-section-header {
		display: flex; align-items: center; justify-content: space-between;
	}
	.sidebar-section-title {
		font-size: .75rem; font-weight: 700; text-transform: uppercase;
		letter-spacing: .05em; color: #94a3b8;
	}
	.sidebar-empty { font-size: .8rem; color: #94a3b8; margin: 0; }


	.legend-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: .3rem; }
	.legend-item { display: flex; align-items: center; gap: .5rem; font-size: .8rem; color: #475569; }
	.legend-dot { width: 10px; height: 10px; border-radius: 3px; flex-shrink: 0; }

	/* ── Main area ── */
	.schedule-main {
		flex: 1; min-width: 0; display: flex; flex-direction: column; padding: 1.5rem 1.5rem 0;
	}
	.schedule-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		margin-bottom: 1.25rem;
	}
	.schedule-header-left { display: flex; flex-direction: column; align-items: flex-start; gap: .35rem; justify-content: center; }
	.schedule-date-range {
		font-family: 'Fraunces', Georgia, serif;
		font-size: clamp(1.125rem, 2vw, 1.5rem); font-weight: 700; color: var(--text);
		letter-spacing: -.02em; margin: 0;
	}
	.schedule-header-right { display: flex; align-items: center; gap: .75rem; justify-content: flex-end; }
	/* ── Add Activity button ── */
	.btn-add-activity {
		padding: .42rem 1rem;
		background: var(--warm);
		color: white;
		border: none;
		border-radius: 9px;
		font-size: .8rem;
		font-weight: 700;
		cursor: pointer;
		white-space: nowrap;
		transition: background .12s;
	}
	.btn-add-activity:hover { background: #cf4f1f; }


	/* ── Grid wrapper ── */
	.schedule-grid-wrapper {
		flex: 1; overflow-x: auto; overflow-y: auto;
		max-height: calc(100vh - 320px);
		border-radius: 12px; border: 1px solid #f0f2f5; background: white;
		position: relative;
		touch-action: pan-y; /* allow vertical scroll, intercept horizontal for drag */
	}
	.schedule-scroll-inner { position: relative; display: inline-block; min-width: 100%; }

	/* Background grid */
	.schedule-grid {
		display: grid;
		grid-template-columns: var(--time-w) repeat(var(--day-cols, 7), minmax(110px, 1fr));
		min-width: max-content;
	}
	.grid-corner {
		background: #f8fafc; border-right: 1px solid #f0f2f5; border-bottom: 1px solid #f0f2f5;
		position: sticky; top: 0; z-index: 3;
		height: var(--hdr-h);
	}
	.grid-day-header {
		padding: .625rem .5rem; text-align: center; background: #f8fafc;
		border-bottom: 1px solid #f0f2f5; border-right: 1px solid #f0f2f5;
		display: flex; flex-direction: column; align-items: center; gap: .2rem;
		position: sticky; top: 0; z-index: 2; height: var(--hdr-h); box-sizing: border-box;
	}
	.day-num { font-size: 1.25rem; font-weight: 800; color: #1e293b; line-height: 1; }
	.day-num.today-num { color: #E85D26; }
	.day-name { font-size: .65rem; font-weight: 600; letter-spacing: .06em; color: #94a3b8; text-transform: uppercase; }
	.grid-day-header.today .day-name { color: #E85D26; }
	.grid-time-label {
		padding: 0 .75rem; font-size: .68rem; font-weight: 500; color: #94a3b8;
		display: flex; align-items: flex-start; padding-top: 6px;
		background: #f8fafc; border-right: 1px solid #f0f2f5; border-bottom: 1px solid #f0f2f5;
		height: var(--slot-h); box-sizing: border-box;
		position: sticky; left: 0; z-index: 1;
	}
	.grid-cell { border-right: 1px solid #f0f2f5; border-bottom: 1px solid #f0f2f5; height: var(--slot-h); box-sizing: border-box; }

	/* ── "Now" line ── */
	.now-line {
		position: absolute; height: 2px; background: #f97316; z-index: 5; pointer-events: none;
		display: flex; align-items: center;
	}
	.now-dot {
		width: 9px; height: 9px; border-radius: 50%; background: #f97316;
		position: absolute; left: -4px; top: 50%; transform: translateY(-50%);
	}

	/* ── Drag ghost ── */
	.drag-ghost {
		position: absolute; border-radius: 10px; z-index: 10; pointer-events: none;
		background: rgba(249,115,22,.15); border: 2px dashed #f97316;
		display: flex; align-items: flex-start; padding: .4rem .6rem;
	}
	.ghost-time { font-size: .75rem; font-weight: 700; color: #ea580c; }

	/* ── Events layer ── */
	.schedule-events-layer {
		position: absolute;
		top: var(--hdr-h);
		left: var(--time-w);
		right: 0;
		bottom: 0;
		pointer-events: none;
	}
	.schedule-events-layer > * { pointer-events: auto; }

	/* ── Event blocks ── */
	.event-block {
		position: absolute;
		border-radius: 10px;
		padding: .45rem .6rem;
		display: flex; flex-direction: column; gap: .1rem;
		overflow: hidden;
		cursor: pointer;
		transition: box-shadow .1s, transform .1s;
		box-sizing: border-box;
		user-select: none;
	}
	.event-block:hover { box-shadow: 0 4px 16px rgba(0,0,0,.13); transform: translateY(-1px); }
	.event-block:focus-visible { outline: 2px solid #f97316; outline-offset: 2px; }
	.event-block.is-dragging { opacity: .35; box-shadow: none; transform: none; }

	.evt-title {
		font-weight: 700; font-size: .78rem; line-height: 1.2;
		white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
	}
	.evt-time { font-size: .68rem; font-weight: 500; opacity: .85; }
	.evt-sub  { font-size: .68rem; opacity: .8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
	.evt-chef {
		position: absolute; bottom: .3rem; right: .45rem;
		font-size: .62rem; opacity: .8; white-space: nowrap;
		max-width: 60%; overflow: hidden; text-overflow: ellipsis;
	}
	.evt-rsvp-pill {
		font-size: .65rem; font-weight: 700; opacity: .9; white-space: nowrap;
		display: flex; gap: .25rem; align-items: center;
	}
	/* ── Not going (skipping / opted out) ── */
	.event-block.not-going {
		background: #f1f5f9 !important;
		opacity: .75;
	}
	.event-block.not-going .evt-title {
		color: #94a3b8 !important;
		font-style: italic;
	}
	.event-block.not-going .evt-time,
	.event-block.not-going .evt-sub,
	.event-block.not-going .evt-chef,
	.event-block.not-going .evt-rsvp-pill {
		color: #94a3b8 !important;
	}

	/* Drag handle (subtle dots in top-right, host only) */
	.drag-handle {
		position: absolute; top: 6px; right: 6px;
		width: 8px; height: 12px;
		background-image: radial-gradient(circle, rgba(0,0,0,.25) 1px, transparent 1px);
		background-size: 4px 4px; background-position: 0 0, 4px 4px;
		opacity: 0; transition: opacity .15s;
		cursor: grab; pointer-events: none;
	}
	.event-block:hover .drag-handle { opacity: 1; }

	.form-hidden { position: absolute; opacity: 0; pointer-events: none; }

	/* ── Footer ── */
	.schedule-footer {
		padding: .875rem 0;
		border-top: 1px solid #f0f2f5;
		display: flex;
		align-items: center;
		gap: .5rem;
		justify-content: flex-end;
		margin-top: .5rem;
	}
	.footer-btn {
		display: inline-flex; align-items: center; gap: .375rem;
		padding: .5rem 1rem; border-radius: 10px; border: 1.5px solid #e2e8f0;
		font-size: .8125rem; font-weight: 600; color: #374151;
		background: white; cursor: pointer; transition: background .15s, border-color .15s, color .15s;
	}
	.footer-btn:hover { background: #f8fafc; border-color: #cbd5e1; }
	.footer-btn.footer-btn-active {
		background: var(--slate); border-color: var(--slate); color: white;
	}
	.footer-btn.footer-btn-active:hover { background: var(--primaryHover); border-color: var(--primaryHover); }

	/* ── Hide-skipping toggle ── */
	.skip-toggle {
		display: flex; align-items: center; gap: .45rem;
		cursor: pointer; user-select: none;
	}
	.skip-toggle-track {
		position: relative;
		display: inline-block;
		width: 32px; height: 18px;
		border-radius: 9px;
		background: #cbd5e1;
		transition: background .2s;
		flex-shrink: 0;
	}
	.skip-toggle-track.on { background: #E85D26; }
	.skip-toggle-track input {
		position: absolute; opacity: 0; width: 0; height: 0;
	}
	.skip-toggle-thumb {
		position: absolute;
		top: 2px; left: 2px;
		width: 14px; height: 14px;
		border-radius: 50%;
		background: white;
		box-shadow: 0 1px 3px rgba(0,0,0,.2);
		transition: transform .2s;
	}
	.skip-toggle-track.on .skip-toggle-thumb { transform: translateX(14px); }
	.skip-toggle-label { font-size: .75rem; font-weight: 500; color: #64748b; white-space: nowrap; }

	/* ── Add Custom Activity Modal ── */
	.modal-backdrop {
		position: fixed; inset: 0;
		background: rgba(0,0,0,.45);
		display: flex; align-items: center; justify-content: center;
		z-index: 1100;
	}
	.modal-box {
		background: white;
		border-radius: 16px;
		width: min(480px, calc(100vw - 2rem));
		padding: 1.5rem;
		box-shadow: 0 20px 60px rgba(0,0,0,.18);
		display: flex; flex-direction: column; gap: 1rem;
	}
	.modal-header { display: flex; justify-content: space-between; align-items: center; }
	.modal-title { font-family: 'Fraunces', Georgia, serif; font-size: 1.1rem; font-weight: 700; color: var(--text); margin: 0; }
	.modal-close {
		background: none; border: none; cursor: pointer;
		color: #94a3b8; font-size: 1.1rem; line-height: 1;
		padding: .2rem .4rem; border-radius: 6px;
	}
	.modal-close:hover { background: #f1f5f9; color: #1e293b; }
	.modal-form { display: flex; flex-direction: column; gap: .65rem; }
	.modal-label { font-size: .8rem; font-weight: 600; color: #374151; }
	.req { color: #E85D26; }
	.modal-optional { font-weight: 400; color: #94a3b8; }
	.modal-input, .modal-select, .modal-textarea {
		width: 100%; box-sizing: border-box;
		padding: .55rem .75rem;
		border: 1.5px solid #e2e8f0;
		border-radius: 9px;
		font-size: .875rem; color: #1e293b;
		outline: none; transition: border-color .15s;
		font-family: inherit;
		background: white;
	}
	.modal-input:focus, .modal-select:focus, .modal-textarea:focus {
		border-color: #E85D26;
	}
	.modal-textarea { resize: vertical; }
	.modal-actions { display: flex; justify-content: flex-end; gap: .6rem; margin-top: .25rem; }
	.modal-btn-cancel {
		padding: .5rem 1.1rem;
		border: 1.5px solid #e2e8f0; border-radius: 9px;
		background: white; color: #64748b;
		font-size: .85rem; font-weight: 600; cursor: pointer;
	}
	.modal-btn-cancel:hover { background: #f8fafc; }
	.modal-btn-submit {
		padding: .5rem 1.25rem;
		background: #E85D26; color: white;
		border: none; border-radius: 9px;
		font-size: .85rem; font-weight: 700; cursor: pointer;
		transition: background .12s;
	}
	.modal-btn-submit:hover:not(:disabled) { background: #cf4f1f; }
	.modal-btn-submit:disabled { opacity: .6; cursor: not-allowed; }

	/* ── Meal placeholders ── */
	.meal-placeholder {
		position: absolute;
		height: 52px;
		border: 1.5px dashed #9ca3af;
		border-radius: 8px;
		background: rgba(0,0,0,.02);
		display: flex; align-items: center; justify-content: center;
		cursor: pointer;
		transition: background .12s, border-color .12s;
		z-index: 1;
	}
	.meal-placeholder:hover {
		background: rgba(232,93,38,.06);
		border-color: #E85D26;
	}
	.placeholder-label {
		font-size: .75rem; font-weight: 500;
		color: #9ca3af;
		pointer-events: none;
	}
	.meal-placeholder:hover .placeholder-label { color: #E85D26; }

</style>
