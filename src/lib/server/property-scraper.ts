// Custom property scraper for VRBO and Airbnb
// Configure selectors/patterns for each site

export interface ScrapingConfig {
	site: 'vrbo' | 'airbnb';
	selectors: {
		title?: string[]; // CSS selectors or regex patterns to try
		maxGuests?: string[]; // Patterns to find "Sleeps X" or "Accommodates X"
		coverPhoto?: string[]; // Selectors for main image
		totalPrice?: string[]; // Patterns to find total price
		roomCount?: string[]; // Patterns to find "X bedrooms" or "X rooms"
	};
}

// Default configurations - you can customize these
const SCRAPING_CONFIGS: Record<string, ScrapingConfig> = {
		vrbo: {
		site: 'vrbo',
		selectors: {
			title: [
				// Add specific selectors here - e.g., 'h1.property-title', '.listing-name', etc.
			],
			roomCount: [
				// Patterns for "X bedrooms" or "X rooms"
				'(\\d+)\\s+bedrooms?',
				'(\\d+)\\s+bedrooms?\\s*\\(',
				'bedrooms?[^0-9]*(\\d+)',
				'"bedrooms":\\s*(\\d+)',
				'bedroomCount[^0-9]*(\\d+)',
				'data-bedrooms="(\\d+)"'
			],
			maxGuests: [
				// Specific pattern for VRBO: </span>Sleeps 4 (text after closing span, handles whitespace)
				'</span>\\s*Sleeps\\s+(\\d+)',
				// Pattern matching the uitk-text span structure with SVG
				'<span[^>]*class="[^"]*uitk-text[^"]*"[^>]*>.*?</span>\\s*Sleeps\\s+(\\d+)',
				// Pattern matching SVG followed by Sleeps X
				'</svg>\\s*Sleeps\\s+(\\d+)',
				// Generic patterns
				'Sleeps\\s+(\\d+)',
				'Sleeps:\\s*(\\d+)',
				'"sleeps":\\s*(\\d+)',
				'sleepsCount[^0-9]*(\\d+)',
				'data-sleeps="(\\d+)"'
			],
			coverPhoto: [
				// Meta tags or image selectors
				'<meta\\s+property="og:image"\\s+content="([^"]+)"',
				'<meta\\s+name="og:image"\\s+content="([^"]+)"',
				'class="[^"]*hero[^"]*"[^>]*src="([^"]+)"'
			],
			totalPrice: [
				// VRBO price patterns - ONLY look for "for X nights" format to avoid nightly rates
				// PRIORITY 1: Checkout page patterns - look for price-summary-message-line FIRST (most reliable)
				// Pattern 1: Match price within price-summary-message-line with uitk-type-end uitk-type-300 (most specific)
				// Uses [\s\S] to match across newlines, and non-greedy matching
				'<div[^>]*data-test-id="price-summary-message-line"[^>]*>[\s\S]{0,2000}?<div[^>]*class="[^"]*uitk-text[^"]*uitk-type-end[^"]*uitk-type-300[^"]*"[^>]*>\\$([\\d,]+(?:\\.[\\d]{2})?)\\s+for\\s+(\\d+)\\s+nights?<\\/div>',
				// Pattern 2: Match price within price-summary-message-line (more flexible, any uitk div with uitk-type-end)
				'<div[^>]*data-test-id="price-summary-message-line"[^>]*>[\s\S]{0,2000}?<div[^>]*class="[^"]*uitk[^"]*uitk-type-end[^"]*"[^>]*>\\$([\\d,]+(?:\\.[\\d]{2})?)\\s+for\\s+(\\d+)\\s+nights?<\\/div>',
				// Pattern 3: Match price within price-summary-message-line (anywhere in that section)
				'<div[^>]*data-test-id="price-summary-message-line"[^>]*>[\s\S]{0,2000}?\\$([\\d,]+(?:\\.[\\d]{2})?)\\s+for\\s+(\\d+)\\s+nights?',
				// PRIORITY 2: Checkout page patterns (often have "Total" or "Amount due" labels):
				'<div[^>]*(?:data-test-id|class)="[^"]*(?:total|amount|due|price)[^"]*"[^>]*>\\$([\\d,]+(?:\\.[\\d]{2})?)\\s+for\\s+(\\d+)\\s+nights?',
				'Total[^$]*\\$([\\d,]+(?:\\.[\\d]{2})?)[^<]*for[^<]*(\\d+)\\s+nights?',
				'Amount[^$]*due[^$]*\\$([\\d,]+(?:\\.[\\d]{2})?)[^<]*for[^<]*(\\d+)\\s+nights?',
				// PRIORITY 3: Match the EXACT structure from user - uitk-type-end uitk-type-300 (right-aligned, matches screenshot)
				'<div[^>]*class="[^"]*uitk-text[^"]*uitk-type-end[^"]*uitk-type-300[^"]*"[^>]*>\\$([\\d,]+(?:\\.[\\d]{2})?)\\s+for\\s+(\\d+)\\s+nights?<\\/div>',
				// Pattern 4: Match uitk-type-300 with uitk-type-end (classes can be in any order)
				'<div[^>]*class="[^"]*uitk-type-300[^"]*uitk-type-end[^"]*"[^>]*>\\$([\\d,]+(?:\\.[\\d]{2})?)\\s+for\\s+(\\d+)\\s+nights?<\\/div>',
			]
		}
	},
	airbnb: {
		site: 'airbnb',
		selectors: {
			title: [],
			roomCount: [
				// Patterns for "X bedrooms" or "X rooms"
				'(\\d+)\\s+bedrooms?',
				'(\\d+)\\s+bedrooms?\\s*\\(',
				'bedrooms?[^0-9]*(\\d+)',
				'"bedrooms":\\s*(\\d+)',
				'bedroomCount[^0-9]*(\\d+)',
				'data-bedrooms="(\\d+)"'
			],
			maxGuests: [
				'"accommodates":\\s*(\\d+)',
				'"guests":\\s*(\\d+)',
				'accommodates[^0-9]*(\\d+)',
				'(\\d+)\\s+guests?'
			],
			coverPhoto: [
				'<meta\\s+property="og:image"\\s+content="([^"]+)"',
				'"picture_url":\\s*"([^"]+)"'
			],
			totalPrice: [
				// Airbnb price patterns - prioritize "for X nights" format (most specific first)
				// Look for patterns like "$588 for 5 nights" - this is the total price
				'\\$([\\d,]+(?:\\.[\\d]{2})?)\\s+for\\s+(\\d+)\\s+nights?',
				'\\$([\\d,]+(?:\\.[\\d]{2})?)\\s+for\\s+(\\d+)\\s+night',
				// Look for "Total" with price and nights
				'Total[^$]*\\$([\\d,]+(?:\\.[\\d]{2})?)[^<]*for[^<]*(\\d+)\\s+nights?',
				// Look for price in context of "for X nights" - more flexible spacing
				'\\$([\\d,]+(?:\\.[\\d]{2})?)[^<]{0,50}for[^<]{0,50}(\\d+)\\s+nights?',
				// Avoid patterns that might catch nightly rates - only look for totals
			]
		}
	}
};

/**
 * Sleep/delay helper
 */
