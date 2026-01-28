import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const UPLOAD_DIR = 'static/uploads';
const MAX_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export const POST: RequestHandler = async ({ request }) => {
	try {
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
		const filename = `${crypto.randomUUID()}.${safeExt}`;
		const dir = join(process.cwd(), UPLOAD_DIR);
		await mkdir(dir, { recursive: true });
		const filepath = join(dir, filename);
		const buf = Buffer.from(await file.arrayBuffer());
		await writeFile(filepath, buf);
		// URL is relative to site root; static files are served from /
		const url = `/uploads/${filename}`;
		return json({ url });
	} catch (err) {
		console.error('Upload error:', err);
		return json({ error: 'Upload failed' }, 500);
	}
};
