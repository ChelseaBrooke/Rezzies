import type { PageServerLoad } from './$types';
import { prisma } from '$lib/server/prisma.js';

export const load: PageServerLoad = async () => {
	const submissions = await prisma.guestSubmission.findMany({
		include: {
			room: true,
			bed: true
		},
		orderBy: {
			submittedAt: 'desc'
		}
	});

	const rooms = await prisma.room.findMany({
		include: {
			beds: true,
			submissions: true
		},
		orderBy: {
			id: 'asc'
		}
	});

	return {
		submissions,
		rooms
	};
};