function sleep(ms: number): Promise<void> {
	return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Fetch HTML using Zyte API (if configured) or direct fetch
 * Zyte API bypasses bot detection and rate limiting
 */
async function fetchPageHTML(url: string, retries = 3): Promise<string | null> {
	const zyteApiKey = process.env.ZYTE_API_KEY;
	
	// If Zyte API is configured, use it (bypasses all bot detection)
	if (zyteApiKey) {
		return fetchWithZyte(url, zyteApiKey);
	}
	
	// Otherwise, fall back to direct fetch with retries
	return fetchPageHTMLDirect(url, retries);
}

/**
 * Fetch HTML using Zyte API
 * Zyte handles bot detection, rate limiting, and JavaScript rendering
 * Documentation: https://docs.zyte.com/zyte-api/api-reference.html
 */
async function fetchWithZyte(url: string, apiKey: string, waitForCalendar = false): Promise<string | null> {
	// For VRBO/Airbnb, we need browserHtml because they use JavaScript to render content
	// Try browserHtml first for these sites, httpResponseBody for others
	const needsBrowserRendering = url.includes('vrbo.com') || url.includes('airbnb.com');
	
	if (needsBrowserRendering) {
		// VRBO/Airbnb need JavaScript rendering - use browserHtml
		// If waitForCalendar is true, wait for calendar to load
		console.log('VRBO/Airbnb detected - using browserHtml for JavaScript rendering');
		return await fetchWithZyteMethod(url, apiKey, 'browserHtml', waitForCalendar);
	} else {
		// Other sites - try httpResponseBody first (faster), then browserHtml if needed
		const result = await fetchWithZyteMethod(url, apiKey, 'httpResponseBody');
		if (result) return result;
		
		console.log('httpResponseBody failed or timed out, trying browserHtml...');
		return await fetchWithZyteMethod(url, apiKey, 'browserHtml');
	}
}

async function fetchWithZyteMethod(url: string, apiKey: string, method: 'httpResponseBody' | 'browserHtml', waitForCalendar = false): Promise<string | null> {
	try {
		console.log(`Using Zyte API (${method}) to fetch:`, url);
		
		// Create abort controller for timeout
		// Browser rendering takes longer, so use 90s for browserHtml with calendar wait, 60s without, 30s for httpResponseBody
		const timeout = method === 'browserHtml' ? (waitForCalendar ? 90000 : 60000) : 30000;
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), timeout);
		
		try {
			console.log('Sending request to Zyte API...');
			const requestBody: any = { 
				url: url,
				[method]: true
			};
			
			// For VRBO/Airbnb using browserHtml, ensure we're getting US pricing
			// VRBO shows different prices based on location and may update prices via JavaScript
			if (method === 'browserHtml' && (url.includes('vrbo.com') || url.includes('airbnb.com'))) {
				console.log('Using browserHtml for VRBO/Airbnb - configuring for accurate price extraction');
				
				// Set geolocation to US to get consistent pricing
				requestBody.geolocation = 'US';
				
				// Note: Zyte's browserHtml already waits for page interactive state
				// However, VRBO may update prices via JavaScript after that. We'll rely on
				// the retry logic in extractPrice to wait for final price if needed.
				console.log('Note: Using US geolocation. Price extraction will retry if initial price seems incomplete.');
			}
			
			const response = await fetch('https://api.zyte.com/v1/extract', {
				method: 'POST',
				headers: {
					'Authorization': `Basic ${Buffer.from(`${apiKey}:`).toString('base64')}`,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(requestBody),
				signal: controller.signal
			});
			
			console.log(`Zyte API response status: ${response.status}`);

			clearTimeout(timeoutId);

			if (!response.ok) {
				const errorText = await response.text();
				console.error('Zyte API error:', response.status, response.statusText);
				console.error('Error details:', errorText);
				
				// Provide helpful error messages
				if (response.status === 401) {
					console.error('Zyte API: Invalid API key. Check your ZYTE_API_KEY environment variable.');
					return null;
				} else if (response.status === 402) {
					console.error('Zyte API: Insufficient credits. Check your Zyte account balance.');
					return null;
				} else if (response.status === 429) {
					console.error('Zyte API: Rate limited. Zyte will handle retries automatically.');
					return null;
				} else if (response.status === 422) {
					console.error('Zyte API: Invalid request format. Trying browserHtml instead...');
					// If httpResponseBody fails, try browserHtml (might need JS rendering)
					// But we can't retry in the same function, so return null and let caller handle it
					return null;
				}
				
				return null;
			}

			const data = await response.json();
			
			// Zyte returns the HTML in browserHtml field when browserHtml: true is requested
			// For httpResponseBody requests, it would be in httpResponseBody field
			const html = data.browserHtml || 
			            data.httpResponseBody || 
			            data.html || 
			            (data.data && data.data.browserHtml) ||
			            (data.data && data.data.httpResponseBody);
			
			if (html) {
				// If it's base64 encoded, decode it
				let finalHtml = html;
				if (typeof html === 'string' && html.length > 0 && !html.includes('<')) {
					try {
						finalHtml = Buffer.from(html, 'base64').toString('utf-8');
					} catch (e) {
						// Not base64, use as-is
					}
				}
				
				console.log(`✓ Zyte API fetch successful (${finalHtml.length} chars)`);
				return finalHtml;
			} else {
				console.error('Zyte API returned no HTML content. Response:', JSON.stringify(data).substring(0, 500));
				return null;
			}
		} finally {
			clearTimeout(timeoutId);
		}
		} catch (error: any) {
			if (error.name === 'AbortError') {
				console.error(`Zyte API request timeout (${method === 'browserHtml' ? '60s' : '30s'})`);
			} else {
				console.error('Zyte API error:', error.message || error);
			}
			return null;
		}
	}

/**
 * Fetch HTML with proper headers to mimic a real browser
 * Includes retry logic with exponential backoff for rate limiting
 * Fallback method when Zyte API is not configured
 */
async function fetchPageHTMLDirect(url: string, retries = 3): Promise<string | null> {
	const userAgents = [
		'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
		'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
		'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
		'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15'
	];

	for (let attempt = 0; attempt < retries; attempt++) {
		try {
			// Add a delay to avoid rate limiting
			if (attempt === 0) {
				// Random delay on first attempt (1-3 seconds) to appear more human
				const initialDelay = 1000 + Math.random() * 2000;
				console.log(`Initial request with ${Math.round(initialDelay)}ms delay...`);
				await sleep(initialDelay);
			} else {
				// Exponential backoff on retries
				const delay = Math.min(1000 * Math.pow(2, attempt - 1), 8000); // Exponential backoff, max 8s
				console.log(`Retry attempt ${attempt + 1}/${retries} after ${delay}ms delay...`);
				await sleep(delay);
			}

			// Rotate user agent
			const userAgent = userAgents[attempt % userAgents.length];
			
			// Create abort controller for timeout
			const controller = new AbortController();
			const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
			
			try {
				const response = await fetch(url, {
					headers: {
						'User-Agent': userAgent,
						'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
						'Accept-Language': 'en-US,en;q=0.9',
						'Accept-Encoding': 'gzip, deflate, br, zstd',
						'Connection': 'keep-alive',
						'Upgrade-Insecure-Requests': '1',
						'Sec-Fetch-Dest': 'document',
						'Sec-Fetch-Mode': 'navigate',
						'Sec-Fetch-Site': attempt === 0 ? 'none' : (url.includes('vrbo.com') ? 'same-origin' : 'same-origin'),
						'Sec-Fetch-User': '?1',
						'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
						'Sec-Ch-Ua-Mobile': '?0',
						'Sec-Ch-Ua-Platform': '"Windows"',
						'Cache-Control': 'max-age=0',
						'Referer': url.includes('vrbo.com') ? 'https://www.vrbo.com/' : 'https://www.airbnb.com/',
						'DNT': '1',
						'Priority': 'u=0, i'
					},
					signal: controller.signal,
					// Add redirect handling
					redirect: 'follow'
				});
				
				clearTimeout(timeoutId);

				if (response.ok) {
					return await response.text();
				} else if (response.status === 429) {
					// Rate limited - will retry with backoff
					console.warn(`Rate limited (429) on attempt ${attempt + 1}. Will retry...`);
					if (attempt === retries - 1) {
						console.error('Max retries reached. VRBO is rate-limiting requests.');
						return null;
					}
					continue; // Retry
				} else {
					console.error('Fetch failed:', response.status, response.statusText);
					if (attempt === retries - 1) {
						return null;
					}
					continue; // Retry on other errors too
				}
			} finally {
				clearTimeout(timeoutId);
			}
		} catch (error: any) {
			if (error.name === 'AbortError') {
				console.error('Request timeout');
			} else {
				console.error('Fetch error:', error.message || error);
			}
			
			if (attempt === retries - 1) {
				return null;
			}
		}
	}
	
	return null;
}

