/** Centralized brand tokens for all Divvi email templates. */

export const BRAND = {
	name: 'Divvi',
	tagline: 'Group trips, squared away',

	// Core palette — matches the web app
	primary: '#2f7778',
	primaryDark: '#1d4d4e',
	primaryMid: '#245a5b',
	accent: '#ce5612',
	sand: '#e3ceaa',
	sky: '#7aced3',

	// Surfaces
	wrapBg: '#eef5f5',
	cardBg: '#ffffff',
	cardShadow: 'rgba(29,77,78,0.12)',

	// Text
	textDark: '#111827',
	textBody: '#374151',
	textLight: '#6b7280',
	textMuted: '#9ca3af',

	// Borders
	borderLight: 'rgba(47,119,120,0.12)',

	// Callout box (used for waitlist position, spot counts, etc.)
	calloutBg: '#eef8f8',
	calloutBorder: 'rgba(47,119,120,0.25)',
	calloutLabel: '#2f7778',

	// Typography
	fontSerif: "'Fraunces',Georgia,'Times New Roman',serif",
	fontSans: "'Plus Jakarta Sans',Helvetica,Arial,sans-serif",

	// Layout
	maxWidth: 560,
} as const;

/** Logo image URL; when set, renders an <img> in the hero band instead of the text mark. */
export const EMAIL_LOGO_URL = process.env.EMAIL_LOGO_URL ?? '';
