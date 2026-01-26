import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { fetchPropertyInfo } from '$lib/server/property-ingestion.js';
import { extractPropertyRoomsAndPhotos } from '$lib/server/room-extractor.js';
import { createSuccessResponse, createErrorResponse } from '$lib/server/validation.js';

/**
 * POST /api/autofill
 * Scrapes all property information from a listing URL
 * Returns: property info, rooms, beds, and photos
 */
export const POST: RequestHandler = async ({ request }) => {
	try {
		const { listingUrl } = await request.json();
		
		if (!listingUrl) {
			return json(
				createErrorResponse('MISSING_URL', 'Listing URL is required'),
				400
			);
		}

		if (!listingUrl.includes('airbnb.com') && !listingUrl.includes('vrbo.com')) {
			return json(
				createErrorResponse('INVALID_URL', 'URL must be from Airbnb or VRBO'),
				400
			);
		}

		// Step 1: Fetch property info (title, photos, max guests, dates, price)
		const propertyInfo = await fetchPropertyInfo(listingUrl);
		
		if (!propertyInfo) {
			return json(
				createErrorResponse('EXTRACTION_FAILED', 'Could not extract property information'),
				500
			);
		}

		// Step 2: Extract rooms, beds, and photos
		let roomsAndPhotos = null;
		try {
			roomsAndPhotos = await extractPropertyRoomsAndPhotos(listingUrl);
		} catch (error) {
			console.error('[Autofill] Error extracting rooms/photos:', error);
			// Continue without rooms/photos - they can be added manually
		}

		return json(createSuccessResponse({
			propertyInfo,
			rooms: roomsAndPhotos?.rooms || [],
			photos: roomsAndPhotos?.photos || []
		}));
	} catch (error) {
		const errorMsg = error instanceof Error ? error.message : String(error);
		console.error('[Autofill] Error:', errorMsg);
		
		return json(
			createErrorResponse('EXTRACTION_FAILED', errorMsg || 'Failed to extract property data'),
			500
		);
	}
};
