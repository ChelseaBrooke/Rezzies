import { prisma } from './prisma.js';
import { sendTemplateEmail } from './email/sendgrid.js';

export async function createInvite(
	tripId: string,
	invitedByUserId: string,
	channel: 'email' | 'sms' | 'app',
	recipientEmail?: string,
	recipientPhone?: string,
	recipientUserId?: string
) {
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
			recipientUserId: recipientUserId || null,
			expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
		},
		include: {
			trip: {
				select: {
					id: true,
					name: true,
					checkInDate: true,
					checkOutDate: true,
					location: true
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
		// Use SendGrid to send invite email
		// For now, use a simple email template
		const hostName = invite.invitedBy.name || invite.invitedBy.email;
		const tripName = invite.trip.name;
		const checkIn = invite.trip.checkInDate.toLocaleDateString();
		const checkOut = invite.trip.checkOutDate.toLocaleDateString();

		// TODO: Create a proper SendGrid template for invites
		// For now, use a simple text email
		await sendTemplateEmail({
			to: email,
			templateKey: 'TRIP_INVITE',
			dynamicTemplateData: {
				hostName,
				tripName,
				checkIn,
				checkOut,
				inviteUrl
			}
		});
	} catch (error) {
		console.error('Failed to send invite email:', error);
		// Don't throw - invite is still created
	}
}
