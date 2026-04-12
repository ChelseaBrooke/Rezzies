import type { Prisma } from '@prisma/client';
import { prisma } from '$lib/server/prisma.js';

const pollActivityInclude = {
	options: true,
	votes: true
} satisfies Prisma.PollInclude;

export type PollWithOptionsAndVotes = Prisma.PollGetPayload<{ include: typeof pollActivityInclude }>;

/** After a poll is closed: if it was an activity poll from Discover and "Add to itinerary" won, create the activity. Idempotent. */
export async function maybeCreateActivityFromClosedPoll(poll: PollWithOptionsAndVotes): Promise<void> {
	const p = poll;
	if (p.category !== 'Activities') return;
	const activityDate =
		p.activityDate != null ? (p.activityDate instanceof Date ? p.activityDate : new Date(p.activityDate)) : null;
	if (!activityDate || isNaN(activityDate.getTime())) return;
	const norm = (s: string) => (s ?? '').trim().toLowerCase();
	const addOption = p.options.find((o) => norm(o.label) === 'add to itinerary');
	const skipOption = p.options.find((o) => norm(o.label) === 'skip');
	if (!addOption || !skipOption) return;
	const addVotes = p.votes.filter((v) => v.optionId === addOption.id).length;
	const skipVotes = p.votes.filter((v) => v.optionId === skipOption.id).length;
	if (addVotes < skipVotes || addVotes === 0) return;
	const activityTitle = p.title.startsWith('Activity: ')
		? p.title.slice('Activity: '.length).trim()
		: p.title;
	const dayStart = new Date(activityDate);
	dayStart.setUTCHours(0, 0, 0, 0);
	const dayEnd = new Date(dayStart);
	dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);
	const existing = await prisma.activity.findFirst({
		where: {
			tripId: p.tripId,
			title: activityTitle,
			date: { gte: dayStart, lt: dayEnd }
		}
	});
	if (existing) return;
	const activity = await prisma.activity.create({
		data: {
			tripId: p.tripId,
			title: activityTitle,
			date: activityDate,
			time: p.activityTime ?? null,
			location: p.activityLocation ?? null,
			notes: p.description ?? null,
			status: 'planned'
		}
	});
	await prisma.activityParticipant.create({
		data: { activityId: activity.id, userId: p.createdById, status: 'in' }
	});
}

/** Close expired open polls for one trip and repair itinerary-from-poll rows. Call from mutations, not page load. */
export async function maintainPollsForTrip(tripId: string): Promise<void> {
	const now = new Date();
	const expired = await prisma.poll.findMany({
		where: { tripId, status: 'open', endAt: { lt: now } },
		include: pollActivityInclude
	});
	for (const poll of expired) {
		await prisma.poll.update({ where: { id: poll.id }, data: { status: 'closed' } });
		try {
			await maybeCreateActivityFromClosedPoll(poll);
		} catch (err) {
			console.error('[polls] maintainPollsForTrip: activity from expired poll', poll.id, err);
		}
	}
	const closedActivityPolls = await prisma.poll.findMany({
		where: { tripId, status: 'closed', category: 'Activities', activityDate: { not: null } },
		include: pollActivityInclude
	});
	for (const poll of closedActivityPolls) {
		try {
			await maybeCreateActivityFromClosedPoll(poll);
		} catch (err) {
			console.error('[polls] maintainPollsForTrip: repair closed poll', poll.id, err);
		}
	}
}

/** Global maintenance for cron: close expired open polls and create itinerary rows when applicable. */
export async function maintainAllPolls(): Promise<{ expiredClosed: number }> {
	const now = new Date();
	const expired = await prisma.poll.findMany({
		where: { status: 'open', endAt: { lt: now } },
		include: pollActivityInclude
	});
	for (const poll of expired) {
		await prisma.poll.update({ where: { id: poll.id }, data: { status: 'closed' } });
		try {
			await maybeCreateActivityFromClosedPoll(poll);
		} catch (err) {
			console.error('[polls] cron: activity from expired poll', poll.id, err);
		}
	}
	return { expiredClosed: expired.length };
}
