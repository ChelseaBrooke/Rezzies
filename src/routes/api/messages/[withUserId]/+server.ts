import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { prisma } from '$lib/server/prisma.js';
import { getSessionUser } from '$lib/server/session.js';

export const GET: RequestHandler = async ({ params, cookies }) => {
	const user = await getSessionUser(cookies);
	if (!user) throw error(401, 'Unauthorized');

	const withUserId = params.withUserId;
	if (!withUserId) throw error(400, 'User ID required');

	if (withUserId === user.id) throw error(400, 'Cannot message yourself');

	// Verify other user exists
	const otherUser = await prisma.user.findUnique({
		where: { id: withUserId },
		select: { id: true, name: true, email: true, avatarUrl: true }
	});
	if (!otherUser) throw error(404, 'User not found');

	// Get messages between the two users (either direction)
	const messages = await prisma.directMessage.findMany({
		where: {
			OR: [
				{ senderId: user.id, recipientId: withUserId },
				{ senderId: withUserId, recipientId: user.id }
			]
		},
		include: {
			sender: { select: { id: true, name: true, email: true, avatarUrl: true, chatBubbleColor: true } }
		},
		orderBy: { createdAt: 'asc' },
		take: 200
	});

	return json({
		otherUser,
		messages: messages.map((m) => ({
			id: m.id,
			message: m.message,
			senderId: m.senderId,
			senderName: m.sender.name || m.sender.email,
			chatBubbleColor: m.sender.chatBubbleColor ?? null,
			createdAt: m.createdAt.toISOString()
		}))
	});
};

export const POST: RequestHandler = async ({ params, cookies, request }) => {
	const user = await getSessionUser(cookies);
	if (!user) throw error(401, 'Unauthorized');

	const withUserId = params.withUserId;
	if (!withUserId) throw error(400, 'User ID required');

	if (withUserId === user.id) throw error(400, 'Cannot message yourself');

	const otherUser = await prisma.user.findUnique({
		where: { id: withUserId },
		select: { id: true }
	});
	if (!otherUser) throw error(404, 'User not found');

	const body = await request.json();
	const message = (body.message as string)?.trim();
	if (!message || message.length === 0) throw error(400, 'Message is required');
	if (message.length > 2000) throw error(400, 'Message too long (max 2000)');

	const dm = await prisma.directMessage.create({
		data: {
			senderId: user.id,
			recipientId: withUserId,
			message
		},
		include: {
			sender: { select: { id: true, name: true, email: true, chatBubbleColor: true } }
		}
	});

	return json({
		message: {
			id: dm.id,
			message: dm.message,
			senderId: dm.senderId,
			senderName: dm.sender.name || dm.sender.email,
			chatBubbleColor: dm.sender.chatBubbleColor ?? null,
			createdAt: dm.createdAt.toISOString()
		}
	});
};
