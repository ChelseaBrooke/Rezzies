import { escapeHtml } from '../html-escape.js';
import { renderEmailLayout } from './shared-layout.js';

function formatMoney(cents: number): string {
	return new Intl.NumberFormat('en-US', {
		style: 'currency',
		currency: 'USD',
		minimumFractionDigits: 0,
		maximumFractionDigits: 0
	}).format(cents / 100);
}

export type CostShareReapprovalEmailData = {
	guestName: string;
	tripName: string;
	tripUrl: string;
	originalLowCents: number;
	originalHighCents: number;
	newShareCents: number;
	reason: string;
	deadlineFormatted: string;
	reminder: boolean;
};

export function renderCostShareReapprovalGuestHtml(d: CostShareReapprovalEmailData): string {
	const guestName = escapeHtml(d.guestName);
	const tripName = escapeHtml(d.tripName);
	const reason = escapeHtml(d.reason);
	const range = `${formatMoney(d.originalLowCents)} – ${formatMoney(d.originalHighCents)}`;
	const newShare = formatMoney(d.newShareCents);
	const reminderLine = d.reminder
		? '<p class="lead lead--tight"><strong>This is a reminder — your deadline is tomorrow.</strong></p>'
		: '';

	const body = `
		<p class="lead">Hi ${guestName},</p>
		${reminderLine}
		<p class="lead">You agreed to pay between <strong>${escapeHtml(range)}</strong>.</p>
		<p class="lead">Your current share is <strong>${escapeHtml(newShare)}</strong>.</p>
		<p class="lead lead--tight">${reason}</p>
		<p class="lead">Please review by <strong>${escapeHtml(d.deadlineFormatted)}</strong>.</p>
	`;

	return renderEmailLayout({
		preheader: `Your cost share for "${d.tripName}" has increased.`,
		kicker: 'Action needed',
		heading: 'Your cost share has increased',
		subheading: tripName,
		body,
		ctaUrl: d.tripUrl,
		ctaLabel: 'Review and confirm →',
		footerNote: `You're receiving this because you're a guest on "${d.tripName}" on Divvi.`
	});
}

export type GuestApprovedCostShareHostEmailData = {
	hostName: string;
	guestName: string;
	tripName: string;
	tripGuestsUrl: string;
	amountFormatted: string;
};

export function renderGuestApprovedCostShareHostHtml(d: GuestApprovedCostShareHostEmailData): string {
	const hostName = escapeHtml(d.hostName);
	const guestName = escapeHtml(d.guestName);
	const tripName = escapeHtml(d.tripName);
	const body = `
		<p class="lead">Hi ${hostName},</p>
		<p class="lead"><strong>${guestName}</strong> approved their updated cost share of <strong>${escapeHtml(d.amountFormatted)}</strong> for <strong>${tripName}</strong>.</p>
	`;

	return renderEmailLayout({
		preheader: `${d.guestName} confirmed their updated share for "${d.tripName}".`,
		kicker: 'Guest update',
		heading: 'Cost share confirmed',
		subheading: tripName,
		body,
		ctaUrl: d.tripGuestsUrl,
		ctaLabel: 'View guests',
		footerNote: `You're receiving this because you host "${d.tripName}" on Divvi.`
	});
}
