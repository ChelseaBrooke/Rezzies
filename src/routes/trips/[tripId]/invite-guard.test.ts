/**
 * B1 regression tests — the invite link must never dead-end, and must never over-share.
 *
 * These drive the real `load` functions of the trip layout guard and the join page with
 * Prisma and the session helper mocked, so the guard's routing decisions are covered end
 * to end without a database.
 *
 * Two of these pin security behaviours that code review caught during B1 and that must
 * not regress — they are marked SECURITY below:
 *   1. a *declined* invite must not open the anonymous preview (guest PII leak)
 *   2. the /join branch must be gated on published-or-valid-invite (trip metadata leak)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isHttpError, isRedirect } from '@sveltejs/kit';

const prismaMock = {
	invite: { findUnique: vi.fn() },
	trip: { findUnique: vi.fn() },
	tripMember: { findUnique: vi.fn(), count: vi.fn(), findMany: vi.fn() },
	rSVP: { findUnique: vi.fn(), count: vi.fn() },
	user: { findUnique: vi.fn() },
	tripGame: { findMany: vi.fn() },
	poll: { findMany: vi.fn(), count: vi.fn() },
	tripFile: { findMany: vi.fn() },
	household: { findUnique: vi.fn() }
};

vi.mock('$lib/server/prisma.js', () => ({ prisma: prismaMock }));
vi.mock('$lib/server/trip-access.js', () => ({
	getUserTripMembership: vi.fn(),
	getUserTrips: vi.fn(async () => ({ ownedTrips: [], invitedTrips: [], allTrips: [] }))
}));
vi.mock('$lib/server/pricing-canonical.js', () => ({
	computeCommittedFundsFromYesRsvps: vi.fn(async () => 0),
	getCostAtMaxParticipation: vi.fn(async () => null)
}));
vi.mock('$lib/server/session.js', () => ({ getSessionUser: vi.fn(async () => null) }));
vi.mock('$lib/server/notification-service.js', () => ({ sendGuestJoinedEmail: vi.fn() }));

const { load: layoutLoad } = await import('./+layout.server.js');
const { load: joinLoad } = await import('./join/+page.server.js');
const { getUserTripMembership } = await import('$lib/server/trip-access.js');
const { getSessionUser } = await import('$lib/server/session.js');

const TRIP_ID = 'trip-abc';
const TOKEN = 'tok-fresh';
const GUEST = { id: 'user-guest', name: 'Ada', email: 'ada@example.com' };

const FRESH_INVITE = {
	tripId: TRIP_ID,
	status: 'sent',
	expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
};
const DECLINED_INVITE = { ...FRESH_INVITE, status: 'declined' };

/** A trip the host has not paid to publish yet — the state that produced the 404. */
function draftTripPreviewRow() {
	return {
		id: TRIP_ID,
		name: 'Cabin Weekend',
		description: null,
		listingCoverPhoto: null,
		checkInDate: new Date('2026-10-01'),
		checkOutDate: new Date('2026-10-04'),
		location: 'Tahoe',
		locationCity: 'Tahoe City',
		activitiesEnabled: true,
		gamesEnabled: false,
		isPublished: false,
		members: [],
		rsvps: [],
		_count: { mealSlots: 2, activities: 1, tripGames: 0 }
	};
}

/** The slim row the layout hands the join page. */
function joinTripRow(isPublished: boolean) {
	return {
		id: TRIP_ID,
		name: 'Cabin Weekend',
		checkInDate: new Date('2026-10-01'),
		checkOutDate: new Date('2026-10-04'),
		listingCoverPhoto: null,
		locationCity: 'Tahoe City',
		isPublished
	};
}

function makeCookies(initial: Record<string, string> = {}) {
	const jar = new Map(Object.entries(initial));
	return {
		jar,
		get: (name: string) => jar.get(name),
		set: (name: string, value: string) => jar.set(name, value),
		delete: (name: string) => jar.delete(name)
	};
}

