import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { prisma } from '$lib/server/prisma.js';
import { getSessionUser } from '$lib/server/session.js';
import { isTripMember } from '$lib/server/trip-access.js';

export const GET: RequestHandler = async ({ params, cookies }) => {
	const user = await getSessionUser(cookies);
	if (!user) {
		throw error(401, 'Unauthorized');
	}

	const tripId = params.tripId;
	if (!tripId) {
		throw error(400, 'Trip ID is required');
	}

	// Check if user is a member of the trip
	const isMember = await isTripMember(tripId, user.id);
	if (!isMember) {
		throw error(403, 'You must be a member of this trip to access chat');
	}

	// Check if user has RSVP'd
	const rsvp = await prisma.rSVP.findUnique({
		where: {
			tripId_userId: {
				tripId,
				userId: user.id
			}
		}
	});

	if (!rsvp || rsvp.status !== 'yes') {
		throw error(403, 'You must RSVP "yes" to participate in the chat');
	}

	// Get all messages for this trip
	const messages = await prisma.chatMessage.findMany({
		where: { tripId },
		include: {
			user: {
				select: {
					id: true,
					name: true,
					email: true
				}
			}
		},
		orderBy: {
			createdAt: 'asc'
		},
		take: 100 // Limit to last 100 messages
	});

	return json({
		messages: messages.map((msg) => ({
			id: msg.id,
			message: msg.message,
			userId: msg.userId,
			userName: msg.user.name,
			createdAt: msg.createdAt.toISOString()
		}))
	});
};

export const POST: RequestHandler = async ({ params, cookies, request }) => {
	const user = await getSessionUser(cookies);
	if (!user) {
		throw error(401, 'Unauthorized');
	}

	const tripId = params.tripId;
	if (!tripId) {
		throw error(400, 'Trip ID is required');
	}

	// Check if user is a member of the trip
	const isMember = await isTripMember(tripId, user.id);
	if (!isMember) {
		throw error(403, 'You must be a member of this trip to send messages');
	}

	// Check if user has RSVP'd
	const rsvp = await prisma.rSVP.findUnique({
		where: {
			tripId_userId: {
				tripId,
				userId: user.id
			}
		}
	});

	if (!rsvp || rsvp.status !== 'yes') {
		throw error(403, 'You must RSVP "yes" to send messages');
	}

	const body = await request.json();
	const message = body.message?.trim();

	if (!message || message.length === 0) {
		throw error(400, 'Message is required');
	}

	if (message.length > 2000) {
		throw error(400, 'Message is too long (max 2000 characters)');
	}

	// Create the message
	const chatMessage = await prisma.chatMessage.create({
		data: {
			tripId,
			userId: user.id,
			message
		},
		include: {
			user: {
				select: {
					id: true,
					name: true,
					email: true
				}
			}
		}
	});

	return json({
		message: {
			id: chatMessage.id,
			message: chatMessage.message,
			userId: chatMessage.userId,
			userName: chatMessage.user.name,
			createdAt: chatMessage.createdAt.toISOString()
		}
	});
};
