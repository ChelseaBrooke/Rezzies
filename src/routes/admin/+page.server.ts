import type { PageServerLoad } from './$types';
import { prisma } from '$lib/server/prisma.js';

export const load: PageServerLoad = async ({ cookies: cookieStore }) => {
	// Get admin user from session (simplified - in production, store user ID in session)
	const session = cookieStore.get('admin_session');
	if (!session) {
		return { trips: [], reservations: [] };
	}

	// Get all trips (for now, show all - later filter by host)
	const trips = await prisma.trip.findMany({
		include: {
			rooms: {
				include: {
					beds: true
				}
			},
			reservations: {
				include: {
					room: true,
					bed: true
				}
			}
		},
		orderBy: {
			createdAt: 'desc'
		}
	});

	// Get all reservations across all trips
	const reservations = await prisma.reservation.findMany({
		include: {
			trip: true,
			room: true,
			bed: true
		},
		orderBy: {
			submittedAt: 'desc'
		}
	});

	// Legacy submissions for backward compatibility
	const legacySubmissions = await prisma.guestSubmission.findMany({
		include: {
			room: true,
			bed: true
		},
		orderBy: {
			submittedAt: 'desc'
		}
	});

	return {
		trips,
		reservations,
		legacySubmissions
	};
};

