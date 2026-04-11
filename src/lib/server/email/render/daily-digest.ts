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
							`<tr><td style="font-family:'Plus Jakarta Sans',Helvetica,Arial,sans-serif;font-size:15px;padding:8px 0;border-bottom:1px solid rgba(47,119,120,0.10);color:#374151;">
								• ${escapeHtml(e)}
							</td></tr>`
					)
					.join('')
			: `<tr><td style="font-family:'Plus Jakarta Sans',Helvetica,Arial,sans-serif;font-size:15px;padding:8px 0;color:#6b7280;">
					No events scheduled for today — enjoy some free time.
				</td></tr>`;

	const body = `
		<p class="lead">Hi ${recipientName}, here's what's on for today on <strong>${tripName}</strong>.</p>
		<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 24px;">
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
