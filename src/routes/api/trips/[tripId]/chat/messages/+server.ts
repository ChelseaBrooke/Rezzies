import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { prisma } from '$lib/server/prisma.js';
import { getSessionUser } from '$lib/server/session.js';
import { getUserTripMembership, isTripMember } from '$lib/server/trip-access.js';

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

	const [membership, rsvp] = await Promise.all([
		getUserTripMembership(tripId, user.id),
		prisma.rSVP.findUnique({
			where: {
				tripId_userId: { tripId, userId: user.id }
			}
		})
	]);

	// Allow: hosts always, or any member who RSVP'd yes (including guests)
	const canChat = membership?.role === 'host' || rsvp?.status === 'yes';
	if (!canChat) {
		throw error(403, 'You must RSVP "yes" to participate in the chat');
	}

	// Trip members for this trip (userId -> role) so we can show host badge
	const tripMembers = await prisma.tripMember.findMany({
		where: { tripId, inviteStatus: 'approved' },
		select: { userId: true, role: true }
	});
	const memberRoleByUserId = new Map(tripMembers.map((m) => [m.userId, m.role]));

	// Get all messages for this trip
	const messages = await prisma.chatMessage.findMany({
		where: { tripId },
		include: {
			user: {
				select: {
					id: true,
					name: true,
					email: true,
					chatBubbleColor: true
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
			userName: msg.user.name || msg.user.email,
			isHost: memberRoleByUserId.get(msg.userId) === 'host',
			chatBubbleColor: msg.user.chatBubbleColor ?? null,
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

	const [membership, rsvp] = await Promise.all([
		getUserTripMembership(tripId, user.id),
		prisma.rSVP.findUnique({
			where: {
				tripId_userId: { tripId, userId: user.id }
			}
		})
	]);

	// Allow: hosts always, or any member who RSVP'd yes (including guests)
	const canChat = membership?.role === 'host' || rsvp?.status === 'yes';
	if (!canChat) {
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
					email: true,
					chatBubbleColor: true
				}
			}
		}
	});

	return json({
		message: {
			id: chatMessage.id,
			message: chatMessage.message,
			userId: chatMessage.userId,
			userName: chatMessage.user.name || chatMessage.user.email,
			isHost: membership?.role === 'host',
			chatBubbleColor: chatMessage.user.chatBubbleColor ?? null,
			createdAt: chatMessage.createdAt.toISOString()
		}
	});
};
