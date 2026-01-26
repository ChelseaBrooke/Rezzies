// Test VRBO calendar extraction - look for actual calendar data patterns
// Run with: node test-vrbo-calendar-extraction.js <VRBO_URL>

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

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

console.log(`Testing calendar extraction for: ${testUrl}\n`);

try {
	console.log('Fetching HTML via Zyte API (browserHtml for JS rendering)...');
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
	writeFileSync('vrbo-calendar-html.html', html.substring(0, 1000000)); // First 1MB
	console.log('📄 Saved HTML to vrbo-calendar-html.html\n');

	// Look for calendar-specific patterns
	console.log('🔍 Searching for calendar availability patterns...\n');

	// Pattern 1: Look for calendar availability in JSON structures
	const patterns = {
		'calendar availability': /"calendar"[^}]*"availability"[^}]*/gi,
		'availableDates': /"availableDates"[^:]*:\s*\[[^\]]+\]/gi,
		'blockedDates': /"blockedDates"[^:]*:\s*\[[^\]]+\]/gi,
		'dateAvailability': /"dateAvailability"[^:]*:\s*\{[^}]+\}/gi,
		'calendarData': /"calendarData"[^:]*:\s*\{[^}]+\}/gi,
		'property-single-offer': /"property-single-offer"[^}]*/gi,
		'data-date': /data-date="[^"]+"/gi,
		'aria-disabled': /aria-disabled="true"/gi,
		'disabled.*date': /disabled[^>]*date[^>]*>/gi,
		'class.*unavailable': /class="[^"]*unavailable[^"]*"/gi,
		'class.*available': /class="[^"]*available[^"]*"/gi,
		'calendar.*disabled': /calendar[^>]*disabled[^>]*>/gi
	};

	console.log('Found patterns:');
	for (const [name, pattern] of Object.entries(patterns)) {
		const matches = html.match(pattern);
		if (matches) {
			console.log(`  ${name}: ${matches.length} matches`);
			if (matches.length <= 5) {
				console.log(`    Samples: ${matches.slice(0, 3).join(', ')}`);
			}
		}
	}

	// Look for specific VRBO calendar module data
	console.log('\n📅 Looking for VRBO calendar module data...\n');
	
	// VRBO might store calendar in flexModuleModelStore
	const flexStorePattern = /"flexModuleModelStore"[^:]*:\s*\{[^}]+\}/s;
	const flexStoreMatch = html.match(flexStorePattern);
	if (flexStoreMatch) {
		console.log('✓ Found flexModuleModelStore');
		try {
			// Try to extract just the calendar-related parts
			const calendarInStore = html.match(/"property-single-offer"[^}]*"model"[^}]*\{[^}]+\}/s);
			if (calendarInStore) {
				console.log('  Found property-single-offer in store');
				writeFileSync('vrbo-calendar-module.json', calendarInStore[0].substring(0, 5000));
				console.log('  Saved sample to vrbo-calendar-module.json');
			}
		} catch (e) {
			console.log('  Could not parse store data');
		}
	}

	// Look for date strings that might indicate availability
	console.log('\n📆 Looking for date patterns...\n');
	const datePattern = /\b(202[4-9]|203[0-9])-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])\b/g;
	const dates = html.match(datePattern);
	if (dates) {
		const uniqueDates = [...new Set(dates)].sort();
		console.log(`Found ${uniqueDates.length} unique date strings`);
		console.log(`  First 10: ${uniqueDates.slice(0, 10).join(', ')}`);
		console.log(`  Last 10: ${uniqueDates.slice(-10).join(', ')}`);
	}

	// Look for calendar API endpoints in the HTML
	console.log('\n🔗 Looking for calendar API endpoints...\n');
	const apiPatterns = [
		/https?:\/\/[^"'\s]+calendar[^"'\s]*/gi,
		/https?:\/\/[^"'\s]+availability[^"'\s]*/gi,
		/https?:\/\/[^"'\s]+booking[^"'\s]*/gi
	];
	
	for (const pattern of apiPatterns) {
		const matches = html.match(pattern);
		if (matches) {
			const unique = [...new Set(matches)];
			console.log(`Found ${unique.length} potential API endpoints:`);
			unique.slice(0, 5).forEach(url => console.log(`  ${url}`));
		}
	}

	console.log('\n✅ Analysis complete!');
	console.log('Check vrbo-calendar-html.html for full HTML structure.');

} catch (error) {
	console.error('❌ Error:', error.message);
	process.exit(1);
}
