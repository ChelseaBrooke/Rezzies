import { escapeHtml } from '../html-escape.js';
import { renderEmailLayout } from './shared-layout.js';

export type WelcomeCoHostEmailData = {
	coHostName: string;
	hostName: string;
	tripName: string;
	tripUrl: string;
};

export function renderWelcomeCoHostHtml(d: WelcomeCoHostEmailData): string {
	const coHostName = escapeHtml(d.coHostName);
	const hostName = escapeHtml(d.hostName);
	const tripName = escapeHtml(d.tripName);

	const body = `
		<p class="lead">Hi ${coHostName}, <strong>${hostName}</strong> has added you as a co-host of <strong>${tripName}</strong>.</p>
		<p class="lead" style="margin-bottom:0">As co-host you can manage guests, assign rooms, and help run the trip dashboard.</p>
	`;

	return renderEmailLayout({
		preheader: `${d.hostName} made you co-host of "${d.tripName}".`,
		kicker: "You're a co-host",
		heading: 'Welcome as co-host',
		subheading: tripName,
		body,
		ctaUrl: d.tripUrl,
		ctaLabel: 'Manage trip',
		footerNote: `You're receiving this because ${d.hostName} added you as co-host on Divvi.`
	});
}
