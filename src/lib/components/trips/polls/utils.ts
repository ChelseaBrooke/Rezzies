import type { PollStatusDisplay } from './types.js';

const HOUR_MS = 60 * 60 * 1000;

/** DB may still say `open` until cron/mutation closes the row; past `endAt` is treated as ended for UI. */
export function effectivePollStatus(status: string, endAt: Date | string | null | undefined): string {
	if (status === 'open' && endAt) {
		const end = new Date(endAt).getTime();
		if (!isNaN(end) && end <= Date.now()) return 'closed';
	}
	return status;
}

/** Derive display status: closing_soon when < 12h remaining for open polls */
export function getStatusDisplay(status: string, endAt: Date | string | null): PollStatusDisplay {
	const s = effectivePollStatus(status, endAt);
	if (s === 'draft' || s === 'canceled') return s as PollStatusDisplay;
	if (s === 'closed') return 'closed';
	if (s === 'open' && endAt) {
		const remaining = new Date(endAt).getTime() - Date.now();
		if (remaining > 0 && remaining < 12 * HOUR_MS) return 'closing_soon';
	}
	return s === 'open' ? 'open' : (s as PollStatusDisplay);
}

/** Humanized time: "Ends in 2d" or "Closed 3d ago" */
export function getTimeLabel(status: string, endAt: Date | string | null): string {
	const s = effectivePollStatus(status, endAt);
	const now = Date.now();
	const end = endAt ? new Date(endAt).getTime() : 0;

	if (s === 'draft') return 'Draft';
	if (s === 'canceled') return 'Canceled';

	if (s === 'open' && end > 0) {
		const remaining = end - now;
		if (remaining <= 0) return 'Ending soon';
		const d = Math.floor(remaining / (24 * HOUR_MS));
		const h = Math.floor((remaining % (24 * HOUR_MS)) / HOUR_MS);
		if (d > 0) return `Ends in ${d}d`;
		if (h > 0) return `Ends in ${h}h`;
		return 'Ends in <1h';
	}

	if (s === 'closed' && end > 0) {
		const ago = now - end;
		const d = Math.floor(ago / (24 * HOUR_MS));
		const m = Math.floor(d / 30);
		if (m > 0) return `Closed ${m}mo ago`;
		if (d > 0) return `Closed ${d}d ago`;
		const h = Math.floor(ago / HOUR_MS);
		if (h > 0) return `Closed ${h}h ago`;
		return 'Closed just now';
	}

	return s === 'open' ? 'No end date' : 'Closed';
}
