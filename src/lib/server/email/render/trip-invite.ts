import { escapeHtml } from '../html-escape.js';
import { renderEmailLayout, metaTable, metaRow } from './shared-layout.js';

export type TripInviteEmailData = {
	hostName: string;
	tripName: string;
	checkIn: string;
	checkOut: string;
	inviteUrl: string;
	destination: string;
};

/**
 * Divvi trip invite — rendered through the shared coastal email layout.
 */
export function renderTripInviteHtml(d: TripInviteEmailData): string {
	const hostName = escapeHtml(d.hostName);
	const tripName = escapeHtml(d.tripName);
	const inviteUrl = escapeHtml(d.inviteUrl);
	const dest = d.destination?.trim();
	const destination = dest ? escapeHtml(dest) : '';

	const rows = [
		metaRow('Trip', tripName),
		metaRow('Dates', `${escapeHtml(d.checkIn)} – ${escapeHtml(d.checkOut)}`),
		...(destination ? [metaRow('Where', destination)] : [])
	];

	const body = `
		<p class="lead">
			<strong>${hostName}</strong> added you to this trip on Divvi.
			Accept your invite to see details, RSVP, split costs, and plan with the group.
		</p>
		${metaTable(rows.join(''))}
	`;

	const subheadParts = [
		`<strong style="color:#fff;">${tripName}</strong>`,
		...(destination ? [`<br /><span style="opacity:0.95;">${destination}</span>`] : [])
	];

	return renderEmailLayout({
		preheader: `${d.hostName} invited you to ${d.tripName}. Open your personal invite to join the trip.`,
		kicker: 'Trip invitation',
		heading: "You're invited",
		subheading: subheadParts.join(''),
		body,
		ctaUrl: d.inviteUrl,
		ctaLabel: 'View your invite',
		finePrint: `This link is personal to you. If you weren't expecting it, you can ignore this email.<br /><br /><span style="word-break:break-all;color:#2f7778;font-size:12px;">Button not working? Paste this into your browser:<br />${inviteUrl}</span>`,
		footerNote: `You're receiving this because someone invited you to a trip on Divvi.`
	});
}
