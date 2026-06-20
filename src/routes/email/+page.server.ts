import { error, fail } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';
import type { Actions, PageServerLoad } from './$types';
import { sendHtmlEmail } from '$lib/server/email/resend.js';
import { buildEmailPreviews, getEmailPreviewById } from './build-email-previews.js';

const PREVIEW_RECIPIENT = 'chelsea.nilon@gmail.com';

function emailPreviewAllowed(): boolean {
	if (dev) return true;
	const v = env.EMAIL_PREVIEW_ENABLED?.trim().toLowerCase();
	return v === '1' || v === 'true' || v === 'yes';
}

export const load: PageServerLoad = async () => {
	if (!emailPreviewAllowed()) {
		throw error(404, 'Not found');
	}
	return {
		previews: buildEmailPreviews(),
		previewRecipient: PREVIEW_RECIPIENT
	};
};

export const actions: Actions = {
	sendPreview: async ({ request }) => {
		if (!emailPreviewAllowed()) {
			throw error(404, 'Not found');
		}

		const formData = await request.formData();
		const previewId = (formData.get('previewId') as string | null)?.trim();
		if (!previewId) {
			return fail(400, {
				sendPreview: { previewId: '', success: false, error: 'Missing template id.' }
			});
		}

		const preview = getEmailPreviewById(previewId);
		if (!preview) {
			return fail(404, {
				sendPreview: { previewId, success: false, error: 'Unknown template.' }
			});
		}

		const result = await sendHtmlEmail({
			to: PREVIEW_RECIPIENT,
			subject: `[Preview] ${preview.subject}`,
			html: preview.html,
			templateKey: preview.templateKey,
			tags: [
				{ name: 'category', value: 'email-preview' },
				{ name: 'preview_id', value: previewId }
			]
		});

		if (!result.success) {
			return fail(500, {
				sendPreview: {
					previewId,
					success: false,
					error: result.error ?? 'Failed to send email.'
				}
			});
		}

		return {
			sendPreview: {
				previewId,
				success: true,
				messageId: result.messageId
			}
		};
	}
};