/**
 * Extract value using multiple patterns/selectors
 */
export function extractValue(html: string, patterns: string[]): string | null {
	for (const pattern of patterns) {
		try {
			// Try as regex first
			if (pattern.startsWith('/') || pattern.includes('\\')) {
				const regex = new RegExp(pattern, 'i');
				const match = html.match(regex);
				if (match && match[1]) {
					return match[1].trim();
				}
			}
			// Try as CSS selector (would need a DOM parser - for now, skip)
			// You can add cheerio or jsdom if needed
		} catch (error) {
			// Pattern invalid, try next
			continue;
		}
	}
	return null;
}

/**
 * Extract number from patterns (for maxGuests)
 */
export function extractNumber(html: string, patterns: string[]): number | null {
	for (const pattern of patterns) {
		try {
			const regex = new RegExp(pattern, 'i');
			const match = html.match(regex);
			if (match && match[1]) {
				const num = parseInt(match[1], 10);
				if (num > 0 && num < 100) {
					console.log(`✓ Found maxGuests: ${num} using pattern: ${pattern}`);
					return num;
				}
			}
		} catch (error) {
			console.log(`Pattern failed: ${pattern}`, error);
			continue;
		}
	}
	console.log('✗ Could not extract maxGuests from HTML');
	// Debug: show a sample of HTML around "Sleeps"
	const sleepsIndex = html.toLowerCase().indexOf('sleeps');
	if (sleepsIndex > -1) {
		const sample = html.substring(Math.max(0, sleepsIndex - 100), sleepsIndex + 100);
		console.log('HTML sample around "sleeps":', sample);
	}
	return null;
}

/**
 * Extract price from embedded JSON/JavaScript data in HTML
 * VRBO/Airbnb often embed price data in JSON-LD or window.__INITIAL_STATE__
 */
function extractPriceFromJSON(html: string): { price: number; nights?: number } | null {
	try {
		// Method 1: Look for JSON-LD with price data
		const jsonLdPattern = /<script[^>]*type="application\/ld\+json"[^>]*>(.*?)<\/script>/gis;
		const jsonLdMatches = html.match(jsonLdPattern);
		
		if (jsonLdMatches) {
			for (const match of jsonLdMatches) {
				try {
					const jsonContent = match.replace(/<script[^>]*>|<\/script>/gi, '').trim();
					const data = JSON.parse(jsonContent);
					
					// Look for price in various possible locations
					if (data.offers?.price || data.price || data.totalPrice) {
						const price = data.offers?.price || data.price || data.totalPrice;
						const nights = data.nights || data.numberOfNights;
						if (price && typeof price === 'number' && price > 0) {
							console.log(`✓ Found price in JSON-LD: $${price}${nights ? ` for ${nights} nights` : ''}`);
							return {
								price: Math.round(price * 100),
								nights: nights || undefined
							};
						}
					}
				} catch (e) {
					// Not valid JSON, continue
				}
			}
		}
		
		// Method 2: Look for window.__INITIAL_STATE__ or similar global variables
		const initialStatePattern = /window\.__INITIAL_STATE__\s*=\s*({.*?});/s;
		const initialStateMatch = html.match(initialStatePattern);
		if (initialStateMatch) {
			try {
				const state = JSON.parse(initialStateMatch[1]);
				// Navigate through state to find price (structure varies)
				const price = state?.pricing?.totalPrice || 
				             state?.booking?.totalPrice ||
				             state?.price?.total;
				if (price && typeof price === 'number' && price > 0) {
					console.log(`✓ Found price in __INITIAL_STATE__: $${price}`);
					return {
						price: Math.round(price * 100)
					};
				}
			} catch (e) {
				// Not valid JSON
			}
		}
		
		// Method 3: Look for price in script tags with "total" or "price" keywords
		const priceScriptPattern = /(?:totalPrice|total_price|priceTotal|totalAmount|finalPrice)[^:]*:\s*([\d.]+)/gi;
		const priceMatches = html.match(priceScriptPattern);
		if (priceMatches) {
			for (const match of priceMatches) {
				const priceMatch = match.match(/([\d.]+)/);
				if (priceMatch) {
					const price = parseFloat(priceMatch[1]);
					// Only accept prices in reasonable range (between $100 and $10,000)
					if (price >= 100 && price <= 10000) {
						console.log(`✓ Found price in script data: $${price}`);
						return {
							price: Math.round(price * 100)
						};
					}
				}
			}
		}
		
		// Method 4: Look for VRBO-specific price data in window.__PLUGIN_STATE__ or similar
		// VRBO often stores pricing data in global state
		const pluginStatePattern = /window\.__PLUGIN_STATE__\s*=\s*({.*?});/s;
		const pluginStateMatch = html.match(pluginStatePattern);
		if (pluginStateMatch) {
			try {
				// This might be a large object, so we'll search for price patterns within it
				const stateStr = pluginStateMatch[1];
				// Look for price patterns in the state string
				const statePricePattern = /"(?:totalPrice|total|price|amount)"\s*:\s*(\d+(?:\.\d{2})?)/gi;
				const statePriceMatches = stateStr.match(statePricePattern);
				if (statePriceMatches) {
					for (const match of statePriceMatches) {
						const priceMatch = match.match(/(\d+(?:\.\d{2})?)/);
						if (priceMatch) {
							const price = parseFloat(priceMatch[1]);
							if (price >= 100 && price <= 10000) {
								console.log(`✓ Found price in __PLUGIN_STATE__: $${price}`);
								return {
									price: Math.round(price * 100)
								};
							}
						}
					}
				}
			} catch (e) {
				// State might be too large or malformed
			}
		}
		
		// Method 5: Look for price in data attributes or hidden elements
		// Sometimes the final price is stored in data attributes
		const dataPricePattern = /data-(?:total|price|amount)="([\d.]+)"/gi;
		const dataPriceMatches = html.match(dataPricePattern);
		if (dataPriceMatches) {
			for (const match of dataPriceMatches) {
				const priceMatch = match.match(/([\d.]+)/);
				if (priceMatch) {
					const price = parseFloat(priceMatch[1]);
					if (price >= 100 && price <= 10000) {
						console.log(`✓ Found price in data attribute: $${price}`);
						return {
							price: Math.round(price * 100)
						};
					}
				}
			}
		}
	} catch (error) {
		console.log('Error extracting price from JSON:', error);
	}
	
	return null;
}

/**
 * Extract price (dollar amount) from HTML
 * Returns price in cents as integer, or null if not found
 * Tries multiple methods: JSON data first, then HTML patterns
 */
