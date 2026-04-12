import { escapeHtml } from '../html-escape.js';
import { renderEmailLayout } from './shared-layout.js';

export type RsvpUpdatedEmailData = {
	guestName: string;
	tripName: string;
	tripUrl: string;
};

export function renderRsvpUpdatedHtml(d: RsvpUpdatedEmailData): string {
	const guestName = escapeHtml(d.guestName);
	const tripName = escapeHtml(d.tripName);

	const body = `
		<p class="lead">Hi ${guestName}, your RSVP for <strong>${tripName}</strong> has been updated.</p>
		<p class="lead lead--tight">If you didn't make this change, please contact your trip host.</p>
	`;

	return renderEmailLayout({
		preheader: `Your RSVP for "${d.tripName}" was updated.`,
		kicker: 'RSVP updated',
		heading: 'Your RSVP was updated',
		subheading: tripName,
		body,
		ctaUrl: d.tripUrl,
		ctaLabel: 'View details',
		footerNote: `You're receiving this because you're a guest on "${d.tripName}" on Divvi.`
	});
}
