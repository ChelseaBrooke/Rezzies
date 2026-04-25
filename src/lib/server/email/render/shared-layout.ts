import { escapeHtml } from '../html-escape.js';
import { BRAND, resolveEmailLogoUrl } from '../brand.js';

export interface EmailLayoutOptions {
	/** Hidden preview text shown in inbox before email is opened. */
	preheader: string;
	/** Small all-caps label above the heading (e.g. "Trip Update"). */
	kicker: string;
	/** Main heading in the hero band. */
	heading: string;
	/** Optional subline beneath the heading. Already-escaped HTML is accepted. */
	subheading?: string;
	/** Main body content, escaped HTML (paragraphs, tables, etc.). */
	body: string;
	/** CTA button URL. If omitted, no button is rendered. */
	ctaUrl?: string;
	/** CTA button label. */
	ctaLabel?: string;
	/** Optional secondary link rendered smaller below the CTA (e.g. a fallback URL line). */
	secondaryUrl?: string;
	/** Label for the secondary link. */
	secondaryLabel?: string;
	/** Optional teal-tinted callout box rendered above the CTA (already-escaped HTML). */
	callout?: string;
	/** Small italicised note below the button (e.g. "You can ignore this if…"). */
	finePrint?: string;
	/** Footer note below the outer card (e.g. reason for receiving). */
	footerNote?: string;
}

const B = BRAND;

const CSS = `
body,table,td,a{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}
table,td{mso-table-lspace:0pt;mso-table-rspace:0pt}
img{-ms-interpolation-mode:bicubic;border:0;height:auto;line-height:100%;outline:none;text-decoration:none}
body{margin:0!important;padding:0!important;width:100%!important}
a[x-apple-data-detectors]{color:inherit!important;text-decoration:none!important}
.wrap{background-color:${B.wrapBg}}
.card{background-color:${B.cardBg};border-radius:${B.radiusCard};overflow:hidden;border:1px solid ${B.cardBorder};box-shadow:${B.cardShadow}}
.accent-strip{height:5px;background:linear-gradient(90deg,${B.sky} 0%,${B.sand} 38%,${B.carrot} 72%,${B.accent} 100%)}
.hero-band{background:linear-gradient(135deg,${B.primaryDark} 0%,${B.primary} 50%,${B.primaryDark} 100%);padding:28px 32px 32px}
.logo-mark{display:inline-block;font-family:${B.fontSerif};font-size:22px;font-weight:800;color:${B.logoMark};letter-spacing:-0.02em;margin:0 0 10px}
.logo-img{display:block;max-height:52px;width:auto;margin:0 0 16px}
.hero-kicker{margin:0 0 12px}
.eyebrow{display:inline-block;font-family:${B.fontSans};font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:rgba(255,255,255,0.95);background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.24);border-radius:999px;padding:5px 11px}
h1{font-family:${B.fontSerif};font-size:26px;line-height:1.15;font-weight:800;color:${B.heroText};margin:0 0 8px;letter-spacing:-0.025em}
.hero-sub{font-family:${B.fontSans};font-size:15px;line-height:1.55;color:${B.heroMuted};margin:0;font-weight:500}
.body-pad{padding:28px 32px 32px}
.lead{font-family:${B.fontSans};font-size:16px;line-height:1.65;color:${B.textDark};margin:0 0 20px}
.lead--tight{margin-bottom:0!important}
.meta-table{width:100%;border-collapse:collapse;margin:0 0 24px}
.meta-row td{font-family:${B.fontSans};font-size:14px;line-height:1.5;padding:10px 0;border-bottom:1px solid ${B.borderLight};color:${B.textBody}}
.meta-label{font-weight:600;color:${B.primary};width:38%;padding-right:12px}
.digest{width:100%;border-collapse:collapse;margin:0 0 24px;border-spacing:0}
.digest td{font-family:${B.fontSans};font-size:15px;padding:8px 0;color:${B.textBody};border-bottom:1px solid ${B.borderLight}}
.digest tr:last-child td{border-bottom:none}
.digest--muted td{color:${B.textLight};border-bottom:none!important}
.callout{background:${B.calloutBg};border:1.5px solid ${B.calloutBorder};border-radius:${B.radiusCallout};padding:20px 24px;text-align:center;margin:0 0 24px;box-shadow:0 4px 14px -8px rgba(47,119,120,0.35)}
.callout-label{font-family:${B.fontSans};font-size:11px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;color:${B.calloutLabel};margin:0 0 8px}
.callout-value{font-family:${B.fontSerif};font-size:36px;font-weight:800;color:${B.navyHeading};line-height:1.2;margin:0 0 4px}
.callout-note{font-family:${B.fontSans};font-size:13px;color:${B.textLight};margin:0}
.btn-wrap{margin:8px 0 28px;text-align:center}
.btn{display:inline-block;font-family:${B.fontSans};font-size:16px;font-weight:700;line-height:1;text-decoration:none!important;color:${B.heroText}!important;background-color:${B.accent};border-radius:${B.radiusBtn};padding:15px 28px;box-shadow:${B.ctaShadow}}
.secondary-link{font-family:${B.fontSans};font-size:13px;color:${B.primary};text-align:center;display:block;margin:-12px 0 24px}
.fine{font-family:${B.fontSans};font-size:13px;line-height:1.55;color:${B.textLight};margin:0 0 16px}
.footer{font-family:${B.fontSans};font-size:12px;line-height:1.55;color:${B.textMuted};text-align:center;padding:0 24px 28px}
.footer a{color:${B.primary}!important;text-decoration:underline!important}
@media screen and (max-width:600px){.hero-band,.body-pad{padding-left:22px!important;padding-right:22px!important}h1{font-size:22px!important}.meta-label{width:42%}.callout-value{font-size:30px!important}}
`;

