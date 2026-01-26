// Property ingestion service for Airbnb/VRBO URLs
// Uses HTML scraping to extract property information and prices

import { scrapePropertyInfo, updateScrapingConfig } from './property-scraper.js';
import { extractVRBOParams, fetchVRBOPriceFromGraphQL } from './vrbo-graphql.js';

export interface PropertyInfo {
	title: string;
	coverPhoto: string | null;
	maxGuests: number | null; // null if not available - host must enter manually
	availableDates?: {
		start: Date;
		end: Date;
	}[];
	description?: string;
	// Dates and guests extracted from URL parameters
	checkInDate?: string;
	checkOutDate?: string;
	guests?: number;
	// Price and error info
	totalPrice?: number | null; // Price in cents
	totalNights?: number | null; // Number of nights (if found in "for X nights" format)
	error?: {
		type: 'UNAVAILABLE_DATES' | 'TOO_MANY_GUESTS';
		message: string;
	};
}

/**
 * Extract property ID from Airbnb URL
 * Format: https://www.airbnb.com/rooms/12345678
 */
function extractAirbnbId(url: string): string | null {
	const match = url.match(/airbnb\.com\/rooms\/(\d+)/);
	return match ? match[1] : null;
}

/**
 * Extract property ID from VRBO URL
 * Format: https://www.vrbo.com/12345678
 * Also handles search URLs: https://www.vrbo.com/search?...&selected=12345678
 */
function extractVRBOId(url: string): string | null {
	// First, try direct listing URL format: vrbo.com/12345678
	const directMatch = url.match(/vrbo\.com\/(\d+)(?:\?|$)/);
	if (directMatch) {
		return directMatch[1];
	}
	
	// If it's a search URL, extract from 'selected' parameter
	if (url.includes('vrbo.com/search')) {
		try {
			const urlObj = new URL(url);
			const selected = urlObj.searchParams.get('selected');
			if (selected) {
				return selected;
			}
		} catch (e) {
			// Invalid URL, continue
		}
	}
	
	return null;
}

// All extraction logic moved to property-scraper.ts

/**
 * Fetch property information from URL
 * Uses custom scraper (free) - configure selectors in property-scraper.ts
 */
/**
 * Check if URL is a checkout/booking page
 * Checkout pages have the final calculated price
 */
function isCheckoutUrl(url: string): boolean {
	return url.includes('/checkout/') || url.includes('/book/') || url.includes('/reserve/');
}

