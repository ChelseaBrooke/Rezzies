import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSessionUser } from '$lib/server/session.js';
import { prisma } from '$lib/server/prisma.js';
import { unlink } from 'node:fs/promises';
import { join } from 'node:path';

const UPLOAD_DIR = 'static/uploads/files';

/** DELETE /api/trips/[tripId]/files/[fileId] — delete a trip file (trip member only) */
export const DELETE: RequestHandler = async ({ cookies, params }) => {
	const user = await getSessionUser(cookies);
	if (!user) return json({ error: 'Unauthorized' }, { status: 401 });

	const { tripId, fileId } = params;

	const member = await prisma.tripMember.findUnique({
		where: { tripId_userId: { tripId, userId: user.id } }
	});
	if (!member) return json({ error: 'Not a trip member' }, { status: 403 });

	const file = await prisma.tripFile.findFirst({
		where: { id: fileId, tripId }
	});
	if (!file) return json({ error: 'File not found' }, { status: 404 });

	await prisma.tripFile.delete({ where: { id: fileId } });

	// Remove from disk if it's under our upload dir (path like /uploads/files/xxx.ext)
	if (file.url.startsWith('/uploads/files/')) {
		const filename = file.url.replace(/^\/uploads\/files\//, '');
		const filePath = join(process.cwd(), UPLOAD_DIR, filename);
		try {
			await unlink(filePath);
		} catch {
			// Ignore if file already missing
		}
	}

	return json({ ok: true });
};
