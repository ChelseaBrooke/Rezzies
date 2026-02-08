/**
 * GET full profile for Profile Card overlay: identity + stats + shared trips (for other user).
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSessionUser } from '$lib/server/session.js';
import { prisma } from '$lib/server/prisma.js';

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
			homeCity: true
		}
	});

	if (!user) {
		return json({ error: 'User not found' }, { status: 404 });
	}

	const isSelf = sessionUser?.id === userId;

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

	// Stub: no friends table yet
	const friendshipStatus = isSelf ? 'self' : 'none';

	return json({
		displayName: user.name || 'Traveler',
		avatarUrl: user.avatarUrl,
		travelStyle: user.travelStyle,
		homeCity: user.homeCity,
		isSelf,
		tripsHosted,
		tripsJoined,
		sharedTrips,
		friendshipStatus
	});
};
