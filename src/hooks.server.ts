import type { Handle } from '@sveltejs/kit';
import { getSessionUser, cleanupExpiredSessions } from '$lib/server/session.js';

// Lazily clean up expired sessions with ~1% probability on each request
// so we don't need a separate cron job.
const CLEANUP_PROBABILITY = 0.01;

export const handle: Handle = async ({ event, resolve }) => {
	// Attach user to locals once per request so child load functions can
	// read event.locals.user without hitting the DB again.
	event.locals.user = await getSessionUser(event.cookies);

	// Lazy session cleanup, fire-and-forget, never blocks the response.
	if (Math.random() < CLEANUP_PROBABILITY) {
		cleanupExpiredSessions().catch((err) =>
			console.error('[session cleanup]', err)
		);
	}

	return resolve(event);
};
