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
	const startTime = Date.now();
	console.log('[Autofill API] Request received');
	
	try {
		const { listingUrl } = await request.json();
		console.log('[Autofill API] Processing URL:', listingUrl);
		
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
		console.log('[Autofill API] Step 1: Fetching property info...');
		const propertyInfoStart = Date.now();
		const propertyInfo = await fetchPropertyInfo(listingUrl);
		console.log('[Autofill API] Step 1 completed in', Date.now() - propertyInfoStart, 'ms');
		
		if (!propertyInfo) {
			console.error('[Autofill API] Property info extraction returned null');
			return json(
				createErrorResponse('EXTRACTION_FAILED', 'Could not extract property information'),
				500
			);
		}

		// Step 2: Extract rooms, beds, and photos
		console.log('[Autofill API] Step 2: Extracting rooms and photos...');
		const roomsStart = Date.now();
		let roomsAndPhotos = null;
		try {
			roomsAndPhotos = await extractPropertyRoomsAndPhotos(listingUrl);
			console.log('[Autofill API] Step 2 completed in', Date.now() - roomsStart, 'ms');
		} catch (error) {
			console.error('[Autofill API] Error extracting rooms/photos:', error);
			// Continue without rooms/photos - they can be added manually
		}

		const totalTime = Date.now() - startTime;
		console.log('[Autofill API] Total time:', totalTime, 'ms');

		return json(createSuccessResponse({
			propertyInfo,
			rooms: roomsAndPhotos?.rooms || [],
			photos: roomsAndPhotos?.photos || []
		}));
	} catch (error) {
		const errorMsg = error instanceof Error ? error.message : String(error);
		const totalTime = Date.now() - startTime;
		console.error('[Autofill API] Error after', totalTime, 'ms:', errorMsg);
		console.error('[Autofill API] Error stack:', error instanceof Error ? error.stack : 'No stack');
		
		return json(
			createErrorResponse('EXTRACTION_FAILED', errorMsg || 'Failed to extract property data'),
			500
		);
	}
};
