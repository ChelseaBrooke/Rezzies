import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getSessionUser } from '$lib/server/session.js';
import { prisma } from '$lib/server/prisma.js';
import {
	HOUSEHOLD_CLAIM_COOKIE,
	HOUSEHOLD_CLAIM_MAX_AGE,
	firstNameFromUserName,
	mergeHouseholdProxyToUser,
	preselectProxyMemberId,
	type HouseholdClaimPayload
} from '$lib/server/household-claim.js';
import { getUserTripMembership } from '$lib/server/trip-access.js';

export const load: PageServerLoad = async ({ params, cookies, parent, url }) => {
	const { tripId, householdId } = params;
	const p = await parent();
	const user = p.user;

	const household = await prisma.household.findFirst({
		where: { id: householdId, tripId },
		include: {
			members: { orderBy: { createdAt: 'asc' } },
			primary: { select: { id: true, name: true, email: true } },
			trip: { select: { id: true, name: true, listingCoverPhoto: true, checkInDate: true, checkOutDate: true } }
		}
	});
	// trip has no hostMember - need to query host
	if (!household) throw error(404, 'Not found');

	const hostRow = await prisma.tripMember.findFirst({
		where: { tripId, role: 'host' },
		include: { user: { select: { name: true, email: true } } }
	});
	const hostName = hostRow?.user?.name?.trim() || hostRow?.user?.email?.split('@')[0] || 'your host';

	const unclaimed = household.members
		.filter(
			(m) =>
				m.ageGroup !== 'child' &&
				m.accountStatus === 'none' &&
				!m.userId
		)
		.map((m) => ({
			id: m.id,
			firstName: m.firstName,
			lastName: m.lastName,
			ageGroup: m.ageGroup
		}));
	const allClaimed = unclaimed.length === 0;
	const primaryFirst = firstNameFromUserName(household.primary.name) || 'Your host';

	let isTripMember = false;
	if (user) {
		const m = await getUserTripMembership(tripId, user.id);
		isTripMember = !!(m && m.inviteStatus === 'approved');
	}

	const suggestedId =
		user && unclaimed.length > 0
			? preselectProxyMemberId(unclaimed, user.name)
			: null;

	const loginRedirect = `/login?redirect=${encodeURIComponent(url.pathname + url.search)}`;
	return {
		tripId,
		loginRedirect,
		trip: {
			name: household.trip.name,
			listingCoverPhoto: household.trip.listingCoverPhoto,
			checkInDate: household.trip.checkInDate,
			checkOutDate: household.trip.checkOutDate
		},
		primaryFirstName: primaryFirst,
		hostName,
		unclaimed,
		allClaimed,
		isAuthenticated: !!user,
		isTripMember,
		currentUser: user,
		suggestedMemberId: suggestedId
	};
};

export const actions: Actions = {
	setClaimCookie: async ({ request, cookies, params, url }) => {
		const fd = await request.formData();
		const memberId = (fd.get('householdMemberId') as string)?.trim();
		if (!memberId) return fail(400, { error: 'Missing member' });
		const ok = await prisma.householdMember.findFirst({
			where: { id: memberId, householdId: params.householdId! }
		});
		if (!ok) return fail(400, { error: 'Invalid member' });
		const payload: HouseholdClaimPayload = {
			v: 1,
			householdMemberId: memberId,
			householdId: params.householdId!,
			tripId: params.tripId!
		};
		cookies.set(HOUSEHOLD_CLAIM_COOKIE, JSON.stringify(payload), {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			secure: url.protocol === 'https:',
			maxAge: HOUSEHOLD_CLAIM_MAX_AGE
		});
		const redir =
			`/signup?redirect=${encodeURIComponent(`/trips/${params.tripId}?householdWelcome=1`)}&claim=1`;
		throw redirect(303, redir);
	},
	/** Logged-in user: merge proxy to current account and join trip */
	confirmAsUser: async ({ request, cookies, params }) => {
		const user = await getSessionUser(cookies);
		if (!user) return fail(401, { error: 'Sign in required' });
		const fd = await request.formData();
		const memberId = (fd.get('householdMemberId') as string)?.trim();
		if (!memberId) return fail(400, { error: 'Select someone' });
		const m = await prisma.householdMember.findFirst({
			where: { id: memberId, householdId: params.householdId! }
		});
		if (!m) return fail(400, { error: 'Invalid member' });
		await mergeHouseholdProxyToUser({
			householdMemberId: memberId,
			userId: user.id,
			userName: user.name
		});
		cookies.delete(HOUSEHOLD_CLAIM_COOKIE, { path: '/' });
		throw redirect(303, `/trips/${params.tripId}?householdWelcome=1`);
	}
};
