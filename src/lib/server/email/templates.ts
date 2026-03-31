/** Logged with each `emailLog` row — not external template IDs (emails are rendered in-app). */
export const TEMPLATE_KEYS = {
	GUEST_CONFIRMATION: 'GUEST_CONFIRMATION',
	TRIP_INVITE: 'TRIP_INVITE'
} as const;

export type EmailTemplateKey = (typeof TEMPLATE_KEYS)[keyof typeof TEMPLATE_KEYS];
