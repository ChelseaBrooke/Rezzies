import { dev } from '$app/environment';
import { json, error } from '@sveltejs/kit';
import { appendFile, access } from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import type { RequestHandler } from './$types';

// Dev-only: append page performance metrics to a CSV at the project root so
// they can be aggregated later (e.g. with DuckDB, Excel, pandas). Disabled in
// production builds — the endpoint 404s.
//
// Tidy/long format: one row per metric. `metric` is one of the wall-clock
// timings from PerfBadge (total, server) or a web-vitals metric (LCP, FCP,
// TTFB, CLS, INP). Note: for CLS the value is unitless; everything else is ms.
const LOG_FILE = path.join(process.cwd(), 'perf-log.csv');
const HEADER = 'timestamp,path,kind,metric,value,rating\n';

function csvField(value: string | number | null): string {
	if (value == null) return '';
	const str = String(value);
	// Quote and escape so commas/quotes in paths can't corrupt the columns.
	return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

// Web-vitals metrics often fire within the same millisecond, so their POSTs
// arrive concurrently. Serialize all appends through a single promise chain so
// the "does the file exist? -> maybe write header -> append" sequence is atomic
// and the header is never written more than once.
let writeChain: Promise<void> = Promise.resolve();

function enqueueRow(row: string): Promise<void> {
	writeChain = writeChain
		.then(async () => {
			let needsHeader = false;
			try {
				await access(LOG_FILE, constants.F_OK);
			} catch {
				needsHeader = true;
			}
			await appendFile(LOG_FILE, (needsHeader ? HEADER : '') + row, 'utf8');
		})
		.catch((err) => {
			// Keep the chain alive for subsequent writes even if one fails.
			console.error('[perf log]', err);
		});
	return writeChain;
}

export const POST: RequestHandler = async ({ request }) => {
	if (!dev) throw error(404);

	const { path: pagePath, kind, metric, value, rating } = await request.json();

	const row =
		[
			csvField(new Date().toISOString()),
			csvField(pagePath ?? ''),
			csvField(kind ?? ''),
			csvField(metric ?? ''),
			csvField(typeof value === 'number' ? value.toFixed(2) : null),
			csvField(rating ?? '')
		].join(',') + '\n';

	await enqueueRow(row);

	return json({ ok: true });
};
