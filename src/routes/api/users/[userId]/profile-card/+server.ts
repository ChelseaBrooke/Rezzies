/**
 * GET full profile for Profile Card overlay: identity + stats + shared trips + friendship + friends list.
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSessionUser } from '$lib/server/session.js';
import { prisma } from '$lib/server/prisma.js';
import { getFriendshipStatus, listFriends, canViewFriendsList } from '$lib/server/friends.js';

export const GET: RequestHandler = async ({ params, cookies }) => {
	const userId = params.userId;
	const sessionUser = await getSessionUser(cookies);

	const user = await prisma.user.findUnique({
		where: { id: userId },
		select: {
			id: true,
			name: true,
			avatarUrl: true,
			travelStyle: true,
			homeCity: true,
			profileVisibility: true,
			friendsListVisibility: true,
			createdAt: true
		}
	});

	if (!user) {
		return json({ error: 'User not found' }, { status: 404 });
	}

	const isSelf = sessionUser?.id === userId;
	const profileVisibility = user.profileVisibility ?? 'public';

	/** So friend-request recipients can open Accept/Decline even if the sender’s profile is private. */
	const hasPendingFriendRequestToViewer =
		sessionUser?.id &&
		!isSelf &&
		(await prisma.friendRequest.findFirst({
			where: {
				fromUserId: userId,
				toUserId: sessionUser.id,
				status: 'pending'
			},
			select: { id: true }
		}));

	if (!isSelf && profileVisibility === 'private' && !hasPendingFriendRequestToViewer) {
		return json({ error: 'User not found' }, { status: 404 });
	}

	// Trips hosted = TripMember where role='host'; trips joined = all TripMember for user
	const [tripsHosted, tripsJoined] = await Promise.all([
		prisma.tripMember.count({ where: { userId, role: 'host' } }),
		prisma.tripMember.count({ where: { userId } })
	]);

	// Shared trips: trips where both current user and viewed user are members (only when viewing other)
	let sharedTrips: { tripId: string; name: string; checkInDate: string; checkOutDate: string }[] = [];
	if (!isSelf && sessionUser?.id) {
		const viewedUserTripIds = await prisma.tripMember
			.findMany({ where: { userId }, select: { tripId: true } })
			.then((r) => r.map((x) => x.tripId));
		const myTripIds = await prisma.tripMember
			.findMany({ where: { userId: sessionUser.id }, select: { tripId: true } })
			.then((r) => r.map((x) => x.tripId));
		const sharedIds = viewedUserTripIds.filter((id) => myTripIds.includes(id));
		if (sharedIds.length > 0) {
			const trips = await prisma.trip.findMany({
				where: { id: { in: sharedIds } },
				select: { id: true, name: true, checkInDate: true, checkOutDate: true },
				orderBy: { checkInDate: 'desc' },
				take: 3
			});
			sharedTrips = trips.map((t) => ({
				tripId: t.id,
				name: t.name,
				checkInDate: t.checkInDate.toISOString(),
				checkOutDate: t.checkOutDate.toISOString()
			}));
		}
	}
	const canViewFullProfile = isSelf || profileVisibility === 'public' || (profileVisibility === 'trip_only' && sharedTrips.length > 0);
	/** Skip trip_only “limited” stub when a friend request is pending so we can load status + action buttons. */
	if (!isSelf && !canViewFullProfile && !hasPendingFriendRequestToViewer) {
		return json({
			displayName: user.name || 'Traveler',
			avatarUrl: user.avatarUrl,
			travelStyle: null,
			homeCity: null,
			isSelf: false,
			tripsHosted: 0,
			tripsJoined: 0,
			sharedTrips: [],
			friendshipStatus: 'none' as const,
			friends: [],
			limitedView: true
		});
	}

	// Friendship status and friends list
	let friendshipStatus: 'self' | 'none' | 'friends' | 'pending_sent' | 'pending_received' = 'none';
	let pendingRequestFromUserId: string | null = null;
	let friends: { id: string; name: string | null; avatarUrl: string | null }[] = [];

	if (isSelf) {
		friendshipStatus = 'self';
		friends = await listFriends(userId);
	} else if (sessionUser?.id) {
		const { status } = await getFriendshipStatus(sessionUser.id, userId);
		friendshipStatus = status;
		if (status === 'pending_received') {
			pendingRequestFromUserId = userId;
		}
		const allowed = await canViewFriendsList(
			sessionUser.id,
			userId,
			user.friendsListVisibility ?? 'friends'
		);
		if (allowed) {
			friends = await listFriends(userId);
		}
	}

	const showTravelAndStats = isSelf || canViewFullProfile;

	return json({
		displayName: user.name || 'Traveler',
		avatarUrl: user.avatarUrl,
		travelStyle: showTravelAndStats ? user.travelStyle : null,
		homeCity: showTravelAndStats ? user.homeCity : null,
		memberSince: showTravelAndStats ? user.createdAt.getFullYear() : null,
		isSelf,
		tripsHosted: showTravelAndStats ? tripsHosted : 0,
		tripsJoined: showTravelAndStats ? tripsJoined : 0,
		sharedTrips: showTravelAndStats ? sharedTrips : [],
		friendshipStatus,
		pendingRequestFromUserId,
		friends: showTravelAndStats ? friends : [],
		/** Name + avatar only when private; friend Accept/Decline still shown in UI. */
		limitedView: !canViewFullProfile
	});
};
