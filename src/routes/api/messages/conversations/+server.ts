import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { prisma } from '$lib/server/prisma.js';
import { getSessionUser } from '$lib/server/session.js';

export const GET: RequestHandler = async ({ cookies }) => {
	const user = await getSessionUser(cookies);
	if (!user) throw error(401, 'Unauthorized');

	const sent = await prisma.directMessage.findMany({
		where: { senderId: user.id },
		select: {
			recipientId: true,
			recipient: { select: { id: true, name: true, email: true, avatarUrl: true } },
			message: true,
			createdAt: true
		},
		orderBy: { createdAt: 'desc' }
	});

	const received = await prisma.directMessage.findMany({
		where: { recipientId: user.id },
		select: {
			senderId: true,
			sender: { select: { id: true, name: true, email: true, avatarUrl: true } },
			message: true,
			createdAt: true
		},
		orderBy: { createdAt: 'desc' }
	});

	const byOther = new Map<string, { otherUser: { id: string; name: string | null; email: string; avatarUrl: string | null }; lastMessage: string; lastAt: Date }>();

	for (const m of sent) {
		const existing = byOther.get(m.recipientId);
		if (!existing || m.createdAt > existing.lastAt) {
			byOther.set(m.recipientId, { otherUser: m.recipient, lastMessage: m.message, lastAt: m.createdAt });
		}
	}
	for (const m of received) {
		const existing = byOther.get(m.senderId);
		if (!existing || m.createdAt > existing.lastAt) {
			byOther.set(m.senderId, { otherUser: m.sender, lastMessage: m.message, lastAt: m.createdAt });
		}
	}

	const conversations = Array.from(byOther.entries())
		.map(([otherUserId, data]) => ({
			otherUserId,
			otherUser: data.otherUser,
			lastMessage: data.lastMessage,
			lastAt: data.lastAt.toISOString()
		}))
		.sort((a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime());

	return json({ conversations });
};
