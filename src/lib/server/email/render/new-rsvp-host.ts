import { escapeHtml } from '../html-escape.js';
import { renderEmailLayout, metaTable, metaRow } from './shared-layout.js';

export type NewRsvpHostEmailData = {
	hostName: string;
	guestName: string;
	tripName: string;
	yesCount: number;
	maxCapacity: number | null;
	tripUrl: string;
};

export function renderNewRsvpHostHtml(d: NewRsvpHostEmailData): string {
	const hostName = escapeHtml(d.hostName);
	const guestName = escapeHtml(d.guestName);
	const tripName = escapeHtml(d.tripName);
	const spotsLine =
		d.maxCapacity != null ? `${d.yesCount} / ${d.maxCapacity} spots filled` : `${d.yesCount} going`;

	const rows = [
		metaRow('Guest', guestName),
		metaRow('Trip', tripName),
		metaRow('Status', spotsLine)
	];

	const body = `
		<p class="lead">Hi ${hostName}, a new RSVP just came in for <strong>${tripName}</strong>.</p>
		${metaTable(rows.join(''))}
	`;

	return renderEmailLayout({
		preheader: `${d.guestName} is in, ${spotsLine}.`,
		kicker: 'New RSVP',
		heading: `${guestName} is in`,
		subheading: spotsLine,
		body,
		ctaUrl: d.tripUrl,
		ctaLabel: 'View guests',
		footerNote: `You're receiving this as the host of "${d.tripName}" on Divvi.`
	});
}
