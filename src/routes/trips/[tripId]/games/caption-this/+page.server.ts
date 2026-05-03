import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { prisma } from '$lib/server/prisma.js';
import { ensureTripGamesEnabled } from '$lib/server/trip-games-guard.js';
import {
	getActiveRound,
	getOrCreateRound,
	submitPhoto as submitPhotoGame,
	removePhoto as removePhotoGame,
	submitCaption as submitCaptionGame,
	submitVote as submitVoteGame,
	endRoundNow,
	advancePhaseIfReady,
	getLeaderboard,
	CAPTION_MAX_LENGTH
} from '$lib/server/caption-this.js';

export const load: PageServerLoad = async ({ parent, params }) => {
	ensureTripGamesEnabled(params.tripId);
	const { trip, user } = await parent();
	const tripId = params.tripId;
	if (!trip || !user || trip.id !== tripId) {
		return { round: null, leaderboard: [], currentUserId: null, captionMaxLength: CAPTION_MAX_LENGTH };
	}
	const tripTimezone = trip.timezone ?? 'UTC';
	let round = await getActiveRound(tripId, tripTimezone);
	if (!round) {
		round = await getOrCreateRound(tripId, tripTimezone);
	} else if (round.phase !== 'RESULTS') {
		await advancePhaseIfReady(round.id);
		round = await getActiveRound(tripId, tripTimezone) ?? round;
	}
	const leaderboard = await getLeaderboard(tripId);
	let eligibleCaptionCount = 0;
	if (round?.phase === 'CAPTION_SUBMISSION') {
		const memberCount = await prisma.tripMember.count({
			where: { tripId, inviteStatus: 'approved' }
		});
		eligibleCaptionCount = round.photoSubmitterUserId ? memberCount - 1 : memberCount;
	}
	return {
		round,
		leaderboard,
		currentUserId: user.id,
		tripTimezone,
		captionMaxLength: CAPTION_MAX_LENGTH,
		eligibleCaptionCount
	};
};

export const actions: Actions = {
	submitPhoto: async ({ request, params, parent }) => {
		ensureTripGamesEnabled(params.tripId);
		const { user, trip } = await parent();
		const tripId = params.tripId;
		if (!user || !trip || trip.id !== tripId) return fail(403, { error: 'Unauthorized' });
		const formData = await request.formData();
		const roundId = formData.get('roundId') as string | null;
		const photoUrl = formData.get('photoUrl') as string | null;
		if (!roundId || !photoUrl) return fail(400, { error: 'Missing roundId or photo' });
		const result = await submitPhotoGame(roundId, user.id, photoUrl, tripId);
		if (!result.ok) return fail(400, { error: result.error });
		return { success: true };
	},

	removePhoto: async ({ request, params, parent }) => {
		ensureTripGamesEnabled(params.tripId);
		const { user, trip } = await parent();
		const tripId = params.tripId;
		if (!user || !trip || trip.id !== tripId) return fail(403, { error: 'Unauthorized' });
		const formData = await request.formData();
		const roundId = formData.get('roundId') as string | null;
		if (!roundId) return fail(400, { error: 'Missing roundId' });
		const result = await removePhotoGame(roundId, user.id, tripId);
		if (!result.ok) return fail(400, { error: result.error });
		return { success: true };
	},

	submitCaption: async ({ request, params, parent }) => {
		ensureTripGamesEnabled(params.tripId);
		const { user, trip } = await parent();
		const tripId = params.tripId;
		if (!user || !trip || trip.id !== tripId) return fail(403, { error: 'Unauthorized' });
		const formData = await request.formData();
		const roundId = formData.get('roundId') as string | null;
		const text = formData.get('text') as string | null;
		if (!roundId || text === null) return fail(400, { error: 'Missing roundId or text' });
		const result = await submitCaptionGame(roundId, user.id, text ?? '', tripId);
		if (!result.ok) return fail(400, { error: result.error });
		return { success: true };
	},

	submitVote: async ({ request, params, parent }) => {
		ensureTripGamesEnabled(params.tripId);
		const { user, trip } = await parent();
		const tripId = params.tripId;
		if (!user || !trip || trip.id !== tripId) return fail(403, { error: 'Unauthorized' });
		const formData = await request.formData();
		const roundId = formData.get('roundId') as string | null;
		const captionId = formData.get('captionId') as string | null;
		if (!roundId || !captionId) return fail(400, { error: 'Missing roundId or captionId' });
		const result = await submitVoteGame(roundId, user.id, captionId, tripId);
		if (!result.ok) return fail(400, { error: result.error });
		return { success: true };
	},

	endRoundNow: async ({ request, params, parent }) => {
		ensureTripGamesEnabled(params.tripId);
		const { user, trip } = await parent();
		const tripId = params.tripId;
		if (!user || !trip || trip.id !== tripId) return fail(403, { error: 'Unauthorized' });
		const formData = await request.formData();
		const roundId = formData.get('roundId') as string | null;
		if (!roundId) return fail(400, { error: 'Missing roundId' });
		const result = await endRoundNow(roundId, user.id, tripId);
		if (!result.ok) return fail(400, { error: result.error });
		return { success: true };
	},

	startNextRound: async ({ params, parent }) => {
		ensureTripGamesEnabled(params.tripId);
		const { user, trip } = await parent();
		const tripId = params.tripId;
		if (!user || !trip || trip.id !== tripId) return fail(403, { error: 'Unauthorized' });
		await getOrCreateRound(tripId, trip.timezone ?? 'UTC');
		// Full navigation keeps client state in sync and matches the games/ embed behavior.
		throw redirect(303, `/trips/${tripId}/games/caption-this`);
	}
};