export async function fetchPropertyInfo(url: string): Promise<PropertyInfo | null> {
	const timestamp = new Date().toISOString();
	console.log(`[${timestamp}] 🏠 fetchPropertyInfo called for: ${url}`);
	
	try {
		// Validate URL
		if (!url || (!url.includes('airbnb.com') && !url.includes('vrbo.com'))) {
			console.log(`[${timestamp}] ❌ Invalid URL (not Airbnb or VRBO)`);
			return null;
		}

		// Check if this is a checkout URL - these have the final price!
		const isCheckout = isCheckoutUrl(url);
		if (isCheckout) {
			console.log(`[${timestamp}] ✅ Detected checkout URL - this should have the final calculated price!`);
		} else {
			console.log(`[${timestamp}] ⚠️ Not a checkout URL - price may not be accurate`);
		}

		const isAirbnb = url.includes('airbnb.com');
		const propertyId = isAirbnb ? extractAirbnbId(url) : extractVRBOId(url);
		
		console.log(`[${timestamp}] 🔍 URL Analysis:`);
		console.log(`[${timestamp}]   - isAirbnb: ${isAirbnb}`);
		console.log(`[${timestamp}]   - isCheckout: ${isCheckout}`);
		console.log(`[${timestamp}]   - propertyId: ${propertyId || '(not found)'}`);

		// For checkout URLs, property ID might not be extractable from URL structure
		// But we can still scrape the checkout page for price
		if (!propertyId && !isCheckout) {
			console.log(`[${timestamp}] ❌ Could not extract property ID from URL: ${url}`);
			return null;
		}

		// If it's a checkout URL, use it directly (it has the final price!)
		// Otherwise, if it's a VRBO search URL, convert it to a direct listing URL
		let urlToScrape = url;
		if (isCheckout) {
			// Use checkout URL directly - it should have the final calculated price
			urlToScrape = url;
			console.log('Using checkout URL directly for price extraction:', urlToScrape);
		} else if (!isAirbnb && url.includes('vrbo.com/search')) {
			// Convert search URL to direct listing URL
			// Keep the query parameters for dates/guests, but use direct property URL
			try {
				const urlObj = new URL(url);
				const params = urlObj.searchParams;
				
				// Build direct listing URL with query params
				urlToScrape = `https://www.vrbo.com/${propertyId}?${params.toString()}`;
				console.log('Converted search URL to direct listing URL:', urlToScrape);
			} catch (e) {
				// If URL parsing fails, use direct URL without params
				urlToScrape = `https://www.vrbo.com/${propertyId}`;
			}
		}

		// Extract dates and guests from URL for price extraction
		let scrapedPrice: number | null = null;
		let scrapedNights: number | null = null;
		
		// Extract dates and guests from URL
		const vrboParams = !isAirbnb ? extractVRBOParams(url) : null;
		let checkInDate: string | null = null;
		let checkOutDate: string | null = null;
		let guestCount: number | null = null;
		
		if (vrboParams?.checkInDate && vrboParams?.checkOutDate) {
			checkInDate = `${vrboParams.checkInDate.year}-${String(vrboParams.checkInDate.month).padStart(2, '0')}-${String(vrboParams.checkInDate.day).padStart(2, '0')}`;
			checkOutDate = `${vrboParams.checkOutDate.year}-${String(vrboParams.checkOutDate.month).padStart(2, '0')}-${String(vrboParams.checkOutDate.day).padStart(2, '0')}`;
			guestCount = vrboParams.adults || 2;
		} else {
			// Try to extract from URL params directly
			try {
				const urlObj = new URL(url);
				const params = urlObj.searchParams;
				checkInDate = params.get('chkin') || params.get('checkIn') || params.get('startDate') || params.get('check_in');
				checkOutDate = params.get('chkout') || params.get('checkOut') || params.get('endDate') || params.get('check_out');
				const guestsParam = params.get('adults') || params.get('guests') || params.get('guest_count');
				guestCount = guestsParam ? parseInt(guestsParam, 10) : 2;
			} catch (e) {
				// URL parsing failed
			}
		}
		
		// Scrape HTML for property information and price
		console.log(`[${timestamp}] 🕷️ Scraping HTML for property information...`);
		const scraped = await scrapePropertyInfo(urlToScrape, undefined, isCheckout);

		console.log(`[${timestamp}] 📊 Scraped data:`);
		console.log(`[${timestamp}]   - title: ${scraped.title || '(not found)'}`);
		console.log(`[${timestamp}]   - maxGuests: ${scraped.maxGuests || '(not found)'}`);
		console.log(`[${timestamp}]   - coverPhoto: ${scraped.coverPhoto || '(not found)'}`);
		console.log(`[${timestamp}]   - totalPrice: ${scraped.totalPrice ? '$' + (scraped.totalPrice / 100).toFixed(2) : '(not found)'}`);
		console.log(`[${timestamp}]   - totalNights: ${scraped.totalNights || '(not found)'}`);
		
		// Use scraped price if available
		if (scraped.totalPrice) {
			scrapedPrice = scraped.totalPrice;
			scrapedNights = scraped.totalNights;
			console.log(`[${timestamp}] ✅ Using scraped HTML price: $${(scrapedPrice / 100).toFixed(2)}`);
		}
		
		// Final price and nights
		const finalPrice = scrapedPrice || scraped.totalPrice;
		const finalNights = scrapedNights || scraped.totalNights;

		// Extract dates from URL to calculate nights if scraper didn't find them
		let calculatedNights: number | null = null;
		if (isCheckout) {
			try {
				const urlObj = new URL(url);
				const params = urlObj.searchParams;
				
				// Try to get dates from legacyUrl parameter (VRBO checkout)
				let checkIn: string | null = null;
				let checkOut: string | null = null;
				
				if (params.has('legacyUrl')) {
					try {
						// legacyUrl is URL-encoded, decode it
						const legacyUrlEncoded = params.get('legacyUrl') || '';
						const legacyUrl = decodeURIComponent(legacyUrlEncoded);
						
						// legacyUrl is a relative path like "/checkout?arrivalDate=01%2F26%2F2026&..."
						// The dates inside are also URL-encoded, so we need to parse the query string
						// Extract the query string part (after the ?)
						const queryString = legacyUrl.includes('?') ? legacyUrl.split('?')[1] : legacyUrl;
						const legacyParams = new URLSearchParams(queryString);
						
						// Dates are still URL-encoded in the query string (e.g., 01%2F26%2F2026)
						const arrivalDateEncoded = legacyParams.get('arrivalDate');
						const departureDateEncoded = legacyParams.get('departureDate');
						
						if (arrivalDateEncoded && departureDateEncoded) {
							// Decode the dates (they're URL-encoded: 01%2F26%2F2026 -> 01/26/2026)
							const arrivalDate = decodeURIComponent(arrivalDateEncoded); // MM/DD/YYYY
							const departureDate = decodeURIComponent(departureDateEncoded); // MM/DD/YYYY
							
							if (arrivalDate && departureDate) {
								const [month1, day1, year1] = arrivalDate.split('/');
								const [month2, day2, year2] = departureDate.split('/');
								if (month1 && day1 && year1 && month2 && day2 && year2) {
									checkIn = `${year1}-${month1.padStart(2, '0')}-${day1.padStart(2, '0')}`;
									checkOut = `${year2}-${month2.padStart(2, '0')}-${day2.padStart(2, '0')}`;
									console.log(`Extracted dates from legacyUrl: ${checkIn} to ${checkOut}`);
								}
							}
						}
					} catch (e) {
						console.log('Error parsing legacyUrl:', e);
					}
				}
				
				// If we have dates, calculate nights
				if (checkIn && checkOut) {
					const checkInDate = new Date(checkIn);
					const checkOutDate = new Date(checkOut);
					const nights = Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24));
					if (nights > 0) {
						calculatedNights = nights;
						console.log(`[${timestamp}] 📅 Calculated ${calculatedNights} nights from checkout URL dates: ${checkIn} to ${checkOut}`);
					}
				} else {
					console.log(`[${timestamp}] ⚠️ Could not extract dates from legacyUrl - checkIn: ${checkIn || '(missing)'}, checkOut: ${checkOut || '(missing)'}`);
				}
			} catch (e) {
				console.log(`[${timestamp}] ❌ Could not calculate nights from checkout URL:`, e);
			}
		}

		// Build result
		const title = scraped.title || (isAirbnb ? `Airbnb Property ${propertyId}` : `VRBO Property ${propertyId}`);
		
		return {
			title,
			coverPhoto: scraped.coverPhoto,
			maxGuests: scraped.maxGuests,
			availableDates: scraped.availableDates,
			totalPrice: finalPrice,
			// Use calculated nights if scraper didn't find them, or prefer scraper's value if it exists
			totalNights: finalNights || calculatedNights || undefined,
			error: scraped.error,
			description: `Property listing from ${isAirbnb ? 'Airbnb' : 'VRBO'}`
		};
	} catch (error) {
		const errorMsg = error instanceof Error ? error.message : String(error);
		console.error(`[${timestamp}] ❌ Property info fetch FAILED: ${errorMsg}`);
		console.error(`[${timestamp}]   Stack: ${error instanceof Error ? error.stack : 'N/A'}`);
		
		// Re-throw the error so it propagates to the API endpoint
		// The API will return a proper error response to the client
		throw error;
	}
}

/**
 * Validate that a URL is a valid property URL
 * Accepts listing URLs (vrbo.com/12345678 or airbnb.com/rooms/12345678)
 * Also accepts checkout URLs for backward compatibility
 */
export function isValidPropertyUrl(url: string): boolean {
	if (!url) return false;
	
	// Accept listing URLs
	if (url.includes('vrbo.com/') && /vrbo\.com\/\d+/.test(url)) {
		return true;
	}
	if (url.includes('airbnb.com/rooms/')) {
		return true;
	}
	
	// Also accept checkout URLs for backward compatibility
	if (url.includes('/checkout/') || url.includes('/book/') || url.includes('/reserve/')) {
		return true;
	}
	
	return false;
}
