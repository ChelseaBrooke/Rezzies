import sgMail from '@sendgrid/mail';
import { getTemplateId, type TemplateKey } from './templates.js';
import { prisma } from '../prisma.js';

// Initialize SendGrid
const apiKey = process.env.SENDGRID_API_KEY;
if (!apiKey) {
	throw new Error('SENDGRID_API_KEY environment variable is required');
}
sgMail.setApiKey(apiKey);

const FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL || 'noreply@example.com';
const FROM_NAME = process.env.SENDGRID_FROM_NAME || 'Wedding RSVP';

export interface SendTemplateEmailParams {
	to: string;
	templateId: TemplateKey;
	dynamicTemplateData: Record<string, unknown>;
	categories?: string[];
	customArgs?: Record<string, string>;
}

export async function sendTemplateEmail({
	to,
	templateId,
	dynamicTemplateData,
	categories,
	customArgs
}: SendTemplateEmailParams): Promise<{ success: boolean; messageId?: string; error?: string }> {
	const requestId = crypto.randomUUID();
	
	try {
		const actualTemplateId = getTemplateId(templateId);
		
		const msg = {
			to,
			from: {
				email: FROM_EMAIL,
				name: FROM_NAME
			},
			templateId: actualTemplateId,
			dynamicTemplateData,
			categories,
			customArgs: {
				...customArgs,
				requestId
			}
		};

		const [response] = await sgMail.send(msg);
		
		// Log success
		await prisma.emailLog.create({
			data: {
				to,
				templateKey: templateId,
				templateId: actualTemplateId,
				payloadJson: JSON.stringify({ 
					to, 
					templateId: actualTemplateId,
					// Redact sensitive data if needed
					dynamicTemplateData: Object.keys(dynamicTemplateData)
				}),
				status: 'sent'
			}
		});

		return {
			success: true,
			messageId: response.headers['x-message-id'] as string | undefined
		};
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : 'Unknown error';
		
		// Log failure
		await prisma.emailLog.create({
			data: {
				to,
				templateKey: templateId,
				templateId: getTemplateId(templateId),
				payloadJson: JSON.stringify({ to, templateId }),
				status: 'failed',
				error: errorMessage
			}
		});

		console.error(`[${requestId}] SendGrid email failed:`, error);
		
		return {
			success: false,
			error: errorMessage
		};
	}
}

