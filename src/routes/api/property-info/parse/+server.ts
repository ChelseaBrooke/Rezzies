import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { extractValue, extractNumber } from '$lib/server/property-scraper.js';
import { createSuccessResponse, createErrorResponse } from '$lib/server/validation.js';

// Import the config (we'll need to access it)
const SCRAPING_CONFIGS: Record<string, any> = {
	vrbo: {
		selectors: {
			title: [],
			maxGuests: [
				'</span>\\s*Sleeps\\s+(\\d+)',
				'<span[^>]*class="[^"]*uitk-text[^"]*"[^>]*>.*?</span>\\s*Sleeps\\s+(\\d+)',
				'</svg>\\s*Sleeps\\s+(\\d+)',
				'Sleeps\\s+(\\d+)',
				'Sleeps:\\s*(\\d+)',
				'"sleeps":\\s*(\\d+)',
				'sleepsCount[^0-9]*(\\d+)',
				'data-sleeps="(\\d+)"'
			],
			coverPhoto: [
				'<meta\\s+property="og:image"\\s+content="([^"]+)"',
				'<meta\\s+name="og:image"\\s+content="([^"]+)"',
				'class="[^"]*hero[^"]*"[^>]*src="([^"]+)"'
			]
		}
	},
	airbnb: {
		selectors: {
			title: [],
			maxGuests: [
				'"accommodates":\\s*(\\d+)',
				'"guests":\\s*(\\d+)',
				'accommodates[^0-9]*(\\d+)',
				'(\\d+)\\s+guests?'
			],
			coverPhoto: [
				'<meta\\s+property="og:image"\\s+content="([^"]+)"',
				'"picture_url":\\s*"([^"]+)"'
			]
		}
	}
};

/**
 * Parse HTML that was fetched client-side
 * This bypasses server-side rate limiting by using the user's browser/IP
 */
export const POST: RequestHandler = async ({ request }) => {
	try {
		const { html, url } = await request.json();

		if (!html || !url) {
			return json(
				createErrorResponse('MISSING_DATA', 'HTML and URL are required'),
				400
			);
		}

		if (!url.includes('vrbo.com') && !url.includes('airbnb.com')) {
			return json(
				createErrorResponse('INVALID_URL', 'URL must be a valid Airbnb or VRBO listing'),
				400
			);
		}

		console.log('Parsing HTML from client-side fetch for:', url);

		const isVRBO = url.includes('vrbo.com');
		const siteType = isVRBO ? 'vrbo' : 'airbnb';
		const config = SCRAPING_CONFIGS[siteType];

		// Extract values using the same logic as property-scraper.ts
		const title = config.selectors.title && config.selectors.title.length > 0
			? extractValue(html, config.selectors.title)
			: null;

		const maxGuests = config.selectors.maxGuests && config.selectors.maxGuests.length > 0
			? extractNumber(html, config.selectors.maxGuests)
			: null;

		const coverPhoto = config.selectors.coverPhoto && config.selectors.coverPhoto.length > 0
			? extractValue(html, config.selectors.coverPhoto)
			: null;

		// Fallback: extract title from <title> tag if not found
		let finalTitle = title;
		if (!finalTitle) {
			const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
			if (titleMatch) {
				finalTitle = titleMatch[1].trim();
			}
		}

		// Extract property ID for fallback title
		const propertyId = isVRBO 
			? url.match(/vrbo\.com\/(\d+)/)?.[1]
			: url.match(/airbnb\.com\/rooms\/(\d+)/)?.[1];

		const result = {
			title: finalTitle || (isVRBO ? `VRBO Property ${propertyId || ''}` : `Airbnb Property ${propertyId || ''}`),
			coverPhoto,
			maxGuests,
			description: `Property listing from ${isVRBO ? 'VRBO' : 'Airbnb'}`
		};

		console.log('Parsed result:', result);

		return json(createSuccessResponse(result));
	} catch (error) {
		console.error('Parse error:', error);
		return json(
			createErrorResponse('INTERNAL_ERROR', 'Failed to parse HTML', error instanceof Error ? error.message : 'Unknown error'),
			500
		);
	}
};
