/** Get current day key YYYY-MM-DD in trip timezone (client-safe). */
export function getDayKeyClient(tripTimezone: string, date: Date = new Date()): string {
	return new Intl.DateTimeFormat('en-CA', {
		timeZone: tripTimezone,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit'
	}).format(date);
}

/** Get milliseconds until midnight in trip timezone for the given dayKey (client-safe). */
export function getMsUntilMidnight(tripTimezone: string, dayKey: string): number {
	const currentDayKey = getDayKeyClient(tripTimezone);
	if (currentDayKey > dayKey) return 0;
	const now = new Date();
	const parts = new Intl.DateTimeFormat('en-CA', {
		timeZone: tripTimezone,
		hour: 'numeric',
		minute: 'numeric',
		second: 'numeric',
		hour12: false
	}).formatToParts(now);
	const hour = parseInt(parts.find((p) => p.type === 'hour')?.value ?? '0', 10);
	const minute = parseInt(parts.find((p) => p.type === 'minute')?.value ?? '0', 10);
	const second = parseInt(parts.find((p) => p.type === 'second')?.value ?? '0', 10);
	const secondsUntilMidnight = 24 * 3600 - (hour * 3600 + minute * 60 + second);
	return Math.max(0, secondsUntilMidnight * 1000);
}

export function formatCountdown(ms: number): string {
	const totalSeconds = Math.floor(ms / 1000);
	const hours = Math.floor(totalSeconds / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const seconds = totalSeconds % 60;
	if (hours > 0) {
		return `${hours}h ${minutes}m ${seconds}s`;
	}
	if (minutes > 0) {
		return `${minutes}m ${seconds}s`;
	}
	return `${seconds}s`;
}