export function extractPrice(html: string, patterns: string[]): { price: number; nights?: number } | null {
	const timestamp = new Date().toISOString();
	console.log(`[${timestamp}] 💰 extractPrice called - HTML length: ${html.length} chars, patterns: ${patterns.length}`);
	
	// For checkout pages, prioritize HTML patterns over JSON (more reliable for final price)
	// First, try HTML patterns to get the "$X for Y nights" format
	console.log(`[${timestamp}] 🔍 Attempting to extract price from HTML patterns first...`);
	
	// Only accept patterns that include "for X nights" - this ensures we get the total, not nightly rate
	console.log(`[${timestamp}] 📋 Using ${patterns.length} patterns to find "$X for Y nights" format`);
	
	// First, try to find the price-summary-message-line section specifically
	// This is the most reliable way to get the correct price
	const priceSummaryMatch = html.match(/<div[^>]*data-test-id="price-summary-message-line"[^>]*>([\s\S]{0,2000}?)<\/div>/i);
	if (priceSummaryMatch && priceSummaryMatch[1]) {
		const priceSummarySection = priceSummaryMatch[1];
		console.log(`[${timestamp}] ✅ Found price-summary-message-line section, extracting from it...`);
		console.log(`[${timestamp}] 📄 Section preview: ${priceSummarySection.substring(0, 500)}`);
		
		// Debug: Find all prices in this section
		const allPricesInSection = priceSummarySection.match(/\$[\d,]+(?:\.\d{2})?/g);
		if (allPricesInSection) {
			console.log(`[${timestamp}] 💵 All prices found in price-summary section: ${allPricesInSection.join(', ')}`);
		} else {
			console.log(`[${timestamp}] ⚠️ No prices found in price-summary section`);
		}
		
		// Look for "$X for Y nights" within this section
		// Prioritize uitk-type-end (final price) over uitk-type-start (intermediate)
		// First, try to find uitk-type-end (final price)
		const endPriceMatch = priceSummarySection.match(/<div[^>]*class="[^"]*uitk[^"]*uitk-type-end[^"]*"[^>]*>[\s\S]{0,500}?\$([\d,]+(?:\.\d{2})?)\s+for\s+(\d+)\s+nights?/i);
		if (endPriceMatch && endPriceMatch[1] && endPriceMatch[2]) {
			const priceStr = endPriceMatch[1].replace(/,/g, '');
			const price = parseFloat(priceStr);
			const nightsNum = parseInt(endPriceMatch[2], 10);
			
			if (!isNaN(price) && price > 0 && !isNaN(nightsNum) && nightsNum > 0) {
				// Validate price is reasonable (between $10 and $100,000 per night average)
				const pricePerNight = price / nightsNum;
				if (price >= 10 && pricePerNight <= 10000) {
					console.log(`[${timestamp}] ✅ Found FINAL price in price-summary-message-line (uitk-type-end): $${price} for ${nightsNum} nights`);
					return {
						price: Math.round(price * 100),
						nights: nightsNum
					};
				} else {
					console.log(`[${timestamp}] ⚠️ Price ${price} ($${pricePerNight.toFixed(2)}/night) is outside reasonable range, but accepting it anyway`);
					// Accept it anyway - better to have a price than none
					return {
						price: Math.round(price * 100),
						nights: nightsNum
					};
				}
			}
		}
		
		// Fallback: look for any "$X for Y nights" in the section
		const priceInSection = priceSummarySection.match(/\$([\d,]+(?:\.\d{2})?)\s+for\s+(\d+)\s+nights?/i);
		if (priceInSection && priceInSection[1] && priceInSection[2]) {
			const priceStr = priceInSection[1].replace(/,/g, '');
			const price = parseFloat(priceStr);
			const nightsNum = parseInt(priceInSection[2], 10);
			
			if (!isNaN(price) && price > 0 && !isNaN(nightsNum) && nightsNum > 0) {
				// Validate price is reasonable (between $10 and $100,000 per night average)
				const pricePerNight = price / nightsNum;
				if (price >= 10 && pricePerNight <= 10000) {
					console.log(`[${timestamp}] ✅ Found price in price-summary-message-line: $${price} for ${nightsNum} nights`);
					return {
						price: Math.round(price * 100),
						nights: nightsNum
					};
				} else {
					console.log(`[${timestamp}] ⚠️ Price ${price} ($${pricePerNight.toFixed(2)}/night) is outside reasonable range, but accepting it anyway`);
					// Accept it anyway - better to have a price than none
					return {
						price: Math.round(price * 100),
						nights: nightsNum
					};
				}
			}
		} else {
			console.log(`[${timestamp}] ❌ Could not find "$X for Y nights" format within price-summary-message-line section`);
		}
	} else {
		console.log(`[${timestamp}] ❌ Could not find price-summary-message-line section in HTML`);
		// Debug: Check if data-test-id exists at all
		if (html.includes('data-test-id')) {
			const testIdMatches = html.match(/data-test-id="([^"]+)"/g);
			if (testIdMatches) {
				console.log(`[${timestamp}] 🔍 Found data-test-id attributes: ${testIdMatches.slice(0, 10).join(', ')}`);
			}
		} else {
			console.log(`[${timestamp}] ⚠️ No data-test-id attributes found in HTML`);
		}
	}
	
	// First, let's see if we can find any price-related text in the HTML
	const priceMatches = html.match(/\$[\d,]+(?:\.\d{2})?\s+for\s+\d+\s+night/gi);
	if (priceMatches) {
		console.log(`[${timestamp}] 💵 Found potential price matches in HTML: ${priceMatches.slice(0, 10).join(', ')}`);
	} else {
		console.log(`[${timestamp}] ⚠️ No obvious "for X nights" price format found in HTML`);
		// Let's look for any price mentions
		const anyPriceMatches = html.match(/\$[\d,]+(?:\.\d{2})?/g);
		if (anyPriceMatches) {
			console.log(`[${timestamp}] 💵 Found other price mentions (may be nightly rates): ${anyPriceMatches.slice(0, 10).join(', ')}`);
		}
	}
	
	// Collect all matches first, then pick the best one
	// WORKAROUND: Track position in HTML to prefer later matches (final price appears after intermediate)
	const allMatches: Array<{ price: number; nights: number; pattern: string; matchText: string; position: number }> = [];
	
		for (const pattern of patterns) {
		try {
			const regex = new RegExp(pattern, 'gis'); // 'gis' = global, case-insensitive, dotall (matches newlines)
			let match;
			while ((match = regex.exec(html)) !== null) {
				if (match[1] && match[2]) {
					// Both price and nights must be present
					const priceStr = match[1].replace(/,/g, '');
					const price = parseFloat(priceStr);
					const nightsNum = parseInt(match[2], 10);
					
					if (!isNaN(price) && price > 0 && !isNaN(nightsNum) && nightsNum > 0) {
						// Validate price is reasonable (between $10 and $100,000 per night average) to filter out false positives
						const pricePerNight = price / nightsNum;
						if (price >= 10 && pricePerNight <= 10000) {
							// Track the position in HTML - later positions are more likely to be final price
							const position = match.index || 0;
							allMatches.push({
								price,
								nights: nightsNum,
								pattern,
								matchText: match[0].substring(0, 200),
								position
							});
							console.log(`[${timestamp}] ✅ Found match at position ${position}: $${price} for ${nightsNum} nights using pattern: ${pattern.substring(0, 80)}...`);
							console.log(`[${timestamp}]   Match text: ${match[0].substring(0, 150)}`);
						} else {
							console.log(`[${timestamp}] ⚠️ Price ${price} ($${pricePerNight.toFixed(2)}/night) outside typical range, but accepting it`);
							// Accept it anyway - better to have a price than none
							const position = match.index || 0;
							allMatches.push({
								price,
								nights: nightsNum,
								pattern,
								matchText: match[0].substring(0, 200),
								position
							});
						}
					}
				}
			}
		} catch (error) {
			console.log(`Pattern error: ${pattern.substring(0, 50)}...`, error);
			continue;
		}
	}
	
	if (allMatches.length === 0) {
		console.log('✗ Could not find price in "for X nights" format');
		return null;
	}
	
	// If multiple matches, prefer in this order (most specific first):
	// 1. Matches with uitk-type-300 (the EXACT class from user's HTML: uitk-text uitk-type-end uitk-type-300 uitk-text-default-theme)
	// 2. Matches from uitk-type-end pattern (right-aligned price)
	// 3. Matches from uitk-text div pattern
	// 4. Otherwise, use the first match
	
	// Check for matches within price-summary-message-line (most specific - from user's screenshot)
	const priceSummaryMatches = allMatches.filter(m => 
		m.matchText.includes('price-summary-message-line') || m.pattern.includes('price-summary-message-line')
	);
	if (priceSummaryMatches.length > 0) {
		// Prefer uitk-type-end within price-summary (final price)
		const endMatches = priceSummaryMatches.filter(m => m.matchText.includes('uitk-type-end'));
		if (endMatches.length > 0) {
			// If multiple end matches, prefer the one that appears later in HTML (final calculated price)
			const bestMatch = endMatches.sort((a, b) => b.position - a.position)[0];
			console.log(`✓ Selected price-summary-message-line match (uitk-type-end, final price): $${bestMatch.price} for ${bestMatch.nights} nights`);
			console.log(`  Match text: ${bestMatch.matchText.substring(0, 300)}`);
			return {
				price: Math.round(bestMatch.price * 100),
				nights: bestMatch.nights
			};
		}
		// Fallback to any price-summary match, preferring later position
		const bestMatch = priceSummaryMatches.sort((a, b) => b.position - a.position)[0];
		console.log(`✓ Selected price-summary-message-line match: $${bestMatch.price} for ${bestMatch.nights} nights`);
		console.log(`  Match text: ${bestMatch.matchText.substring(0, 300)}`);
		return {
			price: Math.round(bestMatch.price * 100),
			nights: bestMatch.nights
		};
	}
	
	// Check for exact match with uitk-type-300 AND uitk-type-end (user's exact HTML: uitk-type-end uitk-type-300)
	const exactEndMatches = allMatches.filter(m => 
		m.matchText.includes('uitk-type-end') && m.matchText.includes('uitk-type-300')
	);
	if (exactEndMatches.length > 0) {
		// WORKAROUND: Prefer the match that appears later in HTML (final price appears after intermediate)
		const bestMatch = exactEndMatches.sort((a, b) => b.position - a.position)[0];
		console.log(`✓ Selected EXACT uitk-type-end + uitk-type-300 match (final price): $${bestMatch.price} for ${bestMatch.nights} nights`);
		console.log(`  Match text: ${bestMatch.matchText}`);
		return {
			price: Math.round(bestMatch.price * 100),
			nights: bestMatch.nights
		};
	}
	
	// Check for uitk-type-300 matches, but prefer uitk-type-end over uitk-type-start
	const uitkType300Matches = allMatches.filter(m => m.matchText.includes('uitk-type-300'));
	if (uitkType300Matches.length > 0) {
		// Prefer uitk-type-end over uitk-type-start (user's HTML had uitk-type-end)
		const endMatches = uitkType300Matches.filter(m => m.matchText.includes('uitk-type-end'));
		const startMatches = uitkType300Matches.filter(m => m.matchText.includes('uitk-type-start'));
		
		// Warn if we only found uitk-type-start (intermediate price) and not uitk-type-end (final price)
		if (endMatches.length === 0 && startMatches.length > 0) {
			console.warn('⚠️ WARNING: Only found uitk-type-start (intermediate price), not uitk-type-end (final price)');
			console.warn('   This suggests the page JavaScript may not have finished calculating the final price yet.');
			console.warn('   Consider increasing the browser wait time in Zyte API.');
		}
		
		const bestMatch = endMatches.length > 0 ? endMatches[0] : uitkType300Matches[0];
		console.log(`✓ Selected uitk-type-300 match (preferring uitk-type-end): $${bestMatch.price} for ${bestMatch.nights} nights`);
		console.log(`  Match text: ${bestMatch.matchText}`);
		return {
			price: Math.round(bestMatch.price * 100),
			nights: bestMatch.nights
		};
	}
	
	const uitkTypeEndMatches = allMatches.filter(m => m.pattern.includes('uitk-type-end'));
	if (uitkTypeEndMatches.length > 0) {
		// WORKAROUND: Prefer later position (final price appears after intermediate)
		const bestMatch = uitkTypeEndMatches.sort((a, b) => b.position - a.position)[0];
		console.log(`✓ Selected uitk-type-end match (final price): $${bestMatch.price} for ${bestMatch.nights} nights`);
		console.log(`  Match text: ${bestMatch.matchText}`);
		return {
			price: Math.round(bestMatch.price * 100),
			nights: bestMatch.nights
		};
	}
	
	const uitkMatches = allMatches.filter(m => m.pattern.includes('uitk-text'));
	if (uitkMatches.length > 0) {
		// WORKAROUND: Prefer later position (final price appears after intermediate)
		const bestMatch = uitkMatches.sort((a, b) => b.position - a.position)[0];
		console.log(`✓ Selected uitk-text match: $${bestMatch.price} for ${bestMatch.nights} nights`);
		console.log(`  Match text: ${bestMatch.matchText}`);
		return {
			price: Math.round(bestMatch.price * 100),
			nights: bestMatch.nights
		};
	}
	
	// Otherwise, use the match that appears latest in HTML (most likely to be final price)
	const bestMatch = allMatches.sort((a, b) => b.position - a.position)[0];
	console.log(`[${timestamp}] ✓ Selected latest match (final price): $${bestMatch.price} for ${bestMatch.nights} nights`);
	console.log(`[${timestamp}]   Match text: ${bestMatch.matchText.substring(0, 200)}`);
	return {
		price: Math.round(bestMatch.price * 100),
		nights: bestMatch.nights
	};
	
	// Fallback: If no HTML patterns matched, try JSON extraction
	// (But only if we didn't find anything in HTML, as HTML is more reliable for checkout pages)
	if (allMatches.length === 0) {
		console.log(`[${timestamp}] ⚠️ No HTML patterns matched, trying JSON extraction as fallback...`);
		const jsonPrice = extractPriceFromJSON(html);
		if (jsonPrice) {
			console.log(`[${timestamp}] ✓ Found price in JSON: $${jsonPrice.price / 100}${jsonPrice.nights ? ` for ${jsonPrice.nights} nights` : ''}`);
			return jsonPrice;
		}
	}
	
	console.log(`[${timestamp}] ❌ Could not extract price from HTML or JSON`);
	return null;
}

