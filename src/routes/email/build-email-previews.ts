/**
 * Sample HTML for /email preview. Only imported from the email preview route (server).
 */
import { renderBedRemovedHtml } from '$lib/server/email/render/bed-removed.js';
import { renderDailyDigestHtml } from '$lib/server/email/render/daily-digest.js';
import { renderDayOfTripHtml } from '$lib/server/email/render/day-of-trip.js';
import { renderFeedbackRequestHtml } from '$lib/server/email/render/feedback-request.js';
import { renderGuestConfirmationHtml } from '$lib/server/email/render/guest-confirmation.js';
import { renderGuestJoinedHtml } from '$lib/server/email/render/guest-joined.js';
import { renderInvitationReminderHtml } from '$lib/server/email/render/invitation-reminder.js';
import { renderNewRsvpHostHtml } from '$lib/server/email/render/new-rsvp-host.js';
import { renderRemovedFromTripHtml } from '$lib/server/email/render/removed-from-trip.js';
import { renderRsvpConfirmedHtml } from '$lib/server/email/render/rsvp-confirmed.js';
import { renderRsvpUpdatedHtml } from '$lib/server/email/render/rsvp-updated.js';
import { renderSpotOpenedHtml } from '$lib/server/email/render/spot-opened.js';
import { renderTripCanceledHtml } from '$lib/server/email/render/trip-canceled.js';
import { renderTripFillingUpHtml } from '$lib/server/email/render/trip-filling-up.js';
import { renderTripInviteHtml } from '$lib/server/email/render/trip-invite.js';
import { renderTripRecapHtml } from '$lib/server/email/render/trip-recap.js';
import { renderTripStartingSoonHtml } from '$lib/server/email/render/trip-starting-soon.js';
import { renderWaitlistAddedHtml } from '$lib/server/email/render/waitlist-added.js';
import { renderWelcomeCoHostHtml } from '$lib/server/email/render/welcome-co-host.js';
import { TEMPLATE_KEYS, type EmailTemplateKey } from '$lib/server/email/templates.js';

const TRIP = 'Lake House Weekend';
const TRIP_URL = 'https://preview.divvi.test/trips/demo-trip';
const INVITE_URL = 'https://preview.divvi.test/invite/sample-token';

export type EmailPreviewEntry = {
	/** URL fragment / anchor id */
	id: string;
	/** Human-readable name */
	label: string;
	/** Production-style subject line (sample data). */
	subject: string;
	templateKey: EmailTemplateKey;
	html: string;
};

