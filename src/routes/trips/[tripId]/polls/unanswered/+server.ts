import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSessionUser } from '$lib/server/session.js';
import { isTripMember } from '$lib/server/trip-access.js';
import { prisma } from '$lib/server/prisma.js';

export type UnansweredPollItem = {
	id: string;
	title: string;
	pollType: string;
	options: Array<{ id: string; label: string }>;
};

/** GET: Unanswered open polls for the current user on this trip. Sorted by createdAt ASC. */
export const GET: RequestHandler = async ({ params, cookies }) => {
	const user = await getSessionUser(cookies);
	if (!user) {
		return json({ polls: [] }, { status: 200 });
	}

	const tripId = params.tripId;
	const member = await isTripMember(tripId, user.id);
	if (!member) {
		return json({ polls: [] }, { status: 200 });
	}

	// Polls that are open and that this user has not voted on
	const pollsWithVotes = await prisma.poll.findMany({
		where: {
			tripId,
			status: 'open'
		},
		orderBy: { createdAt: 'asc' },
		include: {
			options: { orderBy: { sortOrder: 'asc' } },
			votes: { where: { userId: user.id }, select: { id: true } }
		}
	});

	const polls: UnansweredPollItem[] = pollsWithVotes
		.filter((p) => !p.votes || p.votes.length === 0)
		.map((p) => ({
			id: p.id,
			title: p.title,
			pollType: p.pollType ?? 'single',
			options: p.options.map((o) => ({ id: o.id, label: o.label }))
		}));

	return json({ polls });
};
