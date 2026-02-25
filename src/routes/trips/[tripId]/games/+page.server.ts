import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { prisma } from '$lib/server/prisma.js';
import { getSessionUser } from '$lib/server/session.js';
import { isTripMember } from '$lib/server/trip-access.js';
import {
	getActiveRound,
	getOrCreateRound,
	submitPhoto as submitPhotoCaptionThis,
	submitCaption as submitCaptionCaptionThis,
	submitVote as submitVoteCaptionThis,
	endRoundNow as endRoundNowCaptionThis,
	advancePhaseIfReady,
	getLeaderboard,
	CAPTION_MAX_LENGTH
} from '$lib/server/caption-this.js';

export const load: PageServerLoad = async ({ parent, url, params }) => {
	const parentData = await parent();
	const trip = parentData.trip;
	const user = parentData.user;
	const membership = parentData.membership;
	const tripId = params.tripId;

	const isHost = membership?.role === 'host';
	const isCoHost = membership?.role === 'co-host';
	const canRemoveGames = isHost;
	const tabParam = url.searchParams.get('tab');

	// Caption This: load round + leaderboard for inline game viewer
	let captionThis = {
		round: null as Awaited<ReturnType<typeof getActiveRound>>,
		leaderboard: [] as Awaited<ReturnType<typeof getLeaderboard>>,
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
		const leaderboard = await getLeaderboard(tripId);
		let eligibleCaptionCount = 0;
		if (round?.phase === 'CAPTION_SUBMISSION') {
			const memberCount = await prisma.tripMember.count({
				where: { tripId, inviteStatus: 'accepted' }
			});
			eligibleCaptionCount = round.photoSubmitterUserId ? memberCount - 1 : memberCount;
		}
		captionThis = {
			round,
			leaderboard,
			currentUserId: user.id,
			tripTimezone,
			captionMaxLength: CAPTION_MAX_LENGTH,
			eligibleCaptionCount
		};
	}

	return {
		trip,
		user,
		isHost,
		isCoHost,
		canRemoveGames,
		tabParam,
		captionThis
	};
};

export const actions: Actions = {
	submitPhoto: async ({ request, params, cookies }) => {
		const user = await getSessionUser(cookies);
		if (!user) return fail(403, { error: 'Unauthorized' });
		const tripId = params.tripId;
		if (!(await isTripMember(tripId, user.id))) return fail(403, { error: 'Unauthorized' });
		const formData = await request.formData();
		const roundId = formData.get('roundId') as string | null;
		const photoUrl = formData.get('photoUrl') as string | null;
		const activeTab = (formData.get('activeTab') as string | null)?.trim() || null;
		if (!roundId || !photoUrl) return fail(400, { error: 'Missing roundId or photo' });
		const result = await submitPhotoCaptionThis(roundId, user.id, photoUrl, tripId);
		if (!result.ok) return fail(400, { error: result.error });
		if (activeTab) throw redirect(303, `/trips/${tripId}/games?tab=${encodeURIComponent(activeTab)}`);
		return { success: true };
	},
	submitCaption: async ({ request, params, cookies }) => {
		const user = await getSessionUser(cookies);
		if (!user) return fail(403, { error: 'Unauthorized' });
		const tripId = params.tripId;
		if (!(await isTripMember(tripId, user.id))) return fail(403, { error: 'Unauthorized' });
		const formData = await request.formData();
		const roundId = formData.get('roundId') as string | null;
		const text = formData.get('text') as string | null;
		const activeTab = (formData.get('activeTab') as string | null)?.trim() || null;
		if (!roundId || text === null) return fail(400, { error: 'Missing roundId or text' });
		const result = await submitCaptionCaptionThis(roundId, user.id, text ?? '', tripId);
		if (!result.ok) return fail(400, { error: result.error });
		if (activeTab) throw redirect(303, `/trips/${tripId}/games?tab=${encodeURIComponent(activeTab)}`);
		return { success: true };
	},
	submitVote: async ({ request, params, cookies }) => {
		const user = await getSessionUser(cookies);
		if (!user) return fail(403, { error: 'Unauthorized' });
		const tripId = params.tripId;
		if (!(await isTripMember(tripId, user.id))) return fail(403, { error: 'Unauthorized' });
		const formData = await request.formData();
		const roundId = formData.get('roundId') as string | null;
		const captionId = formData.get('captionId') as string | null;
		const activeTab = (formData.get('activeTab') as string | null)?.trim() || null;
		if (!roundId || !captionId) return fail(400, { error: 'Missing roundId or captionId' });
		const result = await submitVoteCaptionThis(roundId, user.id, captionId, tripId);
		if (!result.ok) return fail(400, { error: result.error });
		if (activeTab) throw redirect(303, `/trips/${tripId}/games?tab=${encodeURIComponent(activeTab)}`);
		return { success: true };
	},
	endRoundNow: async ({ request, params, cookies }) => {
		const user = await getSessionUser(cookies);
		if (!user) return fail(403, { error: 'Unauthorized' });
		const tripId = params.tripId;
		if (!(await isTripMember(tripId, user.id))) return fail(403, { error: 'Unauthorized' });
		const formData = await request.formData();
		const roundId = formData.get('roundId') as string | null;
		const activeTab = (formData.get('activeTab') as string | null)?.trim() || null;
		if (!roundId) return fail(400, { error: 'Missing roundId' });
		const result = await endRoundNowCaptionThis(roundId, user.id, tripId);
		if (!result.ok) return fail(400, { error: result.error });
		if (activeTab) throw redirect(303, `/trips/${tripId}/games?tab=${encodeURIComponent(activeTab)}`);
		return { success: true };
	},
	startNextRound: async ({ request, params, cookies }) => {
		const user = await getSessionUser(cookies);
		if (!user) return fail(403, { error: 'Unauthorized' });
		const tripId = params.tripId;
		if (!(await isTripMember(tripId, user.id))) return fail(403, { error: 'Unauthorized' });
		const formData = await request.formData();
		const activeTab = (formData.get('activeTab') as string | null)?.trim() || null;
		const trip = await prisma.trip.findUnique({
			where: { id: tripId },
			select: { timezone: true }
		});
		await getOrCreateRound(tripId, trip?.timezone ?? 'UTC');
		if (activeTab) throw redirect(303, `/trips/${tripId}/games?tab=${encodeURIComponent(activeTab)}`);
		return { success: true };
	}
};
