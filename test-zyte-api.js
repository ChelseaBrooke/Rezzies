// Quick test script to verify Zyte API key works
// Run with: node test-zyte-api.js

import { readFileSync } from 'fs';
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

console.log('✓ Found Zyte API key in .env');
console.log('Testing Zyte API with VRBO URL...\n');

const testUrl = 'https://www.vrbo.com/788798';

try {
	console.log('Sending request to Zyte API...');
	const response = await fetch('https://api.zyte.com/v1/extract', {
		method: 'POST',
		headers: {
			'Authorization': `Basic ${Buffer.from(`${zyteApiKey}:`).toString('base64')}`,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			url: testUrl,
			browserHtml: true  // VRBO needs JavaScript rendering to show "Sleeps X"
		})
	});

	console.log(`Response status: ${response.status} ${response.statusText}\n`);

	if (!response.ok) {
		const errorText = await response.text();
		console.error('❌ Zyte API Error:');
		console.error(errorText);
		
		if (response.status === 401) {
			console.error('\n💡 This means your API key is invalid. Check:');
			console.error('   1. The key in .env matches your Zyte dashboard');
			console.error('   2. There are no extra spaces or quotes');
			console.error('   3. The key is the full key (not truncated)');
		} else if (response.status === 402) {
			console.error('\n💡 This means you have no credits. Add credits to your Zyte account.');
		}
		process.exit(1);
	}

	const data = await response.json();
	const html = data.httpResponseBody || data.browserHtml || data.html;

	if (html) {
		console.log('✅ SUCCESS! Zyte API is working!');
		console.log(`   Received ${html.length} characters of HTML`);
		
		// Check if we got blocked
		if (html.includes('Bot or Not') || html.includes('Access Denied')) {
			console.log('\n⚠️  WARNING: Got bot detection page. Try using browserHtml instead.');
		} else {
			console.log('   HTML looks good (no bot detection)');
		}
		
		// Try to extract "Sleeps X"
		const sleepsMatch = html.match(/Sleeps\s+(\d+)/i);
		if (sleepsMatch) {
			console.log(`   Found "Sleeps ${sleepsMatch[1]}" in HTML ✅`);
		} else {
			console.log('   Could not find "Sleeps X" pattern (might need browserHtml for JS rendering)');
		}
		
		// Try to find calendar/availability data
		console.log('\n📅 Checking for calendar/availability data...');
		
		// Look for common calendar patterns
		const calendarPatterns = [
			/availableDates.*?\[(.*?)\]/i,
			/availability.*?\[(.*?)\]/i,
			/data-available="([^"]+)"/i,
			/data-unavailable="([^"]+)"/i,
			/"availableDates":\s*\[(.*?)\]/i,
			/"availability":\s*\{([^}]+)\}/i,
			/calendar.*?data.*?available/i
		];
		
		let foundCalendar = false;
		for (const pattern of calendarPatterns) {
			const match = html.match(pattern);
			if (match) {
				console.log(`   Found potential calendar data with pattern: ${pattern}`);
				console.log(`   Sample: ${match[0].substring(0, 200)}...`);
				foundCalendar = true;
				break;
			}
		}
		
		// Look for date elements in the HTML
		const dateElements = html.match(/<[^>]*data-date[^>]*>/gi);
		if (dateElements && dateElements.length > 0) {
			console.log(`   Found ${dateElements.length} date elements with data-date attributes`);
			console.log(`   Sample: ${dateElements[0]}`);
			foundCalendar = true;
		}
		
		// Look for calendar-related classes
		const calendarClasses = html.match(/class="[^"]*(?:calendar|date|available|unavailable)[^"]*"/gi);
		if (calendarClasses && calendarClasses.length > 0) {
			console.log(`   Found ${calendarClasses.length} calendar-related elements`);
			foundCalendar = true;
		}
		
		if (!foundCalendar) {
			console.log('   ⚠️  Could not find obvious calendar data patterns');
			console.log('   Calendar might be loaded via separate API call or use different structure');
		}
	} else {
		console.error('❌ Zyte API returned no HTML content');
		console.error('Response:', JSON.stringify(data).substring(0, 500));
		process.exit(1);
	}
} catch (error) {
	console.error('❌ Error testing Zyte API:');
	console.error(error.message);
	
	if (error.message.includes('fetch')) {
		console.error('\n💡 Network error. Check your internet connection.');
	}
	process.exit(1);
}
