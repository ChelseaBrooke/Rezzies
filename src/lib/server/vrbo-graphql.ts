// VRBO GraphQL API integration
// Uses VRBO's GraphQL endpoint to fetch price information

import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

export interface VRBOGraphQLPriceInfo {
	totalPrice: number | null; // Price in cents
	totalNights: number | null;
	currency?: string;
}

/**
 * Extract dates, guests, and search criteria from VRBO listing URL
 */
export function extractVRBOParams(url: string): {
	propertyId: string | null;
	checkInDate?: { day: number; month: number; year: number };
	checkOutDate?: { day: number; month: number; year: number };
	adults?: number;
	searchId?: string;
	productOffersId?: string;
	regionId?: string;
	regionName?: string;
	coordinates?: { latitude: number; longitude: number };
	expediaPropertyId?: string;
} {
	try {
		const urlObj = new URL(url);
		const params = urlObj.searchParams;
		
		// Extract property ID - can be from URL path or "selected" or "expediaPropertyId" param
		let propertyId: string | null = null;
		const urlMatch = url.match(/vrbo\.com\/(\d+)/);
		if (urlMatch) {
			propertyId = urlMatch[1];
		} else {
			// Try from params
			propertyId = params.get('selected') || params.get('expediaPropertyId') || null;
		}
		
		// Extract dates from URL params
		let checkInDate: { day: number; month: number; year: number } | undefined;
		let checkOutDate: { day: number; month: number; year: number } | undefined;
		
		// Try different date parameter formats
		const checkInStr = params.get('chkin') || params.get('startDate') || params.get('checkIn');
		const checkOutStr = params.get('chkout') || params.get('endDate') || params.get('checkOut');
		
		if (checkInStr) {
			// Format: YYYY-MM-DD
			const [year, month, day] = checkInStr.split('-').map(Number);
			if (year && month && day) {
				checkInDate = { day, month, year };
			}
		}
		
		if (checkOutStr) {
			// Format: YYYY-MM-DD
			const [year, month, day] = checkOutStr.split('-').map(Number);
			if (year && month && day) {
				checkOutDate = { day, month, year };
			}
		}
		
		// Extract adults/guests
		const adultsStr = params.get('adults') || params.get('guests');
		const adults = adultsStr ? parseInt(adultsStr, 10) : undefined;
		
		// Extract additional search criteria
		const searchId = params.get('searchId') || undefined;
		const productOffersId = params.get('productOffersId') || undefined;
		const regionId = params.get('regionId') || undefined;
		const regionName = params.get('destination') ? decodeURIComponent(params.get('destination') || '') : undefined;
		const expediaPropertyId = params.get('expediaPropertyId') || params.get('selected') || undefined;
		
		// Extract coordinates if available
		let coordinates: { latitude: number; longitude: number } | undefined;
		const latLong = params.get('latLong');
		if (latLong) {
			const [lat, lng] = latLong.split(',').map(Number);
			if (!isNaN(lat) && !isNaN(lng)) {
				coordinates = { latitude: lat, longitude: lng };
			}
		}
		
		return {
			propertyId,
			checkInDate,
			checkOutDate,
			adults: adults && !isNaN(adults) ? adults : undefined,
			searchId,
			productOffersId,
			regionId,
			regionName,
			coordinates,
			expediaPropertyId
		};
	} catch (e) {
		return { propertyId: null };
	}
}

/**
 * Call VRBO GraphQL API to get price information
 * Returns the total price including taxes and fees
 * 
 * @param propertyId - VRBO property ID (e.g., "18968197" or "788798")
 * @param checkInDate - Check-in date {day, month, year}
 * @param checkOutDate - Check-out date {day, month, year}
 * @param adults - Number of adults (default: 2)
 * @param searchCriteria - Optional additional search criteria (searchId, productOffersId, etc.)
 */
