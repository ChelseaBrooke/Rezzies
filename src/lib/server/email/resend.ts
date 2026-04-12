import { env } from '$env/dynamic/private';
import { Resend } from 'resend';
import { prisma } from '../prisma.js';
import type { EmailTemplateKey } from './templates.js';

function getResendClient(): Resend {
	const key = env.RESEND_API_KEY;
	if (!key) {
		throw new Error('RESEND_API_KEY environment variable is required');
	}
	return new Resend(key);
}

/** Lowercase domain only; keeps local-part as-is (RFC allows case sensitivity there). */
function normalizeFromEmail(raw: string): string {
	const trimmed = raw.trim();
	const at = trimmed.lastIndexOf('@');
	if (at < 1) return trimmed;
	const local = trimmed.slice(0, at);
	const domain = trimmed.slice(at + 1).toLowerCase();
	return `${local}@${domain}`;
}

/**
 * Resend only allows arbitrary recipients when `from` uses your verified domain.
 * See https://resend.com/docs/dashboard/domains/introduction
 */
function fromAddress(): string {
	const raw = env.RESEND_FROM_EMAIL?.trim();
	if (!raw) {
		throw new Error(
			'RESEND_FROM_EMAIL is required (e.g. noreply@your-verified-domain.com). It must match a domain verified in the same Resend project as RESEND_API_KEY.'
		);
	}
	const email = normalizeFromEmail(raw);
	const name = (env.RESEND_FROM_NAME ?? 'Divvi Support').trim() || 'Divvi Support';
	return `${name} <${email}>`;
}

function resendFromHint(errMessage: string): string {
	if (!/testing emails|verify a domain/i.test(errMessage)) return '';
	return (
		' Set RESEND_FROM_EMAIL to an address on your Resend-verified domain (Resend → Domains), ' +
		'use the API key from that same Resend project, and restart the dev server after changing .env.'
	);
}

export interface SendHtmlEmailParams {
	to: string;
	subject: string;
	html: string;
	templateKey: EmailTemplateKey;
	tags?: { name: string; value: string }[];
}

export async function sendHtmlEmail({
	to,
	subject,
	html,
	templateKey,
	tags
}: SendHtmlEmailParams): Promise<{ success: boolean; messageId?: string; error?: string }> {
	const requestId = crypto.randomUUID();

	try {
		const resend = getResendClient();
		const { data, error } = await resend.emails.send({
			from: fromAddress(),
			to: [to],
			subject,
			html,
			tags: tags?.length ? tags : undefined
		});

		if (error) {
			throw new Error(error.message || 'Resend send failed');
		}

		await prisma.emailLog.create({
			data: {
				to,
				templateKey,
				templateId: data?.id ?? null,
				payloadJson: JSON.stringify({ to, templateKey, messageId: data?.id }),
				status: 'sent'
			}
		});

		return {
			success: true,
			messageId: data?.id
		};
	} catch (err) {
		let errorMessage = err instanceof Error ? err.message : 'Unknown error';
		errorMessage += resendFromHint(errorMessage);

		await prisma.emailLog.create({
			data: {
				to,
				templateKey,
				templateId: null,
				payloadJson: JSON.stringify({ to, templateKey }),
				status: 'failed',
				error: errorMessage
			}
		});

		console.error(`[${requestId}] Resend email failed:`, err);

		return { success: false, error: errorMessage };
	}
}
