import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSessionUser } from '$lib/server/session.js';
import { isTripMember } from '$lib/server/trip-access.js';
import { prisma } from '$lib/server/prisma.js';
import { sendGuestApprovedCostShareToHosts } from '$lib/server/notification-service.js';

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

	const inv = await prisma.invoice.findFirst({
		where: { tripId, userId: user.id, status: 'due' },
		select: { totalAmount: true }
	});
	if (!inv) return json({ error: 'No invoice found' }, { status: 400 });

	const cents = Math.round(inv.totalAmount * 100);

	await prisma.rSVP.update({
		where: { tripId_userId: { tripId, userId: user.id } },
		data: {
			costApprovalStatus: 'approved',
			approvedCostShareCents: cents,
			costApprovalMethod: 'self',
			costReapprovalReason: null,
			reApprovalRequiredAt: null,
			reApprovalDeadline: null,
			hostCostApprovalAt: null
		}
	});

	await sendGuestApprovedCostShareToHosts({
		tripId,
		guestUserId: user.id,
		amountCents: cents
	});

	return json({ ok: true, approvedCostShareCents: cents });
};
