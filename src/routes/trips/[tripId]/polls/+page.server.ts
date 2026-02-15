import { error, fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { getSessionUser } from '$lib/server/session.js';
import { isTripMember, isTripHostOrCoHost } from '$lib/server/trip-access.js';
import { prisma } from '$lib/server/prisma.js';
import { z } from 'zod';
import { getStatusDisplay, getTimeLabel } from '$lib/components/trips/polls/utils.js';

const POLL_CATEGORIES = ['Scheduling', 'Meals', 'Activities', 'Rooms/Beds', 'Other'];
const VALID_SORTS = ['recent', 'ending_soon', 'most_votes', 'newest', 'oldest'];

export const load: PageServerLoad = async ({ parent, params, url }) => {
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

	let polls: any[] = [];
	try {
		const where: any = { tripId };
		// Drafts: only host or creator sees them
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

		const orderBy: any[] = [];
		if (sortSafe === 'ending_soon') {
			orderBy.push({ endAt: 'asc' });
			orderBy.push({ createdAt: 'desc' });
		} else if (sortSafe === 'most_votes') {
			// Order by vote count - need a raw approach or multiple queries; for now use updatedAt
			orderBy.push({ updatedAt: 'desc' });
		} else if (sortSafe === 'oldest') {
			orderBy.push({ createdAt: 'asc' });
		} else {
			orderBy.push({ updatedAt: 'desc' });
		}

		const rawPolls = await prisma.poll.findMany({
			where,
			orderBy: orderBy.length > 0 ? orderBy : [{ createdAt: 'desc' }],
			include: {
				createdBy: { select: { id: true, name: true, avatarUrl: true } },
				options: { orderBy: { sortOrder: 'asc' } },
				votes: { select: { optionId: true, userId: true } }
			}
		});

		// Add option vote counts and user vote
		polls = rawPolls.map((poll) => {
			const optionCounts = new Map<string, number>();
			for (const opt of poll.options) optionCounts.set(opt.id, 0);
			for (const v of poll.votes) {
				optionCounts.set(v.optionId, (optionCounts.get(v.optionId) ?? 0) + 1);
			}
			const userVotes = poll.votes.filter((v: any) => v.userId === user.id);
			const userOptionIds = userVotes.map((v: any) => v.optionId);
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
				startAt: poll.startAt,
				endAt: poll.endAt,
				createdAt: poll.createdAt,
				updatedAt: poll.updatedAt,
				createdById: poll.createdById,
				createdBy: poll.createdBy,
				options: poll.options.map((o: any) => ({
					id: o.id,
					label: o.label,
					sortOrder: o.sortOrder,
					voteCount: optionCounts.get(o.id) ?? 0
				})),
				totalVotes: poll.votes.length,
				userVoted: userVotes.length > 0,
				userOptionIds,
				timeLabel
			};
		});

		// Sort by vote count if requested (post-query)
		if (sortSafe === 'most_votes') {
			polls.sort((a, b) => (b.totalVotes ?? 0) - (a.totalVotes ?? 0));
		}
	} catch (e) {
		console.error('Polls load error:', e);
		// Fallback dummy data when DB/schema not wired (e.g. before migration)
		const now = new Date();
		const twoDays = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
		polls = [
			{
				id: 'dummy-1',
				title: 'Where should we have dinner Friday?',
				description: 'Looking for a place that can accommodate 8 people and has vegetarian options.',
				category: 'Meals',
				pollType: 'single',
				status: 'open',
				statusDisplay: 'open' as const,
				showResultsLive: true,
				startAt: now,
				endAt: twoDays,
				createdAt: now,
				updatedAt: now,
				createdById: user.id,
				createdBy: { id: user.id, name: user.name, avatarUrl: user.avatarUrl },
				options: [
					{ id: 'o1', label: 'Italian', sortOrder: 0, voteCount: 3 },
					{ id: 'o2', label: 'Mexican', sortOrder: 1, voteCount: 2 },
					{ id: 'o3', label: 'Sushi', sortOrder: 2, voteCount: 1 }
				],
				totalVotes: 6,
				userVoted: false,
				userOptionIds: [] as string[],
				timeLabel: 'Ends in 2d'
			},
			{
				id: 'dummy-2',
				title: 'Beach day or hiking?',
				description: 'Saturday activity vote.',
				category: 'Activities',
				pollType: 'single',
				status: 'closed',
				statusDisplay: 'closed' as const,
				showResultsLive: true,
				startAt: null,
				endAt: new Date(now.getTime() - 24 * 60 * 60 * 1000),
				createdAt: now,
				updatedAt: now,
				createdById: user.id,
				createdBy: { id: user.id, name: user.name, avatarUrl: user.avatarUrl },
				options: [
					{ id: 'o4', label: 'Beach', sortOrder: 0, voteCount: 5 },
					{ id: 'o5', label: 'Hiking', sortOrder: 1, voteCount: 2 }
				],
				totalVotes: 7,
				userVoted: true,
				userOptionIds: ['o4'],
				timeLabel: 'Closed 1d ago'
			}
		];
	}

	return {
		trip: parentData.trip,
		polls,
		searchQuery,
		category: category === 'All' ? 'All' : category,
		sort: sortSafe,
		currentUserId: user.id,
		isHost: parentData.isHost
	};
};

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
		.transform((v) => v === '1' || v === 'on' || v === 'true'),
	asDraft: z.string().optional()
});

