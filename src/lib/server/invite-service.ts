import { prisma } from './prisma.js';
import { sendHtmlEmail } from './email/resend.js';
import { TEMPLATE_KEYS } from './email/templates.js';
import { renderTripInviteHtml } from './email/render/trip-invite.js';

/**
 * When someone signs up (or we discover them) with an email that was already invited,
 * link those pending invites to their account and create notifications + trip memberships.
 * Call this after signup or when loading notifications so they see "You've been invited".
 */
export async function linkPendingInvitesForUser(userId: string, email: string): Promise<void> {
	const now = new Date();
	const pendingInvites = await prisma.invite.findMany({
		where: {
			recipientEmail: { equals: email.trim(), mode: 'insensitive' },
			recipientUserId: null,
			status: 'sent',
			OR: [{ expiresAt: null }, { expiresAt: { gt: now } }]
		},
		include: {
			trip: { select: { id: true, name: true } }
		}
	});
	for (const inv of pendingInvites) {
		await prisma.$transaction([
			prisma.invite.update({
				where: { id: inv.id },
				data: { recipientUserId: userId }
			}),
			prisma.tripMember.upsert({
				where: {
					tripId_userId: { tripId: inv.tripId, userId }
				},
			create: {
				tripId: inv.tripId,
				userId,
				role: 'guest',
				inviteStatus: 'approved'
			},
			update: { inviteStatus: 'approved' }
			}),
			prisma.notification.create({
				data: {
					userId,
					type: 'invite_received',
					title: "You're invited to a trip",
					message: `You've been invited to "${inv.trip.name}". Click to view the trip.`,
					relatedTripId: inv.tripId
				}
			})
		]);
	}
}

/**
 * When an invite is sent to a user who already has an account, create a TripMember (invited)
 * and an in-app Notification so they see "You've been invited" and can open the guest portal.
 */
export async function notifyExistingUserOfInvite(params: {
	inviteId: string;
	tripId: string;
	tripName: string;
	recipientUserId: string;
}) {
	const { inviteId, tripId, tripName, recipientUserId } = params;
	await prisma.$transaction([
		prisma.tripMember.upsert({
			where: {
				tripId_userId: { tripId, userId: recipientUserId }
			},
			create: {
				tripId,
				userId: recipientUserId,
				role: 'guest',
				inviteStatus: 'approved'
			},
			update: { inviteStatus: 'approved' }
		}),
		prisma.notification.create({
			data: {
				userId: recipientUserId,
				type: 'invite_received',
				title: "You're invited to a trip",
				message: `You've been invited to "${tripName}". Click to view the trip.`,
				relatedTripId: tripId
			}
		})
	]);
}

export async function createInvite(
	tripId: string,
	invitedByUserId: string,
	channel: 'email' | 'sms' | 'app',
	recipientEmail?: string,
	recipientPhone?: string,
	recipientUserId?: string
) {
	// If we have email but no recipientUserId, check if a user exists with that email
	let resolvedRecipientUserId = recipientUserId;
	if (recipientEmail && !resolvedRecipientUserId) {
		const existingUser = await prisma.user.findFirst({
			where: { email: { equals: recipientEmail.trim(), mode: 'insensitive' } },
			select: { id: true }
		});
		if (existingUser) resolvedRecipientUserId = existingUser.id;
	}

	// Generate unique token
	const token = crypto.randomUUID();

	// Create invite
	const invite = await prisma.invite.create({
		data: {
			tripId,
			token,
			invitedByUserId,
			channel,
			recipientEmail: recipientEmail || null,
			recipientPhone: recipientPhone || null,
			recipientUserId: resolvedRecipientUserId || null,
			expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
		},
		include: {
			trip: {
				select: {
					id: true,
					name: true,
					checkInDate: true,
					checkOutDate: true,
					location: true,
					locationCity: true
				}
			},
			invitedBy: {
				select: {
					name: true,
					email: true
				}
			}
		}
	});

	// In-app notification + TripMember for existing users
	if (resolvedRecipientUserId) {
		await notifyExistingUserOfInvite({
			inviteId: invite.id,
			tripId,
			tripName: invite.trip.name,
			recipientUserId: resolvedRecipientUserId
		});
	}

	// Send invite based on channel
	const baseUrl = process.env.APP_BASE_URL || 'http://localhost:5173';
	const inviteUrl = `${baseUrl}/invite/${token}`;

	if (channel === 'email' && recipientEmail) {
		await sendInviteEmail(recipientEmail, invite, inviteUrl);
	} else if (channel === 'sms' && recipientPhone) {
		// TODO: Implement SMS sending with Twilio
		console.log(`SMS invite would be sent to ${recipientPhone}: ${inviteUrl}`);
	}

	return { invite, inviteUrl };
}

async function sendInviteEmail(email: string, invite: any, inviteUrl: string) {
	try {
		const hostName = invite.invitedBy.name || invite.invitedBy.email;
		const tripName = invite.trip.name;
		const checkIn = invite.trip.checkInDate.toLocaleDateString(undefined, {
			weekday: 'short',
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
		const checkOut = invite.trip.checkOutDate.toLocaleDateString(undefined, {
			weekday: 'short',
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
		const destination =
			(typeof invite.trip.locationCity === 'string' && invite.trip.locationCity.trim()) ||
			(typeof invite.trip.location === 'string' && invite.trip.location.trim()) ||
			'';

		const html = renderTripInviteHtml({
			hostName,
			tripName,
			checkIn,
			checkOut,
			inviteUrl,
			destination
		});
		await sendHtmlEmail({
			to: email,
			subject: `${hostName} invited you to ${tripName}`,
			html,
			templateKey: TEMPLATE_KEYS.TRIP_INVITE,
			tags: [{ name: 'category', value: 'trip-invite' }]
		});
	} catch (error) {
		console.error('Failed to send invite email:', error);
		// Don't throw - invite is still created
	}
}
