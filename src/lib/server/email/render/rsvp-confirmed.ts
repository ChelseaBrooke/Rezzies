import { escapeHtml } from '../html-escape.js';
import { renderEmailLayout, metaTable, metaRow } from './shared-layout.js';

export type RsvpConfirmedEmailData = {
	guestName: string;
	tripName: string;
	/** Optional bed/room selection summary (e.g. "Queen bed · Master Bedroom") */
	bedSummary?: string;
	/** Adults + kids count */
	partySize?: number;
	tripUrl: string;
};

export function renderRsvpConfirmedHtml(d: RsvpConfirmedEmailData): string {
	const guestName = escapeHtml(d.guestName);
	const tripName = escapeHtml(d.tripName);

	const rows = [metaRow('Trip', tripName)];
	if (d.partySize) rows.push(metaRow('Guests', String(d.partySize)));
	if (d.bedSummary) rows.push(metaRow('Bed', escapeHtml(d.bedSummary)));

	const body = `
		<p class="lead">Hi ${guestName}, you're confirmed, can't wait to see you there.</p>
		${metaTable(rows.join(''))}
	`;

	return renderEmailLayout({
		preheader: `You're going to "${d.tripName}", your RSVP is confirmed.`,
		kicker: 'RSVP confirmed',
		heading: "You're going",
		subheading: escapeHtml(tripName),
		body,
		ctaUrl: d.tripUrl,
		ctaLabel: 'View trip',
		footerNote: `You're receiving this because you RSVP'd to "${d.tripName}" on Divvi.`
	});
}
