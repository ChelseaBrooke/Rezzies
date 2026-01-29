/**
 * Google Places API adapter for nearby activities search.
 * Uses REST endpoints (Legacy) so we only need fetch + API key server-side.
 * Never expose GOOGLE_PLACES_API_KEY to the client.
 */

import type {
	ActivitySearchResult,
	SearchActivitiesParams,
	GetActivityDetailsParams,
	ActivityDetailsResult
} from '$lib/activities/providers/types.js';

const BASE = 'https://maps.googleapis.com/maps/api';

function getApiKey(): string | undefined {
	return typeof process !== 'undefined' ? process.env.GOOGLE_PLACES_API_KEY : undefined;
}

/** Geocode an address or place name to lat/lng */
export async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
	const key = getApiKey();
	if (!key) return null;
	const url = `${BASE}/geocode/json?address=${encodeURIComponent(address)}&key=${key}`;
	const res = await fetch(url);
	const data = await res.json();
	if (data.status !== 'OK' || !data.results?.[0]?.geometry?.location) return null;
	const { lat, lng } = data.results[0].geometry.location;
	return { lat, lng };
}

/** Map Google place type to simple category for chips */
const TYPE_TO_CATEGORY: Record<string, string> = {
	restaurant: 'Restaurants',
	cafe: 'Restaurants',
	bar: 'Nightlife',
	night_club: 'Nightlife',
	 park: 'Outdoors',
	natural_feature: 'Outdoors',
	gym: 'Wellness',
	spa: 'Wellness',
	museum: 'Attractions',
	art_gallery: 'Attractions',
	tourist_attraction: 'Attractions',
	zoo: 'Attractions',
	amusement_park: 'Attractions',
	shopping_mall: 'Attractions'
};

function mapTypesToCategory(types: string[] | undefined): string | undefined {
	if (!types?.length) return undefined;
	for (const t of types) {
		const cat = TYPE_TO_CATEGORY[t];
		if (cat) return cat;
	}
	return types[0] ? types[0].replace(/_/g, ' ') : undefined;
}

/**
 * Search for places near a lat/lng.
 * Uses Nearby Search (legacy) when no query, or Text Search when query provided (better for "hike", "brunch").
 */
export async function searchActivities(params: SearchActivitiesParams): Promise<ActivitySearchResult[]> {
	const key = getApiKey();
	if (!key) return [];

	const { lat, lng, radiusMeters, query, category } = params;
	const location = `${lat},${lng}`;

	// Optional type filter for Nearby: restaurant, cafe, bar, museum, park, etc.
	const typeMap: Record<string, string> = {
		Restaurants: 'restaurant',
		Outdoors: 'park',
		Attractions: 'tourist_attraction',
		Nightlife: 'bar',
		Wellness: 'gym'
	};
	const typeParam = category ? typeMap[category] ?? category.toLowerCase().replace(/\s+/g, '_') : '';

	let results: Array<{
		place_id: string;
		name?: string;
		vicinity?: string;
		geometry?: { location?: { lat: number; lng: number } };
		types?: string[];
		price_level?: number;
		rating?: number;
		opening_hours?: { open_now?: boolean };
	}> = [];

	if (query && query.trim()) {
		// Text Search: supports "hike", "brunch", "museum"
		const q = typeParam ? `${query} ${typeParam}` : query;
		const url = `${BASE}/place/textsearch/json?query=${encodeURIComponent(q)}&location=${location}&radius=${radiusMeters}&key=${key}`;
		const res = await fetch(url);
		const data = await res.json();
		if (data.status === 'OK' && Array.isArray(data.results)) results = data.results;
	} else {
		// Nearby Search: type required for legacy API
		const type = typeParam || 'point_of_interest';
		const url = `${BASE}/place/nearbysearch/json?location=${location}&radius=${radiusMeters}&type=${type}&key=${key}`;
		const res = await fetch(url);
		const data = await res.json();
		if (data.status === 'OK' && Array.isArray(data.results)) results = data.results;
	}

	return results.slice(0, 20).map((r) => ({
		provider: 'google' as const,
		placeId: r.place_id,
		title: r.name ?? 'Unnamed',
		category: mapTypesToCategory(r.types),
		address: r.vicinity,
		lat: r.geometry?.location?.lat,
		lng: r.geometry?.location?.lng,
		priceLevel: r.price_level,
		rating: r.rating,
		linkUrl: r.place_id ? `https://www.google.com/maps/place/?q=place_id:${r.place_id}` : undefined
	}));
}

/**
 * Fetch place details by place_id (optional, for extra fields).
 */
export async function getActivityDetails(params: GetActivityDetailsParams): Promise<ActivityDetailsResult | null> {
	const key = getApiKey();
	if (!key || params.provider !== 'google') return null;
	const url = `${BASE}/place/details/json?place_id=${encodeURIComponent(params.placeId)}&fields=name,formatted_address,geometry,url,formatted_phone_number,opening_hours,website&key=${key}`;
	const res = await fetch(url);
	const data = await res.json();
	if (data.status !== 'OK' || !data.result) return null;
	const r = data.result;
	return {
		provider: 'google',
		placeId: params.placeId,
		title: r.name ?? 'Unnamed',
		address: r.formatted_address,
		lat: r.geometry?.location?.lat,
		lng: r.geometry?.location?.lng,
		linkUrl: r.url ?? `https://www.google.com/maps/place/?q=place_id:${params.placeId}`,
		phone: r.formatted_phone_number,
		website: r.website
	};
}

export function isGooglePlacesConfigured(): boolean {
	return !!getApiKey();
}
