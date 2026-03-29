/**
 * Pure overlap-layout engine for the Divvi week-view calendar.
 * No framework dependencies – can be unit-tested in isolation.
 */

export interface LayoutEvent {
	id: string;
	startMin: number; // minutes from midnight  (e.g. 09:30 → 570)
	endMin: number;   // minutes from midnight
}

export interface PositionedEvent extends LayoutEvent {
	col: number;       // 0-based column index within its overlap group
	totalCols: number; // total columns in the overlap group
}

/**
 * Given an array of events for a single day, assign each event a (col, totalCols)
 * so events that overlap in time render side-by-side instead of on top of each other.
 *
 * Algorithm:
 *  1. Sort by start time (ties: longer event first).
 *  2. Walk through sorted events, grouping transitively-overlapping events.
 *  3. Within each group, max concurrent depth (sweep line) seeds column count; grow if needed.
 *  4. Greedily assign each event to the first column whose last-end ≤ event.startMin.
 */
export function computeOverlapLayout(events: LayoutEvent[]): PositionedEvent[] {
	if (!events.length) return [];

	const sorted = [...events].sort((a, b) =>
		a.startMin !== b.startMin ? a.startMin - b.startMin : b.endMin - a.endMin
	);

	// Build clash groups (maximal sets of transitively-overlapping events)
	const groups: LayoutEvent[][] = [];
	let cur: LayoutEvent[] = [];
	let maxEnd = -Infinity;

	for (const ev of sorted) {
		if (!cur.length || ev.startMin < maxEnd) {
			cur.push(ev);
			maxEnd = Math.max(maxEnd, ev.endMin);
		} else {
			groups.push([...cur]);
			cur = [ev];
			maxEnd = ev.endMin;
		}
	}
	if (cur.length) groups.push(cur);

	const result: PositionedEvent[] = [];

	for (const group of groups) {
		// colEnds[c] = endMin of the last event assigned to column c
		const colEnds: number[] = new Array(Math.max(1, maxSimultaneous(group))).fill(-Infinity);
		const ordered = [...group].sort((a, b) => a.startMin - b.startMin);
		const pending: PositionedEvent[] = [];

		for (const ev of ordered) {
			let col = colEnds.findIndex((e) => e <= ev.startMin);
			if (col === -1) {
				colEnds.push(-Infinity);
				col = colEnds.length - 1;
			}
			colEnds[col] = ev.endMin;
			pending.push({ ...ev, col, totalCols: 1 });
		}
		const finalCols = Math.max(1, colEnds.length);
		for (const p of pending) {
			result.push({ ...p, totalCols: finalCols });
		}
	}

	return result;
}

/**
 * True max concurrent depth (interval sweep). Ends at minute t are processed before
 * starts at t so back-to-back events do not count as overlapping.
 */
function maxSimultaneous(group: LayoutEvent[]): number {
	if (group.length <= 1) return Math.max(1, group.length);
	const pts: { t: number; d: number }[] = [];
	for (const ev of group) {
		pts.push({ t: ev.startMin, d: 1 }, { t: ev.endMin, d: -1 });
	}
	pts.sort((a, b) => a.t - b.t || a.d - b.d);
	let depth = 0;
	let maxD = 0;
	for (const p of pts) {
		depth += p.d;
		maxD = Math.max(maxD, depth);
	}
	return Math.max(1, maxD);
}

// ---------------------------------------------------------------------------
// Time helpers
// ---------------------------------------------------------------------------

const MEAL_DEFAULTS: Record<string, number> = {
	breakfast: 8 * 60,
	lunch: 12 * 60,
	dinner: 18 * 60,
	snack: 10 * 60
};

/**
 * Convert a time value (24-hr string "HH:MM", 12-hr string "H:MM AM/PM", or Date)
 * into minutes since midnight. Returns a mealType-based fallback if time is null.
 */
export function parseTimeToMinutes(
	time: string | Date | null | undefined,
	mealTypeFallback?: string
): number {
	if (!time) return MEAL_DEFAULTS[mealTypeFallback ?? ''] ?? 12 * 60;

	if (time instanceof Date) return time.getHours() * 60 + time.getMinutes();

	const s = String(time).trim();

	// 24-hr "HH:MM" or "H:MM"
	const m24 = /^(\d{1,2}):(\d{2})$/.exec(s);
	if (m24) return +m24[1] * 60 + +m24[2];

	// 12-hr "H:MM AM/PM"
	const m12 = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(s);
	if (m12) {
		let h = +m12[1];
		const min = +m12[2];
		if (/PM/i.test(m12[3]) && h !== 12) h += 12;
		if (/AM/i.test(m12[3]) && h === 12) h = 0;
		return h * 60 + min;
	}

	return 12 * 60; // final fallback: noon
}

/** Format minutes-since-midnight to a user-friendly "H:MM AM/PM" string. */
export function formatMinutes(totalMin: number): string {
	const clamped = Math.max(0, Math.min(totalMin, 23 * 60 + 59));
	const h24 = Math.floor(clamped / 60);
	const min = clamped % 60;
	const ap = h24 < 12 ? 'AM' : 'PM';
	const h12 = h24 === 0 ? 12 : h24 > 12 ? h24 - 12 : h24;
	return `${h12}:${String(min).padStart(2, '0')} ${ap}`;
}

/** Snap minutes to nearest N-minute grid (default 15). */
export function snapToGrid(minutes: number, snap = 15): number {
	return Math.round(minutes / snap) * snap;
}

/** Clamp a value between min and max. */
export function clamp(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, value));
}
