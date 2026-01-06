// SendGrid template registry
// Template IDs should be configured via environment variables

export const TEMPLATE_KEYS = {
	GUEST_CONFIRMATION: 'GUEST_CONFIRMATION'
} as const;

export type TemplateKey = (typeof TEMPLATE_KEYS)[keyof typeof TEMPLATE_KEYS];

export function getTemplateId(key: TemplateKey): string {
	const envKey = `SENDGRID_TEMPLATE_${key}`;
	const templateId = process.env[envKey];
	
	if (!templateId) {
		throw new Error(`Missing SendGrid template ID for ${key}. Set ${envKey} environment variable.`);
	}
	
	return templateId;
}

