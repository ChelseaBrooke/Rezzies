import { escapeHtml } from '../html-escape.js';
import { renderEmailLayout, metaTable, metaRow } from './shared-layout.js';

export type GuestConfirmationEmailData = {
	guestName: string;
	roomName: string;
	bedType: string;
	checkInDate: string;
	checkOutDate: string;
	nights: number;
	totalPrice: string;
	confirmationUrl: string;
};

export function renderGuestConfirmationHtml(d: GuestConfirmationEmailData): string {
	const guestName = escapeHtml(d.guestName);

	const rows = [
		metaRow('Room', escapeHtml(d.roomName)),
		metaRow('Bed', escapeHtml(d.bedType)),
		metaRow('Check-in', escapeHtml(d.checkInDate)),
		metaRow('Check-out', escapeHtml(d.checkOutDate)),
		metaRow('Nights', String(d.nights)),
		metaRow('Total', `$${escapeHtml(d.totalPrice)}`)
	];

	const body = `
		<p class="lead">Hi ${guestName}, here's your stay summary.</p>
		${metaTable(rows.join(''))}
	`;

	return renderEmailLayout({
		preheader: `Booking confirmed, you're all set.`,
		kicker: 'Booking confirmed',
		heading: "You're booked",
		body,
		ctaUrl: d.confirmationUrl,
		ctaLabel: 'View confirmation',
		footerNote: 'Sent by Divvi'
	});
}
