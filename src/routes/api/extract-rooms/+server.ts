import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { extractPropertyRoomsAndPhotos } from '$lib/server/room-extractor.js';
import { createSuccessResponse, createErrorResponse } from '$lib/server/validation.js';

/**
 * GET /api/extract-rooms?url=...
 * Extracts rooms, beds, and photos from a VRBO/Airbnb listing URL
 */
export const GET: RequestHandler = async ({ url }) => {
	const listingUrl = url.searchParams.get('url');
	
	if (!listingUrl) {
		return json(
			createErrorResponse('MISSING_URL', 'Listing URL is required'),
			400
		);
	}
	
	try {
		const data = await extractPropertyRoomsAndPhotos(listingUrl);
		
		return json(createSuccessResponse(data));
	} catch (error) {
		const errorMsg = error instanceof Error ? error.message : String(error);
		console.error('Error extracting rooms/photos:', errorMsg);
		
		return json(
			createErrorResponse('EXTRACTION_FAILED', errorMsg || 'Failed to extract rooms and photos'),
			500
		);
	}
};