/**
 * Check for error messages in VRBO/Airbnb HTML
 * Returns error type if found, null otherwise
 */
export function checkForErrors(html: string, siteType: 'vrbo' | 'airbnb'): {
	type: 'UNAVAILABLE_DATES' | 'TOO_MANY_GUESTS' | null;
	message?: string;
} | null {
	if (siteType === 'vrbo') {
		// Check for "not available for your dates" message
		if (html.includes('not available for your dates') || 
		    html.includes('This property is not available') ||
		    html.includes('property is not available for your dates')) {
			return {
				type: 'UNAVAILABLE_DATES',
				message: 'This property is not available for your dates. Please choose new dates.'
			};
		}
		
		// Check for "can't accommodate" message
		if (html.includes("can't accommodate") || 
		    html.includes('cannot accommodate') ||
		    html.includes("property can't accommodate")) {
			return {
				type: 'TOO_MANY_GUESTS',
				message: 'This property cannot accommodate the selected number of guests. Please choose fewer guests.'
			};
		}
	} else if (siteType === 'airbnb') {
		// Similar checks for Airbnb
		if (html.includes('not available') && html.includes('dates')) {
			return {
				type: 'UNAVAILABLE_DATES',
				message: 'This property is not available for your dates. Please choose new dates.'
			};
		}
		
		if (html.includes("can't accommodate") || html.includes('exceeds maximum')) {
			return {
				type: 'TOO_MANY_GUESTS',
				message: 'This property cannot accommodate the selected number of guests. Please choose fewer guests.'
			};
		}
	}
	
	return null;
}

/**
 * Scrape property information using custom selectors
 */
/**
 * Extract property ID from VRBO URL
 * Examples:
 * - https://www.vrbo.com/788798 -> 788798
 * - https://www.vrbo.com/123456?param=value -> 123456
 */
function extractVRBOPropertyId(url: string): string | null {
	const match = url.match(/vrbo\.com\/(\d+)/);
	return match ? match[1] : null;
}

