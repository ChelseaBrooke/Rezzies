import { escapeHtml } from '../html-escape.js';
import { renderEmailLayout } from './shared-layout.js';

export type DayOfTripEmailData = {
	recipientName: string;
	tripName: string;
	tripUrl: string;
};

export function renderDayOfTripHtml(d: DayOfTripEmailData): string {
	const recipientName = escapeHtml(d.recipientName);
	const tripName = escapeHtml(d.tripName);

	const body = `
		<p class="lead">Hi ${recipientName}, today's the day — <strong>${tripName}</strong> starts now.</p>
		<p class="lead lead--tight">Everything you need is in your trip dashboard. Have an amazing trip.</p>
	`;

	return renderEmailLayout({
		preheader: `Today's the day — "${d.tripName}" starts now. Open your trip dashboard.`,
		kicker: "It's trip day",
		heading: "Today's the day",
		subheading: tripName,
		body,
		ctaUrl: d.tripUrl,
		ctaLabel: 'Open trip',
		footerNote: `You're receiving this because you're on "${d.tripName}" on Divvi.`
	});
}
