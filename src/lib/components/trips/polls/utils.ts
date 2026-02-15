import type { PollStatusDisplay } from './types.js';

const HOUR_MS = 60 * 60 * 1000;

/** Derive display status: closing_soon when < 12h remaining for open polls */
export function getStatusDisplay(status: string, endAt: Date | string | null): PollStatusDisplay {
	if (status === 'draft' || status === 'canceled') return status as PollStatusDisplay;
	if (status === 'closed') return 'closed';
	if (status === 'open' && endAt) {
		const remaining = new Date(endAt).getTime() - Date.now();
		if (remaining > 0 && remaining < 12 * HOUR_MS) return 'closing_soon';
	}
	return status === 'open' ? 'open' : (status as PollStatusDisplay);
}

/** Humanized time: "Ends in 2d" or "Closed 3d ago" */
export function getTimeLabel(status: string, endAt: Date | string | null): string {
	const now = Date.now();
	const end = endAt ? new Date(endAt).getTime() : 0;

	if (status === 'draft') return 'Draft';
	if (status === 'canceled') return 'Canceled';

	if (status === 'open' && end > 0) {
		const remaining = end - now;
		if (remaining <= 0) return 'Ending soon';
		const d = Math.floor(remaining / (24 * HOUR_MS));
		const h = Math.floor((remaining % (24 * HOUR_MS)) / HOUR_MS);
		if (d > 0) return `Ends in ${d}d`;
		if (h > 0) return `Ends in ${h}h`;
		return 'Ends in <1h';
	}

	if (status === 'closed' && end > 0) {
		const ago = now - end;
		const d = Math.floor(ago / (24 * HOUR_MS));
		const m = Math.floor(d / 30);
		if (m > 0) return `Closed ${m}mo ago`;
		if (d > 0) return `Closed ${d}d ago`;
		const h = Math.floor(ago / HOUR_MS);
		if (h > 0) return `Closed ${h}h ago`;
		return 'Closed just now';
	}

	return status === 'open' ? 'No end date' : 'Closed';
}
