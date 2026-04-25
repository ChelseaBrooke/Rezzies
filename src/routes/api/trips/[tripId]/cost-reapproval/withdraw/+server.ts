import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSessionUser } from '$lib/server/session.js';
import { isTripMember } from '$lib/server/trip-access.js';
import { prisma } from '$lib/server/prisma.js';
import { handleSpotOpened } from '$lib/server/waitlist-service.js';
import { createInvoiceForUser } from '$lib/server/invoice-calculator.js';
import { evaluateCostReapprovalForTrip } from '$lib/server/cost-reapproval.js';

export const POST: RequestHandler = async ({ params, cookies }) => {
	const user = await getSessionUser(cookies);
	if (!user) return json({ error: 'Unauthorized' }, { status: 401 });

	const tripId = params.tripId;
	if (!(await isTripMember(tripId, user.id))) {
		return json({ error: 'Forbidden' }, { status: 403 });
	}

	const rsvp = await prisma.rSVP.findUnique({
		where: { tripId_userId: { tripId, userId: user.id } },
		select: { costApprovalStatus: true, status: true }
	});
	if (rsvp?.status !== 'yes' || rsvp.costApprovalStatus !== 'pending') {
		return json({ error: 'No pending cost re-approval' }, { status: 400 });
	}

	const [trip, guestUser] = await Promise.all([
		prisma.trip.findUnique({
			where: { id: tripId },
			select: { name: true }
		}),
		prisma.user.findUnique({
			where: { id: user.id },
			select: { name: true }
		})
	]);

	await prisma.$transaction([
		prisma.roomAssignment.deleteMany({ where: { tripId, userId: user.id } }),
		prisma.rSVP.update({
			where: { tripId_userId: { tripId, userId: user.id } },
			data: {
				status: 'no',
				costCommitmentAccepted: null,
				rsvpYesAcceptedAt: null,
				yesSubstatus: null,
				acceptedEstimateLowCents: null,
				acceptedEstimateHighCents: null,
				acceptedHeadcountMin: null,
				acceptedHeadcountMax: null,
				acceptedCostBasisVersion: null,
				reconfirmRequiredAt: null,
				reconfirmDeadlineAt: null,
				latestEstimateLowCents: null,
				latestEstimateHighCents: null,
				latestEstimateUpdatedAt: null,
				originalRangeMinCents: null,
				originalRangeMaxCents: null,
				approvedCostShareCents: null,
				costApprovalStatus: 'approved',
				costApprovalMethod: null,
				costReapprovalReason: null,
				reApprovalRequiredAt: null,
				reApprovalDeadline: null,
				hostCostApprovalAt: null
			}
		}),
		prisma.tripMember.update({
			where: { tripId_userId: { tripId, userId: user.id } },
			data: { inviteStatus: 'denied' }
		})
	]);

	await handleSpotOpened(tripId).catch(console.error);

	const assignees = await prisma.roomAssignment.findMany({
		where: { tripId },
		select: { userId: true },
		distinct: ['userId']
	});
	await Promise.allSettled(assignees.map((a) => createInvoiceForUser(tripId, a.userId)));

	const yesCount = await prisma.rSVP.count({ where: { tripId, status: 'yes' } });
	const guestName = guestUser?.name ?? 'A guest';
	await evaluateCostReapprovalForTrip(tripId, {
		reason: `A guest backed out of "${trip?.name ?? 'the trip'}", which affected the cost split.`
	}).catch(console.error);

	const hosts = await prisma.tripMember.findMany({
		where: { tripId, inviteStatus: 'approved', role: { in: ['host', 'co-host'] } },
		select: { userId: true }
	});
	for (const h of hosts) {
		await prisma.notification.create({
			data: {
				userId: h.userId,
				type: 'guest_backed_out_cost',
				title: 'Guest backed out',
				message: `${guestName} backed out of "${trip?.name ?? 'the trip'}". Headcount is now ${yesCount}.`,
				relatedTripId: tripId
			}
		});
	}

	// TODO: transactional email to hosts when email template for back-out is added

	return json({
		ok: true,
		redirect: `/trips/${tripId}/denied?from=cost-reapproval`
	});
};
