/**
 * Extract room and bed information from VRBO/Airbnb listings
 * Also extracts all photos from the listing
 */

export interface ExtractedRoom {
	name: string;
	beds: ExtractedBed[];
}

export interface ExtractedBed {
	bedType: string; // 'king', 'queen', 'twin', 'full', 'bunk', 'sofa', 'murphy', etc.
	quantity: number; // Number of beds of this type
	capacity?: number; // Number of people per bed
}

export interface ExtractedPropertyData {
	rooms: ExtractedRoom[];
	photos: string[]; // All photo URLs from the listing
}

/**
 * Extract rooms and beds from VRBO HTML
 * VRBO typically shows this in a "Rooms & beds" section
 * Format: "Bedroom 1: 1 King Bed", "Living Room 1: 1 Queen Murphy Bed"
 */
export function extractVRBORoomsAndBeds(html: string): ExtractedRoom[] {
	const rooms: ExtractedRoom[] = [];
	
	console.log('[Room Extractor] Starting VRBO room extraction, HTML length:', html.length);
	
	// First, try to extract from JSON/JavaScript data (more reliable)
	try {
		// Look for JSON data with room information
		const jsonPatterns = [
			/"bedrooms?":\s*(\d+)/gi,
			/"rooms?":\s*\[([^\]]+)\]/gi,
			/bedroom[^:]*:\s*(\d+)/gi,
			/"bedroomCount":\s*(\d+)/gi
		];
		
		// Look for structured data with bed information
		const bedDataPattern = /"beds?":\s*\[([^\]]+)\]/gi;
		const bedDataMatch = html.match(bedDataPattern);
		if (bedDataMatch) {
			console.log('[Room Extractor] Found bed data in JSON');
		}
	} catch (e) {
		// Ignore JSON parsing errors
	}
	
	// Look for "Rooms & beds" section first - this is where VRBO typically shows this info
	const roomsSectionMatch = html.match(/rooms?\s*&?\s*beds?[^<]{0,1000}/i);
	if (roomsSectionMatch) {
		console.log('[Room Extractor] Found "Rooms & beds" section, length:', roomsSectionMatch[0].length);
		// Save a snippet for debugging
		const snippet = roomsSectionMatch[0].substring(0, 500);
		console.log('[Room Extractor] Section snippet:', snippet);
	} else {
		console.log('[Room Extractor] Could not find "Rooms & beds" section');
		// Try to find any mention of bedrooms
		const bedroomMention = html.match(/bedroom[^<]{0,200}/gi);
		if (bedroomMention) {
			console.log('[Room Extractor] Found bedroom mentions:', bedroomMention.slice(0, 3));
		}
	}
	
	// Look for bedroom patterns - more flexible matching
	// Pattern: "Bedroom 1: 1 King Bed" or "Bedroom 1" followed by bed info
	// Also handles: "1 Double Bed and 1 Double Futon"
	const bedroomPatterns = [
		// Pattern for "Bedroom 1: 1 Double Bed and 1 Double Futon" format
		/(?:bedroom|room)\s*(\d+)[^<]*?((?:\d+\s+(?:king|queen|twin|full|double|bunk|sofa|murphy|futon)\s+(?:bed|beds?|futon|futons?)(?:\s+and\s+)?)+)/gi,
		// Pattern for "Bedroom 1: 1 King Bed" format (most common) - case insensitive, flexible spacing
		/(?:bedroom|room)\s*(\d+)[^:]*:\s*(\d+)\s+([^<]+?)(?:bed|beds?)/gi,
		// Pattern for "Bedroom 1" followed by bed info (without colon) - more flexible
		/(?:bedroom|room)\s*(\d+)[^<]{0,300}?(\d+)\s+(king|queen|twin|full|double|bunk|sofa|murphy|futon)[^<]{0,100}bed/gi,
		// Pattern matching HTML structure with bed icons - case insensitive
		/<[^>]*>bedroom\s*(\d+)[^<]*?(\d+)\s+(king|queen|twin|full|double|bunk|sofa|murphy|futon)[^<]*bed/gi,
		// Pattern for "Bedroom 1" with bed info in nearby text - very flexible
		/bedroom\s*(\d+)[^<]{0,500}?(\d+)\s+(king|queen|twin|full|double|bunk|sofa|murphy|futon)[^<]{0,200}bed/gi,
		// Pattern for text like "1 King Bed" near "Bedroom 1"
		/bedroom\s*(\d+)[^<]*?(\d+)\s+(?:king|queen|twin|full|double|bunk|sofa|murphy|futon)\s+bed/gi
	];
	
	const roomMap = new Map<number, ExtractedRoom>();
	let totalMatches = 0;
	
	for (let patternIdx = 0; patternIdx < bedroomPatterns.length; patternIdx++) {
		const pattern = bedroomPatterns[patternIdx];
		let match;
		let matchCount = 0;
		while ((match = pattern.exec(html)) !== null) {
			matchCount++;
			totalMatches++;
			console.log(`[Room Extractor] Pattern ${patternIdx} matched:`, {
				roomNum: match[1],
				quantity: match[2],
				bedType: match[3] || 'from match[2]',
				fullMatch: match[0].substring(0, 100)
			});
			const roomNum = parseInt(match[1], 10);
			
			if (!roomMap.has(roomNum)) {
				roomMap.set(roomNum, {
					name: `Bedroom ${roomNum}`,
					beds: []
				});
			}
			
			const room = roomMap.get(roomNum)!;
			
			// Handle pattern 1: "1 Double Bed and 1 Double Futon" format
			if (match[2] && match[2].includes('and')) {
				// Split by "and" to get multiple bed types
				const bedDescriptions = match[2].split(/\s+and\s+/);
				for (const bedDesc of bedDescriptions) {
					// Extract quantity and bed type from "1 Double Bed" or "1 Double Futon"
					const bedMatch = bedDesc.match(/(\d+)\s+(king|queen|twin|full|double|bunk|sofa|murphy|futon)\s+(bed|beds?|futon|futons?)/i);
					if (bedMatch) {
						const quantity = parseInt(bedMatch[1], 10);
						const bedTypeText = bedMatch[2].toLowerCase();
						const bedTypeWord = bedMatch[3].toLowerCase();
						
						// Map bed type text to our bed types
						let bedType = 'other';
						if (bedTypeText === 'king') bedType = 'king';
						else if (bedTypeText === 'queen') bedType = 'queen';
						else if (bedTypeText === 'twin') bedType = 'twin';
						else if (bedTypeText === 'full' || bedTypeText === 'double') bedType = 'full';
						else if (bedTypeText === 'bunk') bedType = 'bunk';
						else if (bedTypeText === 'sofa' || bedTypeText === 'futon' || bedTypeWord === 'futon') bedType = 'sofa';
						else if (bedTypeText === 'murphy') bedType = 'murphy';
						
						// Check if this bed type already exists in the room
						const existingBed = room.beds.find(b => b.bedType === bedType);
						if (existingBed) {
							existingBed.quantity += quantity;
						} else {
							room.beds.push({
								bedType,
								quantity,
								capacity: bedType === 'king' ? 2 : bedType === 'queen' ? 2 : bedType === 'full' ? 2 : bedType === 'twin' ? 1 : bedType === 'bunk' ? 1 : bedType === 'murphy' ? 2 : 1
							});
						}
					}
				}
			} else {
				// Handle other patterns: single bed type
				const quantity = parseInt(match[2], 10) || 1;
				const bedTypeText = (match[3] || '').trim().toLowerCase();
				
				// Map bed type text to our bed types
				let bedType = 'other';
				if (bedTypeText.includes('king')) bedType = 'king';
				else if (bedTypeText.includes('queen')) bedType = 'queen';
				else if (bedTypeText.includes('twin')) bedType = 'twin';
				else if (bedTypeText.includes('full') || bedTypeText.includes('double')) bedType = 'full';
				else if (bedTypeText.includes('bunk')) bedType = 'bunk';
				else if (bedTypeText.includes('sofa') || bedTypeText.includes('futon')) bedType = 'sofa';
				else if (bedTypeText.includes('murphy')) bedType = 'murphy';
				
				// Check if this bed type already exists in the room
				const existingBed = room.beds.find(b => b.bedType === bedType);
				if (existingBed) {
					existingBed.quantity += quantity;
				} else {
					room.beds.push({
						bedType,
						quantity,
						capacity: bedType === 'king' ? 2 : bedType === 'queen' ? 2 : bedType === 'full' ? 2 : bedType === 'twin' ? 1 : bedType === 'bunk' ? 1 : bedType === 'murphy' ? 2 : 1
					});
				}
			}
		}
		if (matchCount > 0) {
			console.log(`[Room Extractor] Pattern ${patternIdx} found ${matchCount} matches`);
		}
	}
	
	console.log(`[Room Extractor] Total matches found: ${totalMatches}, rooms in map: ${roomMap.size}`);
	
	// Look for living room or other spaces
	// Pattern: "Living Room 1: 1 Queen Murphy Bed"
	const livingRoomPatterns = [
		/(?:living\s*room|common\s*area)\s*(\d+)?[^:]*:\s*(\d+)\s*([^<]+?)(?:bed|beds?)/gi,
		/(?:living\s*room|common\s*area)[^<]*?(\d+)\s*(king|queen|twin|full|bunk|sofa|murphy)[^<]*bed/gi
	];
	
	for (const pattern of livingRoomPatterns) {
		let match;
		while ((match = pattern.exec(html)) !== null) {
			const roomNum = match[1] ? parseInt(match[1], 10) : 1;
			const quantity = parseInt(match[2] || match[1] || '1', 10);
			const bedTypeText = (match[3] || match[2] || '').trim().toLowerCase();
			
			let bedType = 'sofa';
			if (bedTypeText.includes('queen')) bedType = 'queen';
			if (bedTypeText.includes('murphy')) bedType = 'murphy';
			if (bedTypeText.includes('king')) bedType = 'king';
			
			const roomName = roomNum > 1 ? `Living Room ${roomNum}` : 'Living Room';
			
			// Check if this living room already exists
			let livingRoom = rooms.find(r => r.name === roomName);
			if (!livingRoom) {
				livingRoom = {
					name: roomName,
					beds: []
				};
				rooms.push(livingRoom);
			}
			
			const existingBed = livingRoom.beds.find(b => b.bedType === bedType);
			if (existingBed) {
				existingBed.quantity += quantity;
			} else {
				livingRoom.beds.push({
					bedType,
					quantity,
					capacity: bedType === 'queen' ? 2 : bedType === 'murphy' ? 2 : bedType === 'king' ? 2 : 1
				});
			}
		}
	}
	
	// Convert map to array and sort by room number
	const bedroomArray = Array.from(roomMap.entries())
		.sort((a, b) => a[0] - b[0])
		.map(([_, room]) => room);
	
	const allRooms = [...bedroomArray, ...rooms];
	console.log(`[Room Extractor] Extracted ${allRooms.length} rooms:`, allRooms.map(r => ({ name: r.name, beds: r.beds.length })));
	
	return allRooms;
}