/**
 * Fetch calendar availability from VRBO's API
 * VRBO uses GraphQL for their API
 */
async function fetchVRBOCalendarAPI(propertyId: string): Promise<{ start: Date; end: Date }[] | null> {
	try {
		// VRBO's GraphQL endpoint
		const graphqlUrl = 'https://www.vrbo.com/graphql';
		
		// GraphQL query to get calendar availability
		// This is a simplified query - we may need to adjust based on actual VRBO API structure
		const query = {
			query: `
				query GetPropertyAvailability($propertyId: String!) {
					property(id: $propertyId) {
						availability {
							availableDates {
								start
								end
							}
						}
					}
				}
			`,
			variables: {
				propertyId: propertyId
			}
		};

		const response = await fetch(graphqlUrl, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Accept': 'application/json',
				'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
				'Origin': 'https://www.vrbo.com',
				'Referer': `https://www.vrbo.com/${propertyId}`
			},
			body: JSON.stringify(query)
		});

		if (!response.ok) {
			if (response.status === 429) {
				console.log('VRBO API rate limited (429) - may require authentication or different headers');
			} else {
				console.log(`VRBO API returned ${response.status}: ${response.statusText}`);
			}
			return null;
		}

		const data = await response.json();
		
		// Parse GraphQL response
		if (data.data?.property?.availability?.availableDates) {
			const dates = data.data.property.availability.availableDates;
			return dates.map((range: { start: string; end: string }) => ({
				start: new Date(range.start),
				end: new Date(range.end)
			}));
		}

		// Check for GraphQL errors
		if (data.errors) {
			console.log('VRBO GraphQL errors:', JSON.stringify(data.errors));
		}

		// If response structure is different, log it for debugging
		if (data.data && !data.data.property) {
			console.log('VRBO API response structure:', JSON.stringify(data.data).substring(0, 200));
		}

		return null;
	} catch (error) {
		console.error('Error fetching VRBO calendar API:', error);
		return null;
	}
}

/**
 * Extract available dates from VRBO calendar
 * VRBO uses specific data structures - this function parses them
 * Also attempts to call VRBO's calendar API directly
 */
async function extractVRBODates(html: string, url?: string): Promise<{ start: Date; end: Date }[]> {
	// First, try to call VRBO's API directly if we have the URL
	if (url) {
		const propertyId = extractVRBOPropertyId(url);
		if (propertyId) {
			console.log(`Attempting to fetch calendar from VRBO API for property ${propertyId}...`);
			const apiDates = await fetchVRBOCalendarAPI(propertyId);
			if (apiDates && apiDates.length > 0) {
				console.log(`✓ Found ${apiDates.length} date ranges from VRBO API`);
				return apiDates;
			}
			console.log('VRBO API did not return dates, falling back to HTML extraction');
		}
	}
	
	const availableDates: { start: Date; end: Date }[] = [];
	
	try {
		// Method 1: Look for JSON-LD or embedded JSON with availability
		const jsonLdPattern = /<script[^>]*type="application\/ld\+json"[^>]*>(.*?)<\/script>/gis;
		const jsonLdMatches = html.match(jsonLdPattern);
		
		if (jsonLdMatches) {
			for (const match of jsonLdMatches) {
				try {
					const jsonContent = match.replace(/<script[^>]*>|<\/script>/gi, '').trim();
					const data = JSON.parse(jsonContent);
					
					// VRBO might have availability in different places
					if (data.availabilityStarts || data.availabilityEnds) {
						availableDates.push({
							start: new Date(data.availabilityStarts),
							end: new Date(data.availabilityEnds)
						});
					}
				} catch (e) {
					// Not valid JSON, continue
				}
			}
		}
		
		// Method 2: Look for calendar data in script tags (VRBO embeds calendar state)
		const scriptPattern = /<script[^>]*>(.*?availability.*?)<\/script>/gis;
		const scriptMatches = html.match(scriptPattern);
		
		if (scriptMatches) {
			for (const script of scriptMatches) {
				// Look for date patterns in the script
				// VRBO often uses ISO date strings or timestamps
				const datePattern = /(\d{4}-\d{2}-\d{2})/g;
				const dates = script.match(datePattern);
				if (dates && dates.length >= 2) {
					// Try to find date ranges
					const uniqueDates = [...new Set(dates)].sort();
					if (uniqueDates.length > 0) {
						// Group consecutive dates into ranges
						let rangeStart = new Date(uniqueDates[0]);
						let rangeEnd = new Date(uniqueDates[0]);
						
						for (let i = 1; i < uniqueDates.length; i++) {
							const currentDate = new Date(uniqueDates[i]);
							const prevDate = new Date(uniqueDates[i - 1]);
							const daysDiff = (currentDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24);
							
							if (daysDiff === 1) {
								// Consecutive date, extend range
								rangeEnd = currentDate;
							} else {
								// Gap found, save current range and start new one
								if (rangeStart <= rangeEnd) {
									availableDates.push({ start: rangeStart, end: rangeEnd });
								}
								rangeStart = currentDate;
								rangeEnd = currentDate;
							}
						}
						// Add final range
						if (rangeStart <= rangeEnd) {
							availableDates.push({ start: rangeStart, end: rangeEnd });
						}
					}
				}
			}
		}
		
		// Method 3: Look for data attributes on calendar elements
		const calendarDataPattern = /data-available[^=]*="([^"]+)"/gi;
		const calendarMatches = html.match(calendarDataPattern);
		if (calendarMatches) {
			console.log(`Found ${calendarMatches.length} calendar data attributes`);
		}
		
		// Method 5: Look for calendar dates in rendered HTML - VRBO marks available dates
		// Available dates typically have specific classes or data attributes
		// Look for date cells that are NOT disabled/unavailable
		const calendarDatePattern = /<td[^>]*(?:data-date|aria-label)="(\d{4}-\d{2}-\d{2})"[^>]*(?!disabled|unavailable|aria-disabled)[^>]*>/gi;
		const dateMatches = html.match(calendarDatePattern);
		if (dateMatches) {
			console.log(`Found ${dateMatches.length} potential available dates in calendar HTML`);
			// Extract dates and group into ranges
			const dates: string[] = [];
			for (const match of dateMatches) {
				const dateMatch = match.match(/(\d{4}-\d{2}-\d{2})/);
				if (dateMatch) {
					dates.push(dateMatch[1]);
				}
			}
			if (dates.length > 0) {
				const uniqueDates = [...new Set(dates)].sort();
				// Group consecutive dates into ranges
				let rangeStart = new Date(uniqueDates[0]);
				let rangeEnd = new Date(uniqueDates[0]);
				
				for (let i = 1; i < uniqueDates.length; i++) {
					const currentDate = new Date(uniqueDates[i]);
					const prevDate = new Date(uniqueDates[i - 1]);
					const daysDiff = (currentDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24);
					
					if (daysDiff === 1) {
						rangeEnd = currentDate;
					} else {
						if (rangeStart <= rangeEnd) {
							availableDates.push({ start: rangeStart, end: rangeEnd });
						}
						rangeStart = currentDate;
						rangeEnd = currentDate;
					}
				}
				if (rangeStart <= rangeEnd) {
					availableDates.push({ start: rangeStart, end: rangeEnd });
				}
			}
		}
		
		// Method 6: Look for VRBO's calendar JSON data in script tags
		// VRBO often embeds calendar data in a specific format
		const vrboCalendarPattern = /"calendar"[^:]*:\s*\{[^}]*"availableDates"[^:]*:\s*\[([^\]]+)\]/is;
		const vrboCalendarMatch = html.match(vrboCalendarPattern);
		if (vrboCalendarMatch) {
			console.log('Found VRBO calendar JSON pattern');
			try {
				// Try to extract and parse the dates
				const datesStr = vrboCalendarMatch[1];
				const dateRegex = /(\d{4}-\d{2}-\d{2})/g;
				const extractedDates = datesStr.match(dateRegex);
				if (extractedDates && extractedDates.length > 0) {
					const uniqueDates = [...new Set(extractedDates)].sort();
					// Group into ranges
					let rangeStart = new Date(uniqueDates[0]);
					let rangeEnd = new Date(uniqueDates[0]);
					
					for (let i = 1; i < uniqueDates.length; i++) {
						const currentDate = new Date(uniqueDates[i]);
						const prevDate = new Date(uniqueDates[i - 1]);
						const daysDiff = (currentDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24);
						
						if (daysDiff === 1) {
							rangeEnd = currentDate;
						} else {
							if (rangeStart <= rangeEnd) {
								availableDates.push({ start: rangeStart, end: rangeEnd });
							}
							rangeStart = currentDate;
							rangeEnd = currentDate;
						}
					}
					if (rangeStart <= rangeEnd) {
						availableDates.push({ start: rangeStart, end: rangeEnd });
					}
				}
			} catch (e) {
				console.log('Error parsing VRBO calendar JSON:', e);
			}
		}
		
		// Method 7: Parse rendered calendar HTML - look for date buttons/cells that are clickable (available)
		// VRBO marks unavailable dates with disabled/aria-disabled attributes
		// Available dates are typically in button or td elements without disabled
		const calendarButtonPattern = /<(?:button|td|div)[^>]*(?:data-date|aria-label|data-testid)="(\d{4}-\d{2}-\d{2})"[^>]*(?!disabled|aria-disabled|unavailable)[^>]*>/gi;
		const buttonMatches = [...html.matchAll(calendarButtonPattern)];
		if (buttonMatches.length > 0) {
			console.log(`Found ${buttonMatches.length} potential available date elements`);
			const dates: string[] = [];
			for (const match of buttonMatches) {
				const dateMatch = match[0].match(/(\d{4}-\d{2}-\d{2})/);
				if (dateMatch && !match[0].includes('disabled') && !match[0].includes('aria-disabled="true"')) {
					dates.push(dateMatch[1]);
				}
			}
			if (dates.length > 0) {
				const uniqueDates = [...new Set(dates)].sort();
				console.log(`Extracted ${uniqueDates.length} unique available dates from calendar HTML`);
				// Group into ranges
				let rangeStart = new Date(uniqueDates[0]);
				let rangeEnd = new Date(uniqueDates[0]);
				
				for (let i = 1; i < uniqueDates.length; i++) {
					const currentDate = new Date(uniqueDates[i]);
					const prevDate = new Date(uniqueDates[i - 1]);
					const daysDiff = (currentDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24);
					
					if (daysDiff === 1) {
						rangeEnd = currentDate;
					} else {
						if (rangeStart <= rangeEnd) {
							availableDates.push({ start: rangeStart, end: rangeEnd });
						}
						rangeStart = currentDate;
						rangeEnd = currentDate;
					}
				}
				if (rangeStart <= rangeEnd) {
					availableDates.push({ start: rangeStart, end: rangeEnd });
				}
			}
		}
		
		// Method 8: Look for blocked/unavailable dates and invert to get available dates
		// Sometimes it's easier to find what's NOT available
		const blockedDatesPattern = /(?:blocked|unavailable|disabled)[^:]*:\s*\[([^\]]+)\]/gi;
		const blockedMatches = html.match(blockedDatesPattern);
		if (blockedMatches && availableDates.length === 0) {
			console.log('Found blocked dates pattern - would need to invert to get available dates');
			// This would require knowing the full date range, so we'll skip for now
		}
		
		// Method 4: Look for VRBO-specific calendar API responses embedded in page
		// VRBO might embed calendar data in window.__INITIAL_STATE__ or similar
		const initialStatePattern = /window\.__INITIAL_STATE__\s*=\s*({.*?});/s;
		const initialStateMatch = html.match(initialStatePattern);
		if (initialStateMatch) {
			try {
				const state = JSON.parse(initialStateMatch[1]);
				// Navigate through state to find calendar/availability data
				if (state.calendar || state.availability || state.listing?.availability) {
					console.log('Found calendar data in __INITIAL_STATE__');
				}
			} catch (e) {
				// Not valid JSON
			}
		}
		
		// Note: VRBO uses "dateless" listing pages where calendar is loaded dynamically
		// Calendar data is typically fetched via separate API calls after page load
		// This extraction attempts to find embedded data, but may return empty if calendar
		// is loaded via JavaScript/AJAX
		
		if (availableDates.length === 0) {
			console.log('VRBO calendar: No dates found in initial HTML (likely loaded dynamically)');
			console.log('Calendar extraction may require additional API calls or browser automation');
		} else {
			console.log(`Extracted ${availableDates.length} available date ranges from VRBO`);
		}
	} catch (error) {
		console.error('Error extracting VRBO dates:', error);
	}
	
	return availableDates;
}

