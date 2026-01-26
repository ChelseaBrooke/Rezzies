<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/stores';
	import type { ActionData } from './$types';

	let { form } = $props();
	
	// Check if autofill mode is enabled
	let isAutofillMode = $derived($page.url.searchParams.get('autofill') === 'true');

	let formData = $state({
		name: '',
		description: '',
		listingUrl: '',
		listingTitle: '',
		listingCoverPhoto: '',
		checkInDate: '',
		checkOutDate: '',
		totalCost: '',
		pricingModel: 'PER_PERSON_PER_NIGHT' as 'PER_ROOM' | 'PER_BED' | 'PER_PERSON' | 'PER_PERSON_PER_NIGHT',
		expectedPeopleCount: '',
		maxGuests: '',
		allowPartialStays: false,
		sharingExponentAlpha: 0.60,
		privacyPremiumP: 0.00
	});

	let propertyInfo = $state<{ 
		title: string; 
		coverPhoto: string | null; 
		maxGuests: number | null;
		roomCount: number | null;
		availableDates?: { start: Date; end: Date }[];
		checkInDate?: string;
		checkOutDate?: string;
		guests?: number;
		totalPrice?: number | null;
		totalNights?: number | null;
		error?: {
			type: 'UNAVAILABLE_DATES' | 'TOO_MANY_GUESTS';
			message: string;
		};
	} | null>(null);
	let isFetchingProperty = $state(false);
	let propertyError = $state<string | null>(null);
	let error = $state<string | null>(null);
	let pricingPreview = $state<any>(null);
	
	// Autofill total modal state
	let showAutofillModal = $state(false);
	let checkoutUrl = $state('');
	let isImportingTotal = $state(false);
	let importError = $state<string | null>(null);
	let importedTotal = $state<{
		totalCents: number;
		currency: string;
		breakdown?: any;
		source: 'airbnb' | 'vrbo';
		nights?: number;
	} | null>(null);

	function isCheckoutUrl(url: string): boolean {
		if (!url) return false;
		return (
			(url.includes('airbnb.com') && (url.includes('/book/') || url.includes('/reserve/'))) ||
			(url.includes('vrbo.com') && (url.includes('/checkout/') || url.includes('/book/')))
		);
	}

	async function fetchPropertyInfo() {
		if (!formData.listingUrl) {
			propertyError = 'Please enter a property URL';
			return;
		}

		isFetchingProperty = true;
		propertyError = null;

		try {
			// Check if it's a checkout URL - if so, extract total directly
			if (isCheckoutUrl(formData.listingUrl)) {
				console.log('Detected checkout URL, extracting total...');
				const response = await fetch('/api/import-total', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ checkoutUrl: formData.listingUrl })
				});
				
				const result = await response.json();
				
				if (result.ok && result.data) {
					// Extract total from checkout
					formData.totalCost = (result.data.totalCents / 100).toFixed(2);
					console.log('Set totalCost from checkout:', formData.totalCost);
					
					// Try to extract dates and guests from checkout URL
					try {
						const url = new URL(formData.listingUrl);
						const params = url.searchParams;
						
						// Extract dates (check various parameter names)
						let checkIn = params.get('checkIn') || params.get('check_in') || params.get('startDate') || params.get('chkin');
						let checkOut = params.get('checkOut') || params.get('check_out') || params.get('endDate') || params.get('chkout');
						
						// For VRBO checkout URLs, check legacyUrl parameter
						if ((!checkIn || !checkOut) && params.has('legacyUrl')) {
							try {
								const legacyUrlEncoded = params.get('legacyUrl') || '';
								const legacyUrl = decodeURIComponent(legacyUrlEncoded);
								const queryString = legacyUrl.includes('?') ? legacyUrl.split('?')[1] : legacyUrl;
								const legacyParams = new URLSearchParams(queryString);
								
								const arrivalDateEncoded = legacyParams.get('arrivalDate');
								const departureDateEncoded = legacyParams.get('departureDate');
								
								if (arrivalDateEncoded && !checkIn) {
									const arrivalDate = decodeURIComponent(arrivalDateEncoded);
									const [month, day, year] = arrivalDate.split('/');
									if (month && day && year) {
										checkIn = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
									}
								}
								
								if (departureDateEncoded && !checkOut) {
									const departureDate = decodeURIComponent(departureDateEncoded);
									const [month, day, year] = departureDate.split('/');
									if (month && day && year) {
										checkOut = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
									}
								}
							} catch (e) {
								// Ignore legacy URL parsing errors
							}
						}
						
					if (checkIn) {
						formData.checkInDate = checkIn;
						console.log('Set checkInDate from checkout URL:', formData.checkInDate);
					}
					if (checkOut) {
						formData.checkOutDate = checkOut;
						console.log('Set checkOutDate from checkout URL:', formData.checkOutDate);
					}
						
					// Extract guests
					const adults = params.get('adults') || params.get('guests');
					if (adults) {
						const guestCount = parseInt(adults, 10);
						if (!isNaN(guestCount)) {
							formData.expectedPeopleCount = guestCount.toString();
							console.log('Set expectedPeopleCount from checkout URL:', formData.expectedPeopleCount);
						}
					}
					} catch (e) {
						// URL parsing failed, continue without dates/guests
						console.log('Could not extract dates/guests from checkout URL:', e);
					}
					
					// Set property info for display
					propertyInfo = {
						title: 'Property from checkout',
						coverPhoto: null,
						maxGuests: null,
						totalPrice: result.data.totalCents,
						totalNights: result.data.nights || undefined
					};
					
					// Show success message
					propertyError = null;
				} else {
					propertyError = result.message || 'Could not extract total from checkout URL';
					propertyInfo = null;
				}
			} else {
				// Regular listing URL - use existing flow
				console.log('Fetching property info from listing URL...');
				const response = await fetch(`/api/property-info?url=${encodeURIComponent(formData.listingUrl)}`);
				const result = await response.json();

				console.log('Property info response:', result);

				if (result.ok && result.data) {
					propertyInfo = result.data;
					formData.listingTitle = result.data.title;
					formData.listingCoverPhoto = result.data.coverPhoto || '';
					
					console.log('Property info received:', result.data);
					
					// Only set maxGuests if it was actually fetched (not null)
					if (result.data.maxGuests !== null && result.data.maxGuests !== undefined) {
						formData.maxGuests = result.data.maxGuests.toString();
					}
					
					// Use guests from URL if available, otherwise use maxGuests
					if (result.data.guests) {
						formData.expectedPeopleCount = result.data.guests.toString();
						console.log('Set expectedPeopleCount from property info (guests):', formData.expectedPeopleCount);
						// Also update maxGuests if URL guests is higher
						if (!formData.maxGuests || parseInt(formData.maxGuests, 10) < result.data.guests) {
							formData.maxGuests = result.data.guests.toString();
						}
					} else if (result.data.maxGuests !== null && result.data.maxGuests !== undefined) {
						// Auto-set expectedPeopleCount to maxGuests if not already set
						if (!formData.expectedPeopleCount) {
							formData.expectedPeopleCount = result.data.maxGuests.toString();
							console.log('Set expectedPeopleCount from property info (maxGuests):', formData.expectedPeopleCount);
						}
					}
					
					// Use dates from URL if available
					if (result.data.checkInDate) {
						formData.checkInDate = result.data.checkInDate;
						console.log('Set checkInDate from property info:', formData.checkInDate);
					}
					if (result.data.checkOutDate) {
						formData.checkOutDate = result.data.checkOutDate;
						console.log('Set checkOutDate from property info:', formData.checkOutDate);
					}
					
					// Use total price if available (convert from cents to dollars)
					if (result.data.totalPrice) {
						formData.totalCost = (result.data.totalPrice / 100).toFixed(2);
						console.log('Set totalCost from property info:', formData.totalCost);
					}
					
					// Auto-populate trip name if empty
					if (!formData.name) {
						formData.name = result.data.title;
					}
				} else {
					propertyError = result.message || 'Could not fetch property information. If you have Zyte API configured, check the server logs for errors.';
					propertyInfo = null;
					console.error('Property fetch error:', result);
				}
			}
		} catch (err) {
			propertyError = 'Failed to fetch property information: ' + (err instanceof Error ? err.message : 'Unknown error');
			propertyInfo = null;
			console.error('Property fetch exception:', err);
		} finally {
			isFetchingProperty = false;
		}
	}

	// Update URL when dates or guests change (debounced)
	let urlUpdateTimeout: ReturnType<typeof setTimeout> | null = null;
	
	function updateUrl() {
		if (!formData.listingUrl || (!formData.listingUrl.includes('vrbo.com') && !formData.listingUrl.includes('airbnb.com'))) {
			return;
		}

		try {
			const url = new URL(formData.listingUrl);
			const isVRBO = formData.listingUrl.includes('vrbo.com');
			
			// Update dates
			if (formData.checkInDate) {
				if (isVRBO) {
					url.searchParams.set('chkin', formData.checkInDate);
					url.searchParams.set('d1', formData.checkInDate);
					url.searchParams.set('startDate', formData.checkInDate);
				} else {
					url.searchParams.set('check_in', formData.checkInDate);
				}
			}
			if (formData.checkOutDate) {
				if (isVRBO) {
					url.searchParams.set('chkout', formData.checkOutDate);
					url.searchParams.set('d2', formData.checkOutDate);
					url.searchParams.set('endDate', formData.checkOutDate);
				} else {
					url.searchParams.set('check_out', formData.checkOutDate);
				}
			}
			
			// Update guests
			if (formData.expectedPeopleCount) {
				url.searchParams.set('adults', formData.expectedPeopleCount);
			}
			
			formData.listingUrl = url.toString();
			
			// Debounce re-fetch to avoid too many requests
			if (urlUpdateTimeout) {
				clearTimeout(urlUpdateTimeout);
			}
			urlUpdateTimeout = setTimeout(() => {
				fetchPropertyInfo();
			}, 1000);
		} catch (e) {
			// Invalid URL, ignore
		}
	}

	function calculateNights() {
		if (!formData.checkInDate || !formData.checkOutDate) return 0;
		const start = new Date(formData.checkInDate);
		const end = new Date(formData.checkOutDate);
		return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
	}

	// Calculate pricing breakdown based on selected model
	function calculatePricingBreakdown() {
		const totalCost = parseFloat(formData.totalCost) || 0;
		const nights = calculateNights();
		const expectedGuests = parseInt(formData.expectedPeopleCount) || 0;
		const roomCount = propertyInfo?.roomCount || 0;

		if (!totalCost || !nights || !expectedGuests) {
			return null;
		}

		const breakdown: Record<string, any> = {};

		switch (formData.pricingModel) {
			case 'PER_PERSON':
				if (expectedGuests > 0) {
					breakdown.perPerson = totalCost / expectedGuests;
					breakdown.description = `Each person pays $${breakdown.perPerson.toFixed(2)} for the full stay`;
					breakdown.disclaimer = '⚠️ RSVPs must equal expected guest count to split the total in this way.';
				}
				break;

			case 'PER_PERSON_PER_NIGHT':
				if (expectedGuests > 0 && nights > 0) {
					breakdown.perPersonPerNight = totalCost / nights / expectedGuests;
					breakdown.description = `Each person pays $${breakdown.perPersonPerNight.toFixed(2)} per night`;
					breakdown.totalForStay = breakdown.perPersonPerNight * nights;
					breakdown.description += ` ($${breakdown.totalForStay.toFixed(2)} for ${nights} nights)`;
				}
				break;

			case 'PER_ROOM':
				if (roomCount > 0) {
					breakdown.perRoom = totalCost / roomCount;
					breakdown.perRoomPerNight = breakdown.perRoom / nights;
					breakdown.description = `Each room costs $${breakdown.perRoomPerNight.toFixed(2)} per night`;
					breakdown.description += ` ($${breakdown.perRoom.toFixed(2)} for ${nights} nights)`;
				} else {
					breakdown.description = 'Room count will be calculated after rooms are set up';
				}
				break;

			case 'PER_BED':
				breakdown.description = 'Bed pricing will be calculated after rooms and beds are set up (weighted by bed type)';
				break;
		}

		return breakdown;
	}

	let pricingBreakdown = $derived(calculatePricingBreakdown());
	
	async function importTotalFromCheckout() {
		if (!checkoutUrl.trim()) {
			importError = 'Please enter a checkout URL';
			return;
		}
		
		isImportingTotal = true;
		importError = null;
		importedTotal = null;
		
		try {
			const response = await fetch('/api/import-total', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ checkoutUrl: checkoutUrl.trim() })
			});
			
			const result = await response.json();
			
			if (result.ok && result.data) {
				importedTotal = result.data;
				// Auto-fill the total cost field
				formData.totalCost = (result.data.totalCents / 100).toFixed(2);
			} else {
				importError = result.message || 'Failed to import total from checkout URL';
			}
		} catch (err) {
			importError = 'Failed to import total: ' + (err instanceof Error ? err.message : 'Unknown error');
		} finally {
			isImportingTotal = false;
		}
	}
	
	function openAutofillModal() {
		showAutofillModal = true;
		checkoutUrl = '';
		importError = null;
		importedTotal = null;
	}
	
	function closeAutofillModal() {
		showAutofillModal = false;
		checkoutUrl = '';
		importError = null;
		importedTotal = null;
	}

	function handleSubmit({ cancel }: Parameters<Parameters<typeof enhance>[0]>[0]) {
		// Debug: Log form data before validation
		console.log('=== Client-side Form Data ===');
		console.log('name:', formData.name);
		console.log('checkInDate:', formData.checkInDate);
		console.log('checkOutDate:', formData.checkOutDate);
		console.log('totalCost:', formData.totalCost, '(type:', typeof formData.totalCost, ')');
		console.log('pricingModel:', formData.pricingModel);
		console.log('===========================');
		
		// Validate required fields
		if (!formData.name || !formData.name.trim()) {
			cancel();
			error = 'Trip name is required';
			console.error('Validation failed: name is missing or empty');
			return;
		}
		
		if (!formData.checkInDate) {
			cancel();
			error = 'Check-in date is required';
			console.error('Validation failed: checkInDate is missing');
			return;
		}
		
		if (!formData.checkOutDate) {
			cancel();
			error = 'Check-out date is required';
			console.error('Validation failed: checkOutDate is missing');
			return;
		}
		
		if (!formData.totalCost || formData.totalCost.trim() === '' || isNaN(Number(formData.totalCost)) || Number(formData.totalCost) <= 0) {
			cancel();
			error = `Total cost must be a positive number. Current value: "${formData.totalCost}"`;
			console.error('Validation failed: totalCost is invalid', formData.totalCost);
			return;
		}
		
		if (!formData.pricingModel) {
			cancel();
			error = 'Pricing model is required';
			console.error('Validation failed: pricingModel is missing');
			return;
		}
		
		console.log('✅ Client-side validation passed');

		if (new Date(formData.checkOutDate) <= new Date(formData.checkInDate)) {
			cancel();
			error = 'Check-out date must be after check-in date';
			return;
		}

		if (formData.pricingModel === 'PER_PERSON' && !formData.expectedPeopleCount) {
			cancel();
			error = 'Expected people count is required for per-person pricing';
			return;
		}

		error = null;
	}

	$effect(() => {
		if (form?.error) {
			error = form.error;
		}
	});

	// Update check-out date minimum when check-in date changes
	$effect(() => {
		if (formData.checkInDate) {
			const checkIn = new Date(formData.checkInDate);
			const nextDay = new Date(checkIn);
			nextDay.setDate(nextDay.getDate() + 1);
			const minCheckOut = nextDay.toISOString().split('T')[0];
			
			// If check-out is before or equal to check-in, clear it
			if (formData.checkOutDate && formData.checkOutDate <= formData.checkInDate) {
				formData.checkOutDate = '';
			}
		}
	});

	// Extract dates and guests from URL parameters when URL is pasted
	// Handles both regular listing URLs and checkout URLs (which may have dates in legacyUrl parameter)
	function extractUrlParams(url: string) {
		try {
			const urlObj = new URL(url);
			const params = urlObj.searchParams;
			
			// First, try direct parameters
			// VRBO listing URLs use: chkin/chkout, startDate/endDate, or checkIn/checkOut
			// Airbnb uses: check_in/check_out
			let checkIn = params.get('chkin') || params.get('checkIn') || params.get('check_in') || params.get('startDate');
			let checkOut = params.get('chkout') || params.get('checkOut') || params.get('check_out') || params.get('endDate');
			let adults = params.get('adults') || params.get('guests');
			
			// For VRBO checkout URLs, check legacyUrl parameter (URL-encoded)
			if (!checkIn && params.has('legacyUrl')) {
				try {
					const legacyUrl = decodeURIComponent(params.get('legacyUrl') || '');
					const legacyUrlObj = new URL(legacyUrl, 'https://www.vrbo.com');
					const legacyParams = legacyUrlObj.searchParams;
					
					// VRBO legacyUrl format: arrivalDate=01/26/2026, departureDate=01/31/2026
					const arrivalDate = legacyParams.get('arrivalDate');
					const departureDate = legacyParams.get('departureDate');
					const legacyAdults = legacyParams.get('adults');
					
					if (arrivalDate) {
						// Convert MM/DD/YYYY to YYYY-MM-DD
						const [month, day, year] = arrivalDate.split('/');
						if (month && day && year) {
							checkIn = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
						}
					}
					
					if (departureDate) {
						// Convert MM/DD/YYYY to YYYY-MM-DD
						const [month, day, year] = departureDate.split('/');
						if (month && day && year) {
							checkOut = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
						}
					}
					
					if (legacyAdults && !adults) {
						adults = legacyAdults;
					}
				} catch (e) {
					// Legacy URL parsing failed, continue with direct params
					console.log('Could not parse legacyUrl parameter:', e);
				}
			}
			
			if (checkIn) {
				formData.checkInDate = checkIn;
			}
			if (checkOut) {
				formData.checkOutDate = checkOut;
			}
			if (adults) {
				const guestCount = parseInt(adults, 10);
				if (!isNaN(guestCount)) {
					formData.expectedPeopleCount = guestCount.toString();
					// Also set maxGuests if not already set
					if (!formData.maxGuests || parseInt(formData.maxGuests, 10) < guestCount) {
						formData.maxGuests = guestCount.toString();
					}
				}
			}
		} catch (e) {
			// Invalid URL, ignore
			console.log('Could not extract URL parameters:', e);
		}
	}
	
	// Watch for URL changes and extract parameters
	$effect(() => {
		if (formData.listingUrl) {
			extractUrlParams(formData.listingUrl);
		}
	});
