import { describe, it, expect, vi, beforeEach } from 'vitest';

const prismaMock = { invite: { findUnique: vi.fn() } };
vi.mock('./prisma.js', () => ({ prisma: prismaMock }));

const { isInviteValidForTrip, isInviteExpired, hasValidInviteForTrip } = await import(
	'./invite-access.js'
);

describe('isInviteValidForTrip', () => {
	const now = new Date('2026-07-05T12:00:00Z');

	it('returns false when there is no invite', () => {
		expect(isInviteValidForTrip(null, 'trip-1', now)).toBe(false);
		expect(isInviteValidForTrip(undefined, 'trip-1', now)).toBe(false);
	});

	it('returns false when the invite belongs to a different trip', () => {
		const invite = { tripId: 'trip-2', expiresAt: null, status: 'sent' };
		expect(isInviteValidForTrip(invite, 'trip-1', now)).toBe(false);
	});

	it('returns false when the invite has expired', () => {
		const invite = { tripId: 'trip-1', expiresAt: new Date('2026-07-04T00:00:00Z'), status: 'sent' };
		expect(isInviteValidForTrip(invite, 'trip-1', now)).toBe(false);
	});

	it('returns false when the invite was declined', () => {
		const invite = { tripId: 'trip-1', expiresAt: null, status: 'declined' };
		expect(isInviteValidForTrip(invite, 'trip-1', now)).toBe(false);
	});

	it('returns true for a matching invite with no expiry', () => {
		const invite = { tripId: 'trip-1', expiresAt: null, status: 'sent' };
		expect(isInviteValidForTrip(invite, 'trip-1', now)).toBe(true);
	});

	it('returns true for a matching invite that has not expired yet', () => {
		const invite = { tripId: 'trip-1', expiresAt: new Date('2026-07-06T00:00:00Z'), status: 'opened' };
		expect(isInviteValidForTrip(invite, 'trip-1', now)).toBe(true);
	});

	it('treats the expiry boundary as expired (strictly before "now" is invalid, exactly "now" is valid)', () => {
		const invite = { tripId: 'trip-1', expiresAt: now, status: 'sent' };
		expect(isInviteValidForTrip(invite, 'trip-1', now)).toBe(true);
	});

	// SECURITY: a declined token must never authorise anything. It is the one status that
	// looks "used" but is still a live, forwardable string sitting in someone's inbox.
	it('rejects a declined invite whatever else is true of it', () => {
		for (const expiresAt of [null, new Date('2026-12-31T00:00:00Z')]) {
			expect(isInviteValidForTrip({ tripId: 'trip-1', expiresAt, status: 'declined' }, 'trip-1', now)).toBe(
				false
			);
		}
	});

	it('rejects an invite explicitly marked expired even when expiresAt is still in the future', () => {
		const invite = { tripId: 'trip-1', expiresAt: new Date('2026-12-31T00:00:00Z'), status: 'expired' };
		expect(isInviteValidForTrip(invite, 'trip-1', now)).toBe(false);
	});

	it('accepts the statuses that still identify a live invitee', () => {
		for (const status of ['sent', 'opened', 'accepted']) {
			expect(isInviteValidForTrip({ tripId: 'trip-1', expiresAt: null, status }, 'trip-1', now)).toBe(
				true
			);
		}
	});
});

describe('isInviteExpired', () => {
	const now = new Date('2026-07-05T12:00:00Z');

	it('is false for an invite with no expiry', () => {
		expect(isInviteExpired({ expiresAt: null, status: 'sent' }, now)).toBe(false);
	});

	it('is false while expiresAt is still ahead', () => {
		expect(isInviteExpired({ expiresAt: new Date('2026-07-06T00:00:00Z'), status: 'sent' }, now)).toBe(
			false
		);
	});

	it('is true once expiresAt has passed', () => {
		expect(isInviteExpired({ expiresAt: new Date('2026-07-04T00:00:00Z'), status: 'sent' }, now)).toBe(
			true
		);
	});

	// Matches how api/trips/[tripId]/invite-respond/+server.ts already reads this status.
	it('is true when the row is explicitly marked expired', () => {
		expect(isInviteExpired({ expiresAt: null, status: 'expired' }, now)).toBe(true);
	});
});

describe('hasValidInviteForTrip', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('is false for an empty or whitespace token, without touching the database', async () => {
		expect(await hasValidInviteForTrip('', 'trip-1')).toBe(false);
		expect(await hasValidInviteForTrip('   ', 'trip-1')).toBe(false);
		expect(await hasValidInviteForTrip(null, 'trip-1')).toBe(false);
		expect(await hasValidInviteForTrip(undefined, 'trip-1')).toBe(false);
		expect(prismaMock.invite.findUnique).not.toHaveBeenCalled();
	});

	it('is false for a token with no matching row', async () => {
		prismaMock.invite.findUnique.mockResolvedValue(null);
		expect(await hasValidInviteForTrip('nope', 'trip-1')).toBe(false);
	});

	it('is false for a token issued for a different trip', async () => {
		prismaMock.invite.findUnique.mockResolvedValue({
			tripId: 'trip-2',
			expiresAt: null,
			status: 'sent'
		});
		expect(await hasValidInviteForTrip('tok', 'trip-1')).toBe(false);
	});

	it('is false for a declined token', async () => {
		prismaMock.invite.findUnique.mockResolvedValue({
			tripId: 'trip-1',
			expiresAt: null,
			status: 'declined'
		});
		expect(await hasValidInviteForTrip('tok', 'trip-1')).toBe(false);
	});

	it('is true for a live token matching the trip, and looks it up by trimmed token', async () => {
		prismaMock.invite.findUnique.mockResolvedValue({
			tripId: 'trip-1',
			expiresAt: null,
			status: 'sent'
		});
		expect(await hasValidInviteForTrip('  tok  ', 'trip-1')).toBe(true);
		expect(prismaMock.invite.findUnique).toHaveBeenCalledWith(
			expect.objectContaining({ where: { token: 'tok' } })
		);
	});
});
