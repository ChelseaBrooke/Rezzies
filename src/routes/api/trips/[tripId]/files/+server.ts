import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSessionUser } from '$lib/server/session.js';
import { prisma } from '$lib/server/prisma.js';
import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const UPLOAD_DIR = 'static/uploads/files';
const MAX_SIZE = 20 * 1024 * 1024; // 20 MB
const ALLOWED_TYPES = [
	'image/jpeg', 'image/png', 'image/webp', 'image/gif',
	'application/pdf',
	'image/heic', 'image/heif',
	'video/mp4', 'video/webm', 'video/quicktime'
];

/** POST /api/trips/[tripId]/files — upload a file and persist a TripFile record */
export const POST: RequestHandler = async ({ request, cookies, params }) => {
	const user = await getSessionUser(cookies);
	if (!user) return json({ error: 'Unauthorized' }, { status: 401 });

	const { tripId } = params;

	// Verify user is a trip member
	const member = await prisma.tripMember.findUnique({
		where: { tripId_userId: { tripId, userId: user.id } }
	});
	if (!member) return json({ error: 'Not a trip member' }, { status: 403 });

	const formData = await request.formData();
	const file = formData.get('file') as File | null;
	const category = (formData.get('category') as string) || 'document';
	const mealSlotId = (formData.get('mealSlotId') as string) || null;
	const notes = (formData.get('notes') as string) || null;

	if (!file || !(file instanceof File)) {
		return json({ error: 'No file provided' }, { status: 400 });
	}
	if (file.size > MAX_SIZE) {
		return json({ error: 'File too large (max 20 MB)' }, { status: 400 });
	}
	if (!ALLOWED_TYPES.includes(file.type)) {
		return json({ error: 'Unsupported file type. Use PDF, images (JPEG, PNG, WebP), or video (MP4, WebM).' }, { status: 400 });
	}

	// Persist to disk
	const ext = file.name.split('.').pop()?.toLowerCase() || 'bin';
	const filename = `${crypto.randomUUID()}.${ext}`;
	const dir = join(process.cwd(), UPLOAD_DIR);
	await mkdir(dir, { recursive: true });
	await writeFile(join(dir, filename), Buffer.from(await file.arrayBuffer()));
	const url = `/uploads/files/${filename}`;

	// Save to DB
	const record = await prisma.tripFile.create({
		data: {
			tripId,
			uploadedById: user.id,
			name: file.name,
			url,
			mimeType: file.type,
			sizeBytes: file.size,
			category,
			mealSlotId: mealSlotId || null,
			notes
		}
	});

	return json({ file: record });
};

/** GET /api/trips/[tripId]/files — list all files for a trip */
export const GET: RequestHandler = async ({ cookies, params, url }) => {
	const user = await getSessionUser(cookies);
	if (!user) return json({ error: 'Unauthorized' }, { status: 401 });

	const { tripId } = params;
	const member = await prisma.tripMember.findUnique({
		where: { tripId_userId: { tripId, userId: user.id } }
	});
	if (!member) return json({ error: 'Not a trip member' }, { status: 403 });

	const mealSlotId = url.searchParams.get('mealSlotId') || undefined;

	const files = await prisma.tripFile.findMany({
		where: { tripId, ...(mealSlotId ? { mealSlotId } : {}) },
		include: { uploadedBy: { select: { id: true, name: true } } },
		orderBy: { createdAt: 'desc' }
	});

	return json({ files });
};