/**
 * Extract rooms and beds from Airbnb HTML
 */
export function extractAirbnbRoomsAndBeds(html: string): ExtractedRoom[] {
	const rooms: ExtractedRoom[] = [];
	
	// Airbnb patterns - similar approach
	const bedroomPattern = /(?:bedroom|room)\s*(\d+)[^:]*:\s*(\d+)\s*([^<]+?)(?:bed|beds)/gi;
	let match;
	const roomMap = new Map<number, ExtractedRoom>();
	
	while ((match = bedroomPattern.exec(html)) !== null) {
		const roomNum = parseInt(match[1], 10);
		const quantity = parseInt(match[2], 10);
		const bedTypeText = match[3].trim().toLowerCase();
		
		let bedType = 'other';
		if (bedTypeText.includes('king')) bedType = 'king';
		else if (bedTypeText.includes('queen')) bedType = 'queen';
		else if (bedTypeText.includes('twin')) bedType = 'twin';
		else if (bedTypeText.includes('full') && !bedTypeText.includes('queen')) bedType = 'full';
		else if (bedTypeText.includes('bunk')) bedType = 'bunk';
		else if (bedTypeText.includes('sofa')) bedType = 'sofa';
		
		if (!roomMap.has(roomNum)) {
			roomMap.set(roomNum, {
				name: `Bedroom ${roomNum}`,
				beds: []
			});
		}
		
		const room = roomMap.get(roomNum)!;
		room.beds.push({
			bedType,
			quantity,
			capacity: bedType === 'king' ? 2 : bedType === 'queen' ? 2 : bedType === 'full' ? 2 : bedType === 'twin' ? 1 : bedType === 'bunk' ? 1 : 1
		});
	}
	
	for (const room of roomMap.values()) {
		rooms.push(room);
	}
	
	return rooms;
}

