/**
 * Pluggable activities search provider interface.
 * Implementations (Google, Yelp, etc.) run server-side only; API key never exposed to client.
 */

export type ActivityProviderName = 'google' | 'yelp' | 'mapbox' | 'ticketmaster';

export interface SearchActivitiesParams {
	query?: string;
	category?: string;
	lat: number;
	lng: number;
	radiusMeters: number;
}

export interface ActivitySearchResult {
	provider: ActivityProviderName;
	placeId: string;
	title: string;
	category?: string;
	address?: string;
	lat?: number;
	lng?: number;
	priceLevel?: number;
	rating?: number;
	distanceMeters?: number;
	linkUrl?: string;
}

export interface GetActivityDetailsParams {
	placeId: string;
	provider: ActivityProviderName;
}

export interface ActivityDetailsResult extends ActivitySearchResult {
	// Extended fields from Place Details if needed
	phone?: string;
	website?: string;
	openingHours?: string;
}

export interface ActivitiesSearchProvider {
	readonly name: ActivityProviderName;
	searchActivities(params: SearchActivitiesParams): Promise<ActivitySearchResult[]>;
	getActivityDetails?(params: GetActivityDetailsParams): Promise<ActivityDetailsResult | null>;
}
