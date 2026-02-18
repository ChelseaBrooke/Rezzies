import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSessionUser } from '$lib/server/session.js';
import { isTripMember } from '$lib/server/trip-access.js';
import { prisma } from '$lib/server/prisma.js';
import { DIVVI_EVENTS_API_KEY, DIVVI_EVENTS_API_BASE_URL } from '$env/static/private';

export const POST: RequestHandler = async ({ request, params, cookies }) => {
	const user = await getSessionUser(cookies);
	if (!user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const tripId = params.tripId;
	const member = await isTripMember(tripId, user.id);
	if (!member) {
		return json({ error: 'Forbidden' }, { status: 403 });
	}

	const trip = await prisma.trip.findUnique({
		where: { id: tripId },
		select: {
			locationCity: true,
			fullAddress: true,
			location: true,
			checkInDate: true,
			checkOutDate: true,
			expectedPeopleCount: true,
			maxGuests: true,
			members: { select: { id: true } },
			rsvps: {
				where: { status: 'yes' },
				select: { adultsCount: true, kidsCount: true }
			}
		}
	});

	if (!trip) {
		return json({ error: 'Trip not found' }, { status: 404 });
	}

	if (!DIVVI_EVENTS_API_BASE_URL || !DIVVI_EVENTS_API_KEY) {
		return json(
			{ error: 'Events discovery is not configured. Please set DIVVI_EVENTS_API_BASE_URL and DIVVI_EVENTS_API_KEY.' },
			{ status: 503 }
		);
	}

	const body = await request.json();
	const { keywords, categories, budget, indoor_outdoor, sort_by, page, radius_miles } = body as {
		keywords?: string[];
		categories?: string[];
		budget?: string;
		indoor_outdoor?: string;
		sort_by?: string;
		page?: number;
		radius_miles?: number;
	};

	// Validate inputs
	if (keywords && (!Array.isArray(keywords) || keywords.some((k) => typeof k !== 'string'))) {
		return json({ error: 'Invalid keywords format' }, { status: 400 });
	}
	if (page != null && (typeof page !== 'number' || page < 1)) {
		return json({ error: 'Invalid page number' }, { status: 400 });
	}

	// Derive city and state from trip data
	const city = trip.locationCity || parseCityFromAddress(trip.fullAddress || trip.location || '');
	const state = parseStateFromAddress(trip.fullAddress || trip.location || '');

	if (!city) {
		return json(
			{ error: 'Trip location is not set. Please add a destination to the trip first.' },
			{ status: 400 }
		);
	}

	if (!trip.checkInDate || !trip.checkOutDate) {
		return json(
			{ error: 'Trip dates are not set. Please add check-in and check-out dates first.' },
			{ status: 400 }
		);
	}

	// Derive group size from RSVPs, expectedPeopleCount, maxGuests, or member count
	const rsvpTotal = trip.rsvps.reduce((sum, r) => sum + (r.adultsCount || 0) + (r.kidsCount || 0), 0);
	const groupSize = rsvpTotal || trip.expectedPeopleCount || trip.maxGuests || trip.members.length || 4;

	// Determine age range based on whether kids are in the RSVPs
	const hasKids = trip.rsvps.some((r) => (r.kidsCount || 0) > 0);
	const ageRange = hasKids ? 'mixed' : 'adults';

	// Build the Divvi API request
	const locationObj: Record<string, string | number> = { city };
	if (state) locationObj.state = state;
	if (radius_miles && radius_miles >= 1 && radius_miles <= 100) {
		locationObj.radius_miles = radius_miles;
	}

	const discoverRequest: Record<string, unknown> = {
		location: locationObj,
		date_range: {
			start: formatDate(trip.checkInDate),
			end: formatDate(trip.checkOutDate)
		},
		group: {
			size: groupSize,
			age_range: ageRange
		},
		options: {
			include_weather: true,
			detail_level: 'summary',
			max_results: 20,
			page: page || 1,
			sort_by: sort_by || 'relevance'
		}
	};

	// Add optional filters
	const filters: Record<string, unknown> = {};
	if (keywords && keywords.length > 0) filters.keywords = keywords;
	if (categories && categories.length > 0) filters.categories = categories;
	if (budget) filters.budget = budget;
	if (indoor_outdoor) filters.indoor_outdoor = indoor_outdoor;
	if (Object.keys(filters).length > 0) {
		discoverRequest.filters = filters;
	}

	try {
		const apiUrl = `${DIVVI_EVENTS_API_BASE_URL}/api/v1/discover`;
		const res = await fetch(apiUrl, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'X-API-Key': DIVVI_EVENTS_API_KEY
			},
			body: JSON.stringify(discoverRequest)
		});

		if (!res.ok) {
			const errorBody = await res.json().catch(() => ({ error: 'Unknown error' }));
			console.error('Divvi Events API error:', res.status, errorBody);
			return json(
				{ error: errorBody.error || `Events API returned ${res.status}`, details: errorBody.details },
				{ status: res.status >= 500 ? 502 : res.status }
			);
		}

		const data = await res.json();
		return json(data);
	} catch (err) {
		console.error('Divvi Events API fetch error:', err);
		return json(
			{ error: 'Failed to connect to events service' },
			{ status: 502 }
		);
	}
};

function formatDate(date: Date): string {
	return date.toISOString().split('T')[0];
}

function parseCityFromAddress(address: string): string {
	if (!address) return '';
	// Try "City, State ZIP" or "City, State" pattern
	const parts = address.split(',').map((p) => p.trim());
	if (parts.length >= 2) {
		// Second-to-last part is usually the city in "Street, City, State ZIP" format
		// Or first part in "City, State" format
		if (parts.length === 2) return parts[0];
		return parts[parts.length - 2];
	}
	return parts[0];
}

function parseStateFromAddress(address: string): string {
	if (!address) return '';
	const parts = address.split(',').map((p) => p.trim());
	if (parts.length >= 2) {
		// Last meaningful part often has "State ZIP" or just "State"
		const lastPart = parts[parts.length - 1];
		// Remove ZIP code if present
		const stateMatch = lastPart.match(/^([A-Za-z\s]+?)(?:\s+\d{5})?$/);
		if (stateMatch) return stateMatch[1].trim();
		return lastPart;
	}
	return '';
}
