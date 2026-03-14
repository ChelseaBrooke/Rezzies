import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSessionUser } from '$lib/server/session.js';
import { prisma } from '$lib/server/prisma.js';
import { supabaseAdmin, UPLOAD_BUCKET } from '$lib/server/supabase.js';

/** Extract storage path from Supabase Storage public URL, or return null. */
function getStoragePathFromPublicUrl(url: string): string | null {
	// Format: https://<project>.supabase.co/storage/v1/object/public/uploads/<path>
	const match = url.match(/\/storage\/v1\/object\/public\/uploads\/(.+)$/);
	return match ? decodeURIComponent(match[1]) : null;
}

/** DELETE /api/trips/[tripId]/files/[fileId] — delete a trip file (trip member only) and remove from Supabase Storage */
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

	const storagePath = getStoragePathFromPublicUrl(file.url);
	if (supabaseAdmin && storagePath) {
		try {
			await supabaseAdmin.storage.from(UPLOAD_BUCKET).remove([storagePath]);
		} catch {
			// Ignore; record is already deleted
		}
	}

	return json({ ok: true });
};
