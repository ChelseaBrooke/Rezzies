/**
 * Extract final total price from checkout URLs
 * 
 * This module extracts the final total (including taxes/fees) from Airbnb/VRBO checkout pages.
 * Users paste the checkout URL after manually navigating to checkout in their browser.
 * 
 * NO browser automation - just fetch the checkout page HTML and extract the total.
 */

import { scrapePropertyInfo } from './property-scraper.js';

export interface CheckoutPriceResult {
	totalCents: number;
	currency: string;
	breakdown?: {
		nightsSubtotalCents?: number;
		cleaningFeeCents?: number;
		serviceFeeCents?: number;
		taxesCents?: number;
		otherFeesCents?: number;
	};
	source: 'airbnb' | 'vrbo';
	nights?: number;
}

/**
 * Detect provider from checkout URL
 */
export function detectProvider(checkoutUrl: string): 'airbnb' | 'vrbo' | 'unknown' {
	if (checkoutUrl.includes('airbnb.com') && (checkoutUrl.includes('/book/') || checkoutUrl.includes('/reserve/'))) {
		return 'airbnb';
	}
	if (checkoutUrl.includes('vrbo.com') && (checkoutUrl.includes('/checkout/') || checkoutUrl.includes('/book/'))) {
		return 'vrbo';
	}
	return 'unknown';
}

/**
 * Parse checkout context from URL (reservation IDs, quote IDs, etc.)
 * For debugging and validation
 */
export function parseCheckoutContext(checkoutUrl: string): {
	provider: 'airbnb' | 'vrbo' | 'unknown';
	reservationId?: string;
	quoteId?: string;
	sessionId?: string;
} {
	const provider = detectProvider(checkoutUrl);
	const result: ReturnType<typeof parseCheckoutContext> = { provider };
	
	try {
		const url = new URL(checkoutUrl);
		
		if (provider === 'airbnb') {
			// Airbnb checkout URLs: /book/stays/{reservationId} or /reserve/{reservationId}
			const pathMatch = checkoutUrl.match(/\/(?:book|reserve)\/(?:stays\/)?([^/?]+)/);
			if (pathMatch) {
				result.reservationId = pathMatch[1];
			}
			result.quoteId = url.searchParams.get('quote_id') || undefined;
		} else if (provider === 'vrbo') {
			// VRBO checkout URLs: /checkout/session/{sessionId} or /book/{id}
			const sessionMatch = checkoutUrl.match(/\/checkout\/session\/([^/?]+)/);
			if (sessionMatch) {
				result.sessionId = sessionMatch[1];
			}
			result.quoteId = url.searchParams.get('tripId') || url.searchParams.get('quoteId') || undefined;
		}
	} catch (e) {
		// Invalid URL, return basic info
	}
	
	return result;
}

/**
 * Extract price breakdown from VRBO checkout HTML
 */
function extractVRBOCheckoutBreakdown(html: string): Partial<CheckoutPriceResult['breakdown']> | null {
	// Look for price breakdown in VRBO checkout page
	// This is optional - we may not always find all breakdown items
	
	const breakdown: Partial<CheckoutPriceResult['breakdown']> = {};
	
	// Try to find individual fee items
	// VRBO checkout pages show: Nights subtotal, Cleaning fee, Service fee, Taxes, Total
	
	// Nights subtotal
	const nightsMatch = html.match(/(?:nights?|subtotal)[^$]*\$([\d,]+(?:\.\d{2})?)/i);
	if (nightsMatch) {
		const cents = Math.round(parseFloat(nightsMatch[1].replace(/,/g, '')) * 100);
		if (cents > 0) breakdown.nightsSubtotalCents = cents;
	}
	
	// Cleaning fee
	const cleaningMatch = html.match(/cleaning[^$]*fee[^$]*\$([\d,]+(?:\.\d{2})?)/i);
	if (cleaningMatch) {
		const cents = Math.round(parseFloat(cleaningMatch[1].replace(/,/g, '')) * 100);
		if (cents > 0) breakdown.cleaningFeeCents = cents;
	}
	
	// Service fee
	const serviceMatch = html.match(/service[^$]*fee[^$]*\$([\d,]+(?:\.\d{2})?)/i);
	if (serviceMatch) {
		const cents = Math.round(parseFloat(serviceMatch[1].replace(/,/g, '')) * 100);
		if (cents > 0) breakdown.serviceFeeCents = cents;
	}
	
	// Taxes
	const taxesMatch = html.match(/tax(?:es)?[^$]*\$([\d,]+(?:\.\d{2})?)/i);
	if (taxesMatch) {
		const cents = Math.round(parseFloat(taxesMatch[1].replace(/,/g, '')) * 100);
		if (cents > 0) breakdown.taxesCents = cents;
	}
	
	return Object.keys(breakdown).length > 0 ? breakdown : null;
}

