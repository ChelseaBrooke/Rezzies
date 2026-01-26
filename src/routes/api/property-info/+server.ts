import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { fetchPropertyInfo, isValidPropertyUrl } from '$lib/server/property-ingestion.js';
import { createSuccessResponse, createErrorResponse } from '$lib/server/validation.js';

/**
 * Extract dates and guests from URL parameters
 * For listing URLs, dates may be in:
 * - VRBO: chkin/chkout, startDate/endDate, checkIn/checkOut
 * - Airbnb: check_in/check_out
 * For checkout URLs, dates may be in:
 * - Direct params: checkIn, checkOut, adults
 * - legacyUrl parameter (VRBO): URL-encoded with arrivalDate, departureDate, adults
 */
function extractUrlParams(propertyUrl: string): {
	checkInDate?: string;
	checkOutDate?: string;
	guests?: number;
} {
	try {
		const urlObj = new URL(propertyUrl);
		const params = urlObj.searchParams;
		
		const result: {
			checkInDate?: string;
			checkOutDate?: string;
			guests?: number;
		} = {};
		
		// First, try direct parameters
		let checkIn = params.get('checkIn') || params.get('check_in') || params.get('startDate');
		let checkOut = params.get('checkOut') || params.get('check_out') || params.get('endDate');
		let adults = params.get('adults') || params.get('guests');
		
		// For VRBO checkout URLs, check legacyUrl parameter (URL-encoded)
		if (!checkIn && params.has('legacyUrl')) {
			try {
				// legacyUrl is URL-encoded, decode it
				const legacyUrlEncoded = params.get('legacyUrl') || '';
				const legacyUrl = decodeURIComponent(legacyUrlEncoded);
				
				// legacyUrl is a relative path like "/checkout?arrivalDate=01%2F26%2F2026&..."
				// The dates inside are also URL-encoded, so we need to parse the query string
				const queryString = legacyUrl.includes('?') ? legacyUrl.split('?')[1] : legacyUrl;
				const legacyParams = new URLSearchParams(queryString);
				
				// Dates are still URL-encoded in the query string (e.g., 01%2F26%2F2026)
				const arrivalDateEncoded = legacyParams.get('arrivalDate');
				const departureDateEncoded = legacyParams.get('departureDate');
				const legacyAdults = legacyParams.get('adults');
				
				if (arrivalDateEncoded) {
					// Decode the date (it's URL-encoded: 01%2F26%2F2026 -> 01/26/2026)
					const arrivalDate = decodeURIComponent(arrivalDateEncoded);
					// Convert MM/DD/YYYY to YYYY-MM-DD
					const [month, day, year] = arrivalDate.split('/');
					if (month && day && year) {
						checkIn = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
					}
				}
				
				if (departureDateEncoded) {
					// Decode the date (it's URL-encoded: 01%2F31%2F2026 -> 01/31/2026)
					const departureDate = decodeURIComponent(departureDateEncoded);
					// Convert MM/DD/YYYY to YYYY-MM-DD
					const [month, day, year] = departureDate.split('/');
					if (month && day && year) {
						checkOut = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
					}
				}
				
				if (legacyAdults && !adults) {
					adults = legacyAdults;
				}
			} catch (e) {
				// Legacy URL parsing failed, continue with direct params
				console.log('Could not parse legacyUrl parameter:', e);
			}
		}
		
		if (checkIn) {
			result.checkInDate = checkIn;
		}
		if (checkOut) {
			result.checkOutDate = checkOut;
		}
		if (adults) {
			const guestCount = parseInt(adults, 10);
			if (!isNaN(guestCount)) {
				result.guests = guestCount;
			}
		}
		
		return result;
	} catch (e) {
		// Invalid URL, return empty
		return {};
	}
}

