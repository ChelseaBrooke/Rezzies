import { escapeHtml } from '../html-escape.js';
import { renderEmailLayout } from './shared-layout.js';

export type InvitationReminderEmailData = {
	recipientName: string;
	tripName: string;
	hostName: string;
	tripUrl: string;
};

export function renderInvitationReminderHtml(d: InvitationReminderEmailData): string {
	const recipientName = escapeHtml(d.recipientName);
	const tripName = escapeHtml(d.tripName);
	const hostName = escapeHtml(d.hostName);

	const body = `
		<p class="lead">Hi ${recipientName}, you haven't responded to <strong>${tripName}</strong> yet.</p>
		<p class="lead lead--tight"><strong>${hostName}</strong> is waiting, spots may fill up soon.</p>
	`;

	return renderEmailLayout({
		preheader: `Reminder: you haven't responded to "${d.tripName}" yet. Spots may fill up.`,
		kicker: 'Reminder',
		heading: "Don't forget to respond",
		subheading: tripName,
		body,
		ctaUrl: d.tripUrl,
		ctaLabel: 'View trip',
		footerNote: `You're receiving this because you were invited to "${d.tripName}" on Divvi.`
	});
}
