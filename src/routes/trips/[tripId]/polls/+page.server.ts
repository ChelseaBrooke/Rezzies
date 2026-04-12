import { error, fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import type { Prisma } from '@prisma/client';
import { getSessionUser } from '$lib/server/session.js';
import { isTripMember, isTripHostOrCoHost } from '$lib/server/trip-access.js';
import { prisma } from '$lib/server/prisma.js';
import { z } from 'zod';
import { getStatusDisplay, getTimeLabel } from '$lib/components/trips/polls/utils.js';
import type { PollWithMeta } from '$lib/components/trips/polls/types.js';
import {
	maintainPollsForTrip,
	maybeCreateActivityFromClosedPoll
} from '$lib/server/poll-maintenance.js';

const POLL_CATEGORIES = ['Scheduling', 'Meals', 'Activities', 'Rooms/Beds', 'Other'];
const VALID_SORTS = ['recent', 'ending_soon', 'most_votes', 'newest', 'oldest'];

const pollListInclude = {
	createdBy: { select: { id: true, name: true, avatarUrl: true } },
	options: { orderBy: { sortOrder: 'asc' } },
	votes: { select: { optionId: true, userId: true } },
	watchers: { select: { userId: true } }
} satisfies Prisma.PollInclude;

type PollListRow = Prisma.PollGetPayload<{ include: typeof pollListInclude }>;

export const load: PageServerLoad = async ({ parent, params, url, cookies }) => {
	const parentData = await parent();
	const user = parentData.user;
	if (!user) throw redirect(303, `/login?redirect=/trips/${params.tripId}/polls`);

	const tripId = params.tripId;
	const member = await isTripMember(tripId, user.id);
	if (!member) throw error(403, 'You must be a member of this trip to view polls');

	const searchQuery = (url.searchParams.get('q') ?? '').trim();
	const category = url.searchParams.get('category') ?? 'All';
	const sort = (url.searchParams.get('sort') ?? 'recent') as string;
	const sortSafe = VALID_SORTS.includes(sort) ? sort : 'recent';

	let polls: PollWithMeta[] = [];
	let pollsLoadError = false;

	try {
		const where: Prisma.PollWhereInput = { tripId };
		const isHost = await isTripHostOrCoHost(tripId, user.id);
		if (!isHost) {
			where.status = { in: ['open', 'closed', 'canceled'] };
		}
		if (category !== 'All') {
			where.category = category;
		}
		if (searchQuery) {
			where.OR = [
				{ title: { contains: searchQuery, mode: 'insensitive' } },
				{ description: { contains: searchQuery, mode: 'insensitive' } }
			];
		}

		const orderBy: Prisma.PollOrderByWithRelationInput[] = [];
		if (sortSafe === 'ending_soon') {
			orderBy.push({ endAt: 'asc' });
			orderBy.push({ createdAt: 'desc' });
		} else if (sortSafe === 'most_votes') {
			orderBy.push({ updatedAt: 'desc' });
		} else if (sortSafe === 'oldest') {
			orderBy.push({ createdAt: 'asc' });
		} else {
			orderBy.push({ updatedAt: 'desc' });
		}

		const rawPolls = await prisma.poll.findMany({
			where,
			orderBy: orderBy.length > 0 ? orderBy : [{ createdAt: 'desc' }],
			include: pollListInclude
		});

		polls = rawPolls.map((poll) => mapPollToClient(poll, user.id) as PollWithMeta);

		if (sortSafe === 'most_votes') {
			polls.sort((a, b) => (b.totalVotes ?? 0) - (a.totalVotes ?? 0));
		}
	} catch (e) {
		console.error('Polls load error:', e);
		pollsLoadError = true;
		polls = [];
	}

	cookies.set(`polls_visit_${tripId}`, new Date().toISOString(), {
		path: '/',
		maxAge: 60 * 60 * 24 * 365,
		sameSite: 'lax'
	});

	return {
		trip: parentData.trip,
		polls,
		pollsLoadError,
		searchQuery,
		category: category === 'All' ? 'All' : category,
		sort: sortSafe,
		currentUserId: user.id,
		isHost: parentData.isHost
	};
};

function mapPollToClient(poll: PollListRow, currentUserId: string) {
	const optionCounts = new Map<string, number>();
	for (const opt of poll.options) optionCounts.set(opt.id, 0);
	for (const v of poll.votes) {
		optionCounts.set(v.optionId, (optionCounts.get(v.optionId) ?? 0) + 1);
	}
	const userVotes = poll.votes.filter((v) => v.userId === currentUserId);
	const userOptionIds = userVotes.map((v) => v.optionId);
	const statusDisplay = getStatusDisplay(poll.status, poll.endAt);
	const timeLabel = getTimeLabel(poll.status, poll.endAt);
	return {
		id: poll.id,
		title: poll.title,
		description: poll.description,
		category: poll.category ?? 'Other',
		pollType: poll.pollType ?? 'single',
		status: poll.status,
		statusDisplay,
		showResultsLive: poll.showResultsLive ?? true,
		allowAnonymous: poll.allowAnonymous ?? false,
		startAt: poll.startAt,
		endAt: poll.endAt,
		createdAt: poll.createdAt,
		updatedAt: poll.updatedAt,
		createdById: poll.createdById,
		createdBy: poll.createdBy,
		activityDate: poll.activityDate ?? null,
		activityTime: poll.activityTime ?? null,
		activityLocation: poll.activityLocation ?? null,
		activitySnapshot: (poll.activitySnapshot as Record<string, unknown> | null) ?? null,
		options: poll.options.map((o) => ({
			id: o.id,
			label: o.label,
			sortOrder: o.sortOrder,
			voteCount: optionCounts.get(o.id) ?? 0
		})),
		totalVotes: poll.votes.length,
		userVoted: userVotes.length > 0,
		userOptionIds,
		timeLabel,
		userWatching: poll.watchers.some((w) => w.userId === currentUserId),
		watcherCount: poll.watchers.length
	};
}

const createPollSchema = z.object({
	title: z.string().min(1, 'Title is required').max(500),
	description: z.string().optional(),
	category: z.enum(POLL_CATEGORIES as [string, ...string[]]).optional().default('Other'),
	pollType: z.enum(['single', 'multi']).optional().default('single'),
	options: z
		.string()
		.min(1, 'Add at least one option')
		.refine((s) => s.split('\n').map((l) => l.trim()).filter(Boolean).length >= 2, 'Add at least 2 options'),
	durationHours: z.coerce.number().min(24).max(168).optional().default(48),
	showResultsLive: z
		.string()
		.optional()
		.transform((v) => v === '1' || v === 'on' || v === 'true')
});

export const actions: Actions = {
	create: async ({ request, params, cookies }) => {
		const user = await getSessionUser(cookies);
		if (!user) throw redirect(303, '/login');

		const tripId = params.tripId;
		if (!(await isTripMember(tripId, user.id))) throw error(403, 'Must be a trip member to create polls');

		await maintainPollsForTrip(tripId);

		const formData = await request.formData();
		const title = (formData.get('title') as string)?.trim() ?? '';
		const description = (formData.get('description') as string)?.trim() ?? '';
		const category = ((formData.get('category') as string)?.trim() || 'Other') as string;
		const optionsRaw = (formData.get('options') as string)?.trim() ?? '';
		const durationHours = parseInt((formData.get('durationHours') as string) || '48', 10);
		const showResultsLiveRaw = formData.get('showResultsLive');

		const options = optionsRaw.split('\n').map((l) => l.trim()).filter(Boolean);
		const parsed = createPollSchema.safeParse({
			title,
			description,
			category,
			pollType: (formData.get('pollType') as string) || 'single',
			options: optionsRaw,
			durationHours,
			showResultsLive: typeof showResultsLiveRaw === 'string' ? showResultsLiveRaw : undefined
		});

		if (!parsed.success) {
			return fail(400, { createError: parsed.error.errors[0]?.message ?? 'Invalid input' });
		}

		const data = parsed.data;
		const cat = POLL_CATEGORIES.includes(data.category) ? data.category : 'Other';
		const pType = data.pollType === 'multi' ? 'multi' : 'single';

		const allowAnonRaw = formData.get('allowAnonymous');
		const allowAnonymous = allowAnonRaw === '1' || allowAnonRaw === 'on' || allowAnonRaw === 'true';

		const now = new Date();
		const endAt = new Date(now.getTime() + data.durationHours * 60 * 60 * 1000);
		const startAt = now;

		await prisma.poll.create({
			data: {
				tripId,
				createdById: user.id,
				title: data.title,
				description: data.description || null,
				category: cat,
				pollType: pType,
				status: 'open',
				showResultsLive: data.showResultsLive ?? true,
				allowAnonymous,
				startAt,
				endAt,
				options: {
					create: options.map((label, i) => ({ label, sortOrder: i }))
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

		await maintainPollsForTrip(tripId);

		const formData = await request.formData();
		const pollId = formData.get('pollId') as string;
		const optionIdsRaw = (formData.get('optionIds') as string) ?? '';
		const optionIds = [...new Set(optionIdsRaw.split(',').map((id) => id.trim()).filter(Boolean))];

		if (!pollId || optionIds.length === 0) return fail(400, { voteError: 'Missing poll or option' });

		const poll = await prisma.poll.findFirst({
			where: { id: pollId, tripId },
			include: { options: true }
		});
		if (!poll) return fail(404, { voteError: 'Poll not found' });
		if (poll.status !== 'open') return fail(400, { voteError: 'Poll is not open for voting' });
		if (poll.endAt && poll.endAt.getTime() <= Date.now()) {
			return fail(400, { voteError: 'This poll has ended' });
		}

		const validIds = new Set(poll.options.map((o) => o.id));
		for (const id of optionIds) {
			if (!validIds.has(id)) return fail(400, { voteError: 'Invalid option' });
		}

		if (poll.pollType === 'single' && optionIds.length > 1) {
			return fail(400, { voteError: 'Single choice polls allow one option' });
		}

		await prisma.$transaction(async (tx) => {
			await tx.pollVote.deleteMany({
				where: { pollId, userId: user.id }
			});
			await tx.pollVote.createMany({
				data: optionIds.map((optionId) => ({ pollId, optionId, userId: user.id })),
				skipDuplicates: true
			});
		});

		return { voteSuccess: true };
	},

	close: async ({ request, params, cookies }) => {
		const user = await getSessionUser(cookies);
		if (!user) throw redirect(303, '/login');

		const tripId = params.tripId;
		if (!(await isTripMember(tripId, user.id))) throw error(403, 'Must be a trip member');

		await maintainPollsForTrip(tripId);

		const formData = await request.formData();
		const pollId = formData.get('pollId') as string;
		if (!pollId) return fail(400, { closeError: 'Missing poll' });

		const poll = await prisma.poll.findFirst({
			where: { id: pollId, tripId },
			include: { options: true, votes: true }
		});
		if (!poll) return fail(404, { closeError: 'Poll not found' });

		const canManage = await isTripHostOrCoHost(tripId, user.id);
		if (!canManage && poll.createdById !== user.id) {
			return fail(403, { closeError: 'Only the host or poll creator can close it' });
		}

		if (poll.status === 'closed') {
			return { closeSuccess: true };
		}

		await prisma.poll.update({ where: { id: pollId }, data: { status: 'closed' } });
		try {
			await maybeCreateActivityFromClosedPoll(poll);
		} catch (err) {
			console.error('Polls close: failed to create activity from poll', pollId, err);
		}

		return { closeSuccess: true };
	},

	watch: async ({ request, params, cookies }) => {
		const user = await getSessionUser(cookies);
		if (!user) throw redirect(303, '/login');

		const tripId = params.tripId;
		if (!(await isTripMember(tripId, user.id))) throw error(403, 'Must be a trip member');

		await maintainPollsForTrip(tripId);

		const formData = await request.formData();
		const pollId = formData.get('pollId') as string;
		if (!pollId) return fail(400, { watchError: 'Missing poll' });

		const existing = await prisma.pollWatcher.findUnique({
			where: { pollId_userId: { pollId, userId: user.id } }
		});

		if (existing) {
			await prisma.pollWatcher.delete({ where: { id: existing.id } });
			return { watchSuccess: true, watching: false };
		}
		await prisma.pollWatcher.create({ data: { pollId, userId: user.id } });
		return { watchSuccess: true, watching: true };
	},

	nudge: async ({ request, params, cookies }) => {
		const user = await getSessionUser(cookies);
		if (!user) throw redirect(303, '/login');

		const tripId = params.tripId;
		const canManage = await isTripHostOrCoHost(tripId, user.id);
		if (!canManage) throw error(403, 'Only hosts can nudge');

		const formData = await request.formData();
		const pollId = formData.get('pollId') as string;
		if (!pollId) return fail(400, { nudgeError: 'Missing poll' });

		const poll = await prisma.poll.findFirst({ where: { id: pollId, tripId } });
		if (!poll) return fail(404, { nudgeError: 'Poll not found' });
		if (poll.status !== 'open') return fail(400, { nudgeError: 'Poll is not open' });
		if (poll.endAt && poll.endAt.getTime() <= Date.now()) {
			return fail(400, { nudgeError: 'This poll has ended' });
		}

		// TODO: Send notifications to non-responders via existing pipeline
		return { nudgeSuccess: true };
	}
};
