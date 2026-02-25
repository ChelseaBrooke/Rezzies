/**
 * Caption This game: rounds, captions, votes, scores.
 * Phase flow: WAITING_FOR_PHOTO → CAPTION_SUBMISSION → VOTING → RESULTS → (next round)
 * Midnight in trip timezone hard-ends CAPTION_SUBMISSION and VOTING.
 */
import { prisma } from '$lib/server/prisma.js';

export type Phase =
	| 'WAITING_FOR_PHOTO'
	| 'CAPTION_SUBMISSION'
	| 'VOTING'
	| 'RESULTS';

const PHASES: Phase[] = [
	'WAITING_FOR_PHOTO',
	'CAPTION_SUBMISSION',
	'VOTING',
	'RESULTS'
];

/** Get day key YYYY-MM-DD in trip timezone for a given date (default now). */
export function getDayKey(tripTimezone: string, date: Date = new Date()): string {
	const formatter = new Intl.DateTimeFormat('en-CA', {
		timeZone: tripTimezone,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit'
	});
	return formatter.format(date); // "YYYY-MM-DD"
}

/** True if the current moment is past midnight (start of next day) in trip timezone for dayKey. */
export function isPastMidnight(tripTimezone: string, dayKey: string): boolean {
	const currentDayKey = getDayKey(tripTimezone, new Date());
	return currentDayKey > dayKey;
}

export type RoundWithDetails = {
	id: string;
	tripId: string;
	dayKey: string;
	phase: Phase;
	photoUrl: string | null;
	photoSubmitterUserId: string | null;
	tripTimezone: string;
	endsAtMidnightTs: Date | null;
	createdAt: Date;
	updatedAt: Date;
	captions: { id: string; text: string; userId: string; voteCount?: number }[];
	votes: { voterUserId: string; captionId: string }[];
};

/** Get the active round (phase !== RESULTS) for the trip, or the latest RESULTS round for display. */
export async function getActiveRound(
	tripId: string,
	tripTimezone: string
): Promise<RoundWithDetails | null> {
	const dayKey = getDayKey(tripTimezone);
	const round = await prisma.captionThisRound.findFirst({
		where: { tripId },
		orderBy: { createdAt: 'desc' },
		include: {
			captions: { select: { id: true, text: true, userId: true } },
			votes: { select: { voterUserId: true, captionId: true } }
		}
	});
	if (!round) return null;
	const r = round as unknown as RoundWithDetails & { captions: { id: string; text: string; userId: string }[]; votes: { voterUserId: string; captionId: string }[] };
	if (r.phase === 'RESULTS') {
		const voteCounts = new Map<string, number>();
		for (const v of r.votes) {
			voteCounts.set(v.captionId, (voteCounts.get(v.captionId) ?? 0) + 1);
		}
		r.captions = r.captions.map((c) => ({
			...c,
			voteCount: voteCounts.get(c.id) ?? 0
		}));
	}
	return r as RoundWithDetails;
}

/** Get or create current round. Returns round in WAITING_FOR_PHOTO or existing active round. */
export async function getOrCreateRound(
	tripId: string,
	tripTimezone: string
): Promise<RoundWithDetails> {
	const existing = await getActiveRound(tripId, tripTimezone);
	if (existing && existing.phase !== 'RESULTS') return existing;
	const dayKey = getDayKey(tripTimezone);
	const round = await prisma.captionThisRound.create({
		data: {
			tripId,
			dayKey,
			phase: 'WAITING_FOR_PHOTO',
			tripTimezone
		},
		include: {
			captions: true,
			votes: true
		}
	});
	return round as unknown as RoundWithDetails;
}

/** Submit photo: set photoUrl and photoSubmitterUserId, move to CAPTION_SUBMISSION. */
export async function submitPhoto(
	roundId: string,
	userId: string,
	photoUrl: string,
	tripId: string
): Promise<{ ok: boolean; error?: string }> {
	const round = await prisma.captionThisRound.findUnique({
		where: { id: roundId },
		select: { id: true, tripId: true, phase: true }
	});
	if (!round || round.tripId !== tripId || round.phase !== 'WAITING_FOR_PHOTO')
		return { ok: false, error: 'Round not found or not waiting for photo' };
	await prisma.captionThisRound.update({
		where: { id: roundId },
		data: {
			photoUrl,
			photoSubmitterUserId: userId,
			phase: 'CAPTION_SUBMISSION'
		}
	});
	return { ok: true };
}

const CAPTION_MAX_LENGTH = 120;

