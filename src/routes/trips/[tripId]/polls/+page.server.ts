import { error, fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { getSessionUser } from '$lib/server/session.js';
import { isTripMember } from '$lib/server/trip-access.js';
import { prisma } from '$lib/server/prisma.js';
import { z } from 'zod';

export const load: PageServerLoad = async ({ parent, params, url }) => {
	const parentData = await parent();
	const user = parentData.user;
	if (!user) throw redirect(303, `/login?redirect=/trips/${params.tripId}/polls`);

	const tripId = params.tripId;
	const member = await isTripMember(tripId, user.id);
	if (!member) throw error(403, 'You must be a member of this trip to view polls');

	const filter = (url.searchParams.get('filter') ?? 'all') as string;
	const validFilters = ['all', 'active', 'closed', 'mine'];
	const filterSafe = validFilters.includes(filter) ? filter : 'all';

	const polls = await prisma.poll.findMany({
		where: {
			tripId,
			...(filterSafe === 'active' && { status: 'active' }),
			...(filterSafe === 'closed' && { status: 'closed' }),
			...(filterSafe === 'mine' && { createdById: user.id })
		},
		orderBy: { createdAt: 'desc' },
		include: {
			createdBy: { select: { id: true, name: true, avatarUrl: true } },
			options: { orderBy: { order: 'asc' } },
			votes: { select: { optionId: true, userId: true } }
		}
	});

	// For each poll, add option vote counts and whether current user voted
	const pollsWithMeta = polls.map((poll) => {
		const optionCounts = new Map<string, number>();
		for (const opt of poll.options) optionCounts.set(opt.id, 0);
		for (const v of poll.votes) optionCounts.set(v.optionId, (optionCounts.get(v.optionId) ?? 0) + 1);
		const userVote = poll.votes.find((v) => v.userId === user.id);
		return {
			id: poll.id,
			question: poll.question,
			status: poll.status,
			createdAt: poll.createdAt,
			createdBy: poll.createdBy,
			createdById: poll.createdById,
			options: poll.options.map((o) => ({
				id: o.id,
				label: o.label,
				order: o.order,
				voteCount: optionCounts.get(o.id) ?? 0
			})),
			totalVotes: poll.votes.length,
			userVoted: !!userVote,
			userOptionId: userVote?.optionId ?? null
		};
	});

	return {
		trip: parentData.trip,
		polls: pollsWithMeta,
		filter: filterSafe,
		currentUserId: user.id
	};
};

const createPollSchema = z.object({
	question: z.string().min(1, 'Question is required').max(500),
	options: z
		.string()
		.min(1, 'Add at least one option')
		.refine((s) => s.split('\n').filter((l) => l.trim()).length >= 2, 'Add at least 2 options')
});

export const actions: Actions = {
	create: async ({ request, params, cookies }) => {
		const user = await getSessionUser(cookies);
		if (!user) throw redirect(303, '/login');

		const tripId = params.tripId;
		if (!(await isTripMember(tripId, user.id))) throw error(403, 'Must be a trip member to create polls');

		const formData = await request.formData();
		const question = (formData.get('question') as string)?.trim() ?? '';
		const optionsRaw = (formData.get('options') as string)?.trim() ?? '';
		const options = optionsRaw.split('\n').map((l) => l.trim()).filter(Boolean);

		const parsed = createPollSchema.safeParse({ question, options: optionsRaw });
		if (!parsed.success) {
			return fail(400, { createError: parsed.error.errors[0]?.message ?? 'Invalid input' });
		}

		await prisma.poll.create({
			data: {
				tripId,
				createdById: user.id,
				question,
				options: {
					create: options.map((label, order) => ({ label, order }))
				}
			}
		});

		return { createSuccess: true };
	},

	vote: async ({ request, params, cookies }) => {
		const user = await getSessionUser(cookies);
		if (!user) throw redirect(303, '/login');

		const tripId = params.tripId;
		if (!(await isTripMember(tripId, user.id))) throw error(403, 'Must be a trip member to vote');

		const formData = await request.formData();
		const pollId = formData.get('pollId') as string;
		const optionId = formData.get('optionId') as string;
		if (!pollId || !optionId) return fail(400, { voteError: 'Missing poll or option' });

		const poll = await prisma.poll.findFirst({
			where: { id: pollId, tripId },
			include: { options: true }
		});
		if (!poll) return fail(404, { voteError: 'Poll not found' });
		if (poll.status !== 'active') return fail(400, { voteError: 'Poll is closed' });
		if (!poll.options.some((o) => o.id === optionId)) return fail(400, { voteError: 'Invalid option' });

		await prisma.pollVote.upsert({
			where: { pollId_userId: { pollId, userId: user.id } },
			create: { pollId, optionId, userId: user.id },
			update: { optionId }
		});

		return { voteSuccess: true };
	},

	close: async ({ request, params, cookies }) => {
		const user = await getSessionUser(cookies);
		if (!user) throw redirect(303, '/login');

		const tripId = params.tripId;
		if (!(await isTripMember(tripId, user.id))) throw error(403, 'Must be a trip member');

		const formData = await request.formData();
		const pollId = formData.get('pollId') as string;
		if (!pollId) return fail(400, { closeError: 'Missing poll' });

		const poll = await prisma.poll.findFirst({ where: { id: pollId, tripId } });
		if (!poll) return fail(404, { closeError: 'Poll not found' });
		// Only creator (or we could allow host) can close
		if (poll.createdById !== user.id) return fail(403, { closeError: 'Only the poll creator can close it' });

		await prisma.poll.update({ where: { id: pollId }, data: { status: 'closed' } });
		return { closeSuccess: true };
	}
};
