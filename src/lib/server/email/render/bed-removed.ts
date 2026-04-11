import { escapeHtml } from '../html-escape.js';
import { renderEmailLayout } from './shared-layout.js';

export type BedRemovedEmailData = {
	guestName: string;
	tripName: string;
	tripUrl: string;
};

export function renderBedRemovedHtml(d: BedRemovedEmailData): string {
	const guestName = escapeHtml(d.guestName);
	const tripName = escapeHtml(d.tripName);

	const body = `
		<p class="lead">Hi ${guestName}, a bed you had claimed on <strong>${tripName}</strong> has been removed by the host.</p>
		<p class="lead" style="margin-bottom:0">Please log in and choose a new bed for your stay.</p>
	`;

	return renderEmailLayout({
		preheader: `Action needed — a bed on "${d.tripName}" was removed. Please choose a new one.`,
		kicker: 'Action needed',
		heading: 'Your bed was removed',
		subheading: tripName,
		body,
		ctaUrl: d.tripUrl,
		ctaLabel: 'Choose a new bed',
		footerNote: `You're receiving this because you're a guest on "${d.tripName}" on Divvi.`
	});
}
