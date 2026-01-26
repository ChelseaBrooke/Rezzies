// Test calendar extraction from VRBO/Airbnb
// Run with: node test-calendar-extraction.js

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { writeFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read .env file
let zyteApiKey = null;
try {
	const envContent = readFileSync(join(__dirname, '.env'), 'utf-8');
	const match = envContent.match(/ZYTE_API_KEY=(.+)/);
	if (match) {
		zyteApiKey = match[1].trim();
	}
} catch (error) {
	console.error('Could not read .env file:', error.message);
	process.exit(1);
}

if (!zyteApiKey) {
	console.error('❌ ZYTE_API_KEY not found in .env file');
	process.exit(1);
}

const testUrl = process.argv[2] || 'https://www.vrbo.com/788798';
const isVRBO = testUrl.includes('vrbo.com');
const isAirbnb = testUrl.includes('airbnb.com');

console.log(`Testing calendar extraction for: ${testUrl}`);
console.log(`Site type: ${isVRBO ? 'VRBO' : isAirbnb ? 'Airbnb' : 'Unknown'}\n`);

try {
	console.log('Fetching HTML via Zyte API...');
	const response = await fetch('https://api.zyte.com/v1/extract', {
		method: 'POST',
		headers: {
			'Authorization': `Basic ${Buffer.from(`${zyteApiKey}:`).toString('base64')}`,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			url: testUrl,
			browserHtml: true
		})
	});

	if (!response.ok) {
		console.error('❌ Zyte API error:', response.status, response.statusText);
		process.exit(1);
	}

	const data = await response.json();
	const html = data.browserHtml || data.httpResponseBody || data.html;

	if (!html) {
		console.error('❌ No HTML received');
		process.exit(1);
	}

	console.log(`✓ Received ${html.length} characters of HTML\n`);

	// Save HTML sample for inspection
	const htmlSample = html.substring(0, 500000); // First 500KB
	writeFileSync('calendar-html-sample.html', htmlSample);
	console.log('📄 Saved HTML sample to calendar-html-sample.html\n');

	// Test extraction
	console.log('🔍 Analyzing calendar structure...\n');

	// Look for common patterns
	const patterns = {
		jsonLd: html.match(/<script[^>]*type="application\/ld\+json"[^>]*>/gi)?.length || 0,
		nextData: html.match(/__NEXT_DATA__/gi)?.length || 0,
		initialState: html.match(/__INITIAL_STATE__/gi)?.length || 0,
		dataDate: html.match(/data-date=/gi)?.length || 0,
		dataAvailable: html.match(/data-available/gi)?.length || 0,
		calendarClass: html.match(/class="[^"]*calendar[^"]*"/gi)?.length || 0,
		datePattern: html.match(/\d{4}-\d{2}-\d{2}/g)?.length || 0
	};

	console.log('Found patterns:');
	for (const [name, count] of Object.entries(patterns)) {
		console.log(`  ${name}: ${count} occurrences`);
	}

	// Try to find specific calendar data
	console.log('\n📅 Looking for calendar data...\n');

	// Look for JSON-LD
	const jsonLdMatches = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>(.*?)<\/script>/gis);
	if (jsonLdMatches) {
		console.log(`Found ${jsonLdMatches.length} JSON-LD scripts`);
		for (let i = 0; i < Math.min(3, jsonLdMatches.length); i++) {
			try {
				const jsonContent = jsonLdMatches[i].replace(/<script[^>]*>|<\/script>/gi, '').trim();
				const data = JSON.parse(jsonContent);
				if (data['@type'] === 'LodgingReservation' || data.availabilityStarts || data.availableFrom) {
					console.log(`  Script ${i + 1} contains availability data:`, JSON.stringify(data).substring(0, 200));
				}
			} catch (e) {
				// Not JSON
			}
		}
	}

	// Look for __INITIAL_STATE__ or similar
	const statePatterns = [
		/window\.__INITIAL_STATE__\s*=\s*({[^;]+});/s,
		/window\.__NEXT_DATA__\s*=\s*({[^<]+})/s,
		/"availability":\s*\{[^}]+"availableDates":\s*\[([^\]]+)\]/is
	];

	for (const pattern of statePatterns) {
		const match = html.match(pattern);
		if (match) {
			console.log(`\n✓ Found potential calendar data with pattern`);
			console.log(`  Sample: ${match[0].substring(0, 300)}...`);
		}
	}

	// Look for date elements
	const dateElements = html.match(/<[^>]*data-date[^>]*>/gi);
	if (dateElements) {
		console.log(`\n✓ Found ${dateElements.length} elements with data-date attribute`);
		console.log(`  Sample: ${dateElements[0]}`);
	}

	console.log('\n✅ Analysis complete! Check calendar-html-sample.html for full HTML structure.');

} catch (error) {
	console.error('❌ Error:', error.message);
	process.exit(1);
}
