import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { getSessionUser } from '$lib/server/session.js';
import { prisma } from '$lib/server/prisma.js';

export const load: PageServerLoad = async ({ params, cookies }) => {
	const token = params.token;

	// Find invite
	const invite = await prisma.invite.findUnique({
		where: { token },
		include: {
			trip: {
				select: {
					id: true,
					name: true,
					description: true,
					listingCoverPhoto: true,
					checkInDate: true,
					checkOutDate: true,
					location: true
				}
			}
		}
	});

	if (!invite) {
		throw error(404, 'Invite not found');
	}

	// Check if expired
	if (invite.expiresAt && invite.expiresAt < new Date()) {
		throw error(410, 'This invite has expired');
	}

	// Get current user if logged in
	const user = await getSessionUser(cookies);

	// Check if user is already a member
	let isMember = false;
	if (user) {
		const membership = await prisma.tripMember.findUnique({
			where: {
				tripId_userId: {
					tripId: invite.tripId,
					userId: user.id
				}
			}
		});
		isMember = membership?.inviteStatus === 'accepted';
	}

	return {
		invite,
		trip: invite.trip,
		user,
		isMember
	};
};

export const actions: Actions = {
	accept: async ({ params, cookies }) => {
		const user = await getSessionUser(cookies);
		if (!user) {
			throw redirect(303, `/login?redirect=/invite/${params.token}`);
		}

		const token = params.token;

		// Find invite
		const invite = await prisma.invite.findUnique({
			where: { token }
		});

		if (!invite) {
			throw error(404, 'Invite not found');
		}

		if (invite.expiresAt && invite.expiresAt < new Date()) {
			throw error(410, 'This invite has expired');
		}

		// Check if already a member
		const existingMember = await prisma.tripMember.findUnique({
			where: {
				tripId_userId: {
					tripId: invite.tripId,
					userId: user.id
				}
			}
		});

		if (existingMember) {
			// Update status to accepted
			await prisma.tripMember.update({
				where: { id: existingMember.id },
				data: { inviteStatus: 'accepted' }
			});
		} else {
			// Create new membership
			await prisma.tripMember.create({
				data: {
					tripId: invite.tripId,
					userId: user.id,
					role: 'guest',
					inviteStatus: 'accepted'
				}
			});
		}

		// Update invite status
		await prisma.invite.update({
			where: { id: invite.id },
			data: { status: 'accepted' }
		});

		// TODO: Create notification for host

		throw redirect(303, `/trips/${invite.tripId}`);
	}
};
