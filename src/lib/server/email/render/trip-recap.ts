import { escapeHtml } from '../html-escape.js';
import { renderEmailLayout } from './shared-layout.js';

export type TripRecapEmailData = {
	recipientName: string;
	tripName: string;
	tripUrl: string;
};

export function renderTripRecapHtml(d: TripRecapEmailData): string {
	const recipientName = escapeHtml(d.recipientName);
	const tripName = escapeHtml(d.tripName);

	const body = `
		<p class="lead">Hi ${recipientName}, <strong>${tripName}</strong> has come to an end, hope it was a great one.</p>
		<p class="lead lead--tight">Head back to the trip to relive the highlights, share moments, or settle any outstanding payments.</p>
	`;

	return renderEmailLayout({
		preheader: `"${d.tripName}" has ended. Relive the memories.`,
		kicker: 'Trip recap',
		heading: "That's a wrap",
		subheading: tripName,
		body,
		ctaUrl: d.tripUrl,
		ctaLabel: 'View recap',
		footerNote: `You're receiving this because you were on "${d.tripName}" on Divvi.`
	});
}
