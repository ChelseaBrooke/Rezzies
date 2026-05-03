import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { prisma } from '$lib/server/prisma.js';
import { getSessionUser } from '$lib/server/session.js';
import { isTripMember, isTripHost } from '$lib/server/trip-access.js';
import {
	getActiveRound,
	getOrCreateRound,
	getPastRounds,
	submitPhoto as submitPhotoCaptionThis,
	removePhoto as removePhotoCaptionThis,
	submitCaption as submitCaptionCaptionThis,
	submitVote as submitVoteCaptionThis,
	endRoundNow as endRoundNowCaptionThis,
	advancePhaseIfReady,
	getLeaderboard,
	CAPTION_MAX_LENGTH
} from '$lib/server/caption-this.js';
import { ensureTripGamesEnabled } from '$lib/server/trip-games-guard.js';

const VALID_CATALOG_GAME_IDS = ['scavenger-bingo', 'caption-this', 'alphabet-hunt', 'daily-trivia'] as const;

export const load: PageServerLoad = async ({ parent, url, params }) => {
	ensureTripGamesEnabled(params.tripId);
	const parentData = await parent();
	const trip = parentData.trip;
	const user = parentData.user;
	const membership = parentData.membership;
	const tripId = params.tripId;

	const isHost = membership?.role === 'host';
	const isCoHost = membership?.role === 'co-host';
	const canRemoveGames = isHost;
	const tabParam = url.searchParams.get('tab');
	// New redesign: ?game=<gameId> (e.g. scavenger-bingo) routes into individual game views
	const gameParam = url.searchParams.get('game');

	// Fetch trip games here so we always have fresh data after add-game redirect (layout may not re-run)
	const tripGamesRows = trip
		? await prisma.tripGame.findMany({
				where: { tripId },
				orderBy: { createdAt: 'asc' }
			})
		: [];
	const tripGames = tripGamesRows.map((g) => ({
		id: g.id,
		gameId: g.gameId,
		name: g.name,
		addedByUserId: g.addedByUserId,
		addedAt: g.createdAt.toISOString()
	}));

	/* ?game= must match a catalog id and a row on this trip (published trips seed all games). */
	if (
		gameParam &&
		(!VALID_CATALOG_GAME_IDS.includes(gameParam as (typeof VALID_CATALOG_GAME_IDS)[number]) ||
			!tripGames.some((g) => g.gameId === gameParam))
	) {
		throw redirect(303, `/trips/${tripId}/games`);
	}

	// Caption This: load round + leaderboard + past rounds for inline game viewer
	let captionThis = {
		round: null as Awaited<ReturnType<typeof getActiveRound>>,
		leaderboard: [] as Awaited<ReturnType<typeof getLeaderboard>>,
		pastRounds: [] as Awaited<ReturnType<typeof getPastRounds>>,
		currentUserId: null as string | null,
		tripTimezone: 'UTC',
		captionMaxLength: CAPTION_MAX_LENGTH,
		eligibleCaptionCount: 0
	};
	if (trip && user && trip.id === tripId) {
		const tripTimezone = trip.timezone ?? 'UTC';
		let round = await getActiveRound(tripId, tripTimezone);
		if (!round) {
			round = await getOrCreateRound(tripId, tripTimezone);
		} else if (round.phase !== 'RESULTS') {
			await advancePhaseIfReady(round.id);
			round = (await getActiveRound(tripId, tripTimezone)) ?? round;
		}
		const [leaderboard, pastRounds] = await Promise.all([
			getLeaderboard(tripId),
			getPastRounds(tripId)
		]);
		let eligibleCaptionCount = 0;
		if (round?.phase === 'CAPTION_SUBMISSION') {
			const memberCount = await prisma.tripMember.count({
				where: { tripId, inviteStatus: 'approved' }
			});
			eligibleCaptionCount = round.photoSubmitterUserId ? memberCount - 1 : memberCount;
		}
		captionThis = {
			round,
			leaderboard,
			pastRounds,
			currentUserId: user.id,
			tripTimezone,
			captionMaxLength: CAPTION_MAX_LENGTH,
			eligibleCaptionCount
		};
	}

	// Members for leaderboard / player lists
	const members = (trip?.members ?? []).map((m: { user?: { id?: string; name?: string | null } | null; role?: string }) => ({
		userId: m.user?.id ?? '',
		name: m.user?.name ?? null,
	}));

	return {
		trip,
		user,
		isHost,
		isCoHost,
		canRemoveGames,
		tabParam,
		gameParam,
		tripGames,
		captionThis,
		members
	};
};

