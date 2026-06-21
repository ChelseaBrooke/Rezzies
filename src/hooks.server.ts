import type { Handle } from '@sveltejs/kit';
import { getSessionUser, cleanupExpiredSessions } from '$lib/server/session.js';
import { prisma } from '$lib/server/prisma.js';

// Lazily clean up expired sessions with ~1% probability on each request
// so we don't need a separate cron job.
const CLEANUP_PROBABILITY = 0.01;
const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function getProtectedTripWrite(pathname: string): { tripId: string; source: 'route' | 'api' } | null {
	const routeMatch = pathname.match(/^\/trips\/([^/]+)\/(guests|itinerary|rooms|settings)(?:\/|$)/);
	if (routeMatch) {
		return { tripId: routeMatch[1], source: 'route' };
	}
	const apiMatch = pathname.match(/^\/api\/trips\/([^/]+)\/update(?:\/|$)/);
	if (apiMatch) {
		return { tripId: apiMatch[1], source: 'api' };
	}
	return null;
}

function hasTripEnded(checkOutDate: Date | null): boolean {
	if (!checkOutDate) return false;
	const endOfCheckoutDay = new Date(checkOutDate);
	endOfCheckoutDay.setHours(23, 59, 59, 999);
	return Date.now() > endOfCheckoutDay.getTime();
}

export const handle: Handle = async ({ event, resolve }) => {
	const perfStart = performance.now();

	// Attach user to locals once per request so child load functions can
	// read event.locals.user without hitting the DB again.
	event.locals.user = await getSessionUser(event.cookies);

	// Lazy session cleanup, fire-and-forget, never blocks the response.
	if (Math.random() < CLEANUP_PROBABILITY) {
		cleanupExpiredSessions().catch((err) =>
			console.error('[session cleanup]', err)
		);
	}

	const protectedWrite = getProtectedTripWrite(event.url.pathname);
	if (protectedWrite && WRITE_METHODS.has(event.request.method.toUpperCase())) {
		const trip = await prisma.trip.findUnique({
			where: { id: protectedWrite.tripId },
			select: { checkOutDate: true }
		});

		if (hasTripEnded(trip?.checkOutDate ?? null)) {
			if (protectedWrite.source === 'api') {
				return new Response(
					JSON.stringify({
						error: 'This trip is complete. Create a new trip to plan again.'
					}),
					{
						status: 403,
						headers: { 'content-type': 'application/json' }
					}
				);
			}
			return new Response('This trip is complete and can no longer be edited.', {
				status: 403
			});
		}
	}

	const response = await resolve(event);

	// Expose total server time so the dev-only PerfBadge can read it via the
	// browser's Server-Timing / resource-timing APIs. Cheap header, safe to
	// leave on in prod (it's just a timing number, no PII).
	const serverMs = performance.now() - perfStart;
	response.headers.set('Server-Timing', `srv;dur=${serverMs.toFixed(1)};desc="server"`);

	return response;
};