/** Submit caption (user must not be photo submitter). */
export async function submitCaption(
	roundId: string,
	userId: string,
	text: string,
	tripId: string
): Promise<{ ok: boolean; error?: string }> {
	const trimmed = text.trim().slice(0, CAPTION_MAX_LENGTH);
	if (!trimmed) return { ok: false, error: 'Caption is required' };
	const round = await prisma.captionThisRound.findUnique({
		where: { id: roundId },
		select: { id: true, tripId: true, phase: true, photoSubmitterUserId: true }
	});
	if (!round || round.tripId !== tripId)
		return { ok: false, error: 'Round not found' };
	if (round.phase !== 'CAPTION_SUBMISSION')
		return { ok: false, error: 'Caption phase ended' };
	if (round.photoSubmitterUserId === userId)
		return { ok: false, error: 'You submitted the photo — you cannot add a caption this round' };
	await prisma.captionThisCaption.upsert({
		where: {
			roundId_userId: { roundId, userId }
		},
		create: { roundId, userId, text: trimmed },
		update: { text: trimmed, updatedAt: new Date() }
	});
	// Advance to VOTING if everyone who can submit has submitted (so next load shows vote UI for everyone)
	await advancePhaseIfReady(roundId);
	return { ok: true };
}

/** Submit vote (1 per user per round; cannot vote for own caption). Photo submitter may vote during CAPTION_SUBMISSION once there is at least one caption. */
export async function submitVote(
	roundId: string,
	voterUserId: string,
	captionId: string,
	tripId: string
): Promise<{ ok: boolean; error?: string }> {
	const round = await prisma.captionThisRound.findUnique({
		where: { id: roundId },
		include: { captions: true, votes: true }
	});
	if (!round || round.tripId !== tripId)
		return { ok: false, error: 'Round not found' };
	const allowedPhase =
		round.phase === 'VOTING' ||
		(round.phase === 'CAPTION_SUBMISSION' && round.photoSubmitterUserId === voterUserId && round.captions.length > 0);
	if (!allowedPhase)
		return { ok: false, error: 'Round not found or not in voting' };
	const caption = round.captions.find((c) => c.id === captionId);
	if (!caption) return { ok: false, error: 'Caption not found' };
	if (caption.userId === voterUserId)
		return { ok: false, error: 'You cannot vote for your own caption' };
	const existing = round.votes.find((v) => v.voterUserId === voterUserId);
	if (existing) return { ok: false, error: 'You have already voted' };
	await prisma.captionThisVote.create({
		data: { roundId, voterUserId, captionId }
	});
	return { ok: true };
}

/** End round early (photo submitter only): CAPTION_SUBMISSION → VOTING, VOTING → RESULTS. */
export async function endRoundNow(
	roundId: string,
	userId: string,
	tripId: string
): Promise<{ ok: boolean; error?: string }> {
	const round = await prisma.captionThisRound.findUnique({
		where: { id: roundId },
		select: { id: true, tripId: true, phase: true, photoSubmitterUserId: true }
	});
	if (!round || round.tripId !== tripId)
		return { ok: false, error: 'Round not found' };
	if (round.photoSubmitterUserId !== userId)
		return { ok: false, error: 'Only the photo submitter can end the round early' };
	if (round.phase === 'CAPTION_SUBMISSION') {
		await prisma.captionThisRound.update({
			where: { id: roundId },
			data: { phase: 'VOTING' }
		});
		return { ok: true };
	}
	if (round.phase === 'VOTING') {
		await finalizeRoundAndApplyScores(roundId);
		return { ok: true };
	}
	return { ok: false, error: 'Round cannot be ended in current phase' };
}

/** Finalize round: compute scores, update leaderboard, set phase to RESULTS. */
export async function finalizeRoundAndApplyScores(roundId: string): Promise<void> {
	const round = await prisma.captionThisRound.findUnique({
		where: { id: roundId },
		include: { captions: true, votes: true }
	});
	if (!round || round.phase !== 'VOTING') return;
	const voteCountByCaption = new Map<string, number>();
	for (const v of round.votes) {
		voteCountByCaption.set(v.captionId, (voteCountByCaption.get(v.captionId) ?? 0) + 1);
	}
	let maxVotes = 0;
	for (const c of round.captions) {
		const n = voteCountByCaption.get(c.id) ?? 0;
		if (n > maxVotes) maxVotes = n;
	}
	const winnerIds = new Set(
		round.captions.filter((c) => (voteCountByCaption.get(c.id) ?? 0) === maxVotes).map((c) => c.id)
	);
	for (const caption of round.captions) {
		const votes = voteCountByCaption.get(caption.id) ?? 0;
		let points = votes;
		if (winnerIds.has(caption.id) && maxVotes > 0) points += 1;
		if (points > 0) {
			await prisma.captionThisScore.upsert({
				where: {
					tripId_userId: { tripId: round.tripId, userId: caption.userId }
				},
				create: { tripId: round.tripId, userId: caption.userId, pointsTotal: points },
				update: { pointsTotal: { increment: points }, updatedAt: new Date() }
			});
		}
	}
	await prisma.captionThisRound.update({
		where: { id: roundId },
		data: { phase: 'RESULTS' }
	});
}