/**
 * Extract all photos from VRBO/Airbnb listing
 */
export function extractAllPhotos(html: string, siteType: 'vrbo' | 'airbnb'): string[] {
	const photos: string[] = [];
	
	if (siteType === 'vrbo') {
		// VRBO photo patterns
		// Look for image URLs in various formats
		const imagePatterns = [
			// Meta tags
			/<meta\s+property="og:image"\s+content="([^"]+)"/gi,
			/<meta\s+name="og:image"\s+content="([^"]+)"/gi,
			// Image tags with specific classes
			/<img[^>]*class="[^"]*photo[^"]*"[^>]*src="([^"]+)"/gi,
			/<img[^>]*class="[^"]*image[^"]*"[^>]*src="([^"]+)"/gi,
			// Data attributes
			/data-src="([^"]*\.(jpg|jpeg|png|webp)[^"]*)"/gi,
			/src="([^"]*vrbo[^"]*\.(jpg|jpeg|png|webp)[^"]*)"/gi
		];
		
		for (const pattern of imagePatterns) {
			let match;
			while ((match = pattern.exec(html)) !== null) {
				const url = match[1];
				if (url && !url.includes('logo') && !url.includes('icon') && !photos.includes(url)) {
					// Clean up URL (remove query params that might be for sizing)
					const cleanUrl = url.split('?')[0];
					if (cleanUrl.match(/\.(jpg|jpeg|png|webp)$/i)) {
						photos.push(cleanUrl);
					}
				}
			}
		}
	} else {
		// Airbnb photo patterns
		const imagePatterns = [
			/<meta\s+property="og:image"\s+content="([^"]+)"/gi,
			/<img[^>]*class="[^"]*photo[^"]*"[^>]*src="([^"]+)"/gi,
			/data-src="([^"]*airbnb[^"]*\.(jpg|jpeg|png|webp)[^"]*)"/gi
		];
		
		for (const pattern of imagePatterns) {
			let match;
			while ((match = pattern.exec(html)) !== null) {
				const url = match[1];
				if (url && !url.includes('logo') && !url.includes('icon') && !photos.includes(url)) {
					const cleanUrl = url.split('?')[0];
					if (cleanUrl.match(/\.(jpg|jpeg|png|webp)$/i)) {
						photos.push(cleanUrl);
					}
				}
			}
		}
	}
	
	return photos;
}

