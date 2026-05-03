import { redirect } from '@sveltejs/kit';
import { FEATURE_TRIP_GAMES } from '$lib/config/features.js';

/** Use in trip `games` route loads and actions when `FEATURE_TRIP_GAMES` is false. */
export function ensureTripGamesEnabled(tripId: string): void {
	if (!FEATURE_TRIP_GAMES) {
		throw redirect(303, `/trips/${tripId}`);
	}
}