export async function fetchVRBOPriceFromGraphQL(
	propertyId: string,
	checkInDate: { day: number; month: number; year: number },
	checkOutDate: { day: number; month: number; year: number },
	adults: number = 2,
	searchCriteria?: {
		searchId?: string;
		productOffersId?: string;
		regionId?: string;
		regionName?: string;
		coordinates?: { latitude: number; longitude: number };
	}
): Promise<VRBOGraphQLPriceInfo> {
	const timestamp = new Date().toISOString();
	console.log(`[${timestamp}] 🔌 Calling VRBO GraphQL API for property ${propertyId}`);
	console.log(`[${timestamp}]   Dates: ${checkInDate.year}-${checkInDate.month}-${checkInDate.day} to ${checkOutDate.year}-${checkOutDate.month}-${checkOutDate.day}`);
	console.log(`[${timestamp}]   Adults: ${adults}`);
	
	try {
		// Build the GraphQL operations - VRBO sends multiple operations in a batch
		// The key operation for price is "AncillaryPropertyOffersQuery"
		const destination = searchCriteria?.regionName && searchCriteria?.regionId ? {
			regionName: searchCriteria.regionName,
			regionId: searchCriteria.regionId,
			coordinates: searchCriteria.coordinates || { latitude: 0, longitude: 0 },
			pinnedPropertyId: propertyId,
			propertyIds: null,
			mapBounds: null
		} : {
			pinnedPropertyId: propertyId,
			propertyIds: null,
			mapBounds: null
		};
		
		const secondarySelections = [
			{ id: 'privacyTrackingState', value: 'CAN_TRACK' }
		];
		
		if (searchCriteria?.productOffersId) {
			secondarySelections.push({ id: 'productOffersId', value: searchCriteria.productOffersId });
		}
		if (searchCriteria?.searchId) {
			secondarySelections.push({ id: 'searchId', value: searchCriteria.searchId });
		}
		secondarySelections.push({ id: 'selected', value: propertyId });
		secondarySelections.push({ id: 'sort', value: 'RECOMMENDED' });
		secondarySelections.push({ id: 'useRewards', value: 'SHOP_WITHOUT_POINTS' });
		
		const baseSearchCriteria = {
			primary: {
				dateRange: {
					checkInDate: checkInDate,
					checkOutDate: checkOutDate
				},
				destination: destination,
				rooms: [{
					adults: adults,
					children: []
				}]
			},
			secondary: {
				counts: [],
				booleans: [],
				selections: secondarySelections,
				ranges: []
			}
		};
		
		const baseContext = {
			siteId: 9001001,
			locale: 'en_US',
			eapid: 1,
			tpid: 9001,
			currency: 'USD',
			device: { type: 'DESKTOP' },
			identity: {
				duaid: 'anonymous',
				authState: 'ANONYMOUS'
			},
			privacyTrackingState: 'CAN_TRACK'
		};
		
		// Build the operations array - VRBO sends multiple operations
		const graphQLOperations = [
			{
				operationName: 'AncillaryPropertyOffersQuery',
				variables: {
					propertyId: propertyId,
					searchCriteria: baseSearchCriteria,
					shoppingContext: {
						multiItem: null,
						queryTriggeredBy: 'OTHER'
					},
					travelAdTrackingInfo: null,
					searchOffer: null,
					referrer: 'HSR',
					selectedSavedQuoteInput: null,
					context: baseContext
				},
				extensions: {
					persistedQuery: {
						version: 1,
						sha256Hash: '342098639bb044c70b290892d183a8987ee1c33fbee0bf7140384af70bbe2b70'
					}
				}
			}
		];
		
		// Retry logic for rate limiting (429 errors)
		const maxRetries = 3;
		let lastError: any = null;
		
		for (let attempt = 0; attempt < maxRetries; attempt++) {
			if (attempt > 0) {
				// Exponential backoff: 2s, 4s, 8s
				const delayMs = Math.pow(2, attempt) * 1000;
				console.log(`[${timestamp}] ⏳ Retry attempt ${attempt + 1}/${maxRetries} after ${delayMs}ms delay...`);
				await new Promise(resolve => setTimeout(resolve, delayMs));
			}
			
			try {
				const response = await fetch('https://www.vrbo.com/graphql', {
					method: 'POST',
					headers: {
						'accept': '*/*',
						'accept-language': 'en-US,en;q=0.9',
						'client-info': 'shopping-pwa,bec75753a54e7ed26ca57f313bc25f27ff0ace7d,us-east-1',
						'content-type': 'application/json',
						'origin': 'https://www.vrbo.com',
						'referer': `https://www.vrbo.com/${propertyId}`,
						'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36',
						'sec-fetch-dest': 'empty',
						'sec-fetch-mode': 'cors',
						'sec-fetch-site': 'same-origin',
						'x-parent-brand-id': 'vrbo',
						'x-product-line': 'lodging',
						'x-shopping-product-line': 'lodging'
					},
					body: JSON.stringify(graphQLOperations)
				});
				
				if (response.status === 429) {
					// Rate limited - will retry
					const errorText = await response.text();
					console.log(`[${timestamp}] ⚠️ VRBO GraphQL API rate limited (429) on attempt ${attempt + 1}/${maxRetries}`);
					lastError = { status: 429, message: 'Rate limited' };
					continue; // Retry
				}
				
				if (!response.ok) {
					const errorText = await response.text();
					console.log(`[${timestamp}] ❌ VRBO GraphQL API returned ${response.status}: ${response.statusText}`);
					console.log(`[${timestamp}] Error response: ${errorText.substring(0, 500)}`);
					return { totalPrice: null, totalNights: null };
				}
				
				// Success! Break out of retry loop
				const data = await response.json();
				console.log(`[${timestamp}] ✅ VRBO GraphQL API response received (attempt ${attempt + 1})`);
				console.log(`[${timestamp}] Response type: ${Array.isArray(data) ? 'array' : typeof data}`);
				if (Array.isArray(data)) {
					console.log(`[${timestamp}] Response has ${data.length} operation results`);
					// Log the structure of each operation result
					for (let i = 0; i < data.length; i++) {
						const result = data[i];
						console.log(`[${timestamp}] Operation ${i + 1}: ${result.operationName || 'unknown'}`);
						if (result.data) {
							// Try to find displayMessages or priceMessaging in the response
							const hasDisplayMessages = result.data.displayMessages || 
								(result.data.ancillaryPropertyOffers && result.data.ancillaryPropertyOffers.displayMessages);
							if (hasDisplayMessages) {
								console.log(`[${timestamp}]   Found displayMessages structure`);
							}
						}
					}
				}
				
				// Parse the response to find price information
				// Look for "priceinsight" or similar fields in the response
				let totalPrice: number | null = null;
				let totalNights: number | null = null;
				
				// The response is an array of operation results
				if (Array.isArray(data)) {
					for (let i = 0; i < data.length; i++) {
						const operationResult = data[i];
						console.log(`[${timestamp}] Processing operation result ${i + 1}/${data.length}: ${operationResult.operationName || 'unknown'}`);
						
						if (operationResult.data) {
							// Look for price data in various possible locations
							// The price is typically in AncillaryPropertyOffersQuery response
							// Check both the root data and nested ancillaryPropertyOffers
							let priceData = findPriceInResponse(operationResult.data);
							
							// Also check in ancillaryPropertyOffers if it exists
							if (!priceData || !priceData.totalPrice) {
								if (operationResult.data.ancillaryPropertyOffers) {
									console.log(`[${timestamp}] Searching in ancillaryPropertyOffers...`);
									priceData = findPriceInResponse(operationResult.data.ancillaryPropertyOffers);
								}
							}
							
							if (priceData && priceData.totalPrice) {
								totalPrice = priceData.totalPrice;
								totalNights = priceData.totalNights;
								console.log(`[${timestamp}] 💰 Found price in GraphQL response: $${(totalPrice / 100).toFixed(2)}${totalNights ? ` for ${totalNights} nights` : ''}`);
								break;
							} else {
								console.log(`[${timestamp}] ⚠️ No price found in operation ${operationResult.operationName || 'unknown'}`);
							}
						}
						
						// Check for errors in the operation result
						if (operationResult.errors) {
							console.log(`[${timestamp}] ⚠️ GraphQL operation ${operationResult.operationName || 'unknown'} returned errors:`, operationResult.errors);
						}
					}
				} else if (data && typeof data === 'object') {
					// Sometimes the response might be a single object instead of an array
					console.log(`[${timestamp}] Response is a single object, searching for price...`);
					const priceData = findPriceInResponse(data);
					if (priceData && priceData.totalPrice) {
						totalPrice = priceData.totalPrice;
						totalNights = priceData.totalNights;
						console.log(`[${timestamp}] 💰 Found price in GraphQL response: $${(totalPrice / 100).toFixed(2)}${totalNights ? ` for ${totalNights} nights` : ''}`);
					}
				}
				
				if (!totalPrice) {
					console.log(`[${timestamp}] ⚠️ Could not find price in GraphQL response`);
					// Save full response for debugging
					try {
						const debugDir = join(process.cwd(), 'debug-html');
						mkdirSync(debugDir, { recursive: true });
						const debugFilename = `graphql-response-${timestamp.replace(/[:.]/g, '-')}.json`;
						const debugFilepath = join(debugDir, debugFilename);
						writeFileSync(debugFilepath, JSON.stringify(data, null, 2), 'utf-8');
						console.log(`[${timestamp}] 💾 Saved full GraphQL response to: ${debugFilepath}`);
					} catch (saveError) {
						console.log(`[${timestamp}] ⚠️ Could not save GraphQL response for debugging:`, saveError);
					}
					console.log(`[${timestamp}] Response preview:`, JSON.stringify(data).substring(0, 1000));
				}
				
				return { totalPrice, totalNights };
				
			} catch (error) {
				lastError = error;
				console.error(`[${timestamp}] ❌ Error on attempt ${attempt + 1}/${maxRetries}:`, error);
				if (attempt === maxRetries - 1) {
					// Last attempt failed
					break;
				}
			}
		}
		
		// All retries exhausted
		console.log(`[${timestamp}] ❌ VRBO GraphQL API failed after ${maxRetries} attempts`);
		if (lastError) {
			console.log(`[${timestamp}] Last error:`, lastError);
		}
		return { totalPrice: null, totalNights: null };
		
		const data = await response.json();
		console.log(`[${timestamp}] ✅ VRBO GraphQL API response received`);
		console.log(`[${timestamp}] Response type: ${Array.isArray(data) ? 'array' : typeof data}`);
		if (Array.isArray(data)) {
			console.log(`[${timestamp}] Response has ${data.length} operation results`);
			// Log the structure of each operation result
			for (let i = 0; i < data.length; i++) {
				const result = data[i];
				console.log(`[${timestamp}] Operation ${i + 1}: ${result.operationName || 'unknown'}`);
				if (result.data) {
					// Try to find displayMessages or priceMessaging in the response
					const hasDisplayMessages = result.data.displayMessages || 
						(result.data.ancillaryPropertyOffers && result.data.ancillaryPropertyOffers.displayMessages);
					if (hasDisplayMessages) {
						console.log(`[${timestamp}]   Found displayMessages structure`);
					}
				}
			}
		}
		
		// Parse the response to find price information
		// Look for "priceinsight" or similar fields in the response
		let totalPrice: number | null = null;
		let totalNights: number | null = null;
		
		// The response is an array of operation results
		if (Array.isArray(data)) {
			for (let i = 0; i < data.length; i++) {
				const operationResult = data[i];
				console.log(`[${timestamp}] Processing operation result ${i + 1}/${data.length}: ${operationResult.operationName || 'unknown'}`);
				
				if (operationResult.data) {
					// Look for price data in various possible locations
					// The price is typically in AncillaryPropertyOffersQuery response
					// Check both the root data and nested ancillaryPropertyOffers
					let priceData = findPriceInResponse(operationResult.data);
					
					// Also check in ancillaryPropertyOffers if it exists
					if (!priceData || !priceData.totalPrice) {
						if (operationResult.data.ancillaryPropertyOffers) {
							console.log(`[${timestamp}] Searching in ancillaryPropertyOffers...`);
							priceData = findPriceInResponse(operationResult.data.ancillaryPropertyOffers);
						}
					}
					
					if (priceData && priceData.totalPrice) {
						totalPrice = priceData.totalPrice;
						totalNights = priceData.totalNights;
						console.log(`[${timestamp}] 💰 Found price in GraphQL response: $${(totalPrice / 100).toFixed(2)}${totalNights ? ` for ${totalNights} nights` : ''}`);
						break;
					} else {
						console.log(`[${timestamp}] ⚠️ No price found in operation ${operationResult.operationName || 'unknown'}`);
					}
				}
				
				// Check for errors in the operation result
				if (operationResult.errors) {
					console.log(`[${timestamp}] ⚠️ GraphQL operation ${operationResult.operationName || 'unknown'} returned errors:`, operationResult.errors);
				}
			}
		} else if (data && typeof data === 'object') {
			// Sometimes the response might be a single object instead of an array
			console.log(`[${timestamp}] Response is a single object, searching for price...`);
			const priceData = findPriceInResponse(data);
			if (priceData && priceData.totalPrice) {
				totalPrice = priceData.totalPrice;
				totalNights = priceData.totalNights;
				console.log(`[${timestamp}] 💰 Found price in GraphQL response: $${(totalPrice / 100).toFixed(2)}${totalNights ? ` for ${totalNights} nights` : ''}`);
			}
		}
		
		if (!totalPrice) {
			console.log(`[${timestamp}] ⚠️ Could not find price in GraphQL response`);
			// Save full response for debugging
			try {
				const debugDir = join(process.cwd(), 'debug-html');
				mkdirSync(debugDir, { recursive: true });
				const debugFilename = `graphql-response-${timestamp.replace(/[:.]/g, '-')}.json`;
				const debugFilepath = join(debugDir, debugFilename);
				writeFileSync(debugFilepath, JSON.stringify(data, null, 2), 'utf-8');
				console.log(`[${timestamp}] 💾 Saved full GraphQL response to: ${debugFilepath}`);
			} catch (saveError) {
				console.log(`[${timestamp}] ⚠️ Could not save GraphQL response for debugging:`, saveError);
			}
			console.log(`[${timestamp}] Response preview:`, JSON.stringify(data).substring(0, 1000));
		}
		
		return { totalPrice, totalNights };
	} catch (error) {
		console.error(`[${timestamp}] ❌ Error calling VRBO GraphQL API:`, error);
		return { totalPrice: null, totalNights: null };
	}
}

