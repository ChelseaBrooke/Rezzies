import { error, redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { getUserTripMembership, getUserTrips } from '$lib/server/trip-access.js';
import { getSessionUser } from '$lib/server/session.js';
import { prisma } from '$lib/server/prisma.js';
import { firstNameFromUserName } from '$lib/server/household-claim.js';
import { computeCommittedFundsFromYesRsvps, getCostAtMaxParticipation } from '$lib/server/pricing-canonical.js';
import { ROOM_BEDS_ORDER_BY, TRIP_ROOMS_ORDER_BY } from '$lib/server/trip-room-order.js';
import type { InvoiceBreakdown } from '$lib/server/invoice-calculator.js';
import { FEATURE_TRIP_GAMES } from '$lib/config/features.js';

const INVITE_COOKIE_PREFIX = 'trip_invite_';

export const load: LayoutServerLoad = async ({ params, cookies, locals, url }) => {
	const tripId = params.tripId;
	const inviteCookieName = `${INVITE_COOKIE_PREFIX}${tripId}`;
	const inviteFromQuery = url.searchParams.get('invite')?.trim() || '';

	if (inviteFromQuery) {
		cookies.set(inviteCookieName, inviteFromQuery, {
			path: `/trips/${tripId}`,
			httpOnly: true,
			sameSite: 'lax',
			secure: url.protocol === 'https:',
			maxAge: 60 * 60 * 24 * 21
		});
	}

	const inviteTokenResolved = (inviteFromQuery || cookies.get(inviteCookieName)?.trim() || '').trim();
	const user = locals.user;
	type FeatureTourVariant = 'first-trip' | 'first-rsvp' | null;

	const isTripDashboardRoot =
		url.pathname === `/trips/${tripId}` || url.pathname === `/trips/${tripId}/`;

	// Plain guest join route (not the household-claim join sub-route, which is handled separately below).
	const isJoinRoute = url.pathname === `/trips/${tripId}/join`;

	// ── Anonymous + valid invite: limited preview on trip dashboard root only ──
	if (!user && inviteTokenResolved) {
		const invite = await prisma.invite.findUnique({
			where: { token: inviteTokenResolved },
			select: { tripId: true, expiresAt: true, status: true }
		});

		if (!invite || invite.tripId !== tripId) {
			cookies.delete(inviteCookieName, { path: `/trips/${tripId}` });
			throw redirect(303, `/login?redirect=${encodeURIComponent(`/trips/${tripId}`)}`);
		}

		if (invite.expiresAt && invite.expiresAt < new Date()) {
			throw error(410, 'This invite has expired');
		}

		if (!isTripDashboardRoot) {
			throw redirect(303, `/trips/${tripId}?invite=${encodeURIComponent(inviteTokenResolved)}`);
		}

		const previewRow = await prisma.trip.findUnique({
			where: { id: tripId },
			select: {
				id: true,
				name: true,
				description: true,
				listingCoverPhoto: true,
				checkInDate: true,
				checkOutDate: true,
				location: true,
				locationCity: true,
				activitiesEnabled: true,
				gamesEnabled: true,
				isPublished: true,
				members: {
					where: { role: 'host', inviteStatus: 'approved' },
					take: 1,
					include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } }
				},
				rsvps: {
					where: { status: 'yes' },
					include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } }
				},
				_count: { select: { mealSlots: true, activities: true, tripGames: true } }
			}
		});

		// Note: a valid, unexpired invite for this exact trip is sufficient to preview it — a
		// host can send invites before finishing publish, so gating on `isPublished` here would
		// 404 a guest who followed a perfectly good invite link (that was the B1 bug).
		if (!previewRow) {
			throw error(404, 'Trip not found');
		}

		const hostMember = previewRow.members[0];
		const previewHostName = hostMember?.user?.name ?? hostMember?.user?.email ?? 'Host';

		const goingMembers = previewRow.rsvps
			.filter((r) => r.user)
			.map((r) => ({
				user: r.user,
				role: 'guest' as const,
				inviteStatus: 'approved' as const
			}));

		const trip = {
			...previewRow,
			fullAddress: null as string | null,
			checkInTime: null as string | null,
			checkOutTime: null as string | null,
			parkingNotes: null as string | null,
			houseRules: null as string | null,
			rooms: [] as unknown[],
			members: goingMembers,
			rsvps: previewRow.rsvps,
			mealSlots: [] as unknown[],
			activities: [] as unknown[],
			roomAssignments: [] as unknown[],
			invoices: [] as unknown[],
			reservations: [] as unknown[],
			invites: [] as unknown[],
			tripActivities: [] as unknown[],
			extraCostRules: [] as unknown[],
			mealPlan: null,
			totalCost: 0,
			costSharingEnabled: false,
			platformFeePerPerson: 0
		};

		return {
			gamesUiEnabled: FEATURE_TRIP_GAMES,
			publicHouseholdClaim: false as const,
			joinPreview: false as const,
			user: null,
			invitePreview: true as const,
			inviteToken: inviteTokenResolved,
			inviteStatus: invite.status,
			previewCounts: {
				meals: previewRow._count.mealSlots,
				activities: previewRow._count.activities,
				games: previewRow._count.tripGames
			},
			previewHostName,
			trip,
			allTrips: [],
			membership: null,
			isHost: false,
			isCoHost: false,
			canHostShare: false,
			householdShare: null,
			costAtMaxParticipation: null,
			userRsvp: null,
			costReapprovalBlock: null,
			canChat: false,
			pendingMemberCount: 0,
			committedFundsFromYesRsvps: 0,
			pollsBadgeCount: 0,
			tripGames: [],
			recentPolls: [],
			tripGalleryFiles: [],
			featureTourVariant: null as FeatureTourVariant
		};
	}

	/** Unauthenticated (or not yet on trip) claim flow, skip membership gate */
	const isPublicHouseholdJoin = url.pathname.includes('/join/household/');
	if (isPublicHouseholdJoin) {
		const sUser = await getSessionUser(cookies);
		const t = await prisma.trip.findUnique({
			where: { id: tripId },
			select: {
				id: true,
				name: true,
				isPublished: true,
				checkInDate: true,
				checkOutDate: true,
				listingCoverPhoto: true,
				locationCity: true
			}
		});
		if (!t || !t.isPublished) throw error(404, 'Trip not found');
		return {
			gamesUiEnabled: FEATURE_TRIP_GAMES,
			user: sUser,
			publicHouseholdClaim: true as const,
			joinPreview: false as const,
			invitePreview: false as const,
			inviteToken: null as string | null,
			inviteStatus: null as string | null,
			previewHostName: null as string | null,
			previewCounts: null as { meals: number; activities: number; games: number } | null,
			trip: t,
			allTrips: [] as { id: string; name: string; listingCoverPhoto?: string | null }[],
			membership: null,
			isHost: false,
			isCoHost: false,
			canHostShare: false,
			householdShare: null,
			costAtMaxParticipation: null,
			userRsvp: null,
			costReapprovalBlock: null,
			canChat: false,
			pendingMemberCount: 0,
			committedFundsFromYesRsvps: 0,
			pollsBadgeCount: 0,
			tripGames: [] as { id: string; name: string }[],
			recentPolls: [] as { id: string; title: string; createdAt: string }[],
			tripGalleryFiles: [] as { id: string; name: string; url: string }[],
			featureTourVariant: null as FeatureTourVariant
		};
	}

	if (!user) {
		throw redirect(303, `/login?redirect=/trips/${tripId}`);
	}

	const membership = await getUserTripMembership(tripId, user.id);

	if (!membership) {
		// Already on the join route: render it (below) instead of redirecting to itself, which
		// would loop forever and never let the guest see the join page (the B1 bug).
		if (isJoinRoute) {
			const joinTrip = await prisma.trip.findUnique({
				where: { id: tripId },
				select: {
					id: true,
					name: true,
					checkInDate: true,
					checkOutDate: true,
					listingCoverPhoto: true,
					locationCity: true,
					isPublished: true
				}
			});

			if (!joinTrip) {
				throw error(404, 'Trip not found');
			}

			return {
				gamesUiEnabled: FEATURE_TRIP_GAMES,
				publicHouseholdClaim: false as const,
				joinPreview: true as const,
				user,
				invitePreview: false as const,
				inviteToken: inviteFromQuery || null,
				inviteStatus: null as string | null,
				previewHostName: null as string | null,
				previewCounts: null as { meals: number; activities: number; games: number } | null,
				trip: joinTrip,
				allTrips: [] as { id: string; name: string; listingCoverPhoto?: string | null }[],
				membership: null,
				isHost: false,
				isCoHost: false,
				canHostShare: false,
				householdShare: null,
				costAtMaxParticipation: null,
				userRsvp: null,
				costReapprovalBlock: null,
				canChat: false,
				pendingMemberCount: 0,
				committedFundsFromYesRsvps: 0,
				pollsBadgeCount: 0,
				tripGames: [] as { id: string; name: string }[],
				recentPolls: [] as { id: string; title: string; createdAt: string }[],
				tripGalleryFiles: [] as { id: string; name: string; url: string }[],
				featureTourVariant: null as FeatureTourVariant
			};
		}

		const joinQs = inviteFromQuery ? `?invite=${encodeURIComponent(inviteFromQuery)}` : '';
		throw redirect(303, `/trips/${tripId}/join${joinQs}`);
	}

	if (membership.inviteStatus === 'pending') {
		throw redirect(303, `/trips/${tripId}/pending`);
	}
	if (membership.inviteStatus === 'denied') {
		throw redirect(303, `/trips/${tripId}/denied`);
	}

	if (membership.inviteStatus !== 'approved') {
		throw error(403, 'You do not have access to this trip');
	}

	const isHost = membership.role === 'host';
	const isCoHost = membership.role === 'co-host';
	const canHostShare = isHost || isCoHost;
	const [trip, , tripsResult, userRsvp, committedFunds, costAtMaxParticipation, userOnboardingData] = await Promise.all([
		prisma.trip.findUnique({
			where: { id: tripId },
			include: {
				rooms: {
					orderBy: TRIP_ROOMS_ORDER_BY,
					include: { beds: { orderBy: ROOM_BEDS_ORDER_BY } }
				},
				members: { include: { user: { select: { id: true, email: true, name: true, avatarUrl: true } } } },
				mealPlan: true,
				mealSlots: { include: { assignedUser: { select: { id: true, name: true } } } },
				activities: {
					include: {
						participants: { include: { user: { select: { id: true, name: true } } } }
					}
				},
				invoices: true,
				reservations: true,
				rsvps: { include: { user: { select: { id: true, name: true, avatarUrl: true } } } },
				roomAssignments: {
					include: {
						room: { select: { id: true, name: true, photoUrls: true } },
						bed: { select: { id: true, bedType: true } },
						user: { select: { id: true, name: true } }
					}
				},
				invites: {
					include: {
						invitedBy: { select: { id: true, name: true } },
						recipient: { select: { id: true, name: true } }
					}
				},
				tripActivities: { orderBy: { createdAt: 'desc' }, take: 50 },
				extraCostRules: true
			}
		}),
		Promise.resolve(membership),
		getUserTrips(user.id),
		prisma.rSVP.findUnique({
			where: { tripId_userId: { tripId, userId: user.id } }
		}),
		computeCommittedFundsFromYesRsvps(tripId),
		isHost ? getCostAtMaxParticipation(tripId) : Promise.resolve(null),
		prisma.user.findUnique({
			where: { id: user.id },
			select: { dismissedTooltips: true }
		})
	]);

	if (!trip) {
		throw error(404, 'Trip not found');
	}

	const allTrips = tripsResult.allTrips.map((m) => m.trip);

	const [tripGamesRows, recentPolls, tripGalleryFiles, pendingMemberCount] = await Promise.all([
		prisma.tripGame.findMany({
			where: { tripId },
			orderBy: { createdAt: 'asc' }
		}),
		prisma.poll.findMany({
			where: { tripId },
			orderBy: { createdAt: 'desc' },
			take: 30,
			select: {
				id: true,
				title: true,
				createdAt: true,
				createdById: true,
				createdBy: { select: { id: true, name: true } }
			}
		}),
		prisma.tripFile.findMany({
			where: {
				tripId,
				category: { not: 'receipt' },
				OR: [{ mimeType: { startsWith: 'image/' } }, { mimeType: { startsWith: 'video/' } }]
			},
			orderBy: { createdAt: 'desc' },
			select: { id: true, name: true, url: true, mimeType: true }
		}),
		isHost ? prisma.tripMember.count({ where: { tripId, inviteStatus: 'pending' } }) : Promise.resolve(0)
	]);

	const tripGames = tripGamesRows.map((g) => ({
		id: g.id,
		gameId: g.gameId,
		name: g.name,
		addedByUserId: g.addedByUserId,
		addedAt: g.createdAt.toISOString()
	}));

	let pollsBadgeCount = 0;
	const lastVisitRaw = cookies.get(`polls_visit_${tripId}`);
	const lastVisit = lastVisitRaw ? new Date(lastVisitRaw).getTime() : 0;
	if (lastVisit > 0) {
		pollsBadgeCount = await prisma.poll.count({
			where: { tripId, createdAt: { gt: new Date(lastVisit) } }
		});
	}

	const dismissedTourKeys = Array.isArray(userOnboardingData?.dismissedTooltips)
		? (userOnboardingData.dismissedTooltips as string[])
		: [];
	const hasSeenFirstTripTour = dismissedTourKeys.includes('feature-tour:first-trip');
	const hasSeenFirstRsvpTour = dismissedTourKeys.includes('feature-tour:first-rsvp');

	let featureTourVariant: FeatureTourVariant = null;
	if (isHost && !hasSeenFirstTripTour) {
		const hostedTripCount = await prisma.tripMember.count({
			where: { userId: user.id, role: 'host', inviteStatus: 'approved' }
		});
		if (hostedTripCount === 1) {
			featureTourVariant = 'first-trip';
		}
	}

	if (!featureTourVariant && !isHost && userRsvp?.status === 'yes' && !hasSeenFirstRsvpTour) {
		const yesRsvpCount = await prisma.rSVP.count({
			where: { userId: user.id, status: 'yes' }
		});
		if (yesRsvpCount === 1) {
			featureTourVariant = 'first-rsvp';
		}
	}

	let householdShare: {
		householdId: string;
		hasUnclaimedProxyMembers: boolean;
		unclaimedFirstNames: string[];
		primaryFirstName: string;
	} | null = null;
	let costReapprovalBlock: {
		tripName: string;
		originalRangeMinCents: number;
		originalRangeMaxCents: number;
		currentShareCents: number;
		reasonLine: string;
		reApprovalDeadline: string;
		breakdown: { rooms?: { amount: number; nights: number }[] } | null;
	} | null = null;
	if (
		userRsvp?.status === 'yes' &&
		userRsvp.costApprovalStatus === 'pending' &&
		trip.costSharingEnabled &&
		!isHost &&
		membership?.role !== 'co-host'
	) {
		const inv = trip.invoices?.find((i) => i.userId === user.id && i.status === 'due');
		const origMin = userRsvp.originalRangeMinCents ?? userRsvp.acceptedEstimateLowCents;
		const origMax = userRsvp.originalRangeMaxCents ?? userRsvp.acceptedEstimateHighCents;
		const deadline = userRsvp.reApprovalDeadline;
		if (inv && origMin != null && origMax != null && deadline) {
			let breakdown: InvoiceBreakdown | null = null;
			if (inv.breakdownJson) {
				try {
					breakdown = JSON.parse(inv.breakdownJson) as InvoiceBreakdown;
				} catch {
					breakdown = null;
				}
			}
			const reasonLine =
				userRsvp.costReapprovalReason?.trim() ||
				`The group's cost split has changed for "${trip.name}".`;
			costReapprovalBlock = {
				tripName: trip.name,
				originalRangeMinCents: origMin,
				originalRangeMaxCents: origMax,
				currentShareCents: Math.round(inv.totalAmount * 100),
				reasonLine,
				reApprovalDeadline: deadline.toISOString(),
				breakdown: breakdown
					? { rooms: breakdown.rooms?.map((r) => ({ amount: r.amount, nights: r.nights })) }
					: null
			};
		}
	}

	if (!canHostShare) {
		const hh = await prisma.household.findUnique({
			where: { tripId_primaryUserId: { tripId, primaryUserId: user.id } },
			include: { members: true }
		});
		if (hh) {
			const unclaimed = hh.members.filter(
				(m) => m.ageGroup !== 'child' && m.accountStatus === 'none' && !m.userId
			);
			householdShare = {
				householdId: hh.id,
				hasUnclaimedProxyMembers: unclaimed.length > 0,
				unclaimedFirstNames: unclaimed.map((m) => m.firstName),
				primaryFirstName: firstNameFromUserName(user.name) || 'You'
			};
		}
	}

	return {
		gamesUiEnabled: FEATURE_TRIP_GAMES,
		publicHouseholdClaim: false as const,
		joinPreview: false as const,
		user,
		invitePreview: false as const,
		inviteToken: null as string | null,
		inviteStatus: null as string | null,
		previewCounts: null as { meals: number; activities: number; games: number } | null,
		previewHostName: null as string | null,
		trip,
		allTrips,
		membership,
		isHost,
		isCoHost,
		canHostShare,
		householdShare,
		costAtMaxParticipation: costAtMaxParticipation ?? null,
		userRsvp,
		costReapprovalBlock,
		canChat: userRsvp?.status === 'yes' || membership?.role === 'host',
		pendingMemberCount,
		committedFundsFromYesRsvps: committedFunds,
		pollsBadgeCount,
		tripGames,
		recentPolls,
		tripGalleryFiles,
		featureTourVariant
	};
};