export const GET: RequestHandler = async ({ url }) => {
	const timestamp = new Date().toISOString();
	console.log('\n' + '='.repeat(80));
	console.log(`[${timestamp}] 🔍 PROPERTY INFO API REQUEST`);
	console.log('='.repeat(80));
	
	const propertyUrl = url.searchParams.get('url');
	console.log(`[${timestamp}] 📍 Request URL: ${url.toString()}`);
	console.log(`[${timestamp}] 🔗 Property URL: ${propertyUrl || '(missing)'}`);

	if (!propertyUrl) {
		console.log(`[${timestamp}] ❌ Missing property URL`);
		return json(
			createErrorResponse('MISSING_URL', 'Property URL is required'),
			400
		);
	}

	if (!isValidPropertyUrl(propertyUrl)) {
		console.log(`[${timestamp}] ❌ Invalid property URL (not a checkout URL)`);
		return json(
			createErrorResponse('INVALID_URL', 'URL must be a checkout/booking URL from Airbnb or VRBO. Please click "Book now" or "Reserve" on the listing page and copy that URL.'),
			400
		);
	}

	try {
		console.log(`[${timestamp}] ✅ Starting property info fetch for: ${propertyUrl}`);
		
		// Extract dates and guests from URL parameters
		console.log(`[${timestamp}] 🔍 Extracting URL parameters...`);
		const urlParams = extractUrlParams(propertyUrl);
		console.log(`[${timestamp}] 📅 Extracted URL parameters:`);
		console.log(`[${timestamp}]   - checkInDate: ${urlParams.checkInDate || '(not found)'}`);
		console.log(`[${timestamp}]   - checkOutDate: ${urlParams.checkOutDate || '(not found)'}`);
		console.log(`[${timestamp}]   - guests: ${urlParams.guests || '(not found)'}`);
		
		console.log(`[${timestamp}] 🌐 Fetching property info from scraper...`);
		const propertyInfo = await fetchPropertyInfo(propertyUrl);
		console.log(`[${timestamp}] 📦 Property info result:`);
		console.log(`[${timestamp}]   - title: ${propertyInfo.title || '(not found)'}`);
		console.log(`[${timestamp}]   - maxGuests: ${propertyInfo.maxGuests || '(not found)'}`);
		console.log(`[${timestamp}]   - totalPrice: ${propertyInfo.totalPrice ? '$' + (propertyInfo.totalPrice / 100).toFixed(2) : '(not found)'}`);
		console.log(`[${timestamp}]   - totalNights: ${propertyInfo.totalNights || '(not found)'}`);
		console.log(`[${timestamp}]   - checkInDate: ${propertyInfo.checkInDate || '(not found)'}`);
		console.log(`[${timestamp}]   - checkOutDate: ${propertyInfo.checkOutDate || '(not found)'}`);

		// Merge URL parameters into property info
		// URL params take precedence over scraped values (they're more reliable for checkout URLs)
		const result = {
			...propertyInfo,
			// Override with URL params if they exist (these are extracted from checkout URL)
			checkInDate: urlParams.checkInDate || propertyInfo.checkInDate || undefined,
			checkOutDate: urlParams.checkOutDate || propertyInfo.checkOutDate || undefined,
			guests: urlParams.guests || propertyInfo.guests || undefined
		};
		
		console.log(`[${timestamp}] ✨ Final result with merged URL params:`);
		console.log(`[${timestamp}]   - checkInDate: ${result.checkInDate || '(not set)'}`);
		console.log(`[${timestamp}]   - checkOutDate: ${result.checkOutDate || '(not set)'}`);
		console.log(`[${timestamp}]   - guests: ${result.guests || '(not set)'}`);
		console.log(`[${timestamp}]   - totalPrice: ${result.totalPrice ? '$' + (result.totalPrice / 100).toFixed(2) : '(not set)'}`);
		console.log(`[${timestamp}]   - totalNights: ${result.totalNights || '(not set)'}`);
		console.log('='.repeat(80) + '\n');

		// If scraping failed but we got basic info, return it with a note
		if (propertyInfo.maxGuests === null) {
			// Still return success, but UI will show that manual entry is needed
			return json(createSuccessResponse(result));
		}

		return json(createSuccessResponse(result));
	} catch (error) {
		const errorTimestamp = new Date().toISOString();
		const errorMsg = error instanceof Error ? error.message : String(error);
		
		console.error(`[${errorTimestamp}] ❌ Property info error: ${errorMsg}`);
		if (error instanceof Error) {
			console.error(`[${errorTimestamp}]   Error stack: ${error.stack}`);
		}
		console.log('='.repeat(80) + '\n');
		
		// Return error with clear message
		// Error will explain why extraction failed
		return json(
			createErrorResponse(
				'EXTRACTION_FAILED', 
				errorMsg || 'Failed to extract property information. Check server logs for details.',
				errorMsg
			),
			500
		);
	}
};