/**
 * Extract available dates from Airbnb calendar
 * Airbnb uses different data structures than VRBO
 */
function extractAirbnbDates(html: string): { start: Date; end: Date }[] {
	const availableDates: { start: Date; end: Date }[] = [];
	
	try {
		// Method 1: Look for JSON-LD with availability
		const jsonLdPattern = /<script[^>]*type="application\/ld\+json"[^>]*>(.*?)<\/script>/gis;
		const jsonLdMatches = html.match(jsonLdPattern);
		
		if (jsonLdMatches) {
			for (const match of jsonLdMatches) {
				try {
					const jsonContent = match.replace(/<script[^>]*>|<\/script>/gi, '').trim();
					const data = JSON.parse(jsonContent);
					
					// Airbnb schema might have availability
					if (data.availableFrom || data.availableThrough) {
						availableDates.push({
							start: new Date(data.availableFrom),
							end: new Date(data.availableThrough)
						});
					}
				} catch (e) {
					// Continue
				}
			}
		}
		
		// Method 2: Look for Airbnb's embedded data (often in __NEXT_DATA__ or similar)
		const nextDataPattern = /<script[^>]*id="__NEXT_DATA__"[^>]*>(.*?)<\/script>/is;
		const nextDataMatch = html.match(nextDataPattern);
		if (nextDataMatch) {
			try {
				const jsonContent = nextDataMatch[1].trim();
				const data = JSON.parse(jsonContent);
				// Navigate through Airbnb's data structure
				if (data.props?.pageProps?.listing?.availability) {
					console.log('Found availability in __NEXT_DATA__');
					// Parse Airbnb's availability structure
				}
			} catch (e) {
				// Not valid JSON
			}
		}
		
		// Method 3: Look for calendar API responses
		const apiResponsePattern = /"availability":\s*\{[^}]*"availableDates":\s*\[(.*?)\]/is;
		const apiMatch = html.match(apiResponsePattern);
		if (apiMatch) {
			console.log('Found availability in API response pattern');
		}
		
		// Note: Airbnb calendar data may also be loaded dynamically
		// This extraction attempts common patterns but may need refinement
		
		if (availableDates.length === 0) {
			console.log('Airbnb calendar: No dates found in initial HTML (may be loaded dynamically)');
		} else {
			console.log(`Extracted ${availableDates.length} available date ranges from Airbnb`);
		}
	} catch (error) {
		console.error('Error extracting Airbnb dates:', error);
	}
	
	return availableDates;
}

/**
 * Extract available dates from VRBO/Airbnb calendar
 * Uses site-specific extraction functions
 */
async function extractAvailableDates(html: string, siteType: 'vrbo' | 'airbnb', url?: string): Promise<{ start: Date; end: Date }[]> {
	if (siteType === 'vrbo') {
		return await extractVRBODates(html, url);
	} else {
		return extractAirbnbDates(html);
	}
}