/**
 * Extract rooms, beds, and photos from HTML
 * This is called after HTML is fetched via scrapePropertyInfo
 */
export function extractRoomsAndPhotosFromHTML(
	html: string,
	siteType: 'vrbo' | 'airbnb'
): ExtractedPropertyData {
	const rooms = siteType === 'vrbo'
		? extractVRBORoomsAndBeds(html)
		: extractAirbnbRoomsAndBeds(html);
	
	const photos = extractAllPhotos(html, siteType);
	
	return {
		rooms,
		photos: photos.slice(0, 50) // Limit to 50 photos
	};
}

/**
 * Extract rooms, beds, and photos from a listing URL
 */
export async function extractPropertyRoomsAndPhotos(
	url: string
): Promise<ExtractedPropertyData> {
	const isVRBO = url.includes('vrbo.com');
	const isAirbnb = url.includes('airbnb.com');
	
	if (!isVRBO && !isAirbnb) {
		return { rooms: [], photos: [] };
	}
	
	// Fetch HTML using scrapePropertyInfo (which uses fetchPageHTML internally)
	// We need to access the HTML, so we'll need to fetch it separately
	// For now, let's create a helper that fetches HTML directly
	const { scrapePropertyInfo } = await import('./property-scraper.js');
	
	// We need the raw HTML, so let's fetch it using the internal method
	// Actually, let's add a method to get HTML directly
	// For now, we'll use a workaround: fetch the page and extract from HTML
	
	// Import the internal fetch function - we'll need to make it exportable or use a different approach
	// Let's use a fetch approach that works with Zyte API
	const zyteApiKey = process.env.ZYTE_API_KEY;
	
	if (!zyteApiKey) {
		console.warn('ZYTE_API_KEY not set, cannot extract rooms/photos');
		return { rooms: [], photos: [] };
	}
	
	try {
		console.log(`[Room Extractor] Fetching HTML from Zyte API for: ${url}`);
		// Use Zyte API to fetch HTML
		const response = await fetch('https://api.zyte.com/v1/extract', {
			method: 'POST',
			headers: {
				'Authorization': `Basic ${Buffer.from(`${zyteApiKey}:`).toString('base64')}`,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				url: url,
				browserHtml: true,
				geolocation: 'US'
			})
		});
		
		if (!response.ok) {
			const errorText = await response.text();
			console.error(`[Room Extractor] Zyte API error ${response.status}:`, errorText);
			throw new Error(`Zyte API error: ${response.status} - ${errorText}`);
		}
		
		const data = await response.json();
		const html = data.browserHtml || data.httpResponseBody || '';
		
		if (!html) {
			console.warn('[Room Extractor] No HTML returned from Zyte API');
			return { rooms: [], photos: [] };
		}
		
		console.log(`[Room Extractor] HTML fetched successfully (${html.length} characters)`);
		const result = extractRoomsAndPhotosFromHTML(html, isVRBO ? 'vrbo' : 'airbnb');
		console.log(`[Room Extractor] Extraction complete: ${result.rooms.length} rooms, ${result.photos.length} photos`);
		return result;
	} catch (error) {
		console.error('[Room Extractor] Error fetching HTML for room extraction:', error);
		return { rooms: [], photos: [] };
	}
}
