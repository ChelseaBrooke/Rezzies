/**
 * Centralized brand tokens for all Divvi email templates (HTML tables + inline CSS).
 *
 * Theme parity — keep aligned with `src/styles/theme.css` :root:
 * | BRAND field    | theme.css token        | Hex / value |
 * |----------------|------------------------|---------------|
 * | primary        | --slate, --primary     | #2F7778 |
 * | primaryDark    | --navy                 | #1d4d4e |
 * | primaryMid     | --primaryHover         | #245a5b |
 * | accent         | --warm (CTAs / alloy)  | #CE5612 |
 * | carrot         | --carrot (accents)     | #F7AA29 |
 * | sand           | --sand, --beige        | #E3CEAA |
 * | sky            | --sky                  | #7ACED3 |
 * | textDark       | --text                 | #111827 |
 * | wrapBg         | --bg                   | #f4f5f7 |
 * | cardBg         | --surfaceSolid         | #ffffff |
 * | borderLight    | soft slate border      | rgba(47,119,120,0.12) |
 *
 * Emails cannot use CSS variables; duplicate hex here when the site palette changes.
 */
export const BRAND = {
	name: 'Divvi',
	tagline: 'Group trips, squared away',

	// Core palette (see table above)
	primary: '#2F7778',
	primaryDark: '#1d4d4e',
	primaryMid: '#245a5b',
	accent: '#CE5612',
	carrot: '#F7AA29',
	sand: '#E3CEAA',
	sky: '#7ACED3',

	// Surfaces
	wrapBg: '#f4f5f7',
	cardBg: '#ffffff',
	/** Card drop shadow — mirrors --shadow-soft */
	cardShadow: '0 10px 30px rgba(29,77,78,0.07)',
	cardBorder: 'rgba(47,119,120,0.14)',

	// Text
	textDark: '#111827',
	textBody: '#374151',
	textLight: '#6b7280',
	textMuted: '#9ca3af',

	// Hero / on-teal content
	heroText: '#ffffff',
	heroMuted: 'rgba(255,255,255,0.92)',
	/** Secondary line on hero (e.g. destination under trip name) */
	heroSubtle: 'rgba(255,255,255,0.9)',
	logoMark: '#f4f8f8',

	// Borders
	borderLight: 'rgba(47,119,120,0.12)',

	// Callout box (waitlist, spot counts, etc.)
	calloutBg: '#eef8f8',
	calloutBorder: 'rgba(47,119,120,0.25)',
	calloutLabel: '#2F7778',

	// CTA — shadow uses warm channel
	ctaShadow: '0 4px 14px rgba(206,86,18,0.35)',

	// Typography (match app.css + theme)
	fontSerif: "'Fraunces',Georgia,'Times New Roman',serif",
	fontSans: "'Plus Jakarta Sans',Helvetica,Arial,sans-serif",

	// Layout
	maxWidth: 560,

	/** Border radii — close to --radius-xl / --radius-2xl */
	radiusCard: '16px',
	radiusBtn: '12px',
	radiusCallout: '12px'
} as const;

/** Trimmed logo URL from env; empty = text wordmark in hero. */
export const EMAIL_LOGO_URL = process.env.EMAIL_LOGO_URL?.trim() ?? '';

export function resolveEmailLogoUrl(): string {
	return EMAIL_LOGO_URL;
}