function makeEvent(opts: {
	pathname: string;
	search?: string;
	user?: typeof GUEST | null;
	cookies?: ReturnType<typeof makeCookies>;
}) {
	const url = new URL(`http://localhost${opts.pathname}${opts.search ?? ''}`);
	return {
		params: { tripId: TRIP_ID },
		url,
		cookies: opts.cookies ?? makeCookies(),
		locals: { user: opts.user ?? null }
	};
}

/** Run a load and describe how it finished, so redirects/errors are assertable. */
async function run(
	loadFn: (event: never) => unknown,
	event: unknown
): Promise<
	| { outcome: 'data'; data: Record<string, unknown> }
	| { outcome: 'redirect'; location: string }
	| { outcome: 'error'; status: number }
> {
	try {
		const data = (await loadFn(event as never)) as Record<string, unknown>;
		return { outcome: 'data', data };
	} catch (thrown) {
		if (isRedirect(thrown)) return { outcome: 'redirect', location: thrown.location };
		if (isHttpError(thrown)) return { outcome: 'error', status: thrown.status };
		throw thrown;
	}
}

beforeEach(() => {
	vi.clearAllMocks();
	prismaMock.tripMember.count.mockResolvedValue(0);
	prismaMock.rSVP.findUnique.mockResolvedValue(null);
	prismaMock.rSVP.count.mockResolvedValue(0);
	prismaMock.user.findUnique.mockResolvedValue({ dismissedTooltips: [] });
	prismaMock.tripGame.findMany.mockResolvedValue([]);
	prismaMock.poll.findMany.mockResolvedValue([]);
	prismaMock.poll.count.mockResolvedValue(0);
	prismaMock.tripFile.findMany.mockResolvedValue([]);
	prismaMock.household.findUnique.mockResolvedValue(null);
	prismaMock.tripMember.findMany.mockResolvedValue([]);
});