/**
 * Recursively search for price information in the GraphQL response
 * Looks for "PriceDisplayMessage" with "$X for Y nights" format
 * The structure is: array of PriceDisplayMessage objects, each with lineItems array
 */
function findPriceInResponse(data: any): { totalPrice: number | null; totalNights: number | null } | null {
	if (!data || typeof data !== 'object') {
		return null;
	}
	
	// Look for arrays that might contain PriceDisplayMessage objects
	// The structure can be: data.displayMessages or data itself might be an array
	// Also check in ancillaryPropertyOffers.displayMessages
	let messagesArray: any[] | null = null;
	
	// Check in ancillaryPropertyOffers first (this is where AncillaryPropertyOffersQuery returns data)
	if (data.ancillaryPropertyOffers) {
		if (Array.isArray(data.ancillaryPropertyOffers.displayMessages)) {
			messagesArray = data.ancillaryPropertyOffers.displayMessages;
			console.log(`[findPriceInResponse] Found displayMessages in ancillaryPropertyOffers (${messagesArray.length} messages)`);
		} else if (data.ancillaryPropertyOffers.priceMessaging && Array.isArray(data.ancillaryPropertyOffers.priceMessaging)) {
			messagesArray = data.ancillaryPropertyOffers.priceMessaging;
			console.log(`[findPriceInResponse] Found priceMessaging in ancillaryPropertyOffers (${messagesArray.length} messages)`);
		}
	}
	
	// Fallback to root level
	if (!messagesArray) {
		if (Array.isArray(data)) {
			messagesArray = data;
			console.log(`[findPriceInResponse] Using data as array (${messagesArray.length} items)`);
		} else if (Array.isArray(data.displayMessages)) {
			messagesArray = data.displayMessages;
			console.log(`[findPriceInResponse] Found displayMessages at root (${messagesArray.length} messages)`);
		} else if (data.priceMessaging && Array.isArray(data.priceMessaging)) {
			messagesArray = data.priceMessaging;
			console.log(`[findPriceInResponse] Found priceMessaging at root (${messagesArray.length} messages)`);
		}
	}
	
	if (messagesArray) {
		console.log(`[findPriceInResponse] Searching ${messagesArray.length} messages for price...`);
		
		// PRIORITY 1: Look for LodgingEnrichedMessage with state="BREAKOUT_TYPE_SECONDARY_PRICE"
		// This is the total price including taxes/fees
		for (let msgIdx = 0; msgIdx < messagesArray.length; msgIdx++) {
			const message = messagesArray[msgIdx];
			if (!message) continue;
			
			console.log(`[findPriceInResponse] Message ${msgIdx + 1}: __typename=${message.__typename || 'unknown'}`);
			
			let lineItems: any[] = [];
			if (Array.isArray(message.lineItems)) {
				lineItems = message.lineItems;
			} else if (message.__typename === 'PriceDisplayMessage' && Array.isArray(message.lineItems)) {
				lineItems = message.lineItems;
			}
			
			if (lineItems.length > 0) {
				console.log(`[findPriceInResponse]   Found ${lineItems.length} lineItems`);
			}
			
			for (let itemIdx = 0; itemIdx < lineItems.length; itemIdx++) {
				const item = lineItems[itemIdx];
				if (!item) continue;
				
				console.log(`[findPriceInResponse]   Item ${itemIdx + 1}: __typename=${item.__typename || 'unknown'}, state=${item.state || 'none'}, value=${item.value ? item.value.substring(0, 50) : 'none'}`);
				
				// Look for LodgingEnrichedMessage with BREAKOUT_TYPE_SECONDARY_PRICE state
				if (item.__typename === 'LodgingEnrichedMessage' && 
				    item.state === 'BREAKOUT_TYPE_SECONDARY_PRICE' &&
				    item.value && typeof item.value === 'string') {
					const valueMatch = item.value.match(/\$([\d,]+(?:\.\d{2})?)\s+for\s+(\d+)\s+nights?/i);
					if (valueMatch && valueMatch[1] && valueMatch[2]) {
						const priceStr = valueMatch[1].replace(/,/g, '');
						const price = parseFloat(priceStr);
						const nights = parseInt(valueMatch[2], 10);
						
						if (!isNaN(price) && price > 0 && !isNaN(nights) && nights > 0) {
							console.log(`✓ Found total price in LodgingEnrichedMessage (BREAKOUT_TYPE_SECONDARY_PRICE): ${item.value}`);
							return {
								totalPrice: Math.round(price * 100), // Convert to cents
								totalNights: nights
							};
						}
					}
				}
			}
		}
		
		// PRIORITY 2: Look for any LodgingEnrichedMessage with "$X for Y nights" format
		// (even without the BREAKOUT_TYPE_SECONDARY_PRICE state)
		for (const message of messagesArray) {
			if (message && (message.__typename === 'PriceDisplayMessage' || Array.isArray(message.lineItems))) {
				const lineItems = message.lineItems || (Array.isArray(message) ? message : []);
				
				for (const item of lineItems) {
					// Look for LodgingEnrichedMessage with "value" field containing "$X for Y nights"
					if (item.__typename === 'LodgingEnrichedMessage' && 
					    item.value && typeof item.value === 'string') {
						const valueMatch = item.value.match(/\$([\d,]+(?:\.\d{2})?)\s+for\s+(\d+)\s+nights?/i);
						if (valueMatch && valueMatch[1] && valueMatch[2]) {
							const priceStr = valueMatch[1].replace(/,/g, '');
							const price = parseFloat(priceStr);
							const nights = parseInt(valueMatch[2], 10);
							
							if (!isNaN(price) && price > 0 && !isNaN(nights) && nights > 0) {
								console.log(`✓ Found total price in LodgingEnrichedMessage: ${item.value}`);
								return {
									totalPrice: Math.round(price * 100), // Convert to cents
									totalNights: nights
								};
							}
						}
					}
				}
			}
		}
		
		// PRIORITY 3: Fallback - look for any item with "value" containing "$X for Y nights"
		// (in case the structure is slightly different)
		for (const message of messagesArray) {
			if (message && Array.isArray(message.lineItems)) {
				for (const item of message.lineItems) {
					if (item.value && typeof item.value === 'string') {
						const valueMatch = item.value.match(/\$([\d,]+(?:\.\d{2})?)\s+for\s+(\d+)\s+nights?/i);
						if (valueMatch && valueMatch[1] && valueMatch[2]) {
							const priceStr = valueMatch[1].replace(/,/g, '');
							const price = parseFloat(priceStr);
							const nights = parseInt(valueMatch[2], 10);
							
							if (!isNaN(price) && price > 0 && !isNaN(nights) && nights > 0) {
								console.log(`✓ Found total price in lineItems value: ${item.value}`);
								return {
									totalPrice: Math.round(price * 100), // Convert to cents
									totalNights: nights
								};
							}
						}
					}
				}
			}
		}
		
		// Skip DisplayPrice with role="LEAD" - this is the nightly rate, not the total
		// (We don't want to use $127 * 3 = $381, we want the actual total which may include taxes/fees)
	}
	
	// Look for "priceMessaging" object (might contain price info)
	if (data.priceMessaging && typeof data.priceMessaging === 'object' && !Array.isArray(data.priceMessaging)) {
		const result = findPriceInResponse(data.priceMessaging);
		if (result && result.totalPrice) {
			return result;
		}
	}
	
	// Recursively search in nested objects (but skip arrays we've already checked)
	for (const key in data) {
		if (data.hasOwnProperty(key) && key !== 'displayMessages' && key !== 'priceMessaging') {
			// Skip arrays at the top level - we want to search in objects
			if (!Array.isArray(data[key]) || (Array.isArray(data[key]) && data[key].length > 0 && typeof data[key][0] === 'object')) {
				const result = findPriceInResponse(data[key]);
				if (result && result.totalPrice) {
					return result;
				}
			}
		}
	}
	
	return null;
}
