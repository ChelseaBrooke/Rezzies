import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { prisma } from '$lib/server/prisma.js';

export const load: PageServerLoad = async ({ params }) => {
	const reservation = await prisma.reservation.findUnique({
		where: { id: params.id },
		include: {
			trip: true,
			room: true,
			bed: true
		}
	});

	if (!reservation) {
		throw redirect(303, '/');
	}

	return {
		reservation
	};
};
