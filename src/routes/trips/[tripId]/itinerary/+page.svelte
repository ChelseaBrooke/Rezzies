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

	let { data }: { data: PageData } = $props();

	// ── Grid constants ─────────────────────────────────────────────────────
	const HOUR_START = 6;
	const HOUR_END = 23;
	const SLOT_HEIGHT = 60; // px per hour
	const HEADER_HEIGHT = 58; // day-header row px
	const TIME_COL_WIDTH = 64; // left time gutter px
	const DEFAULT_DURATION_MEAL = 60; // minutes
	const DEFAULT_DURATION_ACTIVITY = 90; // minutes
	const MIN_DURATION = 30;

	// ── Server data refs ───────────────────────────────────────────────────
	const tripDays = $derived(data.tripDays ?? []);
	const goingUsers = $derived(data.goingUsers ?? []);

	// ── Mini-calendar derived state ────────────────────────────────────────
	const todayKey = $derived(new Date().toISOString().slice(0, 10));
	const calendarMonth = $derived.by(() => {
		if (!tripDays.length) return { year: new Date().getFullYear(), month: new Date().getMonth() };
		const d = new Date(tripDays[0] + 'T12:00:00');
		return { year: d.getFullYear(), month: d.getMonth() };
	});
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
		Array.from({ length: HOUR_END - HOUR_START }, (_, i) => {
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
		participants?: { id: string; name: string; rsvpStatus: 'going' | 'maybe' | 'skip' }[];
		currentUserRsvp?: 'going' | 'maybe' | 'skip';
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
			const calEvents = raw.filter((e) => e.type === 'meal' || e.type === 'activity');

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
			pricePerPerson: ev.pricePerPerson as number | undefined,
			totalCostToSplit: ev.totalCostToSplit as number | null | undefined,
			assignedUser: ev.assignedUser as { id: string; name: string } | null | undefined,
			participants: ev.participants as DrawerEvent['participants'],
			currentUserRsvp: ev.currentUserRsvp as 'going' | 'maybe' | 'skip' | undefined,
			attendance: ev.attendance as DrawerEvent['attendance'],
			currentUserOptedOut: ev.currentUserOptedOut as boolean | undefined
		};
		// Attach the resolved date from the current rendering
		if (!drawerEvent.date) drawerEvent.date = '';
	}

	function handleLocalRsvpUpdate(eventId: string, status: 'going' | 'maybe' | 'skip' | 'meal-in' | 'meal-out') {
		if (!drawerEvent || drawerEvent.id !== eventId) return;

		if (drawerEvent.type === 'activity') {
			const rsvp = status as 'going' | 'maybe' | 'skip';
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
		'meal-breakfast': {
			bg: 'rgba(249,115,22,.10)', border: '#f97316',
			titleColor: '#9a3412', subColor: '#c2410c'
		},
		'meal-lunch': {
			bg: 'rgba(245,158,11,.10)', border: '#d97706',
			titleColor: '#78350f', subColor: '#92400e'
		},
		'meal-dinner': {
			bg: 'rgba(41,76,96,.10)', border: '#294C60',
			titleColor: '#001B2E', subColor: '#294C60'
		},
		'meal-snack': {
			bg: 'rgba(253,186,116,.20)', border: '#fb923c',
			titleColor: '#9a3412', subColor: '#c2410c'
		},
		activity: {
			bg: 'rgba(0,27,46,.07)', border: '#001B2E',
			titleColor: '#001B2E', subColor: '#294C60'
		}
	};
	function evStyle(ev: Record<string, unknown>): EventType {
		if (ev.type === 'meal') return EVENT_STYLES[`meal-${ev.mealType}`] ?? EVENT_STYLES['meal-dinner'];
		return EVENT_STYLES.activity;
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
	function maybeCount(ev: Record<string, unknown>): number {
		const p = ev.participants as { rsvpStatus: string }[] | undefined;
		return p?.filter((x) => x.rsvpStatus === 'maybe').length ?? 0;
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
						<div class="mini-cal-nav" aria-hidden="true">
							<span class="mini-cal-arrow">‹</span>
							<span class="mini-cal-arrow">›</span>
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

				<!-- Attending -->
				<div class="sidebar-section">
					<div class="sidebar-section-header">
						<span class="sidebar-section-title">Attending</span>
					</div>
					{#if goingUsers.length === 0}
						<p class="sidebar-empty">No RSVPs yet</p>
					{:else}
						<ul class="going-list">
							{#each goingUsers as person (person.id)}
								<li
									class="going-chip"
									draggable="true"
									ondragstart={(e) => handlePersonDragStart(e, { type: 'person', id: person.id!, name: person.name })}
									title="Drag to assign to event"
								>
									<span class="going-avatar">{person.name.charAt(0).toUpperCase()}</span>
									<span class="going-name">{person.name}</span>
								</li>
							{/each}
						</ul>
					{/if}
				</div>

				<!-- Legend -->
				<div class="sidebar-section">
					<div class="sidebar-section-header">
						<span class="sidebar-section-title">Key</span>
					</div>
					<ul class="legend-list">
						<li class="legend-item"><span class="legend-dot" style="background:#f97316"></span>Breakfast</li>
						<li class="legend-item"><span class="legend-dot" style="background:#d97706"></span>Lunch</li>
						<li class="legend-item"><span class="legend-dot" style="background:#294C60"></span>Dinner</li>
						<li class="legend-item"><span class="legend-dot" style="background:#001B2E"></span>Activity</li>
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
					</div>
					<div class="schedule-header-right">
						<span class="view-badge">Week</span>
						<a href="/trips/{data.trip.id}/meals" class="btn-add">+ Add meal</a>
						<a href="/trips/{data.trip.id}/activities" class="btn-add">+ Add activity</a>
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
									{@const mCount = maybeCount(ev)}

									<!-- Event card -->
									<div
										class="event-block"
										class:is-dragging={isDragging}
										style="
											top:{topPx}px;
											height:{heightPx}px;
											left:calc({colIdx} * (100% / {tripDays.length}) + {(col / totalCols) * 100}% / {tripDays.length} + 4px);
											width:calc((100% / {tripDays.length}) / {totalCols} - 8px);
											background:{style.bg};
											border-left:3px solid {style.border};
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
											<span class="evt-time" style="color:{style.subColor}">{ev.time}</span>
										{/if}

										<!-- Meal: assigned cook -->
										{#if isMeal && (ev.assignedUser as { name: string } | null)}
											<span class="evt-sub" style="color:{style.subColor}">
												🍳 {(ev.assignedUser as { name: string }).name}
											</span>
										{/if}

										<!-- Activity: going/maybe indicators -->
										{#if !isMeal && (gCount > 0 || mCount > 0)}
											<span class="evt-rsvp-pill" style="color:{style.subColor}">
												{#if gCount > 0}✓{gCount}{/if}
												{#if mCount > 0}<span class="maybe-pill"> ?{mCount}</span>{/if}
											</span>
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
					<div class="footer-left">
						<div class="footer-avatars">
							{#each goingUsers.slice(0, 5) as person (person.id)}
								<span class="footer-avatar" title={person.name}>{initial(person.name)}</span>
							{/each}
							{#if goingUsers.length > 5}
								<span class="footer-avatar footer-avatar-more">+{goingUsers.length - 5}</span>
							{/if}
						</div>
						{#if goingUsers.length > 0}
							<a href="/trips/{data.trip.id}/guests" class="footer-view-all">View All Guests</a>
						{/if}
					</div>
					<div class="footer-right">
						<a href="/trips/{data.trip.id}/meals" class="footer-btn">
							<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v21M3 9h18M3 15h18"/></svg>
							Meals
						</a>
						<a href="/trips/{data.trip.id}/activities" class="footer-btn">
							<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/></svg>
							Activities
						</a>
					</div>
				</div>
			</div>
		</div>
	{/if}
</div>

<!-- Event Details Drawer -->
{#if drawerEvent}
	<EventDetailsDrawer
		event={drawerEvent}
		currentUserId={data.user.id}
		isHost={data.isHost}
		tripId={data.trip.id}
		onClose={() => (drawerEvent = null)}
		onLocalRsvpUpdate={handleLocalRsvpUpdate}
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
	}
	.mini-cal-arrow:hover { background: #e2e8f0; }
	.mini-cal-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 1px; font-size: .7rem; }
	.cal-dow { text-align: center; color: #94a3b8; font-weight: 600; padding-bottom: .35rem; }
	.cal-day {
		aspect-ratio: 1; display: flex; align-items: center; justify-content: center;
		border-radius: 6px; color: #374151; font-size: .7rem;
	}
	.cal-day.empty { visibility: hidden; }
	.cal-day.trip-day { background: rgba(41,76,96,.12); color: #294C60; font-weight: 600; }
	.cal-day.today   { background: #001B2E; color: white; font-weight: 700; }

	.sidebar-section { display: flex; flex-direction: column; gap: .5rem; }
	.sidebar-section-header {
		display: flex; align-items: center; justify-content: space-between;
	}
	.sidebar-section-title {
		font-size: .75rem; font-weight: 700; text-transform: uppercase;
		letter-spacing: .05em; color: #94a3b8;
	}
	.sidebar-empty { font-size: .8rem; color: #94a3b8; margin: 0; }

	.going-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: .375rem; }
	.going-chip {
		display: flex; align-items: center; gap: .5rem; padding: .375rem .6rem;
		background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;
		cursor: grab; transition: box-shadow .15s;
	}
	.going-chip:hover { background: #f1f5f9; box-shadow: 0 2px 8px rgba(0,0,0,.07); }
	.going-avatar {
		width: 24px; height: 24px; border-radius: 50%;
		background: linear-gradient(135deg, #294C60, #001B2E);
		color: white; font-size: .65rem; font-weight: 700;
		display: flex; align-items: center; justify-content: center; flex-shrink: 0;
	}
	.going-name { font-size: .8125rem; color: #374151; font-weight: 500; }

	.legend-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: .3rem; }
	.legend-item { display: flex; align-items: center; gap: .5rem; font-size: .8rem; color: #475569; }
	.legend-dot { width: 10px; height: 10px; border-radius: 3px; flex-shrink: 0; }

	/* ── Main area ── */
	.schedule-main {
		flex: 1; min-width: 0; display: flex; flex-direction: column; padding: 1.5rem 1.5rem 0;
	}
	.schedule-header {
		display: flex; align-items: center; justify-content: space-between;
		gap: 1rem; margin-bottom: 1.25rem; flex-wrap: wrap;
	}
	.schedule-header-left { display: flex; align-items: center; gap: .75rem; }
	.schedule-date-range {
		font-size: clamp(1.125rem, 2vw, 1.5rem); font-weight: 800; color: #1e293b;
		letter-spacing: -.02em; margin: 0;
	}
	.schedule-header-right { display: flex; align-items: center; gap: .5rem; flex-wrap: wrap; }
	.view-badge {
		padding: .35rem .875rem; background: #f1f5f9; border-radius: 8px;
		font-size: .8125rem; font-weight: 600; color: #475569;
	}
	.btn-add {
		padding: .5rem 1rem; background: #f97316; color: white; border-radius: 10px;
		font-size: .8125rem; font-weight: 600; text-decoration: none;
		display: inline-flex; align-items: center; gap: .25rem;
		transition: background .15s, transform .1s; white-space: nowrap;
	}
	.btn-add:hover { background: #ea580c; transform: translateY(-1px); }

	/* ── Grid wrapper ── */
	.schedule-grid-wrapper {
		flex: 1; overflow-x: auto; overflow-y: auto;
		max-height: calc(100vh - 260px);
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
	.day-num.today-num {
		width: 34px; height: 34px; border-radius: 50%;
		background: #001B2E; color: white;
		display: flex; align-items: center; justify-content: center;
	}
	.day-name { font-size: .65rem; font-weight: 600; letter-spacing: .06em; color: #94a3b8; text-transform: uppercase; }
	.grid-day-header.today .day-name { color: #f97316; }
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
	.evt-rsvp-pill {
		font-size: .65rem; font-weight: 700; opacity: .9; white-space: nowrap;
		display: flex; gap: .25rem; align-items: center;
	}
	.maybe-pill { opacity: .7; }

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
		padding: .875rem 0; border-top: 1px solid #f0f2f5;
		display: flex; align-items: center; justify-content: space-between; margin-top: .5rem;
	}
	.footer-left { display: flex; align-items: center; gap: .75rem; }
	.footer-avatars { display: flex; align-items: center; }
	.footer-avatar {
		width: 34px; height: 34px; border-radius: 50%;
		background: linear-gradient(135deg, #294C60, #001B2E);
		color: white; font-size: .75rem; font-weight: 700;
		display: flex; align-items: center; justify-content: center;
		border: 2.5px solid white; margin-left: -8px;
	}
	.footer-avatar:first-child { margin-left: 0; }
	.footer-avatar-more { background: #e2e8f0; color: #64748b; font-size: .7rem; }
	.footer-view-all {
		font-size: .8125rem; font-weight: 600; color: #294C60; text-decoration: none; margin-left: .5rem;
	}
	.footer-view-all:hover { text-decoration: underline; }
	.footer-right { display: flex; align-items: center; gap: .5rem; }
	.footer-btn {
		display: inline-flex; align-items: center; gap: .375rem;
		padding: .5rem 1rem; border-radius: 10px; border: 1.5px solid #e2e8f0;
		font-size: .8125rem; font-weight: 600; color: #374151;
		text-decoration: none; background: white; transition: background .15s, border-color .15s;
	}
	.footer-btn:hover { background: #f8fafc; border-color: #cbd5e1; }
</style>
