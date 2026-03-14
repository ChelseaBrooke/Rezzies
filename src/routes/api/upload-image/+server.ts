import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { supabaseAdmin, UPLOAD_BUCKET } from '$lib/server/supabase.js';

const MAX_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

/** POST /api/upload-image — upload an image to Supabase Storage (bucket: uploads), e.g. for listing cover photo */
export const POST: RequestHandler = async ({ request }) => {
	try {
		if (!supabaseAdmin) {
			return json({ error: 'Storage not configured' }, 503);
		}
		const formData = await request.formData();
		const file = formData.get('file') as File | null;
		if (!file || !(file instanceof File)) {
			return json({ error: 'No file provided' }, 400);
		}
		if (file.size > MAX_SIZE) {
			return json({ error: 'File too large (max 10MB)' }, 400);
		}
		if (!ALLOWED_TYPES.includes(file.type)) {
			return json({ error: 'Invalid file type. Use JPEG, PNG, WebP, or GIF.' }, 400);
		}
		const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
		const safeExt = ['jpeg', 'jpg', 'png', 'webp', 'gif'].includes(ext) ? ext : 'jpg';
		const storagePath = `images/${crypto.randomUUID()}.${safeExt}`;
		const { error: uploadError } = await supabaseAdmin.storage
			.from(UPLOAD_BUCKET)
			.upload(storagePath, await file.arrayBuffer(), {
				contentType: file.type,
				upsert: false
			});
		if (uploadError) {
			console.error('Supabase storage upload failed', uploadError);
			return json({ error: 'Upload failed' }, 500);
		}
		const { data: publicUrlData } = supabaseAdmin.storage
			.from(UPLOAD_BUCKET)
			.getPublicUrl(storagePath);
		return json({ url: publicUrlData.publicUrl });
	} catch (err) {
		console.error('Upload error:', err);
		return json({ error: 'Upload failed' }, 500);
	}
};