describe('trip layout guard — logged-out invitee', () => {
	it('previews the trip instead of 404ing, even while the trip is a draft', async () => {
		prismaMock.invite.findUnique.mockResolvedValue(FRESH_INVITE);
		prismaMock.trip.findUnique.mockResolvedValue(draftTripPreviewRow());

		const result = await run(
			layoutLoad,
			makeEvent({ pathname: `/trips/${TRIP_ID}`, search: `?invite=${TOKEN}`, user: null })
		);

		expect(result.outcome).toBe('data');
		if (result.outcome !== 'data') return;
		expect(result.data.invitePreview).toBe(true);
		expect(result.data.inviteToken).toBe(TOKEN);
		expect(result.data.user).toBeNull();
	});

	it('hands the preview no membership, no host powers and no money data', async () => {
		prismaMock.invite.findUnique.mockResolvedValue(FRESH_INVITE);
		prismaMock.trip.findUnique.mockResolvedValue(draftTripPreviewRow());

		const result = await run(
			layoutLoad,
			makeEvent({ pathname: `/trips/${TRIP_ID}`, search: `?invite=${TOKEN}`, user: null })
		);

		expect(result.outcome).toBe('data');
		if (result.outcome !== 'data') return;
		expect(result.data.membership).toBeNull();
		expect(result.data.isHost).toBe(false);
		expect(result.data.isCoHost).toBe(false);
		expect(result.data.canChat).toBe(false);
		expect(result.data.costAtMaxParticipation).toBeNull();
		expect(result.data.committedFundsFromYesRsvps).toBe(0);
		const trip = result.data.trip as Record<string, unknown>;
		expect(trip.rooms).toEqual([]);
		expect(trip.invoices).toEqual([]);
		expect(trip.invites).toEqual([]);
		expect(trip.totalCost).toBe(0);
		expect(trip.fullAddress).toBeNull();
		expect(trip.houseRules).toBeNull();
	});

	/**
	 * SECURITY (review finding, must not regress): the preview payload carries guest PII —
	 * names, emails and avatars of everyone who RSVP'd yes. A declined invite is still a
	 * live, forwardable string in someone's inbox, so it must buy nothing.
	 */
	it('refuses a declined invite and never runs the preview query', async () => {
		prismaMock.invite.findUnique.mockResolvedValue(DECLINED_INVITE);
		const cookies = makeCookies({ [`trip_invite_${TRIP_ID}`]: TOKEN });

		const result = await run(
			layoutLoad,
			makeEvent({ pathname: `/trips/${TRIP_ID}`, search: `?invite=${TOKEN}`, user: null, cookies })
		);

		expect(result.outcome).toBe('redirect');
		if (result.outcome !== 'redirect') return;
		expect(result.location).toContain('/login');
		// No preview row was ever fetched, so no guest PII was assembled.
		expect(prismaMock.trip.findUnique).not.toHaveBeenCalled();
		// And the stale token is dropped so it can't be replayed from the cookie.
		expect(cookies.jar.has(`trip_invite_${TRIP_ID}`)).toBe(false);
	});

	it('still 404s when the trip row itself is gone', async () => {
		prismaMock.invite.findUnique.mockResolvedValue(FRESH_INVITE);
		prismaMock.trip.findUnique.mockResolvedValue(null);

		const result = await run(
			layoutLoad,
			makeEvent({ pathname: `/trips/${TRIP_ID}`, search: `?invite=${TOKEN}`, user: null })
		);

		expect(result).toEqual({ outcome: 'error', status: 404 });
	});

	it('sends an unknown token to login and drops the stale invite cookie', async () => {
		prismaMock.invite.findUnique.mockResolvedValue(null);
		const cookies = makeCookies({ [`trip_invite_${TRIP_ID}`]: 'stale-token' });

		const result = await run(
			layoutLoad,
			makeEvent({ pathname: `/trips/${TRIP_ID}`, user: null, cookies })
		);

		expect(result.outcome).toBe('redirect');
		if (result.outcome !== 'redirect') return;
		expect(result.location).toContain('/login');
		expect(cookies.jar.has(`trip_invite_${TRIP_ID}`)).toBe(false);
		expect(prismaMock.trip.findUnique).not.toHaveBeenCalled();
	});

	it('returns 410 Gone for an expired token', async () => {
		prismaMock.invite.findUnique.mockResolvedValue({
			...FRESH_INVITE,
			expiresAt: new Date('2020-01-01')
		});

		const result = await run(
			layoutLoad,
			makeEvent({ pathname: `/trips/${TRIP_ID}`, search: `?invite=${TOKEN}`, user: null })
		);

		expect(result).toEqual({ outcome: 'error', status: 410 });
	});

	it('returns 410 Gone for a token explicitly marked expired', async () => {
		prismaMock.invite.findUnique.mockResolvedValue({ ...FRESH_INVITE, status: 'expired' });

		const result = await run(
			layoutLoad,
			makeEvent({ pathname: `/trips/${TRIP_ID}`, search: `?invite=${TOKEN}`, user: null })
		);

		expect(result).toEqual({ outcome: 'error', status: 410 });
	});

	it('refuses a token minted for a different trip', async () => {
		prismaMock.invite.findUnique.mockResolvedValue({ ...FRESH_INVITE, tripId: 'other-trip' });

		const result = await run(
			layoutLoad,
			makeEvent({ pathname: `/trips/${TRIP_ID}`, search: `?invite=${TOKEN}`, user: null })
		);

		expect(result.outcome).toBe('redirect');
		if (result.outcome !== 'redirect') return;
		expect(result.location).toContain('/login');
		expect(prismaMock.trip.findUnique).not.toHaveBeenCalled();
	});
});

