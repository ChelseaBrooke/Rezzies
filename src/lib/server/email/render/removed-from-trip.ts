import { escapeHtml } from '../html-escape.js';
import { renderEmailLayout } from './shared-layout.js';

export type RemovedFromTripEmailData = {
	guestName: string;
	tripName: string;
};

export function renderRemovedFromTripHtml(d: RemovedFromTripEmailData): string {
	const guestName = escapeHtml(d.guestName);
	const tripName = escapeHtml(d.tripName);

	const body = `
		<p class="lead">Hi ${guestName}, you no longer have access to <strong>${tripName}</strong>.</p>
		<p class="lead lead--tight">If you think this was a mistake, please contact the trip host directly.</p>
	`;

	return renderEmailLayout({
		preheader: `You've been removed from "${d.tripName}".`,
		kicker: 'Trip update',
		heading: 'Removed from trip',
		subheading: tripName,
		body,
		footerNote: `You're receiving this because you were a guest on "${d.tripName}" on Divvi.`
	});
}