</script>

<div class="create-trip-page">
	<div class="container">
		<header>
			<h1>Create New Trip (Rezzies)</h1>
			<a href="/admin" class="btn-secondary">Back to Dashboard</a>
		</header>

		{#if error}
			<div class="error-message">{error}</div>
		{/if}

		<form method="POST" action="?/create" use:enhance={handleSubmit}>
			<!-- Hidden fields for property info -->
			<input type="hidden" name="listingTitle" value={formData.listingTitle} />
			<input type="hidden" name="listingCoverPhoto" value={formData.listingCoverPhoto} />
			<input type="hidden" name="maxGuests" value={formData.maxGuests} />
			<input type="hidden" name="sharingExponentAlpha" value={formData.sharingExponentAlpha} />
			<input type="hidden" name="privacyPremiumP" value={formData.privacyPremiumP} />

			<section class="form-section">
				<h2>Property Information</h2>
				{#if isAutofillMode}
					<div class="info-box card" style="margin-bottom: var(--spacing-lg); background: rgba(37, 99, 235, 0.05); border-left: 4px solid var(--color-primary);">
						<h4 style="margin-bottom: var(--spacing-xs); color: var(--color-primary);">🔗 Autofill Mode</h4>
						<p style="margin: 0; color: var(--color-text-light);">Paste your VRBO or Airbnb listing URL below to automatically import property details, photos, pricing, and dates.</p>
					</div>
				{/if}
				<div class="form-group">
					<label for="listingUrl">Airbnb/VRBO URL *</label>
					<input
						type="url"
						id="listingUrl"
						name="listingUrl"
						bind:value={formData.listingUrl}
						placeholder="https://www.vrbo.com/12345678 or https://www.vrbo.com/checkout/..."
						required
						oninput={(e) => {
							// Auto-trigger fetch when URL is pasted/entered
							const url = (e.target as HTMLInputElement).value;
							if (url && (url.includes('vrbo.com') || url.includes('airbnb.com'))) {
								// Debounce: wait 500ms after user stops typing
								setTimeout(() => {
									if (formData.listingUrl === url) {
										fetchPropertyInfo();
									}
								}, 500);
							}
						}}
					/>
					<small>Enter a listing URL or checkout URL. Checkout URLs will automatically extract the total price with taxes.</small>
					{#if isFetchingProperty}
						<div class="loading-container">
							<div class="loading-spinner"></div>
							<p class="loading-text">
								{isCheckoutUrl(formData.listingUrl) 
									? 'Extracting total from checkout URL...' 
									: 'Fetching property information...'}
							</p>
							<p class="loading-subtext">
								{isCheckoutUrl(formData.listingUrl)
									? 'Extracting final price with taxes and fees'
									: 'This may take 30-60 seconds while we extract data from the listing'}
							</p>
						</div>
					{/if}
					<div class="url-instructions">
						<p><strong>💡 How to get the property URL:</strong></p>
						<ol>
							<li>Go to the VRBO or Airbnb listing page</li>
							<li>Select the <strong>number of guests</strong> and <strong>dates</strong> you want</li>
							<li>Copy the URL from the address bar (the listing URL with dates/guests in the URL parameters)</li>
						</ol>
						<p><strong>Example:</strong> <code>https://www.vrbo.com/12345678?chkin=2026-01-27&chkout=2026-01-30&adults=3</code></p>
						<p><small>The dates and guest count from the URL will be automatically populated in the form below. The price will be fetched using VRBO's API.</small></p>
					</div>
					{#if propertyError}
						<div class="field-error">
							{propertyError}
						</div>
					{/if}
				</div>

				<!-- Preview card - always visible for required fields -->
				<div class="property-preview-card">
					{#if propertyInfo?.coverPhoto}
						<img src={propertyInfo.coverPhoto} alt={propertyInfo.title || 'Property'} class="preview-image" />
					{/if}
					<div class="preview-content">
					{#if propertyInfo?.title}
						<h3 class="preview-title">{propertyInfo.title}</h3>
					{/if}
					
					{#if propertyInfo?.roomCount}
						<div class="preview-meta">
							<span class="meta-item">🛏️ {propertyInfo.roomCount} {propertyInfo.roomCount === 1 ? 'Bedroom' : 'Bedrooms'}</span>
							{#if propertyInfo.maxGuests}
								<span class="meta-item">👥 Sleeps {propertyInfo.maxGuests}</span>
							{/if}
						</div>
					{/if}
						
						{#if propertyInfo?.error}
							<div class="preview-error">
								<strong>⚠️ {propertyInfo.error.message}</strong>
							</div>
						{/if}
						
						<div class="preview-fields">
								<div class="preview-field">
									<label>Check-in Date *</label>
									<input
										type="date"
										name="checkInDate"
										bind:value={formData.checkInDate}
										required
										onchange={updateUrl}
										min={new Date().toISOString().split('T')[0]}
									/>
								</div>
								
								<div class="preview-field">
									<label>Check-out Date *</label>
									<input
										type="date"
										name="checkOutDate"
										bind:value={formData.checkOutDate}
										required
										onchange={updateUrl}
										min={formData.checkInDate || new Date().toISOString().split('T')[0]}
									/>
								</div>
								
								<div class="preview-field">
									<label>Number of Guests *</label>
									<input
										type="number"
										name="expectedPeopleCount"
										bind:value={formData.expectedPeopleCount}
										required
										onchange={updateUrl}
										min="1"
										max={propertyInfo?.maxGuests || undefined}
									/>
									{#if propertyInfo?.maxGuests}
										<small>Max: {propertyInfo.maxGuests}</small>
									{/if}
								</div>
								
								<div class="preview-field price-field">
									<label>Total Price *</label>
									<div class="price-display">
										<div class="price-input-container">
											<span>$</span>
											<input
												type="number"
												name="totalCost"
												bind:value={formData.totalCost}
												required
												step="0.01"
												min="0.01"
												class="price-input"
												placeholder="563.00"
											/>
											<span>
												{#if propertyInfo?.totalNights}
													for {propertyInfo.totalNights} {propertyInfo.totalNights === 1 ? 'night' : 'nights'}
												{:else if formData.checkInDate && formData.checkOutDate}
													{(() => {
														const checkIn = new Date(formData.checkInDate);
														const checkOut = new Date(formData.checkOutDate);
														const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
														return nights > 0 ? `for ${nights} ${nights === 1 ? 'night' : 'nights'}` : '';
													})()}
												{/if}
											</span>
										</div>
									</div>
									<div class="price-disclaimer">
										⚠️ Please check that this matches what you see on the checkout page for this listing. This may not always account for taxes, etc.
									</div>
								</div>
							</div>
						</div>
					</div>
			</section>

			<section class="form-section">
				<h2>Trip Details</h2>
				<div class="form-group">
					<label for="name">Trip Name *</label>
					<input
						type="text"
						id="name"
						name="name"
						bind:value={formData.name}
						required
						placeholder="Summer Beach House 2024"
					/>
				</div>
				<div class="form-group">
					<label for="description">Description</label>
					<textarea
						id="description"
						name="description"
						bind:value={formData.description}
						rows="3"
						placeholder="Optional description for your guests"
					></textarea>
				</div>
			</section>

			<!-- Hidden inputs for form submission (dates, guests, and totalCost are in the preview card with name attributes) -->

			<section class="form-section">
				<h2>Pricing Model</h2>

				<div class="form-group">
					<label for="pricingModel">Pricing Model *</label>
					<select
						id="pricingModel"
						name="pricingModel"
						bind:value={formData.pricingModel}
						required
					>
						<option value="PER_ROOM">Per Room (equal split per room)</option>
						<option value="PER_BED">Per Bed (weighted by bed type)</option>
						<option value="PER_PERSON">Per Person (equal split per person)</option>
						<option value="PER_PERSON_PER_NIGHT">Per Person Per Night (recommended)</option>
					</select>
					<small>
						{formData.pricingModel === 'PER_ROOM' && 'Total cost divided equally among all rooms'}
						{formData.pricingModel === 'PER_BED' && 'Total cost weighted by bed type (king > queen > twin)'}
						{formData.pricingModel === 'PER_PERSON' && 'Total cost divided equally among all guests (full stay)'}
						{formData.pricingModel === 'PER_PERSON_PER_NIGHT' && 'Total cost divided by capacity and nights (most fair)'}
					</small>
				</div>

				{#if pricingBreakdown && formData.totalCost && formData.checkInDate && formData.checkOutDate && formData.expectedPeopleCount}
					<div class="pricing-breakdown card">
						<h3>💰 Pricing Breakdown</h3>
						<p class="breakdown-description">{pricingBreakdown.description}</p>
						{#if pricingBreakdown.disclaimer}
							<p class="breakdown-disclaimer">{pricingBreakdown.disclaimer}</p>
						{/if}
						{#if pricingBreakdown.perPerson}
							<div class="breakdown-detail">
								<strong>Per Person:</strong> ${pricingBreakdown.perPerson.toFixed(2)}
							</div>
						{/if}
						{#if pricingBreakdown.perPersonPerNight}
							<div class="breakdown-detail">
								<strong>Per Person Per Night:</strong> ${pricingBreakdown.perPersonPerNight.toFixed(2)}
							</div>
						{/if}
						{#if pricingBreakdown.perRoom}
							<div class="breakdown-detail">
								<strong>Per Room:</strong> ${pricingBreakdown.perRoom.toFixed(2)} for {calculateNights()} nights
							</div>
						{/if}
					</div>
				{/if}

				<div class="form-group">
					<label class="checkbox-label">
						<input
							type="checkbox"
							name="allowPartialStays"
							bind:checked={formData.allowPartialStays}
						/>
						<span>Allow partial stays</span>
					</label>
					<small>If enabled, guests can reserve for fewer nights than the full trip duration</small>
				</div>
			</section>

			<div class="form-actions">
				<button type="submit" class="btn-primary">Create Trip & Continue to Room Setup</button>
			</div>
		</form>
	</div>
</div>

<!-- Autofill Total Modal -->
{#if showAutofillModal}
	<div class="modal-overlay" onclick={closeAutofillModal}>
		<div class="modal-content" onclick={(e) => e.stopPropagation()}>
			<div class="modal-header">
				<h2>Autofill Total (Taxes Included)</h2>
				<button class="modal-close" onclick={closeAutofillModal} aria-label="Close">×</button>
			</div>
			
			<div class="modal-body">
				{#if !importedTotal}
					<div class="autofill-steps">
						<div class="step-section">
							<h3>Step 1: Open Checkout</h3>
							{#if formData.listingUrl}
								<a href={formData.listingUrl} target="_blank" rel="noopener noreferrer" class="button button-primary">
									Open checkout in new tab
								</a>
							{:else}
								<p class="text-muted">Enter a listing URL first to enable this feature.</p>
							{/if}
						</div>
						
						<div class="step-section">
							<h3>Step 2: Complete Checkout Steps</h3>
							<ol class="instructions-list">
								<li>Set your check-in and check-out dates</li>
								<li>Select the number of guests</li>
								<li>Click "Reserve" or "Book Now"</li>
								<li>Wait for the checkout page to load (where you see the final total with taxes)</li>
							</ol>
						</div>
						
						<div class="step-section">
							<h3>Step 3: Copy Checkout URL</h3>
							<p>Copy the URL from your browser's address bar on the checkout page.</p>
						</div>
						
						<div class="step-section">
							<h3>Step 4: Paste & Import</h3>
							<div class="form-group">
								<label for="checkoutUrl">Checkout URL</label>
								<input
									type="url"
									id="checkoutUrl"
									bind:value={checkoutUrl}
									placeholder="https://www.vrbo.com/checkout/... or https://www.airbnb.com/book/..."
									disabled={isImportingTotal}
									onkeydown={(e) => {
										if (e.key === 'Enter' && !isImportingTotal) {
											importTotalFromCheckout();
										}
									}}
								/>
							</div>
							
							{#if importError}
								<div class="error-message">{importError}</div>
							{/if}
							
							<div style="display: flex; gap: 0.5rem; margin-top: 1rem;">
								<button
									type="button"
									onclick={importTotalFromCheckout}
									disabled={isImportingTotal || !checkoutUrl.trim()}
									class="button button-primary"
								>
									{isImportingTotal ? 'Importing...' : 'Import Total'}
								</button>
								<button
									type="button"
									onclick={closeAutofillModal}
									class="button button-secondary"
									disabled={isImportingTotal}
								>
									Cancel
								</button>
							</div>
						</div>
					</div>
				{:else}
					<!-- Success State -->
					<div class="success-state">
						<div class="success-icon">✓</div>
						<h3>Total Imported Successfully!</h3>
						<div class="imported-total">
							<div class="total-amount">
								${(importedTotal.totalCents / 100).toFixed(2)} {importedTotal.currency}
							</div>
							{#if importedTotal.nights}
								<div class="total-nights">for {importedTotal.nights} nights</div>
							{/if}
						</div>
						
						{#if importedTotal.breakdown}
							<div class="breakdown">
								<h4>Price Breakdown</h4>
								{#if importedTotal.breakdown.nightsSubtotalCents}
									<div class="breakdown-item">
										<span>Nights Subtotal:</span>
										<span>${(importedTotal.breakdown.nightsSubtotalCents / 100).toFixed(2)}</span>
									</div>
								{/if}
								{#if importedTotal.breakdown.cleaningFeeCents}
									<div class="breakdown-item">
										<span>Cleaning Fee:</span>
										<span>${(importedTotal.breakdown.cleaningFeeCents / 100).toFixed(2)}</span>
									</div>
								{/if}
								{#if importedTotal.breakdown.serviceFeeCents}
									<div class="breakdown-item">
										<span>Service Fee:</span>
										<span>${(importedTotal.breakdown.serviceFeeCents / 100).toFixed(2)}</span>
									</div>
								{/if}
								{#if importedTotal.breakdown.taxesCents}
									<div class="breakdown-item">
										<span>Taxes:</span>
										<span>${(importedTotal.breakdown.taxesCents / 100).toFixed(2)}</span>
									</div>
								{/if}
							</div>
						{/if}
						
						<div style="margin-top: 1.5rem;">
							<button
								type="button"
								onclick={closeAutofillModal}
								class="button button-primary"
							>
								Done
							</button>
						</div>
					</div>
				{/if}
			</div>
		</div>
	</div>
{/if}

<style>
	.create-trip-page {
		min-height: 100vh;
		padding: 2rem;
		background: #f5f7fa;
	}

	.container {
		max-width: 800px;
		margin: 0 auto;
		background: white;
		border-radius: 8px;
		padding: 2rem;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
	}

	header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 2rem;
		padding-bottom: 1rem;
		border-bottom: 2px solid #e0e0e0;
	}

	h1 {
		margin: 0;
		color: #2c3e50;
	}

	.btn-secondary {
		background: #95a5a6;
		color: white;
		border: none;
		padding: 0.5rem 1rem;
		border-radius: 4px;
		cursor: pointer;
		text-decoration: none;
		display: inline-block;
	}

	.btn-secondary:hover {
		background: #7f8c8d;
	}

	.error-message {
		background: #fee;
		color: #c33;
		padding: 1rem;
		border-radius: 8px;
		margin-bottom: 1.5rem;
		border: 1px solid #fcc;
	}

	.form-section {
		margin: 2rem 0;
		padding: 1.5rem;
		background: #fafbfc;
		border-radius: 8px;
	}

	h2 {
		font-size: 1.3rem;
		color: #34495e;
		margin: 0 0 1rem 0;
	}

	.form-group {
		margin: 1rem 0;
	}

	label {
		display: block;
		margin-bottom: 0.5rem;
		font-weight: 500;
		color: #555;
	}

	input[type="text"],
	input[type="url"],
	input[type="number"],
	input[type="date"],
	textarea,
	select {
		width: 100%;
		padding: 0.75rem;
		border: 1px solid #ddd;
		border-radius: 6px;
		font-size: 1rem;
		font-family: inherit;
	}

	textarea {
		resize: vertical;
	}

	small {
		display: block;
		margin-top: 0.25rem;
		color: #7f8c8d;
		font-size: 0.85rem;
	}

	.url-input-group {
		display: flex;
		gap: 0.5rem;
	}

	.url-input-group input {
		flex: 1;
	}

	.btn-fetch {
		background: #3498db;
		color: white;
		border: none;
		padding: 0.75rem 1.5rem;
		border-radius: 6px;
		cursor: pointer;
		font-size: 0.9rem;
		white-space: nowrap;
	}

	.btn-fetch:hover:not(:disabled) {
		background: #2980b9;
	}

	.btn-fetch:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.btn-secondary-fetch {
		background: #95a5a6;
	}

	.btn-secondary-fetch:hover:not(:disabled) {
		background: #7f8c8d;
	}

	.fetch-method-selector {
		margin-top: 1rem;
	}

	.method-tabs {
		display: flex;
		gap: 0.5rem;
		margin-bottom: 1rem;
		border-bottom: 2px solid #ecf0f1;
	}

	.method-tab {
		background: none;
		border: none;
		padding: 0.75rem 1.5rem;
		cursor: pointer;
		font-size: 0.9rem;
		color: #7f8c8d;
		border-bottom: 2px solid transparent;
		margin-bottom: -2px;
		transition: all 0.2s;
	}

	.method-tab:hover {
		color: #3498db;
	}

	.method-tab.active {
		color: #3498db;
		border-bottom-color: #3498db;
		font-weight: 600;
	}

	.auto-fetch-info {
		padding: 1rem;
		background: #fff3cd;
		border: 1px solid #ffc107;
		border-radius: 6px;
		font-size: 0.9rem;
	}

	.auto-fetch-info p {
		margin: 0 0 0.5rem 0;
		color: #856404;
	}

	.auto-fetch-info small {
		color: #856404;
	}

	.field-error {
		color: #e74c3c;
		font-size: 0.85rem;
		margin-top: 0.25rem;
	}

	.price-disclaimer {
		color: #e74c3c;
		font-size: 0.85rem;
		margin-top: 0.5rem;
		padding: 0.5rem;
		background: #fee;
		border-left: 3px solid #e74c3c;
		border-radius: 4px;
		font-weight: 500;
	}

	.loading-container {
		margin-top: 1.5rem;
		padding: 2rem;
		background: #f8f9fa;
		border: 2px solid #3498db;
		border-radius: 8px;
		text-align: center;
	}

	.loading-spinner {
		width: 50px;
		height: 50px;
		margin: 0 auto 1rem;
		border: 4px solid #e3f2fd;
		border-top: 4px solid #3498db;
		border-radius: 50%;
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		0% { transform: rotate(0deg); }
		100% { transform: rotate(360deg); }
	}

	.loading-text {
		margin: 0 0 0.5rem 0;
		color: #2c3e50;
		font-size: 1rem;
		font-weight: 600;
	}

	.loading-subtext {
		margin: 0;
		color: #7f8c8d;
		font-size: 0.85rem;
	}

	.property-preview-card {
		margin-top: 1.5rem;
		padding: 1.5rem;
		background: white;
		border: 2px solid #3498db;
		border-radius: 12px;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
		display: flex;
		gap: 1.5rem;
		align-items: flex-start;
	}

	.preview-image {
		width: 200px;
		height: 150px;
		object-fit: cover;
		border-radius: 8px;
		flex-shrink: 0;
	}

	.preview-content {
		flex: 1;
	}

	.preview-title {
		margin: 0 0 1rem 0;
		color: #2c3e50;
		font-size: 1.5rem;
		font-weight: 600;
	}

	.preview-error {
		margin-bottom: 1rem;
		padding: 0.75rem;
		background: #fee;
		border: 1px solid #fcc;
		border-radius: 6px;
		color: #c33;
	}

	.preview-fields {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 1rem;
	}

	.preview-field {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.preview-field label {
		font-size: 0.85rem;
		font-weight: 600;
		color: #555;
	}

	.preview-field input {
		padding: 0.5rem;
		border: 1px solid #ddd;
		border-radius: 4px;
		font-size: 0.9rem;
	}

	.preview-field small {
		font-size: 0.75rem;
		color: #777;
	}

	.preview-field.price-field {
		grid-column: 1 / -1;
	}

	.price-display {
		padding: 0.75rem;
		background: #f8f9fa;
		border: 1px solid #dee2e6;
		border-radius: 4px;
		font-size: 1.25rem;
	}

	.price-input-container {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.price-display .price-input {
		flex: 1;
		background: white;
		border: 1px solid #ddd;
		border-radius: 4px;
		padding: 0.5rem;
		font-size: 1.25rem;
		font-weight: 500;
		text-align: right;
	}

	.price-display .price-input:focus {
		outline: none;
		border-color: #3498db;
		box-shadow: 0 0 0 2px rgba(52, 152, 219, 0.1);
	}

	.price-placeholder {
		font-size: 0.9rem;
		font-weight: normal;
		color: #999;
		font-style: italic;
	}

	.date-inputs {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1rem;
	}

	.date-input {
		width: 100%;
		padding: 0.75rem;
		border: 2px solid #ddd;
		border-radius: 6px;
		font-size: 1rem;
		transition: border-color 0.2s;
	}

	.date-input:focus {
		outline: none;
		border-color: #3498db;
	}

	.date-input:hover {
		border-color: #bbb;
	}

	.nights-info {
		margin-top: 0.5rem;
		color: #555;
		font-size: 0.9rem;
		font-weight: 500;
	}

	.date-note {
		margin-top: 1rem;
		padding: 0.75rem;
		background: #f8f9fa;
		border-left: 3px solid #3498db;
		border-radius: 4px;
	}

	.date-note small {
		color: #555;
		line-height: 1.5;
	}

	.date-note.success {
		background: #e8f5e9;
		border-left-color: #4caf50;
	}

	.available-dates-info {
		margin-top: 1rem;
		padding: 1rem;
		background: #e8f5e9;
		border-left: 3px solid #4caf50;
		border-radius: 4px;
	}

	.available-dates-info ul {
		margin: 0.5rem 0;
		padding-left: 1.5rem;
	}

	.available-dates-info li {
		margin: 0.25rem 0;
		color: #2e7d32;
	}

	.available-dates-info small {
		color: #555;
		font-size: 0.85rem;
	}

	.input-with-symbol {
		position: relative;
	}

	.input-with-symbol .symbol {
		position: absolute;
		left: 0.75rem;
		top: 50%;
		transform: translateY(-50%);
		color: #7f8c8d;
		font-weight: 600;
	}

	.input-with-symbol input {
		padding-left: 2rem;
	}

	.checkbox-label {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		cursor: pointer;
	}

	.checkbox-label input[type="checkbox"] {
		width: auto;
		margin: 0;
	}

	.form-actions {
		text-align: center;
		margin-top: 2rem;
	}

	.btn-primary {
		background: #3498db;
		color: white;
		border: none;
		padding: 1rem 2.5rem;
		font-size: 1.1rem;
		border-radius: 8px;
		cursor: pointer;
		transition: background 0.2s;
		font-weight: 500;
	}

	.btn-primary:hover {
		background: #2980b9;
	}

	/* Autofill Modal Styles */
	.modal-overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.5);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
		padding: 1rem;
	}

	.modal-content {
		background: white;
		border-radius: 8px;
		box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
		max-width: 600px;
		width: 100%;
		max-height: 90vh;
		overflow-y: auto;
	}

	.modal-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1.5rem;
		border-bottom: 1px solid #e0e0e0;
	}

	.modal-header h2 {
		margin: 0;
		font-size: 1.5rem;
	}

	.modal-close {
		background: none;
		border: none;
		font-size: 2rem;
		cursor: pointer;
		color: #666;
		padding: 0;
		width: 2rem;
		height: 2rem;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 4px;
		transition: background 0.2s;
	}

	.modal-close:hover {
		background: #f0f0f0;
	}

	.modal-body {
		padding: 1.5rem;
	}

	.autofill-steps {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.step-section {
		padding: 1rem;
		background: #f8f9fa;
		border-radius: 6px;
	}

	.step-section h3 {
		margin: 0 0 0.75rem 0;
		font-size: 1.1rem;
		color: #333;
	}

	.preview-meta {
		display: flex;
		gap: 1rem;
		margin-top: 0.5rem;
		font-size: 0.9rem;
		color: #666;
	}

	.meta-item {
		display: flex;
		align-items: center;
		gap: 0.25rem;
	}

	.pricing-breakdown {
		margin-top: 1.5rem;
		padding: 1.5rem;
		background: #f8f9fa;
		border: 2px solid #3498db;
		border-radius: 8px;
	}

	.pricing-breakdown h3 {
		margin: 0 0 1rem 0;
		color: #2c3e50;
		font-size: 1.2rem;
	}

	.breakdown-description {
		font-size: 1rem;
		color: #333;
		margin: 0 0 0.5rem 0;
		font-weight: 500;
	}

	.breakdown-disclaimer {
		font-size: 0.9rem;
		color: #e74c3c;
		margin: 0.5rem 0;
		font-weight: 500;
	}

	.breakdown-detail {
		margin-top: 0.75rem;
		padding: 0.75rem;
		background: white;
		border-radius: 4px;
		border-left: 3px solid #3498db;
	}

	.instructions-list {
		margin: 0.5rem 0 0 0;
		padding-left: 1.5rem;
	}

	.instructions-list li {
		margin: 0.5rem 0;
		color: #555;
	}

	.text-muted {
		color: #777;
		font-style: italic;
	}

	.success-state {
		text-align: center;
		padding: 1rem;
	}

	.success-icon {
		width: 4rem;
		height: 4rem;
		border-radius: 50%;
		background: #4caf50;
		color: white;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 2rem;
		font-weight: bold;
		margin: 0 auto 1rem;
	}

	.success-state h3 {
		margin: 0 0 1rem 0;
		color: #333;
	}

	.imported-total {
		margin: 1.5rem 0;
	}

	.total-amount {
		font-size: 2rem;
		font-weight: bold;
		color: #2c3e50;
		margin-bottom: 0.5rem;
	}

	.total-nights {
		color: #666;
		font-size: 1rem;
	}

	.breakdown {
		margin-top: 1.5rem;
		padding: 1rem;
		background: #f8f9fa;
		border-radius: 6px;
		text-align: left;
	}

	.breakdown h4 {
		margin: 0 0 0.75rem 0;
		font-size: 1rem;
		color: #333;
	}

	.breakdown-item {
		display: flex;
		justify-content: space-between;
		padding: 0.5rem 0;
		border-bottom: 1px solid #e0e0e0;
	}

	.breakdown-item:last-child {
		border-bottom: none;
	}

	.breakdown-item span:first-child {
		color: #666;
	}

	.breakdown-item span:last-child {
		font-weight: 500;
		color: #333;
	}
</style>