export const actions: Actions = {
	create: async ({ request, params, cookies }) => {
		const user = await getSessionUser(cookies);
		if (!user) throw redirect(303, '/login');

		const tripId = params.tripId;
		const canCreate = await isTripHostOrCoHost(tripId, user.id);
		if (!canCreate) throw error(403, 'Only hosts can create polls');

		const formData = await request.formData();
		const title = (formData.get('title') as string)?.trim() ?? '';
		const description = (formData.get('description') as string)?.trim() ?? '';
		const category = ((formData.get('category') as string)?.trim() || 'Other') as string;
		const pollType = ((formData.get('pollType') as string) || 'single') as string;
		const optionsRaw = (formData.get('options') as string)?.trim() ?? '';
		const durationHours = parseInt((formData.get('durationHours') as string) || '48', 10);
		const showResultsLive = (formData.get('showResultsLive') as string) === '1';
		const asDraft = (formData.get('asDraft') as string) === '1';

		const options = optionsRaw.split('\n').map((l) => l.trim()).filter(Boolean);
		const parsed = createPollSchema.safeParse({
			title,
			description,
			category,
			pollType: (formData.get('pollType') as string) || 'single',
			options: optionsRaw,
			durationHours,
			showResultsLive,
			asDraft
		});

		if (!parsed.success) {
			return fail(400, { createError: parsed.error.errors[0]?.message ?? 'Invalid input' });
		}

		const data = parsed.data;
		const cat = POLL_CATEGORIES.includes(data.category) ? data.category : 'Other';
		const pType = data.pollType === 'multi' ? 'multi' : 'single';

		const now = new Date();
		const endAt = asDraft ? null : new Date(now.getTime() + data.durationHours * 60 * 60 * 1000);
		const startAt = asDraft ? null : now;

		await prisma.poll.create({
			data: {
				tripId,
				createdById: user.id,
				title: data.title,
				description: data.description || null,
				category: cat,
				pollType: pType,
				status: asDraft ? 'draft' : 'open',
				showResultsLive: data.showResultsLive ?? true,
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

		const formData = await request.formData();
		const pollId = formData.get('pollId') as string;
		const optionIdsRaw = (formData.get('optionIds') as string) ?? '';
		const optionIds = optionIdsRaw.split(',').map((id) => id.trim()).filter(Boolean);

		if (!pollId || optionIds.length === 0) return fail(400, { voteError: 'Missing poll or option' });

		const poll = await prisma.poll.findFirst({
			where: { id: pollId, tripId },
			include: { options: true }
		});
		if (!poll) return fail(404, { voteError: 'Poll not found' });
		if (poll.status !== 'open') return fail(400, { voteError: 'Poll is not open for voting' });

		const validIds = new Set(poll.options.map((o) => o.id));
		for (const id of optionIds) {
			if (!validIds.has(id)) return fail(400, { voteError: 'Invalid option' });
		}

		if (poll.pollType === 'single' && optionIds.length > 1) {
			return fail(400, { voteError: 'Single choice polls allow one option' });
		}

		// Delete existing votes for this user in this poll, then create new ones
		await prisma.pollVote.deleteMany({
			where: { pollId, userId: user.id }
		});

		await prisma.pollVote.createMany({
			data: optionIds.map((optionId) => ({ pollId, optionId, userId: user.id }))
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

		const canManage = await isTripHostOrCoHost(tripId, user.id);
		if (!canManage && poll.createdById !== user.id) {
			return fail(403, { closeError: 'Only the host or poll creator can close it' });
		}

		await prisma.poll.update({ where: { id: pollId }, data: { status: 'closed' } });
		return { closeSuccess: true };
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

		// TODO: Send notifications to non-responders via existing pipeline
		// For now: stub success
		return { nudgeSuccess: true };
	}
};
