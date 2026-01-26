// Test VRBO calendar API call
// Run with: node test-vrbo-api.js <VRBO_URL>

const testUrl = process.argv[2] || 'https://www.vrbo.com/788798';

function extractVRBOPropertyId(url) {
	const match = url.match(/vrbo\.com\/(\d+)/);
	return match ? match[1] : null;
}

async function testVRBOCalendarAPI(propertyId) {
	console.log(`Testing VRBO calendar API for property ${propertyId}...\n`);
	
	try {
		// Try GraphQL endpoint
		const graphqlUrl = 'https://www.vrbo.com/graphql';
		
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

		console.log('Attempting GraphQL request...');
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

		console.log(`Response status: ${response.status} ${response.statusText}`);
		
		if (!response.ok) {
			const text = await response.text();
			console.log(`Response body: ${text.substring(0, 500)}`);
			return null;
		}

		const data = await response.json();
		console.log('Response:', JSON.stringify(data, null, 2));
		
		if (data.data?.property?.availability?.availableDates) {
			const dates = data.data.property.availability.availableDates;
			console.log(`\n✓ Found ${dates.length} date ranges`);
			return dates;
		}

		if (data.errors) {
			console.log('GraphQL errors:', data.errors);
		}

		return null;
	} catch (error) {
		console.error('Error:', error.message);
		return null;
	}
}

const propertyId = extractVRBOPropertyId(testUrl);
if (!propertyId) {
	console.error('Could not extract property ID from URL');
	process.exit(1);
}

testVRBOCalendarAPI(propertyId).then(result => {
	if (result) {
		console.log('\n✅ API call successful!');
	} else {
		console.log('\n❌ API call failed - may need to adjust endpoint/query');
	}
});
