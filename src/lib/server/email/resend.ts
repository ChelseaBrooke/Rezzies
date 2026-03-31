import { Resend } from 'resend';
import { prisma } from '../prisma.js';
import type { EmailTemplateKey } from './templates.js';

function getResendClient(): Resend {
	const key = process.env.RESEND_API_KEY;
	if (!key) {
		throw new Error('RESEND_API_KEY environment variable is required');
	}
	return new Resend(key);
}

function fromAddress(): string {
	const email = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
	const name = process.env.RESEND_FROM_NAME || 'Divvi';
	return `${name} <${email}>`;
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
		const errorMessage = err instanceof Error ? err.message : 'Unknown error';

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
