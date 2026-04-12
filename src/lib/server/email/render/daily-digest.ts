import { escapeHtml } from '../html-escape.js';
import { renderEmailLayout } from './shared-layout.js';

export type DailyDigestEmailData = {
	recipientName: string;
	tripName: string;
	/** Date string already formatted (e.g. "Saturday, April 12") */
	dateLabel: string;
	/** Brief activity names/descriptions. Max ~5 items shown well. */
	events: string[];
	tripUrl: string;
};

export function renderDailyDigestHtml(d: DailyDigestEmailData): string {
	const recipientName = escapeHtml(d.recipientName);
	const tripName = escapeHtml(d.tripName);
	const dateLabel = escapeHtml(d.dateLabel);

	const eventRows =
		d.events.length > 0
			? d.events
					.map(
						(e) =>
							`<tr><td>• ${escapeHtml(e)}</td></tr>`
					)
					.join('')
			: `<tr><td>No events scheduled for today — enjoy some free time.</td></tr>`;

	const digestClass = d.events.length > 0 ? 'digest' : 'digest digest--muted';
	const body = `
		<p class="lead">Hi ${recipientName}, here's what's on for today on <strong>${tripName}</strong>.</p>
		<table role="presentation" class="${digestClass}" width="100%" cellspacing="0" cellpadding="0" border="0">
			${eventRows}
		</table>
	`;

	return renderEmailLayout({
		preheader: `Today's plan for "${d.tripName}" — ${d.dateLabel}.`,
		kicker: "Today's plan",
		heading: dateLabel,
		subheading: tripName,
		body,
		ctaUrl: d.tripUrl,
		ctaLabel: 'View full itinerary',
		footerNote: `You're receiving this as a daily digest for "${d.tripName}" on Divvi.`
	});
}
