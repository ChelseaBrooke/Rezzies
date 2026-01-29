import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	searchActivities as googleSearchActivities,
	geocodeAddress,
	isGooglePlacesConfigured
} from '$lib/server/activities/google-places.js';
import type { ActivitySearchResult } from '$lib/activities/providers/types.js';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();
		const {
			query,
			category,
			radiusMeters = 16093,
			lat: bodyLat,
			lng: bodyLng,
			destinationText
		} = body as {
			query?: string;
			category?: string;
			radiusMeters?: number;
			lat?: number;
			lng?: number;
			destinationText?: string;
		};

		if (!isGooglePlacesConfigured()) {
			return json({
				results: [] as ActivitySearchResult[],
				searchAvailable: false,
				message: 'Nearby search is not configured. Add activities manually or set GOOGLE_PLACES_API_KEY.'
			});
		}

		let lat = bodyLat;
		let lng = bodyLng;

		if ((lat == null || lng == null) && destinationText && String(destinationText).trim()) {
			const coords = await geocodeAddress(String(destinationText).trim());
			if (coords) {
				lat = coords.lat;
				lng = coords.lng;
			}
		}

		if (lat == null || lng == null) {
			return json({
				results: [] as ActivitySearchResult[],
				searchAvailable: true,
				message: 'Set destination on Overview to enable nearby search, or provide lat/lng.'
			});
		}

		const results = await googleSearchActivities({
			query,
			category,
			lat,
			lng,
			radiusMeters: Math.min(Math.max(Number(radiusMeters) || 16093, 1000), 50000)
		});

		return json({
			results,
			searchAvailable: true
		});
	} catch (err) {
		console.error('Activities search error:', err);
		return json(
			{
				results: [] as ActivitySearchResult[],
				searchAvailable: true,
				message: err instanceof Error ? err.message : 'Search failed'
			},
			{ status: 500 }
		);
	}
};

/** GET: Check if search is available (no key exposure) */
export const GET: RequestHandler = async () => {
	return json({
		searchAvailable: isGooglePlacesConfigured()
	});
};
