/**
 * Centralized brand tokens for all Divvi email templates (HTML tables + inline CSS).
 *
 * Theme parity — keep aligned with `src/styles/theme.css` :root:
 * | BRAND field    | theme.css token        | Hex / value |
 * |----------------|------------------------|---------------|
 * | primary        | --slate, --primary     | #2F7778 |
 * | primaryDark    | --navy                 | #1d4d4e |
 * | navyHeading    | headings (cost step)   | #1d4d4e |
 * | primaryMid     | --primaryHover         | #245a5b |
 * | accent         | --warm (CTAs / alloy)  | #CE5612 |
 * | carrot         | --carrot (accents)     | #F7AA29 |
 * | sand           | --sand, --beige        | #E3CEAA |
 * | sky            | --sky                  | #7ACED3 |
 * | textDark       | --text                 | #111827 |
 * | wrapBg         | --bg                   | #f4f5f7 |
 * | cardBg         | --surfaceSolid         | #ffffff |
 * | borderLight    | soft slate border      | rgba(47,119,120,0.12) |
 * | heroGradient   | trip wizard cost hero  | warm sand → white |
 *
 * Emails cannot use CSS variables; duplicate hex here when the site palette changes.
 */
export const BRAND = {
	name: 'Divvi',
	tagline: 'Group trips, squared away',

	// Core palette (see table above)
	primary: '#2F7778',
	primaryDark: '#1d4d4e',
	/** Headlines on light “cost sharing” style hero — matches wizard --navy */
	navyHeading: '#1d4d4e',
	primaryMid: '#245a5b',
	accent: '#CE5612',
	carrot: '#F7AA29',
	sand: '#E3CEAA',
	sky: '#7ACED3',

	/** Light hero band — parity with AddOnsStep.cs-hero */
	heroGradient:
		'linear-gradient(135deg, rgba(227,206,170,0.55) 0%, rgba(227,206,170,0.18) 55%, rgba(255,255,255,0.96) 100%)',
	heroSolidFallback: '#fbf9f6',
	heroBorderBottom: 'rgba(47,119,120,0.18)',
	heroShadow: '0 18px 40px -22px rgba(47,119,120,0.28)',
	eyebrowText: '#CE5612',
	eyebrowBg: 'rgba(206,86,18,0.1)',
	eyebrowBorder: 'rgba(206,86,18,0.25)',
	heroSubText: '#475569',

	// Surfaces
	wrapBg: '#f4f5f7',
	cardBg: '#ffffff',
	/** Card drop shadow — slightly deeper like wizard cost card */
	cardShadow: '0 18px 44px -24px rgba(47,119,120,0.22)',
	cardBorder: 'rgba(47,119,120,0.18)',

	// Text
	textDark: '#111827',
	textBody: '#374151',
	textLight: '#6b7280',
	textMuted: '#9ca3af',

	// Hero — CTA text on orange buttons (unchanged)
	heroText: '#ffffff',
	/** Legacy name; hero copy is now dark on light band — use heroSubText */
	heroMuted: 'rgba(255,255,255,0.92)',
	heroSubtle: 'rgba(255,255,255,0.9)',
	/** Text “Divvi” wordmark when no logo image — on teal hero */
	logoMark: '#f4f8f8',

	// Borders
	borderLight: 'rgba(47,119,120,0.12)',

	// Callout box — wizard toggle-card vibe (white inset on soft teal)
	calloutBg: '#ffffff',
	calloutBorder: 'rgba(47,119,120,0.22)',
	calloutLabel: '#2F7778',

	// CTA — shadow uses warm channel
	ctaShadow: '0 4px 14px rgba(206,86,18,0.35)',

	// Typography (match app.css + theme)
	fontSerif: "'Fraunces',Georgia,'Times New Roman',serif",
	fontSans: "'Plus Jakarta Sans',Helvetica,Arial,sans-serif",

	// Layout
	maxWidth: 560,

	/** Border radii — closer to wizard cs-hero (1.25rem) */
	radiusCard: '20px',
	radiusBtn: '12px',
	radiusCallout: '12px'
} as const;

/**
 * Optional full URL to a logo image — wins over the default white Divvi mark
 * (`/email/divvi-logo-white.png` on your app origin).
 */
export const EMAIL_LOGO_URL = process.env.EMAIL_LOGO_URL?.trim() ?? '';

/** Served from `static/email/` — white Divvi wordmark PNG for templates. */
export const DEFAULT_EMAIL_LOGO_PATH = '/email/divvi-logo-white.png';

/**
 * Absolute URL for the hero logo. Uses `EMAIL_LOGO_URL` when set; otherwise
 * `APP_BASE_URL` + {@link DEFAULT_EMAIL_LOGO_PATH}. Returns empty string if
 * neither can produce a URL (wordmark fallback in layout).
 */
export function resolveEmailLogoUrl(): string {
	if (EMAIL_LOGO_URL) return EMAIL_LOGO_URL;
	const base = process.env.APP_BASE_URL?.trim()?.replace(/\/$/, '') ?? '';
	if (!base) return '';
	return `${base}${DEFAULT_EMAIL_LOGO_PATH}`;
}