describe('trip layout guard — signed-in non-member', () => {
	it('sends them from the trip root to the join page with the token', async () => {
		vi.mocked(getUserTripMembership).mockResolvedValue(null as never);

		const result = await run(
			layoutLoad,
			makeEvent({ pathname: `/trips/${TRIP_ID}`, search: `?invite=${TOKEN}`, user: GUEST })
		);

		expect(result).toEqual({
			outcome: 'redirect',
			location: `/trips/${TRIP_ID}/join?invite=${TOKEN}`
		});
	});

	// The B1 loop: this redirect target used to be re-evaluated by the same gate and sent
	// straight back to itself, so the join page never rendered.
	it('renders the join page instead of redirecting it back to itself', async () => {
		vi.mocked(getUserTripMembership).mockResolvedValue(null as never);
		prismaMock.trip.findUnique.mockResolvedValue(joinTripRow(false));
		prismaMock.invite.findUnique.mockResolvedValue(FRESH_INVITE);

		const result = await run(
			layoutLoad,
			makeEvent({ pathname: `/trips/${TRIP_ID}/join`, search: `?invite=${TOKEN}`, user: GUEST })
		);

		expect(result.outcome).toBe('data');
		if (result.outcome !== 'data') return;
		expect(result.data.joinPreview).toBe(true);
		expect(result.data.membership).toBeNull();
		expect(result.data.isHost).toBe(false);
		expect(result.data.inviteToken).toBe(TOKEN);
	});

	it('renders the join page for a published trip with no invite at all', async () => {
		vi.mocked(getUserTripMembership).mockResolvedValue(null as never);
		prismaMock.trip.findUnique.mockResolvedValue(joinTripRow(true));

		const result = await run(
			layoutLoad,
			makeEvent({ pathname: `/trips/${TRIP_ID}/join`, user: GUEST })
		);

		expect(result.outcome).toBe('data');
		if (result.outcome !== 'data') return;
		expect(result.data.joinPreview).toBe(true);
		// A published trip is public enough to show without a token.
		expect(prismaMock.invite.findUnique).not.toHaveBeenCalled();
	});

	/**
	 * SECURITY (review finding, must not regress): the /join branch returns trip metadata
	 * — name, dates, cover photo, city. Any authenticated account can hit /join for an
	 * arbitrary trip id, so a draft trip must stay behind published-or-valid-invite.
	 */
	it('404s on a draft trip when the visitor holds no invite', async () => {
		vi.mocked(getUserTripMembership).mockResolvedValue(null as never);
		prismaMock.trip.findUnique.mockResolvedValue(joinTripRow(false));

		const result = await run(
			layoutLoad,
			makeEvent({ pathname: `/trips/${TRIP_ID}/join`, user: GUEST })
		);

		expect(result).toEqual({ outcome: 'error', status: 404 });
	});

	it('404s on a draft trip when the invite is declined', async () => {
		vi.mocked(getUserTripMembership).mockResolvedValue(null as never);
		prismaMock.trip.findUnique.mockResolvedValue(joinTripRow(false));
		prismaMock.invite.findUnique.mockResolvedValue(DECLINED_INVITE);

		const result = await run(
			layoutLoad,
			makeEvent({ pathname: `/trips/${TRIP_ID}/join`, search: `?invite=${TOKEN}`, user: GUEST })
		);

		expect(result).toEqual({ outcome: 'error', status: 404 });
	});

	it("404s on a draft trip when the invite belongs to another trip", async () => {
		vi.mocked(getUserTripMembership).mockResolvedValue(null as never);
		prismaMock.trip.findUnique.mockResolvedValue(joinTripRow(false));
		prismaMock.invite.findUnique.mockResolvedValue({ ...FRESH_INVITE, tripId: 'other-trip' });

		const result = await run(
			layoutLoad,
			makeEvent({ pathname: `/trips/${TRIP_ID}/join`, search: `?invite=${TOKEN}`, user: GUEST })
		);

		expect(result).toEqual({ outcome: 'error', status: 404 });
	});

	it('404s on the join route when the trip does not exist', async () => {
		vi.mocked(getUserTripMembership).mockResolvedValue(null as never);
		prismaMock.trip.findUnique.mockResolvedValue(null);

		const result = await run(
			layoutLoad,
			makeEvent({ pathname: `/trips/${TRIP_ID}/join`, user: GUEST })
		);

		expect(result).toEqual({ outcome: 'error', status: 404 });
	});
});

