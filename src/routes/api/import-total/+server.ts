import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { extractCheckoutTotal, detectProvider, parseCheckoutContext } from '$lib/server/checkout-price-extractor.js';
import { createSuccessResponse, createErrorResponse } from '$lib/server/validation.js';

/**
 * POST /api/import-total
 * 
 * Accepts a checkout URL and returns the final total including taxes/fees.
 * 
 * Request body:
 * {
 *   "checkoutUrl": "https://www.vrbo.com/checkout/..."
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "totalCents": 38100,
 *     "currency": "USD",
 *     "breakdown": { ... },
 *     "source": "vrbo",
 *     "nights": 3
 *   }
 * }
 */
export const POST: RequestHandler = async ({ request }) => {
	const timestamp = new Date().toISOString();
	console.log('\n' + '='.repeat(80));
	console.log(`[${timestamp}] 🔍 IMPORT TOTAL API REQUEST`);
	console.log('='.repeat(80));
	
	try {
		const body = await request.json();
		const checkoutUrl = body?.checkoutUrl;
		
		console.log(`[${timestamp}] 📍 Checkout URL: ${checkoutUrl || '(missing)'}`);
		
		if (!checkoutUrl || typeof checkoutUrl !== 'string') {
			console.error(`[${timestamp}] ❌ Missing checkoutUrl in request body`);
			return json(
				createErrorResponse('MISSING_URL', 'checkoutUrl is required in request body'),
				400
			);
		}
		
		// Validate URL format
		try {
			new URL(checkoutUrl);
		} catch (e) {
			console.error(`[${timestamp}] ❌ Invalid URL format: ${checkoutUrl}`);
			return json(
				createErrorResponse('INVALID_URL', 'checkoutUrl must be a valid URL'),
				400
			);
		}
		
		// Detect provider
		const provider = detectProvider(checkoutUrl);
		console.log(`[${timestamp}] 🔍 Detected provider: ${provider}`);
		
		if (provider === 'unknown') {
			console.error(`[${timestamp}] ❌ Unsupported checkout URL`);
			return json(
				createErrorResponse(
					'UNSUPPORTED_URL',
					'Unsupported checkout URL. Please paste the full checkout link from the page where the final total is shown (Airbnb or VRBO checkout page).'
				),
				400
			);
		}
		
		// Parse checkout context for logging (not returned to client)
		const context = parseCheckoutContext(checkoutUrl);
		console.log(`[${timestamp}] 📋 Checkout context:`, {
			provider: context.provider,
			reservationId: context.reservationId || '(none)',
			quoteId: context.quoteId || '(none)',
			sessionId: context.sessionId || '(none)'
		});
		
		// Extract total from checkout URL
		console.log(`[${timestamp}] 💰 Extracting total from checkout page...`);
		const result = await extractCheckoutTotal(checkoutUrl);
		
		console.log(`[${timestamp}] ✅ Successfully extracted total:`);
		console.log(`[${timestamp}]   - Total: $${(result.totalCents / 100).toFixed(2)} ${result.currency}`);
		console.log(`[${timestamp}]   - Nights: ${result.nights || '(not found)'}`);
		console.log(`[${timestamp}]   - Source: ${result.source}`);
		if (result.breakdown) {
			console.log(`[${timestamp}]   - Breakdown:`, result.breakdown);
		}
		console.log('='.repeat(80) + '\n');
		
		return json(createSuccessResponse(result));
		
	} catch (error) {
		const errorMsg = error instanceof Error ? error.message : String(error);
		console.error(`[${timestamp}] ❌ Import total error: ${errorMsg}`);
		
		if (error instanceof Error) {
			console.error(`[${timestamp}]   Stack: ${error.stack}`);
		}
		
		console.log('='.repeat(80) + '\n');
		
		// Return appropriate error based on error message
		if (errorMsg.includes('Unsupported checkout URL')) {
			return json(
				createErrorResponse('UNSUPPORTED_URL', errorMsg),
				400
			);
		}
		
		if (errorMsg.includes('Total with taxes not found')) {
			return json(
				createErrorResponse('PRICE_NOT_FOUND', errorMsg),
				404
			);
		}
		
		return json(
			createErrorResponse('EXTRACTION_FAILED', errorMsg || 'Failed to extract total from checkout URL'),
			500
		);
	}
};