export function buildEmailPreviews(): EmailPreviewEntry[] {
	return [
		{
			id: 'bed-removed',
			label: 'Bed removed',
			subject: `Action needed: your bed on "${TRIP}" was removed`,
			templateKey: TEMPLATE_KEYS.BED_REMOVED,
			html: renderBedRemovedHtml({
				guestName: 'Alex Rivera',
				tripName: TRIP,
				tripUrl: TRIP_URL
			})
		},
		{
			id: 'daily-digest',
			label: 'Daily digest',
			subject: `Today's plan: ${TRIP}`,
			templateKey: TEMPLATE_KEYS.DAILY_DIGEST,
			html: renderDailyDigestHtml({
				recipientName: 'Jordan',
				tripName: TRIP,
				dateLabel: 'Saturday, June 14',
				events: ['Morning hike · 9:00', 'Group dinner · 7:00'],
				tripUrl: TRIP_URL
			})
		},
		{
			id: 'daily-digest-empty',
			label: 'Daily digest (no events)',
			subject: `Today's plan: ${TRIP}`,
			templateKey: TEMPLATE_KEYS.DAILY_DIGEST,
			html: renderDailyDigestHtml({
				recipientName: 'Jordan',
				tripName: TRIP,
				dateLabel: 'Sunday, June 15',
				events: [],
				tripUrl: TRIP_URL
			})
		},
		{
			id: 'day-of-trip',
			label: 'Day of trip',
			subject: `Today's the day, "${TRIP}" starts now`,
			templateKey: TEMPLATE_KEYS.DAY_OF_TRIP,
			html: renderDayOfTripHtml({
				recipientName: 'Sam',
				tripName: TRIP,
				tripUrl: TRIP_URL
			})
		},
		{
			id: 'feedback-request',
			label: 'Feedback request',
			subject: `How was "${TRIP}"?`,
			templateKey: TEMPLATE_KEYS.FEEDBACK_REQUEST,
			html: renderFeedbackRequestHtml({
				recipientName: 'Sam',
				tripName: TRIP,
				feedbackUrl: 'https://preview.divvi.test/feedback/demo'
			})
		},
		{
			id: 'guest-confirmation',
			label: 'Guest confirmation',
			subject: "You're booked, Master Bedroom",
			templateKey: TEMPLATE_KEYS.GUEST_CONFIRMATION,
			html: renderGuestConfirmationHtml({
				guestName: 'Alex Rivera',
				roomName: 'Master Bedroom',
				bedType: 'king',
				checkInDate: 'Fri, Jun 13',
				checkOutDate: 'Mon, Jun 16',
				nights: 3,
				totalPrice: '1,245.00',
				confirmationUrl: 'https://preview.divvi.test/trips/demo-trip/confirm'
			})
		},
		{
			id: 'guest-joined',
			label: 'Guest joined',
			subject: `You've joined "${TRIP}"`,
			templateKey: TEMPLATE_KEYS.GUEST_JOINED,
			html: renderGuestJoinedHtml({
				guestName: 'Taylor Kim',
				tripName: TRIP,
				tripUrl: TRIP_URL
			})
		},
		{
			id: 'invitation-reminder',
			label: 'Invitation reminder',
			subject: `Reminder: you haven't responded to "${TRIP}" yet`,
			templateKey: TEMPLATE_KEYS.INVITATION_REMINDER,
			html: renderInvitationReminderHtml({
				recipientName: 'Alex',
				tripName: TRIP,
				hostName: 'Morgan Lee',
				tripUrl: TRIP_URL
			})
		},
		{
			id: 'new-rsvp-host',
			label: 'New RSVP (host)',
			subject: 'Taylor Kim just RSVP\'d to "Lake House Weekend"',
			templateKey: TEMPLATE_KEYS.NEW_RSVP_HOST,
			html: renderNewRsvpHostHtml({
				hostName: 'Morgan Lee',
				guestName: 'Taylor Kim',
				tripName: TRIP,
				yesCount: 7,
				maxCapacity: 10,
				tripUrl: TRIP_URL
			})
		},
		{
			id: 'removed-from-trip',
			label: 'Removed from trip',
			subject: `Update on "${TRIP}"`,
			templateKey: TEMPLATE_KEYS.REMOVED_FROM_TRIP,
			html: renderRemovedFromTripHtml({
				guestName: 'Alex Rivera',
				tripName: TRIP
			})
		},
		{
			id: 'rsvp-confirmed',
			label: 'RSVP confirmed',
			subject: `You're going to "${TRIP}"`,
			templateKey: TEMPLATE_KEYS.RSVP_CONFIRMED,
			html: renderRsvpConfirmedHtml({
				guestName: 'Alex Rivera',
				tripName: TRIP,
				bedSummary: 'Queen bed · Guest room',
				partySize: 2,
				tripUrl: TRIP_URL
			})
		},
		{
			id: 'rsvp-updated',
			label: 'RSVP updated',
			subject: `Your RSVP for "${TRIP}" was updated`,
			templateKey: TEMPLATE_KEYS.RSVP_UPDATED,
			html: renderRsvpUpdatedHtml({
				guestName: 'Alex Rivera',
				tripName: TRIP,
				tripUrl: TRIP_URL
			})
		},
		{
			id: 'spot-opened',
			label: 'Spot opened (waitlist)',
			subject: `2 spots opened on "${TRIP}", first come, first served`,
			templateKey: TEMPLATE_KEYS.SPOT_OPENED,
			html: renderSpotOpenedHtml({
				guestName: 'Jordan',
				tripName: TRIP,
				spotsAvailable: 2
			})
		},
		{
			id: 'trip-canceled',
			label: 'Trip canceled',
			subject: `"${TRIP}" was canceled`,
			templateKey: TEMPLATE_KEYS.TRIP_CANCELED,
			html: renderTripCanceledHtml({
				recipientName: 'Sam',
				tripName: TRIP
			})
		},
		{
			id: 'trip-filling-up',
			label: 'Trip filling up (host)',
			subject: `"${TRIP}" is 80% full`,
			templateKey: TEMPLATE_KEYS.TRIP_FILLING_UP_80,
			html: renderTripFillingUpHtml({
				hostName: 'Morgan Lee',
				tripName: TRIP,
				yesCount: 8,
				maxCapacity: 10,
				thresholdPercent: 80,
				tripUrl: TRIP_URL
			})
		},
		{
			id: 'trip-invite',
			label: 'Trip invite',
			subject: `Morgan Lee invited you to ${TRIP}`,
			templateKey: TEMPLATE_KEYS.TRIP_INVITE,
			html: renderTripInviteHtml({
				hostName: 'Morgan Lee',
				tripName: TRIP,
				checkIn: 'Fri, Jun 13',
				checkOut: 'Mon, Jun 16',
				inviteUrl: INVITE_URL,
				destination: 'Lake Tahoe, CA'
			})
		},
		{
			id: 'trip-recap',
			label: 'Trip recap',
			subject: `Your trip recap: "${TRIP}"`,
			templateKey: TEMPLATE_KEYS.TRIP_RECAP,
			html: renderTripRecapHtml({
				recipientName: 'Sam',
				tripName: TRIP,
				tripUrl: TRIP_URL
			})
		},
		{
			id: 'trip-starting-soon',
			label: 'Trip starting soon',
			subject: `"${TRIP}" starts in 3 days`,
			templateKey: TEMPLATE_KEYS.TRIP_STARTING_SOON,
			html: renderTripStartingSoonHtml({
				recipientName: 'Alex',
				tripName: TRIP,
				daysUntilTrip: 3,
				checkInDate: 'Fri, Jun 13',
				checkOutDate: 'Mon, Jun 16',
				tripUrl: TRIP_URL
			})
		},
		{
			id: 'waitlist-added',
			label: 'Waitlist added',
			subject: `You're on the waitlist for "${TRIP}"`,
			templateKey: TEMPLATE_KEYS.WAITLIST_ADDED,
			html: renderWaitlistAddedHtml({
				guestName: 'Jordan',
				tripName: TRIP,
				waitlistPosition: 3
			})
		},
		{
			id: 'welcome-co-host',
			label: 'Welcome co-host',
			subject: `You're a co-host of "${TRIP}"`,
			templateKey: TEMPLATE_KEYS.WELCOME_CO_HOST,
			html: renderWelcomeCoHostHtml({
				coHostName: 'Taylor Kim',
				hostName: 'Morgan Lee',
				tripName: TRIP,
				tripUrl: TRIP_URL
			})
		}
	];
}

export function getEmailPreviewById(id: string): EmailPreviewEntry | undefined {
	return buildEmailPreviews().find((p) => p.id === id);
}
