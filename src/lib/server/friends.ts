import { prisma } from './prisma.js';

export type FriendshipStatus = 'none' | 'pending_sent' | 'pending_received' | 'friends';

/** Returns the friendship status between viewer and target from the viewer's perspective. */
export async function getFriendshipStatus(
	viewerId: string,
	targetUserId: string
): Promise<{ status: FriendshipStatus; friendRequestId?: string }> {
	if (viewerId === targetUserId) {
		return { status: 'none' };
	}

	const [friendship, requestSent, requestReceived] = await Promise.all([
		findFriendship(viewerId, targetUserId),
		prisma.friendRequest.findUnique({
			where: {
				fromUserId_toUserId: { fromUserId: viewerId, toUserId: targetUserId },
				status: 'pending'
			},
			select: { id: true }
		}),
		prisma.friendRequest.findUnique({
			where: {
				fromUserId_toUserId: { fromUserId: targetUserId, toUserId: viewerId },
				status: 'pending'
			},
			select: { id: true }
		})
	]);

	if (friendship) return { status: 'friends' };
	if (requestSent) return { status: 'pending_sent', friendRequestId: requestSent.id };
	if (requestReceived) return { status: 'pending_received', friendRequestId: requestReceived.id };
	return { status: 'none' };
}

function orderedPair(a: string, b: string): [string, string] {
	return a < b ? [a, b] : [b, a];
}

async function findFriendship(userId1: string, userId2: string) {
	const [a, b] = orderedPair(userId1, userId2);
	return prisma.friendship.findUnique({
		where: { userIdA_userIdB: { userIdA: a, userIdB: b } }
	});
}

/** List friends of userId with minimal profile (id, name, avatarUrl). */
export async function listFriends(userId: string): Promise<
	{
		id: string;
		name: string | null;
		avatarUrl: string | null;
	}[]
> {
	const friendships = await prisma.friendship.findMany({
		where: { OR: [{ userIdA: userId }, { userIdB: userId }] },
		include: {
			userA: { select: { id: true, name: true, avatarUrl: true } },
			userB: { select: { id: true, name: true, avatarUrl: true } }
		}
	});
	return friendships.map((f) =>
		f.userIdA === userId ? f.userB : f.userA
	);
}

/** Check if viewer is allowed to see owner's friends list based on friendsListVisibility. */
export async function canViewFriendsList(
	viewerId: string | null,
	ownerId: string,
	ownerFriendsListVisibility: string
): Promise<boolean> {
	if (!viewerId || viewerId === ownerId) return true;
	if (ownerFriendsListVisibility === 'private') return false;
	if (ownerFriendsListVisibility === 'friends') {
		const friendship = await findFriendship(viewerId, ownerId);
		return !!friendship;
	}
	// trip_members: at least one shared trip
	if (ownerFriendsListVisibility === 'trip_members') {
		const [ownerTrips, viewerTrips] = await Promise.all([
			prisma.tripMember.findMany({ where: { userId: ownerId }, select: { tripId: true } }),
			prisma.tripMember.findMany({ where: { userId: viewerId }, select: { tripId: true } })
		]);
		const ownerSet = new Set(ownerTrips.map((t) => t.tripId));
		const hasShared = viewerTrips.some((t) => ownerSet.has(t.tripId));
		return hasShared;
	}
	return false;
}

/** Send a friend request. Idempotent if already friends or pending. Returns created: true only when a new pending request was created. */
export async function createRequest(
	fromUserId: string,
	toUserId: string
): Promise<{ ok: boolean; created?: boolean; error?: string }> {
	if (fromUserId === toUserId) {
		return { ok: false, error: 'Cannot send request to yourself' };
	}
	const existing = await prisma.user.findUnique({ where: { id: toUserId }, select: { id: true } });
	if (!existing) {
		return { ok: false, error: 'User not found' };
	}
	const friendship = await findFriendship(fromUserId, toUserId);
	if (friendship) {
		return { ok: true }; // already friends
	}
	const existingRequest = await prisma.friendRequest.findUnique({
		where: {
			fromUserId_toUserId: { fromUserId, toUserId }
		}
	});
	if (existingRequest) {
		if (existingRequest.status === 'pending') {
			return { ok: true }; // idempotent
		}
		// was accepted/declined; could allow new request by updating, for now treat as done
		return { ok: true };
	}
	// Check reverse request (they sent to us)
	const reverse = await prisma.friendRequest.findUnique({
		where: {
			fromUserId_toUserId: { fromUserId: toUserId, toUserId: fromUserId },
			status: 'pending'
		}
	});
	if (reverse) {
		// Auto-accept: they already sent us a request
		await acceptRequest(fromUserId, toUserId);
		return { ok: true };
	}
	const fromUser = await prisma.user.findUnique({
		where: { id: fromUserId },
		select: { name: true }
	});
	const senderName = fromUser?.name?.trim() || 'Someone';
	await prisma.$transaction([
		prisma.friendRequest.create({
			data: {
				fromUserId,
				toUserId,
				status: 'pending',
				updatedAt: new Date()
			}
		}),
		prisma.notification.create({
			data: {
				userId: toUserId,
				type: 'friend_request',
				title: 'Friend request',
				message: `${senderName} wants to be your friend.`,
				relatedEntityId: fromUserId
			}
		})
	]);
	return { ok: true, created: true };
}

/** Accept a pending request (caller is the recipient). */
export async function acceptRequest(
	recipientUserId: string,
	fromUserId: string
): Promise<{ ok: boolean; error?: string }> {
	const request = await prisma.friendRequest.findUnique({
		where: {
			fromUserId_toUserId: { fromUserId, toUserId: recipientUserId },
			status: 'pending'
		}
	});
	if (!request) {
		return { ok: false, error: 'Friend request not found or already handled' };
	}
	const [a, b] = orderedPair(fromUserId, recipientUserId);
	await prisma.$transaction([
		prisma.friendRequest.update({
			where: { id: request.id },
			data: { status: 'accepted', updatedAt: new Date() }
		}),
		prisma.friendship.create({
			data: { userIdA: a, userIdB: b }
		})
	]);
	return { ok: true };
}

/** Decline a pending request (caller is the recipient). */
export async function declineRequest(
	recipientUserId: string,
	fromUserId: string
): Promise<{ ok: boolean; error?: string }> {
	const request = await prisma.friendRequest.findUnique({
		where: {
			fromUserId_toUserId: { fromUserId, toUserId: recipientUserId },
			status: 'pending'
		}
	});
	if (!request) {
		return { ok: false, error: 'Friend request not found or already handled' };
	}
	await prisma.friendRequest.update({
		where: { id: request.id },
		data: { status: 'declined', updatedAt: new Date() }
	});
	return { ok: true };
}

/** Remove friendship (either user can call). */
export async function removeFriendship(
	userId: string,
	friendUserId: string
): Promise<{ ok: boolean; error?: string }> {
	const friendship = await prisma.friendship.findFirst({
		where: {
			OR: [
				{ userIdA: userId, userIdB: friendUserId },
				{ userIdA: friendUserId, userIdB: userId }
			]
		}
	});
	if (!friendship) {
		return { ok: false, error: 'Not friends' };
	}
	await prisma.friendship.delete({
		where: { id: friendship.id }
	});
	// Optionally clean up any old request rows
	await prisma.friendRequest.deleteMany({
		where: {
			OR: [
				{ fromUserId: userId, toUserId: friendUserId },
				{ fromUserId: friendUserId, toUserId: userId }
			]
		}
	});
	return { ok: true };
}
