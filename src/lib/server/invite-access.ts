import { prisma } from './prisma.js';

export type InviteRecordForAccessCheck = {
	tripId: string;
	expiresAt: Date | null;
	status: string;
};

/**
 * Pure guard: is this invite record usable to access `tripId` right now?
 * Requires the invite to exist, match the trip, not be expired, and not have been declined.
 * Kept side-effect-free (no DB access) so the membership/token guard logic is unit-testable
 * without mocking Prisma.
 */
export function isInviteValidForTrip(
	invite: InviteRecordForAccessCheck | null | undefined,
	tripId: string,
	now: Date = new Date()
): boolean {
	if (!invite) return false;
	if (invite.tripId !== tripId) return false;
	if (invite.expiresAt && invite.expiresAt < now) return false;
	if (invite.status === 'declined') return false;
	return true;
}

/**
 * Looks up an invite by token and reports whether it's currently valid for the given trip.
 * Used as the "alternate path" past a publish/membership gate: a guest holding a genuine,
 * unexpired invite for this exact trip should never be 404'd off the join flow, even if the
 * trip is still a draft (hosts can send invites before finishing publish).
 */
export async function hasValidInviteForTrip(
	token: string | null | undefined,
	tripId: string
): Promise<boolean> {
	const trimmed = token?.trim();
	if (!trimmed) return false;

	const invite = await prisma.invite.findUnique({
		where: { token: trimmed },
		select: { tripId: true, expiresAt: true, status: true }
	});

	return isInviteValidForTrip(invite, tripId);
}