/**
 * Extract price breakdown from Airbnb checkout HTML
 */
function extractAirbnbCheckoutBreakdown(html: string): Partial<CheckoutPriceResult['breakdown']> | null {
	const breakdown: Partial<CheckoutPriceResult['breakdown']> = {};
	
	// Airbnb checkout pages show similar breakdown
	// Look for structured data or specific selectors
	
	// Nights subtotal
	const nightsMatch = html.match(/(?:nights?|subtotal)[^$]*\$([\d,]+(?:\.\d{2})?)/i);
	if (nightsMatch) {
		const cents = Math.round(parseFloat(nightsMatch[1].replace(/,/g, '')) * 100);
		if (cents > 0) breakdown.nightsSubtotalCents = cents;
	}
	
	// Cleaning fee
	const cleaningMatch = html.match(/cleaning[^$]*fee[^$]*\$([\d,]+(?:\.\d{2})?)/i);
	if (cleaningMatch) {
		const cents = Math.round(parseFloat(cleaningMatch[1].replace(/,/g, '')) * 100);
		if (cents > 0) breakdown.cleaningFeeCents = cents;
	}
	
	// Service fee
	const serviceMatch = html.match(/service[^$]*fee[^$]*\$([\d,]+(?:\.\d{2})?)/i);
	if (serviceMatch) {
		const cents = Math.round(parseFloat(serviceMatch[1].replace(/,/g, '')) * 100);
		if (cents > 0) breakdown.serviceFeeCents = cents;
	}
	
	// Taxes
	const taxesMatch = html.match(/tax(?:es)?[^$]*\$([\d,]+(?:\.\d{2})?)/i);
	if (taxesMatch) {
		const cents = Math.round(parseFloat(taxesMatch[1].replace(/,/g, '')) * 100);
		if (cents > 0) breakdown.taxesCents = cents;
	}
	
	return Object.keys(breakdown).length > 0 ? breakdown : null;
}

/**
 * Extract listing URL from checkout session URL
 * For VRBO checkout session URLs, try to extract the property ID from legacyUrl parameter
 */
function extractListingUrlFromCheckout(checkoutUrl: string): string | null {
	try {
		const url = new URL(checkoutUrl);
		const legacyUrl = url.searchParams.get('legacyUrl');
		
		if (legacyUrl) {
			const decoded = decodeURIComponent(legacyUrl);
			// legacyUrl format: /checkout?lodgingDirectoryId=18968197&arrivalDate=...
			const lodgingIdMatch = decoded.match(/lodgingDirectoryId=(\d+)/);
			if (lodgingIdMatch) {
				const propertyId = lodgingIdMatch[1];
				// Extract dates and guests from legacyUrl
				const params = new URLSearchParams(decoded.split('?')[1] || '');
				const arrivalDate = params.get('arrivalDate');
				const departureDate = params.get('departureDate');
				const adults = params.get('adults');
				
				// Build listing URL with dates and guests
				let listingUrl = `https://www.vrbo.com/${propertyId}`;
				if (arrivalDate && departureDate) {
					// Convert dates from MM/DD/YYYY to YYYY-MM-DD
					const [month1, day1, year1] = arrivalDate.split('/');
					const [month2, day2, year2] = departureDate.split('/');
					if (month1 && day1 && year1 && month2 && day2 && year2) {
						const checkIn = `${year1}-${month1.padStart(2, '0')}-${day1.padStart(2, '0')}`;
						const checkOut = `${year2}-${month2.padStart(2, '0')}-${day2.padStart(2, '0')}`;
						listingUrl += `?chkin=${checkIn}&chkout=${checkOut}&startDate=${checkIn}&endDate=${checkOut}`;
						if (adults) {
							listingUrl += `&adults=${adults}`;
						}
					}
				}
				return listingUrl;
			}
		}
	} catch (e) {
		// URL parsing failed
	}
	return null;
}