export const actions: Actions = {
	submitPhoto: async ({ request, params, cookies }) => {
		ensureTripGamesEnabled(params.tripId);
		const user = await getSessionUser(cookies);
		if (!user) return fail(403, { error: 'Unauthorized' });
		const tripId = params.tripId;
		if (!(await isTripMember(tripId, user.id))) return fail(403, { error: 'Unauthorized' });
		const formData = await request.formData();
		const roundId = formData.get('roundId') as string | null;
		const photoUrl = formData.get('photoUrl') as string | null;
		if (!roundId || !photoUrl) return fail(400, { error: 'Missing roundId or photo' });
		const result = await submitPhotoCaptionThis(roundId, user.id, photoUrl, tripId);
		if (!result.ok) return fail(400, { error: result.error });
		return { success: true };
	},
	removePhoto: async ({ request, params, cookies }) => {
		ensureTripGamesEnabled(params.tripId);
		const user = await getSessionUser(cookies);
		if (!user) return fail(403, { error: 'Unauthorized' });
		const tripId = params.tripId;
		if (!(await isTripMember(tripId, user.id))) return fail(403, { error: 'Unauthorized' });
		const formData = await request.formData();
		const roundId = formData.get('roundId') as string | null;
		if (!roundId) return fail(400, { error: 'Missing roundId' });
		const result = await removePhotoCaptionThis(roundId, user.id, tripId);
		if (!result.ok) return fail(400, { error: result.error });
		return { success: true };
	},
	submitCaption: async ({ request, params, cookies }) => {
		ensureTripGamesEnabled(params.tripId);
		const user = await getSessionUser(cookies);
		if (!user) return fail(403, { error: 'Unauthorized' });
		const tripId = params.tripId;
		if (!(await isTripMember(tripId, user.id))) return fail(403, { error: 'Unauthorized' });
		const formData = await request.formData();
		const roundId = formData.get('roundId') as string | null;
		const text = formData.get('text') as string | null;
		if (!roundId || text === null) return fail(400, { error: 'Missing roundId or text' });
		const result = await submitCaptionCaptionThis(roundId, user.id, text ?? '', tripId);
		if (!result.ok) return fail(400, { error: result.error });
		return { success: true };
	},
	submitVote: async ({ request, params, cookies }) => {
		ensureTripGamesEnabled(params.tripId);
		const user = await getSessionUser(cookies);
		if (!user) return fail(403, { error: 'Unauthorized' });
		const tripId = params.tripId;
		if (!(await isTripMember(tripId, user.id))) return fail(403, { error: 'Unauthorized' });
		const formData = await request.formData();
		const roundId = formData.get('roundId') as string | null;
		const captionId = formData.get('captionId') as string | null;
		if (!roundId || !captionId) return fail(400, { error: 'Missing roundId or captionId' });
		const result = await submitVoteCaptionThis(roundId, user.id, captionId, tripId);
		if (!result.ok) return fail(400, { error: result.error });
		return { success: true };
	},
	endRoundNow: async ({ request, params, cookies }) => {
		ensureTripGamesEnabled(params.tripId);
		const user = await getSessionUser(cookies);
		if (!user) return fail(403, { error: 'Unauthorized' });
		const tripId = params.tripId;
		if (!(await isTripMember(tripId, user.id))) return fail(403, { error: 'Unauthorized' });
		const formData = await request.formData();
		const roundId = formData.get('roundId') as string | null;
		if (!roundId) return fail(400, { error: 'Missing roundId' });
		const result = await endRoundNowCaptionThis(roundId, user.id, tripId);
		if (!result.ok) return fail(400, { error: result.error });
		throw redirect(303, `/trips/${tripId}/games?game=caption-this`);
	},
	startNextRound: async ({ params, cookies }) => {
		ensureTripGamesEnabled(params.tripId);
		const user = await getSessionUser(cookies);
		if (!user) return fail(403, { error: 'Unauthorized' });
		const tripId = params.tripId;
		if (!(await isTripMember(tripId, user.id))) return fail(403, { error: 'Unauthorized' });
		const trip = await prisma.trip.findUnique({
			where: { id: tripId },
			select: { timezone: true }
		});
		await getOrCreateRound(tripId, trip?.timezone ?? 'UTC');
		throw redirect(303, `/trips/${tripId}/games?game=caption-this`);
	},

	addTripGame: async ({ request, params, cookies }) => {
		ensureTripGamesEnabled(params.tripId);
		const user = await getSessionUser(cookies);
		if (!user) return fail(403, { error: 'Unauthorized' });
		const tripId = params.tripId;
		if (!(await isTripMember(tripId, user.id))) return fail(403, { error: 'Unauthorized' });
		const formData = await request.formData();
		const gameId = (formData.get('gameId') as string | null)?.trim();
		const name = (formData.get('name') as string | null)?.trim();
		if (!gameId || !name) return fail(400, { error: 'Missing gameId or name' });
		if (!VALID_CATALOG_GAME_IDS.includes(gameId as (typeof VALID_CATALOG_GAME_IDS)[number]))
			return fail(400, { error: 'Invalid game' });
		const existing = await prisma.tripGame.findUnique({
			where: { tripId_gameId: { tripId, gameId } }
		});
		if (existing) return fail(400, { error: 'Game already added' });
		const newGame = await prisma.tripGame.create({
			data: { tripId, gameId, name, addedByUserId: user.id }
		});
		throw redirect(303, `/trips/${tripId}/games?game=${encodeURIComponent(gameId)}`);
	},

	removeTripGame: async ({ request, params, cookies }) => {
		ensureTripGamesEnabled(params.tripId);
		const user = await getSessionUser(cookies);
		if (!user) return fail(403, { error: 'Unauthorized' });
		const tripId = params.tripId;
		if (!(await isTripHost(tripId, user.id))) return fail(403, { error: 'Only the host can remove games' });
		const formData = await request.formData();
		const tripGameId = (formData.get('tripGameId') as string | null)?.trim();
		if (!tripGameId) return fail(400, { error: 'Missing tripGameId' });
		await prisma.tripGame.deleteMany({
			where: { id: tripGameId, tripId }
		});
		throw redirect(303, `/trips/${tripId}/games`);
	}
};