describe('trip layout guard — members keep working', () => {
	it('lets an approved member through to the full trip load', async () => {
		vi.mocked(getUserTripMembership).mockResolvedValue({
			role: 'guest',
			inviteStatus: 'approved',
			userId: GUEST.id,
			tripId: TRIP_ID
		} as never);
		prismaMock.trip.findUnique.mockResolvedValue({
			id: TRIP_ID,
			name: 'Cabin Weekend',
			costSharingEnabled: false,
			invoices: [],
			rooms: [],
			members: [],
			rsvps: []
		});

		const result = await run(layoutLoad, makeEvent({ pathname: `/trips/${TRIP_ID}`, user: GUEST }));

		expect(result.outcome).toBe('data');
		if (result.outcome !== 'data') return;
		expect(result.data.invitePreview).toBe(false);
		expect(result.data.joinPreview).toBe(false);
		expect(result.data.membership).not.toBeNull();
	});

	it('routes a pending member to the pending page', async () => {
		vi.mocked(getUserTripMembership).mockResolvedValue({
			role: 'guest',
			inviteStatus: 'pending'
		} as never);

		const result = await run(layoutLoad, makeEvent({ pathname: `/trips/${TRIP_ID}`, user: GUEST }));

		expect(result).toEqual({ outcome: 'redirect', location: `/trips/${TRIP_ID}/pending` });
	});

	it('routes a denied member to the denied page', async () => {
		vi.mocked(getUserTripMembership).mockResolvedValue({
			role: 'guest',
			inviteStatus: 'denied'
		} as never);

		const result = await run(layoutLoad, makeEvent({ pathname: `/trips/${TRIP_ID}`, user: GUEST }));

		expect(result).toEqual({ outcome: 'redirect', location: `/trips/${TRIP_ID}/denied` });
	});

	it('refuses any other membership state', async () => {
		vi.mocked(getUserTripMembership).mockResolvedValue({
			role: 'guest',
			inviteStatus: 'removed'
		} as never);

		const result = await run(layoutLoad, makeEvent({ pathname: `/trips/${TRIP_ID}`, user: GUEST }));

		expect(result).toEqual({ outcome: 'error', status: 403 });
	});
});