/**
 * Extract final total from checkout URL
 * 
 * Fetches the checkout page HTML and extracts the final total including taxes/fees.
 * This is the total shown to users on the checkout page.
 */
export async function extractCheckoutTotal(checkoutUrl: string): Promise<CheckoutPriceResult> {
	const provider = detectProvider(checkoutUrl);
	
	if (provider === 'unknown') {
		throw new Error('Unsupported checkout URL. Please paste the full checkout link from the page where the final total is shown (Airbnb or VRBO checkout page).');
	}
	
	console.log(`[Checkout Extractor] Extracting total from ${provider} checkout URL...`);
	console.log(`[Checkout Extractor] URL: ${checkoutUrl.substring(0, 100)}...`);
	
	// Check if this is a session-based checkout URL (requires authentication)
	// Try to extract listing URL from it instead
	if (checkoutUrl.includes('/checkout/session/')) {
		console.log(`[Checkout Extractor] Detected checkout session URL - attempting to extract listing URL...`);
		const listingUrl = extractListingUrlFromCheckout(checkoutUrl);
		if (listingUrl) {
			console.log(`[Checkout Extractor] Extracted listing URL: ${listingUrl}`);
			console.log(`[Checkout Extractor] Attempting to extract price from listing URL instead...`);
			
			// Try extracting from listing URL (more reliable than session URLs)
			const scraped = await scrapePropertyInfo(listingUrl, undefined, false);
			if (scraped.totalPrice && scraped.totalPrice > 0) {
				console.log(`[Checkout Extractor] ✅ Successfully extracted price from listing URL: $${(scraped.totalPrice / 100).toFixed(2)}`);
				return {
					totalCents: scraped.totalPrice,
					currency: 'USD',
					breakdown: undefined,
					source: provider,
					nights: scraped.totalNights || undefined
				};
			}
		}
		console.log(`[Checkout Extractor] ⚠️ Could not extract listing URL from session URL, trying direct checkout URL...`);
	}
	
	// Use existing scraper to fetch checkout page HTML
	// The scraper already handles Zyte API and has checkout-specific extraction logic
	const scraped = await scrapePropertyInfo(checkoutUrl, undefined, true); // true = isCheckout
	
	if (!scraped.totalPrice || scraped.totalPrice <= 0) {
		// Provide more helpful error message
		const errorDetails = [];
		
		// Check if this is a session-based checkout URL (might require authentication)
		if (checkoutUrl.includes('/checkout/session/')) {
			errorDetails.push('Checkout session URLs require authentication and may have expired.');
			errorDetails.push('Try using the listing URL with dates and guests selected instead, or use the "Autofill total" button to open checkout in your browser.');
		} else {
			errorDetails.push('The checkout page may not have loaded completely, or the price format has changed.');
			errorDetails.push('Please ensure you copied the URL from the checkout page where the final total is displayed.');
		}
		
		errorDetails.push('Check the server logs for more details about what was extracted.');
		
		throw new Error(`Total with taxes not found. ${errorDetails.join(' ')}`);
	}
	
	// Extract breakdown if possible
	let breakdown: CheckoutPriceResult['breakdown'] | undefined;
	if (provider === 'vrbo') {
		// Re-fetch HTML to extract breakdown (scraper doesn't return breakdown)
		// For now, we'll just return the total - breakdown can be added later if needed
		breakdown = undefined;
	} else if (provider === 'airbnb') {
		breakdown = undefined;
	}
	
	// Determine currency (default to USD)
	const currency = 'USD'; // Can be extracted from HTML if needed
	
	return {
		totalCents: scraped.totalPrice,
		currency,
		breakdown,
		source: provider,
		nights: scraped.totalNights || undefined
	};
}