export async function scrapePropertyInfo(
	url: string,
	customConfig?: Partial<ScrapingConfig>,
	isCheckout: boolean = false // Explicit parameter to indicate checkout page
): Promise<{
	title: string | null;
	maxGuests: number | null;
	roomCount: number | null;
	coverPhoto: string | null;
	availableDates?: { start: Date; end: Date }[];
	totalPrice?: number | null; // Price in cents
	totalNights?: number | null; // Number of nights (if found in "for X nights" format)
	error?: {
		type: 'UNAVAILABLE_DATES' | 'TOO_MANY_GUESTS';
		message: string;
	};
}> {
	const isVRBO = url.includes('vrbo.com');
	const isAirbnb = url.includes('airbnb.com');

	if (!isVRBO && !isAirbnb) {
		return { title: null, maxGuests: null, roomCount: null, coverPhoto: null };
	}

	// Check if this is a checkout URL - these have the final calculated price!
	const timestamp = new Date().toISOString();
	const detectedCheckout = url.includes('/checkout/') || url.includes('/book/') || url.includes('/reserve/');
	const isCheckoutPage = isCheckout || detectedCheckout;
	if (isCheckoutPage) {
		console.log(`[${timestamp}] ✅ Detected checkout URL - extracting final price from checkout page`);
	} else {
		console.log(`[${timestamp}] ⚠️ Not a checkout URL - may need to extract from listing page`);
	}

	const siteType = isVRBO ? 'vrbo' : 'airbnb';
	const config = customConfig || SCRAPING_CONFIGS[siteType];

	// Fetch HTML - for checkout pages, use longer wait times for JavaScript to render
	console.log(`[${timestamp}] 🌐 Fetching HTML from: ${url}`);
	let html = await fetchPageHTML(url);
	if (!html) {
		console.log(`[${timestamp}] ❌ Failed to fetch HTML`);
		return { title: null, maxGuests: null, roomCount: null, coverPhoto: null };
	}
	console.log(`[${timestamp}] ✅ HTML fetched successfully (${html.length} characters)`);
	
	// For checkout pages, check if we got an error/login page instead of checkout content
	if (isCheckoutPage) {
		const hasErrorPage = html.includes('Sign in') && html.includes('to contact hosts') ||
		                     html.includes('Access Denied') ||
		                     html.includes('Bot or Not') ||
		                     html.includes('Please enable JavaScript') ||
		                     (html.length < 5000 && !html.includes('checkout') && !html.includes('price'));
		
		if (hasErrorPage) {
			console.warn(`[${timestamp}] ⚠️ Checkout page may require authentication or session cookies`);
			console.warn(`[${timestamp}]   HTML length: ${html.length}, contains checkout: ${html.includes('checkout')}, contains price: ${html.includes('price')}`);
			console.warn(`[${timestamp}]   The checkout URL may have expired or requires a logged-in session`);
		}
	}
	
	// Use the same HTML for price extraction (no need for separate calendar fetch since calendar UI was removed)
	let calendarHtml = html;
	
	// Extract values
	console.log(`[${timestamp}] 🔍 Extracting property information...`);
	const title = config.selectors.title && config.selectors.title.length > 0
		? extractValue(html, config.selectors.title)
		: null;
	console.log(`[${timestamp}]   - title: ${title || '(not found)'}`);

	const maxGuests = config.selectors.maxGuests && config.selectors.maxGuests.length > 0
		? extractNumber(html, config.selectors.maxGuests)
		: null;
	console.log(`[${timestamp}]   - maxGuests: ${maxGuests || '(not found)'}`);

	const roomCount = config.selectors.roomCount && config.selectors.roomCount.length > 0
		? extractNumber(html, config.selectors.roomCount)
		: null;
	console.log(`[${timestamp}]   - roomCount: ${roomCount || '(not found)'}`);

	const coverPhoto = config.selectors.coverPhoto && config.selectors.coverPhoto.length > 0
		? extractValue(html, config.selectors.coverPhoto)
		: null;
	console.log(`[${timestamp}]   - coverPhoto: ${coverPhoto ? '(found)' : '(not found)'}`);

	// Extract total price (may include nights if in "for X nights" format)
	// WORKAROUND: For VRBO/Airbnb, the price updates via JavaScript after initial render
	// Strategy: Try multiple approaches:
	// 1. Extract from current HTML (may have intermediate price)
	// 2. Extract from embedded JSON/JavaScript data (often has final price)
	// 3. Retry after a delay to get the final price
	
	let htmlForPrice = html;
	if (isVRBO && calendarHtml && calendarHtml.length > html.length) {
		console.log('Using calendar HTML for price extraction (more content rendered)');
		htmlForPrice = calendarHtml;
	}
	
	// Try to extract price from current HTML
	let priceResult = config.selectors.totalPrice && config.selectors.totalPrice.length > 0
		? extractPrice(htmlForPrice, config.selectors.totalPrice)
		: null;
	
	// WORKAROUND: For checkout pages, we don't need retries - they already have the final price
	// For regular listing pages, only retry if we didn't find a price at all
	// Reduced retry delays for faster response (2s, 4s instead of 5s, 10s, 15s)
	if (!isCheckoutPage && !priceResult && (isVRBO || isAirbnb)) {
		console.log('⚠️ No price found - retrying with shorter delays...');
		
		// Try shorter retries (2s, 4s) - Zyte API already waits for page load
		const retryDelays = [2000, 4000];
		
		for (let i = 0; i < retryDelays.length; i++) {
			const delay = retryDelays[i];
			console.log(`Retry attempt ${i + 1}/${retryDelays.length}: Waiting ${delay}ms...`);
			await sleep(delay);
			
			// Fetch the page again to get the price
			const retryHtml = await fetchPageHTML(url);
			if (retryHtml && retryHtml.length > 0) {
				const retryPriceResult = config.selectors.totalPrice && config.selectors.totalPrice.length > 0
					? extractPrice(retryHtml, config.selectors.totalPrice)
					: null;
				
				if (retryPriceResult) {
					console.log(`✓ Found price on retry ${i + 1}: $${retryPriceResult.price / 100}${retryPriceResult.nights ? ` for ${retryPriceResult.nights} nights` : ''}`);
					priceResult = retryPriceResult;
					break; // Stop retrying once we have a price
				}
			}
		}
		
		if (!priceResult) {
			console.log('⚠️ No price found in retry attempts');
		}
	}
	
	const totalPrice = priceResult?.price || null;
	const totalNights = priceResult?.nights || null;
	
	if (!totalPrice) {
		console.log(`[${timestamp}] ⚠️ Price extraction failed - price may be loaded dynamically or in different format`);
	} else {
		console.log(`[${timestamp}] 💰 Final extracted price: $${(totalPrice / 100).toFixed(2)}${totalNights ? ` for ${totalNights} nights` : ''}`);
		if (isCheckoutPage && totalNights) {
			console.log(`[${timestamp}]   ℹ️ This is from checkout page - verifying nights calculation...`);
		}
	}

	// Check for error messages (unavailable dates, too many guests)
	const error = checkForErrors(html, siteType);

	// Skip available dates extraction - calendar UI was removed, so this saves time
	// const availableDates = await extractAvailableDates(htmlForCalendar, siteType, url);

	return {
		title,
		maxGuests,
		roomCount,
		coverPhoto,
		totalPrice,
		totalNights,
		error: error || undefined,
		availableDates: undefined // Not needed since calendar UI was removed
	};
}

/**
 * Update scraping configuration for a site
 * Call this to customize what to look for
 */
export function updateScrapingConfig(
	site: 'vrbo' | 'airbnb',
	selectors: {
		title?: string[];
		maxGuests?: string[];
		coverPhoto?: string[];
	}
): void {
	SCRAPING_CONFIGS[site] = {
		site,
		selectors: {
			...SCRAPING_CONFIGS[site].selectors,
			...selectors
		}
	};
}
