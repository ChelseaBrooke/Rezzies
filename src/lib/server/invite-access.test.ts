import { describe, it, expect } from 'vitest';
import { isInviteValidForTrip } from './invite-access.js';

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
});
