import { escapeHtml } from '../html-escape.js';
import { renderEmailLayout } from './shared-layout.js';

export type FeedbackRequestEmailData = {
	recipientName: string;
	tripName: string;
	/** Link to a feedback form or Divvi feedback page */
	feedbackUrl: string;
};

export function renderFeedbackRequestHtml(d: FeedbackRequestEmailData): string {
	const recipientName = escapeHtml(d.recipientName);
	const tripName = escapeHtml(d.tripName);

	const body = `
		<p class="lead">Hi ${recipientName}, we hope <strong>${tripName}</strong> was a memorable one.</p>
		<p class="lead lead--tight">We'd love to hear how it went — your feedback helps us make Divvi better for every trip.</p>
	`;

	return renderEmailLayout({
		preheader: `How was "${d.tripName}"? Share your feedback — it takes 2 minutes.`,
		kicker: 'How was your trip?',
		heading: 'Leave your feedback',
		subheading: tripName,
		body,
		ctaUrl: d.feedbackUrl,
		ctaLabel: 'Leave feedback',
		finePrint: 'Takes about 2 minutes. Your responses are anonymous.',
		footerNote: `You're receiving this because you were on "${d.tripName}" on Divvi.`
	});
}
