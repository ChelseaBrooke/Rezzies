import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSessionUser } from '$lib/server/session.js';
import { prisma } from '$lib/server/prisma.js';

export const POST: RequestHandler = async ({ request, cookies }) => {
	const user = await getSessionUser(cookies);
	if (!user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	let body: { notificationId?: string; tripId?: string };
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Invalid JSON' }, { status: 400 });
	}

	const { notificationId, tripId } = body;
	if (!notificationId) {
		return json({ error: 'notificationId required' }, { status: 400 });
	}

	await prisma.notification.updateMany({
		where: {
			id: notificationId,
			userId: user.id
		},
		data: { read: true }
	});

	return json({ ok: true, tripId: tripId ?? null });
};