const FONTS = `<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,600;0,9..144,700;0,9..144,800;1,9..144,600&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />`;

function buildFooterHtml(footerNoteEscaped: string): string {
	const appBase = (typeof process !== 'undefined' ? process.env.APP_BASE_URL?.trim() : '') ?? '';
	const base = appBase.replace(/\/$/, '');
	let linkLine = '';
	if (base.length > 0) {
		const href = escapeHtml(`${base}/`);
		linkLine = `<br /><a href="${href}" target="_blank" rel="noopener">Open Divvi</a>`;
	}
	return `<p class="footer">${footerNoteEscaped}${linkLine}</p>`;
}

/** Wrap content in the standard Divvi coastal email template. */
export function renderEmailLayout(opts: EmailLayoutOptions): string {
	const preheader = escapeHtml(opts.preheader);
	const kicker = escapeHtml(opts.kicker);
	const heading = escapeHtml(opts.heading);
	const subheading = opts.subheading ?? '';

	const logoUrl = resolveEmailLogoUrl();
	const logoBlock = logoUrl
		? `<img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(B.name)}" class="logo-img" />`
		: `<div class="logo-mark">${escapeHtml(B.name)}</div>`;

	const calloutBlock = opts.callout ? `<div class="callout">${opts.callout}</div>` : '';

	const ctaBlock =
		opts.ctaUrl && opts.ctaLabel
			? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
					<tr><td class="btn-wrap" align="center">
						<a href="${escapeHtml(opts.ctaUrl)}" target="_blank" class="btn" rel="noopener">${escapeHtml(opts.ctaLabel)}</a>
					</td></tr>
				</table>`
			: '';

	const secondaryBlock =
		opts.secondaryUrl && opts.secondaryLabel
			? `<a href="${escapeHtml(opts.secondaryUrl)}" target="_blank" class="secondary-link" rel="noopener">${escapeHtml(opts.secondaryLabel)}</a>`
			: '';

	const finePrint = opts.finePrint ? `<p class="fine">${opts.finePrint}</p>` : '';
	const footerText = opts.footerNote
		? escapeHtml(opts.footerNote)
		: escapeHtml(`Sent by ${B.name} · ${B.tagline}`);
	const footerHtml = buildFooterHtml(footerText);

	return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="utf-8" />
	<meta name="viewport" content="width=device-width, initial-scale=1.0" />
	<meta http-equiv="X-UA-Compatible" content="IE=edge" />
	<meta name="color-scheme" content="light" />
	<meta name="supported-color-schemes" content="light" />
	<title>${heading}</title>
	${FONTS}
	<style type="text/css">${CSS}</style>
</head>
<body>
	<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${preheader}</div>
	<table role="presentation" class="wrap" width="100%" cellspacing="0" cellpadding="0" border="0">
		<tr>
			<td align="center" style="padding:32px 16px;">
				<table role="presentation" class="card" width="100%" style="max-width:${B.maxWidth}px;" cellspacing="0" cellpadding="0" border="0">
					<tr><td class="accent-strip"></td></tr>
					<tr>
						<td class="hero-band">
							${logoBlock}
							<div class="hero-kicker"><span class="eyebrow">${kicker}</span></div>
							<h1>${heading}</h1>
							${subheading ? `<p class="hero-sub">${subheading}</p>` : ''}
						</td>
					</tr>
					<tr>
						<td class="body-pad">
							${opts.body}
							${calloutBlock}
							${ctaBlock}
							${secondaryBlock}
							${finePrint}
						</td>
					</tr>
				</table>
				${footerHtml}
			</td>
		</tr>
	</table>
</body>
</html>`;
}

/** Build a simple meta-table row. Both arguments should already be escaped. */
export function metaRow(label: string, value: string): string {
	return `<tr class="meta-row"><td class="meta-label">${label}</td><td>${value}</td></tr>`;
}

/** Wrap rows in a meta-table block. */
export function metaTable(rows: string): string {
	return `<table role="presentation" class="meta-table" cellspacing="0" cellpadding="0" border="0">${rows}</table>`;
}

/** Build a callout box with a large value, small label above, and optional note below. */
export function calloutBox(label: string, value: string, note?: string): string {
	return [
		`<p class="callout-label">${escapeHtml(label)}</p>`,
		`<p class="callout-value">${escapeHtml(value)}</p>`,
		note ? `<p class="callout-note">${escapeHtml(note)}</p>` : ''
	].join('');
}
