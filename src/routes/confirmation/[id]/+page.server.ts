import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { prisma } from '$lib/server/prisma.js';

export const load: PageServerLoad = async ({ params }) => {
	const submission = await prisma.guestSubmission.findUnique({
		where: { id: params.id },
		include: {
			room: true,
			bed: true
		}
	});

	if (!submission) {
		throw error(404, 'Submission not found');
	}

	return {
		submission
	};
};

