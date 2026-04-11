import { escapeHtml } from '../html-escape.js';
import { renderEmailLayout } from './shared-layout.js';

export type TripCanceledEmailData = {
	recipientName: string;
	tripName: string;
};

export function renderTripCanceledHtml(d: TripCanceledEmailData): string {
	const recipientName = escapeHtml(d.recipientName);
	const tripName = escapeHtml(d.tripName);

	const body = `
		<p class="lead">Hi ${recipientName}, <strong>${tripName}</strong> has been canceled by the host.</p>
		<p class="lead" style="margin-bottom:0">If you have any questions, please reach out to the host directly.</p>
	`;

	return renderEmailLayout({
		preheader: `"${d.tripName}" has been canceled.`,
		kicker: 'Trip canceled',
		heading: 'This trip was canceled',
		subheading: tripName,
		body,
		footerNote: `You're receiving this because you were on "${d.tripName}" on Divvi.`
	});
}
