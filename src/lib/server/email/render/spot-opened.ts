import { escapeHtml } from '../html-escape.js';
import { renderEmailLayout, calloutBox } from './shared-layout.js';

export type SpotOpenedEmailData = {
	guestName: string;
	tripName: string;
	spotsAvailable: number;
};

/**
 * Email sent to ALL waitlisted guests when spots open on a trip.
 * It's first come, first served, whoever RSVPs yes first gets in.
 */
export function renderSpotOpenedHtml(d: SpotOpenedEmailData): string {
	const guestName = escapeHtml(d.guestName);
	const tripName = escapeHtml(d.tripName);
	const count = d.spotsAvailable;
	const spotWord = count === 1 ? 'spot' : 'spots';

	const body = `
		<p class="lead">Hi ${guestName},</p>
		<p class="lead">
			Good news, ${count === 1 ? 'a spot has' : `${count} spots have`} just opened up on
			<strong>${tripName}</strong>. This is first come, first served, so head over and
			RSVP yes now if you want in.
		</p>
	`;

	const callout = calloutBox(
		`Open ${spotWord} right now`,
		String(count),
		'First come, first served'
	);

	return renderEmailLayout({
		preheader: `${count} ${spotWord} opened on "${d.tripName}", RSVP now before they fill.`,
		kicker: 'Waitlist update',
		heading: count === 1 ? 'A spot just opened!' : `${count} spots just opened!`,
		subheading: tripName,
		body,
		callout,
		ctaUrl: undefined,
		ctaLabel: undefined,
		finePrint: `Log in to your Divvi dashboard, find <strong>${tripName}</strong>, and submit your RSVP. If the ${spotWord} ${count === 1 ? 'fills' : 'fill'} before you do, you'll stay on the waitlist and we'll notify you again if another opens.`,
		footerNote: `You received this because you were on the waitlist for "${d.tripName}" on Divvi.`
	});
}
