import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { prisma } from '$lib/server/prisma.js';

export const GET: RequestHandler = async ({ locals }) => {
	const user = locals.user;
	if (!user) return json({ dismissed: [] }, { status: 401 });

	const row = await prisma.user.findUnique({
		where: { id: user.id },
		select: { dismissedTooltips: true }
	});

	const dismissed = Array.isArray(row?.dismissedTooltips) ? row.dismissedTooltips : [];
	return json({ dismissed });
};

export const POST: RequestHandler = async ({ locals, request }) => {
	const user = locals.user;
	if (!user) return json({ error: 'Unauthorized' }, { status: 401 });

	const body = await request.json();
	const key = typeof body?.dismiss === 'string' ? body.dismiss.trim() : '';
	if (!key) return json({ error: 'Missing dismiss key' }, { status: 400 });

	const row = await prisma.user.findUnique({
		where: { id: user.id },
		select: { dismissedTooltips: true }
	});

	const current: string[] = Array.isArray(row?.dismissedTooltips) ? (row.dismissedTooltips as string[]) : [];
	if (current.includes(key)) return json({ dismissed: current });

	const updated = [...current, key];
	await prisma.user.update({
		where: { id: user.id },
		data: { dismissedTooltips: updated }
	});

	return json({ dismissed: updated });
};
