import { escapeHtml } from '../html-escape.js';
import { renderEmailLayout } from './shared-layout.js';

export type GuestJoinedEmailData = {
	guestName: string;
	tripName: string;
	tripUrl: string;
};

export function renderGuestJoinedHtml(d: GuestJoinedEmailData): string {
	const guestName = escapeHtml(d.guestName);
	const tripName = escapeHtml(d.tripName);

	const body = `
		<p class="lead">Hi ${guestName}, you've joined <strong>${tripName}</strong>.</p>
		<p class="lead" style="margin-bottom:0">Next step: RSVP and choose your bed so the host can finalize plans.</p>
	`;

	return renderEmailLayout({
		preheader: `You've joined "${d.tripName}" on Divvi. Next: RSVP and choose your bed.`,
		kicker: "You're in",
		heading: "You've joined the trip",
		subheading: tripName,
		body,
		ctaUrl: d.tripUrl,
		ctaLabel: 'Complete RSVP',
		footerNote: `You're receiving this because you joined "${d.tripName}" on Divvi.`
	});
}
