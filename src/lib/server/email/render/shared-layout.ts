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
body{margin:0!important;padding:0!important;width:100%!important;background-color:${B.wrapBg}}
a[x-apple-data-detectors]{color:inherit!important;text-decoration:none!important}
.wrap{background-color:${B.wrapBg};width:100%}
.shell{width:100%;max-width:${B.maxWidth}px;background-color:${B.cardBg}}
.hero{background-color:${B.primaryDark};background-image:linear-gradient(158deg,${B.primary} 0%,${B.primaryDark} 70%);padding:44px 48px 46px}
.logo-mark{display:inline-block;font-family:${B.fontSerif};font-size:22px;font-weight:700;color:${B.logoMark};letter-spacing:-0.02em;margin:0 0 30px}
.logo-img{display:block;max-height:42px;width:auto;margin:0 0 30px}
.hero-kicker{margin:0 0 18px;font-size:0;line-height:0}
.eyebrow{font-family:${B.fontSerif};font-style:italic;font-weight:400;font-size:15px;letter-spacing:0;color:${B.carrot};vertical-align:middle}
.eyebrow-rule{display:inline-block;width:34px;height:1px;background-color:${B.sand};opacity:0.5;vertical-align:middle;margin-left:14px;font-size:0;line-height:1px}
.shell h1{font-family:${B.fontSerif};font-size:36px;line-height:1.06;font-weight:600;color:${B.heroText};margin:0 0 14px;letter-spacing:-0.035em}
.hero-sub{font-family:${B.fontSans};font-size:16px;line-height:1.6;color:rgba(255,255,255,0.82);margin:0;font-weight:400}
.body-pad{padding:42px 48px 16px}
.lead{font-family:${B.fontSans};font-size:16.5px;line-height:1.75;color:${B.textBody};margin:0 0 22px;font-weight:400}
.lead strong{font-weight:700;color:${B.navyHeading}}
.lead--tight{margin-bottom:0!important}
.surface{margin:10px 0 30px}
.meta-table{width:100%;border-collapse:separate;border-spacing:0;margin:10px 0 30px;background-color:#ffffff;border:1px solid ${B.borderLight};border-radius:${B.radiusSurface}}
.meta-row td{font-family:${B.fontSans};font-size:15px;line-height:1.45;padding:15px 22px;border-top:1px solid ${B.borderLight};color:${B.textDark}}
.meta-row:first-child td{border-top:none}
.meta-label{font-weight:600;color:${B.primary};width:40%;padding-right:14px}
.digest{width:100%;border-collapse:separate;border-spacing:0;margin:10px 0 30px;background-color:#ffffff;border:1px solid ${B.borderLight};border-radius:${B.radiusSurface}}
.digest td{font-family:${B.fontSans};font-size:15px;line-height:1.5;padding:14px 22px;color:${B.textDark};border-top:1px solid ${B.borderLight}}
.digest tr:first-child td{border-top:none}
.digest--muted td{color:${B.textLight}}
.callout{background-color:${B.calloutBg};border:1px solid ${B.calloutBorder};border-radius:${B.radiusCallout};padding:30px 26px;text-align:center;margin:0 0 30px}
.callout-label{font-family:${B.fontSerif};font-style:italic;font-size:15px;font-weight:400;letter-spacing:0;text-transform:none;color:${B.calloutLabel};margin:0 0 10px}
.callout-value{font-family:${B.fontSerif};font-size:44px;font-weight:600;color:${B.navyHeading};line-height:1.05;margin:0 0 8px;letter-spacing:-0.02em}
.callout-note{font-family:${B.fontSans};font-size:13px;line-height:1.5;color:${B.textLight};margin:0}
.cta-table{width:100%;margin:8px 0 26px}
.cta-cell{background-color:${B.accent};border-radius:${B.radiusBtn}}
.btn{display:block;font-family:${B.fontSans};font-size:16px;font-weight:700;line-height:1.2;text-decoration:none!important;color:${B.heroText}!important;padding:18px 24px;text-align:center;letter-spacing:0.01em}
.secondary-link{font-family:${B.fontSans};font-size:13.5px;color:${B.primary};text-align:center;display:block;margin:-10px 0 26px}
.fine{font-family:${B.fontSans};font-size:13px;line-height:1.65;color:${B.textLight};margin:0 0 6px}
.footer{background-color:${B.footerBg};padding:30px 48px 34px;border-top:1px solid ${B.borderLight}}
.footer-brand{font-family:${B.fontSerif};font-size:18px;font-weight:700;color:${B.primary};letter-spacing:-0.02em;margin:0 0 8px}
.footer-note{font-family:${B.fontSans};font-size:12.5px;line-height:1.65;color:${B.textMuted};margin:0 0 10px}
.footer-note a{color:${B.primary}!important;text-decoration:underline!important}
.footer-tag{font-family:${B.fontSerif};font-style:italic;font-size:13px;color:${B.textLight};margin:0}
@media screen and (max-width:620px){.hero{padding-left:28px!important;padding-right:28px!important;padding-top:36px!important}.body-pad{padding-left:28px!important;padding-right:28px!important}.footer{padding-left:28px!important;padding-right:28px!important}.shell h1{font-size:29px!important}.meta-label{width:42%}.meta-row td{padding-left:18px!important;padding-right:18px!important}.digest td{padding-left:18px!important;padding-right:18px!important}.callout-value{font-size:36px!important}}
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
	return `<tr>
		<td class="footer" align="center">
			<div class="footer-brand">${escapeHtml(B.name)}</div>
			<p class="footer-note">${footerNoteEscaped}${linkLine}</p>
			<p class="footer-tag">${escapeHtml(B.tagline)}</p>
		</td>
	</tr>`;
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
			? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" class="cta-table">
					<tr><td class="cta-cell" align="center" bgcolor="${B.accent}" style="border-radius:${B.radiusBtn};">
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
			<td align="center">
				<table role="presentation" class="shell" width="100%" style="max-width:${B.maxWidth}px;" cellspacing="0" cellpadding="0" border="0">
					<tr>
						<td class="hero">
							${logoBlock}
							<div class="hero-kicker"><span class="eyebrow">${kicker}</span><span class="eyebrow-rule">&nbsp;</span></div>
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
					${footerHtml}
				</table>
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