/** Advance phase based on midnight or "all done" (call from cron or after actions). */
export async function advancePhaseIfReady(roundId: string): Promise<boolean> {
	const round = await prisma.captionThisRound.findUnique({
		where: { id: roundId },
		include: { captions: true, votes: true }
	});
	if (!round || round.phase === 'RESULTS' || round.phase === 'WAITING_FOR_PHOTO') return false;
	const pastMidnight = isPastMidnight(round.tripTimezone, round.dayKey);

	if (round.phase === 'CAPTION_SUBMISSION') {
		const trip = await prisma.trip.findUnique({
			where: { id: round.tripId },
			include: { members: { where: { inviteStatus: 'accepted' }, select: { userId: true } } }
		});
		const eligibleCount = (trip?.members.length ?? 0) - (round.photoSubmitterUserId ? 1 : 0);
		const submittedCount = round.captions.length;
		const allSubmitted = submittedCount >= Math.max(0, eligibleCount);
		if (pastMidnight || allSubmitted) {
			await prisma.captionThisRound.update({
				where: { id: roundId },
				data: { phase: 'VOTING' }
			});
			return true;
		}
	}
	if (round.phase === 'VOTING') {
		const trip = await prisma.trip.findUnique({
			where: { id: round.tripId },
			include: { members: { where: { inviteStatus: 'accepted' }, select: { userId: true } } }
		});
		const voterCount = round.votes.length;
		const allVoted = voterCount >= (trip?.members.length ?? 0);
		if (pastMidnight || allVoted) {
			await finalizeRoundAndApplyScores(roundId);
			return true;
		}
	}
	return false;
}

export type PastRoundSummary = {
	id: string;
	dayKey: string;
	photoUrl: string | null;
	captions: {
		id: string;
		text: string;
		userId: string;
		voteCount: number;
		userName: string | null;
		userAvatarUrl: string | null;
	}[];
};

/** Past completed rounds (RESULTS) for the trip, for "past photos" gallery. Newest first. */
export async function getPastRounds(
	tripId: string,
	limit: number = 20
): Promise<PastRoundSummary[]> {
	const rounds = await prisma.captionThisRound.findMany({
		where: { tripId, phase: 'RESULTS' },
		orderBy: { createdAt: 'desc' },
		take: limit,
		include: {
			captions: {
				select: {
					id: true,
					text: true,
					userId: true,
					user: { select: { name: true, avatarUrl: true } }
				}
			},
			votes: { select: { captionId: true } }
		}
	});
	const result: PastRoundSummary[] = [];
	for (const r of rounds) {
		const voteCountByCaption = new Map<string, number>();
		for (const v of r.votes) {
			voteCountByCaption.set(v.captionId, (voteCountByCaption.get(v.captionId) ?? 0) + 1);
		}
		const captions = r.captions.map((c) => ({
			id: c.id,
			text: c.text,
			userId: c.userId,
			voteCount: voteCountByCaption.get(c.id) ?? 0,
			userName: c.user.name ?? null,
			userAvatarUrl: c.user.avatarUrl ?? null
		}));
		result.push({
			id: r.id,
			dayKey: r.dayKey,
			photoUrl: r.photoUrl,
			captions
		});
	}
	return result;
}

/** Leaderboard: trip members with total points, sorted by points desc. */
export async function getLeaderboard(
	tripId: string
): Promise<{ userId: string; name: string | null; pointsTotal: number; rank: number }[]> {
	const members = await prisma.tripMember.findMany({
		where: { tripId, inviteStatus: 'accepted' },
		include: { user: { select: { id: true, name: true } } }
	});
	const scores = await prisma.captionThisScore.findMany({
		where: { tripId },
		select: { userId: true, pointsTotal: true }
	});
	const scoreMap = new Map(scores.map((s) => [s.userId, s.pointsTotal]));
	const list = members.map((m) => ({
		userId: m.user.id,
		name: m.user.name ?? null,
		pointsTotal: scoreMap.get(m.user.id) ?? 0
	}));
	list.sort((a, b) => b.pointsTotal - a.pointsTotal);
	let rank = 1;
	let prevPoints = -1;
	return list.map((row, i) => {
		if (row.pointsTotal !== prevPoints) rank = i + 1;
		prevPoints = row.pointsTotal;
		return { ...row, rank };
	});
}

export { CAPTION_MAX_LENGTH };
