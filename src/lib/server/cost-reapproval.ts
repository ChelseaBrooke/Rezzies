import { prisma } from './prisma.js';
import { sendCostShareReapprovalToGuest } from './notification-service.js';

function reApprovalDeadlineFromTripStart(checkInDate: Date | null): Date {
	const base = checkInDate ? new Date(checkInDate) : new Date();
	base.setHours(0, 0, 0, 0);
	return new Date(base.getTime() - 48 * 60 * 60 * 1000);
}

export function formatReapprovalDeadline(d: Date): string {
	return d.toLocaleString('en-US', {
		weekday: 'short',
		month: 'short',
		day: 'numeric',
		hour: 'numeric',
		minute: '2-digit',
		hour12: true
	});
}

/**
 * After invoices change, mark guests who need cost re-approval and notify them.
 * Idempotent: guests already `pending` are skipped.
 */
export async function evaluateCostReapprovalForTrip(
	tripId: string,
	opts?: { reason?: string | null }
): Promise<void> {
	const trip = await prisma.trip.findUnique({
		where: { id: tripId },
		select: { costSharingEnabled: true, checkInDate: true, name: true }
	});
	if (!trip?.costSharingEnabled) return;

	const reasonFromCaller = opts?.reason?.trim() || null;
	const deadline = reApprovalDeadlineFromTripStart(trip.checkInDate);

	const yesRsvps = await prisma.rSVP.findMany({
		where: { tripId, status: 'yes' },
		select: {
			userId: true,
			costApprovalStatus: true,
			originalRangeMinCents: true,
			originalRangeMaxCents: true,
			approvedCostShareCents: true,
			acceptedEstimateLowCents: true,
			acceptedEstimateHighCents: true
		}
	});

	const invoices = await prisma.invoice.findMany({
		where: { tripId, status: 'due' },
		select: { userId: true, totalAmount: true }
	});
	const amountByUser = new Map(invoices.map((i) => [i.userId, i.totalAmount]));

	for (const r of yesRsvps) {
		if (r.costApprovalStatus === 'pending') continue;

		const invAmt = amountByUser.get(r.userId);
		if (invAmt == null) continue;
		const currentCents = Math.round(invAmt * 100);

		const origMax = r.originalRangeMaxCents ?? r.acceptedEstimateHighCents;
		const origMin = r.originalRangeMinCents ?? r.acceptedEstimateLowCents;
		if (origMax == null) continue;

		const ceiling = r.approvedCostShareCents ?? origMax;
		if (currentCents <= ceiling) continue;

		const reason = reasonFromCaller ?? "The group's cost split has changed";

		await prisma.rSVP.update({
			where: { tripId_userId: { tripId, userId: r.userId } },
			data: {
				costApprovalStatus: 'pending',
				reApprovalRequiredAt: new Date(),
				reApprovalDeadline: deadline,
				costReapprovalReason: reason
			}
		});

		await prisma.notification.create({
			data: {
				userId: r.userId,
				type: 'cost_share_reapproval',
				title: 'Cost share updated',
				message: `Your share for "${trip.name}" has changed. Tap to review and re-confirm.`,
				relatedTripId: tripId
			}
		});

		await sendCostShareReapprovalToGuest({
			tripId,
			userId: r.userId,
			tripName: trip.name,
			originalLowCents: origMin ?? 0,
			originalHighCents: origMax,
			newShareCents: currentCents,
			reason,
			deadline,
			reminder: false
		});
	}
}
