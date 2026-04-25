import { escapeHtml } from '../html-escape.js';
import { renderEmailLayout, metaTable, metaRow } from './shared-layout.js';

export type TripStartingSoonEmailData = {
	recipientName: string;
	tripName: string;
	daysUntilTrip: number;
	checkInDate: string;
	checkOutDate: string;
	tripUrl: string;
};

export function renderTripStartingSoonHtml(d: TripStartingSoonEmailData): string {
	const recipientName = escapeHtml(d.recipientName);
	const tripName = escapeHtml(d.tripName);
	const daysLabel = d.daysUntilTrip === 1 ? '1 day' : `${d.daysUntilTrip} days`;

	const rows = [
		metaRow('Trip', tripName),
		metaRow('Check-in', escapeHtml(d.checkInDate)),
		metaRow('Check-out', escapeHtml(d.checkOutDate)),
		metaRow('Starts in', daysLabel)
	];

	const body = `
		<p class="lead">Hi ${recipientName}, <strong>${tripName}</strong> starts in ${daysLabel}.</p>
		<p class="lead">Check the itinerary and finalize any plans before you go.</p>
		${metaTable(rows.join(''))}
	`;

	return renderEmailLayout({
		preheader: `"${d.tripName}" starts in ${daysLabel}, check the itinerary.`,
		kicker: 'Coming up',
		heading: `${tripName} starts soon`,
		subheading: `${daysLabel} to go`,
		body,
		ctaUrl: d.tripUrl,
		ctaLabel: 'View trip',
		footerNote: `You're receiving this because you're on "${d.tripName}" on Divvi.`
	});
}
