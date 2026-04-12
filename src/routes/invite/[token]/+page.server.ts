import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { prisma } from '$lib/server/prisma.js';

// Email invite links now redirect to the trip's join page.
// The invite token is used only to discover the tripId.
export const load: PageServerLoad = async ({ params }) => {
	const token = params.token;

	const invite = await prisma.invite.findUnique({
		where: { token },
		select: { tripId: true, expiresAt: true, status: true }
	});

	if (!invite) {
		throw error(404, 'Invite not found');
	}

	if (invite.expiresAt && invite.expiresAt < new Date()) {
		throw error(410, 'This invite link has expired');
	}

	// Land on the trip page in invite preview mode (limited access before RSVP / join).
	throw redirect(303, `/trips/${invite.tripId}?invite=${encodeURIComponent(token)}`);
};

