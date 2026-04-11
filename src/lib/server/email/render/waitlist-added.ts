import { escapeHtml } from '../html-escape.js';
import { renderEmailLayout, calloutBox } from './shared-layout.js';

export type WaitlistAddedEmailData = {
	guestName: string;
	tripName: string;
	waitlistPosition: number;
};

/**
 * Email sent when a guest is added to a waitlist because the trip reached capacity.
 */
export function renderWaitlistAddedHtml(d: WaitlistAddedEmailData): string {
	const guestName = escapeHtml(d.guestName);
	const tripName = escapeHtml(d.tripName);

	const body = `
		<p class="lead">Hi ${guestName},</p>
		<p class="lead">
			Great news — you're still in the running for <strong>${tripName}</strong>!
			The trip is currently full, so we've placed you on the waitlist.
			If a spot opens up, we'll notify you right away.
		</p>
	`;

	const callout = calloutBox(
		'Your waitlist position',
		`#${d.waitlistPosition}`
	);

	return renderEmailLayout({
		preheader: `You're #${d.waitlistPosition} on the waitlist for "${d.tripName}".`,
		kicker: 'Waitlist',
		heading: "You're on the waitlist",
		subheading: tripName,
		body,
		callout,
		finePrint: 'Spots are offered on a first-come, first-served basis. When a spot opens you\'ll receive a new email — keep an eye on your inbox.',
		footerNote: `You received this because you were invited to "${d.tripName}" on Divvi.`
	});
}
