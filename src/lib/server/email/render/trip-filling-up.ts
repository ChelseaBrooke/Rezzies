import { escapeHtml } from '../html-escape.js';
import { renderEmailLayout, metaTable, metaRow } from './shared-layout.js';

export type TripFillingUpEmailData = {
	hostName: string;
	tripName: string;
	yesCount: number;
	maxCapacity: number;
	/** 50 | 75 | 90 */
	thresholdPercent: number;
	tripUrl: string;
};

export function renderTripFillingUpHtml(d: TripFillingUpEmailData): string {
	const hostName = escapeHtml(d.hostName);
	const tripName = escapeHtml(d.tripName);
	const spotsRemaining = d.maxCapacity - d.yesCount;

	const rows = [
		metaRow('Trip', tripName),
		metaRow('Spots filled', `${d.yesCount} of ${d.maxCapacity}`),
		metaRow('Spots remaining', String(spotsRemaining))
	];

	const body = `
		<p class="lead">Hi ${hostName}, <strong>${tripName}</strong> is ${d.thresholdPercent}% full, spots are going quickly.</p>
		${metaTable(rows.join(''))}
	`;

	return renderEmailLayout({
		preheader: `${d.yesCount} of ${d.maxCapacity} spots taken, "${d.tripName}" is filling up.`,
		kicker: 'Trip update',
		heading: `${tripName} is filling up`,
		subheading: `${d.yesCount} / ${d.maxCapacity} spots filled`,
		body,
		ctaUrl: d.tripUrl,
		ctaLabel: 'View trip',
		footerNote: `You're receiving this as the host of "${d.tripName}" on Divvi.`
	});
}