describe('join page load', () => {
	const publishedTrip = {
		id: TRIP_ID,
		name: 'Cabin Weekend',
		checkInDate: new Date('2026-10-01'),
		checkOutDate: new Date('2026-10-04'),
		isPublished: true,
		listingCoverPhoto: null,
		locationCity: 'Tahoe City',
		inviteMode: 'approval_required',
		maxCapacity: null
	};
	const draftTrip = { ...publishedTrip, isPublished: false };

	it('admits an invited non-member to a draft trip instead of 404ing', async () => {
		vi.mocked(getSessionUser).mockResolvedValue(GUEST as never);
		prismaMock.tripMember.findUnique.mockResolvedValue(null);
		prismaMock.trip.findUnique.mockResolvedValue(draftTrip);
		prismaMock.invite.findUnique.mockResolvedValue(FRESH_INVITE);

		const result = await run(
			joinLoad,
			makeEvent({ pathname: `/trips/${TRIP_ID}/join`, search: `?invite=${TOKEN}`, user: GUEST })
		);

		expect(result.outcome).toBe('data');
		if (result.outcome !== 'data') return;
		expect(result.data.inviteToken).toBe(TOKEN);
	});

	it('keeps a draft trip hidden from someone with no invite', async () => {
		vi.mocked(getSessionUser).mockResolvedValue(GUEST as never);
		prismaMock.tripMember.findUnique.mockResolvedValue(null);
		prismaMock.trip.findUnique.mockResolvedValue(draftTrip);
		prismaMock.invite.findUnique.mockResolvedValue(null);

		const result = await run(
			joinLoad,
			makeEvent({ pathname: `/trips/${TRIP_ID}/join`, user: GUEST })
		);

		expect(result).toEqual({ outcome: 'error', status: 404 });
	});

	it('keeps a draft trip hidden from a declined invite', async () => {
		vi.mocked(getSessionUser).mockResolvedValue(GUEST as never);
		prismaMock.tripMember.findUnique.mockResolvedValue(null);
		prismaMock.trip.findUnique.mockResolvedValue(draftTrip);
		prismaMock.invite.findUnique.mockResolvedValue(DECLINED_INVITE);

		const result = await run(
			joinLoad,
			makeEvent({ pathname: `/trips/${TRIP_ID}/join`, search: `?invite=${TOKEN}`, user: GUEST })
		);

		expect(result).toEqual({ outcome: 'error', status: 404 });
	});

	it('keeps a draft trip hidden from an expired invite', async () => {
		vi.mocked(getSessionUser).mockResolvedValue(GUEST as never);
		prismaMock.tripMember.findUnique.mockResolvedValue(null);
		prismaMock.trip.findUnique.mockResolvedValue(draftTrip);
		prismaMock.invite.findUnique.mockResolvedValue({
			...FRESH_INVITE,
			expiresAt: new Date('2020-01-01')
		});

		const result = await run(
			joinLoad,
			makeEvent({ pathname: `/trips/${TRIP_ID}/join`, search: `?invite=${TOKEN}`, user: GUEST })
		);

		expect(result).toEqual({ outcome: 'error', status: 404 });
	});

	it("keeps a draft trip hidden from another trip's invite", async () => {
		vi.mocked(getSessionUser).mockResolvedValue(GUEST as never);
		prismaMock.tripMember.findUnique.mockResolvedValue(null);
		prismaMock.trip.findUnique.mockResolvedValue(draftTrip);
		prismaMock.invite.findUnique.mockResolvedValue({ ...FRESH_INVITE, tripId: 'other-trip' });

		const result = await run(
			joinLoad,
			makeEvent({ pathname: `/trips/${TRIP_ID}/join`, search: `?invite=${TOKEN}`, user: GUEST })
		);

		expect(result).toEqual({ outcome: 'error', status: 404 });
	});

	it('still admits anyone to a published trip with no invite', async () => {
		vi.mocked(getSessionUser).mockResolvedValue(GUEST as never);
		prismaMock.tripMember.findUnique.mockResolvedValue(null);
		prismaMock.trip.findUnique.mockResolvedValue(publishedTrip);

		const result = await run(
			joinLoad,
			makeEvent({ pathname: `/trips/${TRIP_ID}/join`, user: GUEST })
		);

		expect(result.outcome).toBe('data');
		if (result.outcome !== 'data') return;
		expect(result.data.isTripFull).toBe(false);
	});

	it('reports the trip as full once approved members reach capacity', async () => {
		vi.mocked(getSessionUser).mockResolvedValue(GUEST as never);
		prismaMock.tripMember.findUnique.mockResolvedValue(null);
		prismaMock.trip.findUnique.mockResolvedValue({ ...publishedTrip, maxCapacity: 4 });
		prismaMock.tripMember.count.mockResolvedValue(4);

		const result = await run(
			joinLoad,
			makeEvent({ pathname: `/trips/${TRIP_ID}/join`, user: GUEST })
		);

		expect(result.outcome).toBe('data');
		if (result.outcome !== 'data') return;
		expect(result.data.isTripFull).toBe(true);
		expect(result.data.maxCapacity).toBe(4);
	});

	it('sends an existing approved member back to the trip', async () => {
		vi.mocked(getSessionUser).mockResolvedValue(GUEST as never);
		prismaMock.tripMember.findUnique.mockResolvedValue({ inviteStatus: 'approved' });
		prismaMock.trip.findUnique.mockResolvedValue(publishedTrip);

		const result = await run(
			joinLoad,
			makeEvent({ pathname: `/trips/${TRIP_ID}/join`, user: GUEST })
		);

		expect(result).toEqual({ outcome: 'redirect', location: `/trips/${TRIP_ID}` });
	});

	it('redirects a signed-out visitor to login, preserving the invite token', async () => {
		vi.mocked(getSessionUser).mockResolvedValue(null as never);

		const result = await run(
			joinLoad,
			makeEvent({ pathname: `/trips/${TRIP_ID}/join`, search: `?invite=${TOKEN}`, user: null })
		);

		expect(result.outcome).toBe('redirect');
		if (result.outcome !== 'redirect') return;
		expect(result.location).toContain('/login');
		expect(decodeURIComponent(result.location)).toContain(`/trips/${TRIP_ID}/join?invite=${TOKEN}`);
	});
});
