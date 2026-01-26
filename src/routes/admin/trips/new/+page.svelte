<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import type { ActionData } from './$types';
	import AutofillLoader from '$lib/components/AutofillLoader.svelte';

	// TEST: This should log immediately when component loads
	console.log('🔴 COMPONENT SCRIPT LOADED');
	alert('Component loaded - check console');

	let { form } = $props();
	
	let isAutofillMode = $derived($page.url.searchParams.get('autofill') === 'true');
	
	// Loading state
	let isLoading = $state(false);
	let loadingProgress = $state(0);
	let loadingStatus = $state('Starting...');
	
	// Scraped data
	let scrapedData = $state<{
		propertyInfo: any;
		rooms: any[];
		photos: string[];
	} | null>(null);
	
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
		privacyPremiumP: 0.00,
		enableMeals: false,
		enableActivities: false,
		enableExtras: false
	});

	let error = $state<string | null>(null);
	let selectedRoomPhotos = $state<Record<string, string[]>>({});
	let selectedCoverPhoto = $state<string | null>(null);
	let customRooms = $state<Array<{ id: string; name: string; beds: Array<{ bedType: string; quantity: number }> }>>([]);

	// Photo gallery state
	let showPhotoGallery = $state(false);
	let galleryRoomId = $state<string | null>(null);
	let showCoverPhotoGallery = $state(false);
	let showAddRoomModal = $state(false);
	let newRoomName = $state('');
	let newRoomBeds = $state<Array<{ bedType: string; quantity: number }>>([{ bedType: 'sofa', quantity: 1 }]);

	// Trigger autofill on mount - use both window.location and $page as fallback
	onMount(() => {
		console.log('[AdminTripNew] onMount running');
		console.log('[AdminTripNew] window.location.search:', window.location.search);
		console.log('[AdminTripNew] $page.url.search:', $page.url.search);
		
		const urlParams = new URLSearchParams(window.location.search);
		const isAutofill = urlParams.get('autofill') === 'true' || $page.url.searchParams.get('autofill') === 'true';
		console.log('[AdminTripNew] isAutofill:', isAutofill);
		
		if (isAutofill) {
			const url = sessionStorage.getItem('autofillUrl');
			console.log('[AdminTripNew] URL from sessionStorage:', url);
			console.log('[AdminTripNew] All sessionStorage:', Object.keys(sessionStorage));
			
			if (url) {
				console.log('[AdminTripNew] Calling performAutofill NOW');
				performAutofill(url).catch(err => {
					console.error('[AdminTripNew] performAutofill error:', err);
					error = err.message;
					isLoading = false;
				});
			} else {
				console.error('[AdminTripNew] No URL in sessionStorage');
				error = 'No listing URL found. Please go back and try again.';
			}
		}
	});

	async function performAutofill(listingUrl: string) {
		console.log('=== PERFORM AUTOFILL CALLED ===', listingUrl);
		isLoading = true;
		loadingProgress = 0;
		loadingStatus = 'Starting extraction...';
		console.log('isLoading set to:', isLoading);
		
		// Simulate progress updates
		const progressInterval = setInterval(() => {
			if (loadingProgress < 90) {
				loadingProgress += Math.random() * 10;
				if (loadingProgress > 90) loadingProgress = 90;
			}
		}, 500);
		
		try {
			loadingProgress = 10;
			loadingStatus = 'Connecting to listing...';
			await new Promise(resolve => setTimeout(resolve, 300));
			
			loadingProgress = 20;
			loadingStatus = 'Fetching property information...';
			
			const response = await fetch('/api/autofill', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ listingUrl })
			});
			
			if (!response.ok) {
				const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
				throw new Error(errorData.message || `Server error: ${response.status}`);
			}
			
			loadingProgress = 60;
			loadingStatus = 'Extracting rooms and photos...';
			
			const result = await response.json();
			
			if (!result.ok) {
				throw new Error(result.message || 'Failed to extract property data');
			}
			
			// Step 2: Process data
			loadingProgress = 85;
			loadingStatus = 'Processing data...';
			
			scrapedData = result.data;
			console.log('[Autofill] Scraped data:', scrapedData);
			const { propertyInfo, rooms, photos } = result.data;
			
			// Populate form data
			formData.listingUrl = listingUrl;
			formData.listingTitle = propertyInfo.title || '';
			formData.listingCoverPhoto = propertyInfo.coverPhoto || '';
			
			// Set default cover photo if available
			if (propertyInfo.coverPhoto) {
				selectedCoverPhoto = propertyInfo.coverPhoto;
			} else if (photos && photos.length > 0) {
				selectedCoverPhoto = photos[0];
			}
			
			// Extract dates and guests from URL if not in propertyInfo
			try {
				const url = new URL(listingUrl);
				const params = url.searchParams;
				const isVRBO = listingUrl.includes('vrbo.com');
				
				// Try to get dates from URL
				let checkIn = propertyInfo.checkInDate || params.get('chkin') || params.get('checkIn') || params.get('check_in') || params.get('startDate');
				let checkOut = propertyInfo.checkOutDate || params.get('chkout') || params.get('checkOut') || params.get('check_out') || params.get('endDate');
				
				// For VRBO checkout URLs, check legacyUrl
				if ((!checkIn || !checkOut) && params.has('legacyUrl')) {
					try {
						const legacyUrl = decodeURIComponent(params.get('legacyUrl') || '');
						const queryString = legacyUrl.includes('?') ? legacyUrl.split('?')[1] : legacyUrl;
						const legacyParams = new URLSearchParams(queryString);
						
						const arrivalDate = legacyParams.get('arrivalDate');
						const departureDate = legacyParams.get('departureDate');
						
						if (arrivalDate && !checkIn) {
							const [month, day, year] = decodeURIComponent(arrivalDate).split('/');
							if (month && day && year) {
								checkIn = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
							}
						}
						
						if (departureDate && !checkOut) {
							const [month, day, year] = decodeURIComponent(departureDate).split('/');
							if (month && day && year) {
								checkOut = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
							}
						}
					} catch (e) {
						// Ignore legacy URL parsing errors
					}
				}
				
				if (checkIn) formData.checkInDate = checkIn;
				if (checkOut) formData.checkOutDate = checkOut;
				
				// Get guests
				const guests = propertyInfo.guests || params.get('adults') || params.get('guests');
				if (guests) {
					const guestCount = parseInt(guests.toString(), 10);
					if (!isNaN(guestCount)) {
						formData.expectedPeopleCount = guestCount.toString();
					}
				}
			} catch (e) {
				// URL parsing failed, use propertyInfo values
				if (propertyInfo.checkInDate) formData.checkInDate = propertyInfo.checkInDate;
				if (propertyInfo.checkOutDate) formData.checkOutDate = propertyInfo.checkOutDate;
				if (propertyInfo.guests) formData.expectedPeopleCount = propertyInfo.guests.toString();
			}
			
			if (propertyInfo.maxGuests) formData.maxGuests = propertyInfo.maxGuests.toString();
			if (propertyInfo.totalPrice) formData.totalCost = (propertyInfo.totalPrice / 100).toFixed(2);
			if (!formData.name) formData.name = propertyInfo.title || '';
			
			// Initialize room photo selections
			rooms.forEach((room: any, idx: number) => {
				selectedRoomPhotos[`room-${idx}`] = [];
			});
			
			clearInterval(progressInterval);
			loadingProgress = 100;
			loadingStatus = 'Complete!';
			
			// Small delay to show 100%
			await new Promise(resolve => setTimeout(resolve, 500));
			isLoading = false;
			
			// Clear sessionStorage
			sessionStorage.removeItem('autofillUrl');
		} catch (err) {
			clearInterval(progressInterval);
			const errorMessage = err instanceof Error ? err.message : 'Failed to extract property data';
			error = errorMessage;
			isLoading = false;
			loadingProgress = 0;
			loadingStatus = 'Error occurred';
		}
	}

	// Re-scrape if dates or guests change (only in autofill mode)
	let rescrapeTimeout: ReturnType<typeof setTimeout> | null = null;
	
	async function handleDateOrGuestChange() {
		if (!isAutofillMode || !formData.listingUrl) return;
		
		// Debounce rescraping
		if (rescrapeTimeout) clearTimeout(rescrapeTimeout);
		
		rescrapeTimeout = setTimeout(async () => {
			if (formData.checkInDate && formData.checkOutDate && formData.expectedPeopleCount) {
				// Update URL with new dates/guests
				try {
					const url = new URL(formData.listingUrl);
					const isVRBO = formData.listingUrl.includes('vrbo.com');
					
					if (isVRBO) {
						url.searchParams.set('chkin', formData.checkInDate);
						url.searchParams.set('chkout', formData.checkOutDate);
						url.searchParams.set('adults', formData.expectedPeopleCount);
					} else {
						url.searchParams.set('check_in', formData.checkInDate);
						url.searchParams.set('check_out', formData.checkOutDate);
						url.searchParams.set('guests', formData.expectedPeopleCount);
					}
					
					formData.listingUrl = url.toString();
					
					// Re-scrape for new price
					isLoading = true;
					loadingProgress = 50;
					loadingStatus = 'Updating price for new dates...';
					
					const response = await fetch('/api/autofill', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ listingUrl: formData.listingUrl })
					});
					
					const result = await response.json();
					
					if (result.ok && result.data?.propertyInfo?.totalPrice) {
						formData.totalCost = (result.data.propertyInfo.totalPrice / 100).toFixed(2);
					}
					
					isLoading = false;
				} catch (err) {
					console.error('Error re-scraping:', err);
					isLoading = false;
				}
			}
		}, 1000);
	}

	function calculateNights(): number {
		if (!formData.checkInDate || !formData.checkOutDate) return 0;
		const start = new Date(formData.checkInDate);
		const end = new Date(formData.checkOutDate);
		return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
	}

	function calculatePricingBreakdown() {
		const totalCost = parseFloat(formData.totalCost) || 0;
		const nights = calculateNights();
		const expectedGuests = parseInt(formData.expectedPeopleCount) || 0;
		const roomCount = scrapedData?.rooms?.length || 0;

		if (!totalCost || !nights || !expectedGuests) {
			return null;
		}

		const breakdown: Record<string, any> = {};

		switch (formData.pricingModel) {
			case 'PER_PERSON':
				if (expectedGuests > 0) {
					breakdown.perPerson = totalCost / expectedGuests;
					breakdown.description = `Each person pays $${breakdown.perPerson.toFixed(2)} for the full stay`;
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
					breakdown.description = `Each of the ${roomCount} ${roomCount === 1 ? 'room' : 'rooms'} costs $${breakdown.perRoomPerNight.toFixed(2)} per night`;
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

	function handleSubmit({ cancel }: Parameters<Parameters<typeof enhance>[0]>[0]) {
		if (!formData.name?.trim()) {
			cancel();
			error = 'Trip name is required';
			return;
		}
		
		if (!formData.checkInDate) {
			cancel();
			error = 'Check-in date is required';
			return;
		}
		
		if (!formData.checkOutDate) {
			cancel();
			error = 'Check-out date is required';
			return;
		}
		
		if (!formData.totalCost || isNaN(Number(formData.totalCost)) || Number(formData.totalCost) <= 0) {
			cancel();
			error = 'Total cost must be a positive number';
			return;
		}
		
		if (!formData.pricingModel) {
			cancel();
			error = 'Pricing model is required';
			return;
		}
		
		if (new Date(formData.checkOutDate) <= new Date(formData.checkInDate)) {
			cancel();
			error = 'Check-out date must be after check-in date';
			return;
		}

		error = null;
	}

	$effect(() => {
		if (form?.error) {
			error = form.error;
		}
	});

	function openPhotoGallery(roomId: string) {
		galleryRoomId = roomId;
		showPhotoGallery = true;
	}

	function closePhotoGallery() {
		showPhotoGallery = false;
		galleryRoomId = null;
	}

	function togglePhotoForRoom(roomId: string, photoUrl: string) {
		if (!selectedRoomPhotos[roomId]) {
			selectedRoomPhotos[roomId] = [];
		}
		
		const index = selectedRoomPhotos[roomId].indexOf(photoUrl);
		if (index > -1) {
			selectedRoomPhotos[roomId] = selectedRoomPhotos[roomId].filter(p => p !== photoUrl);
		} else {
			selectedRoomPhotos[roomId] = [...selectedRoomPhotos[roomId], photoUrl];
		}
	}

	function selectCoverPhoto(photoUrl: string) {
		selectedCoverPhoto = photoUrl;
		formData.listingCoverPhoto = photoUrl;
		showCoverPhotoGallery = false;
	}
</script>

{#if isLoading}
	<div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: white; z-index: 9999; display: flex; align-items: center; justify-content: center;">
		<div style="text-align: center;">
			<p>LOADING: {loadingStatus}</p>
			<p>Progress: {loadingProgress}%</p>
			<AutofillLoader progress={loadingProgress} status={loadingStatus} />
		</div>
	</div>
{:else if error && isAutofillMode}
	<div class="error-container">
		<div class="error-card card">
			<h2>❌ Error</h2>
			<p>{error}</p>
			<a href="/host-vacation" class="btn btn-primary">Go Back</a>
		</div>
	</div>
{:else}
	<div class="trip-form-page">
		<div class="container container-narrow">
			<div class="page-header">
				<h1>Create New Trip</h1>
			</div>

			{#if error}
				<div class="error-banner">{error}</div>
			{/if}

			<form method="POST" action="?/create" use:enhance={handleSubmit}>
				<!-- Listing URL Input (always visible if not in autofill mode) -->
				{#if !formData.listingUrl && !isAutofillMode}
					<div class="form-section card">
						<div class="section-header">
							<h2>Property Listing</h2>
						</div>
						<div class="form-field">
							<label for="listingUrlInput">Listing URL (Optional)</label>
							<div class="url-input-group">
								<input
									type="url"
									id="listingUrlInput"
									placeholder="https://www.vrbo.com/123456 or https://www.airbnb.com/rooms/123456"
									bind:value={formData.listingUrl}
									class="url-input"
								/>
								<button
									type="button"
									class="btn btn-primary"
									onclick={() => {
										if (formData.listingUrl.trim()) {
											performAutofill(formData.listingUrl.trim());
										}
									}}
									disabled={!formData.listingUrl.trim() || isLoading}
								>
									{isLoading ? 'Processing...' : 'Autofill'}
								</button>
							</div>
							<small>Paste your VRBO or Airbnb listing URL and click "Autofill" to automatically extract property details</small>
						</div>
					</div>
				{/if}
				
				<!-- Listing URL (read-only if autofilled) -->
				{#if formData.listingUrl}
					<div class="form-section card">
						<div class="section-header">
							<h2>Property Information</h2>
						</div>
						
						<div class="property-header">
							<div class="cover-photo-section">
								{#if selectedCoverPhoto}
									<img src={selectedCoverPhoto} alt={scrapedData?.propertyInfo?.title || 'Property'} class="property-cover" />
								{:else if scrapedData?.propertyInfo?.coverPhoto}
									<img src={scrapedData.propertyInfo.coverPhoto} alt={scrapedData.propertyInfo.title} class="property-cover" />
								{/if}
								{#if scrapedData?.photos && scrapedData.photos.length > 0}
									<button
										type="button"
										class="btn btn-secondary btn-small cover-photo-btn"
										onclick={() => showCoverPhotoGallery = true}
									>
										📷 {selectedCoverPhoto ? 'Change Cover Photo' : 'Select Cover Photo'}
									</button>
								{/if}
							</div>
							<div class="property-details">
								<h3>{scrapedData?.propertyInfo?.title || formData.listingTitle || 'Property'}</h3>
								<div class="property-meta">
									{#if scrapedData?.propertyInfo?.roomCount}
										<span>🛏️ {scrapedData.propertyInfo.roomCount} {scrapedData.propertyInfo.roomCount === 1 ? 'Bedroom' : 'Bedrooms'}</span>
									{/if}
									{#if scrapedData?.propertyInfo?.maxGuests}
										<span>👥 Sleeps {scrapedData.propertyInfo.maxGuests}</span>
									{/if}
								</div>
								<p class="listing-url">
									<small>🔗 <a href={formData.listingUrl} target="_blank" rel="noopener noreferrer">{formData.listingUrl}</a></small>
								</p>
							</div>
						</div>

						<!-- Dates and Guests -->
						<div class="dates-guests-grid">
							<div class="form-field">
								<label for="checkInDate">Check-in Date *</label>
								<input
									type="date"
									id="checkInDate"
									name="checkInDate"
									bind:value={formData.checkInDate}
									required
									onchange={handleDateOrGuestChange}
									min={new Date().toISOString().split('T')[0]}
								/>
							</div>
							
							<div class="form-field">
								<label for="checkOutDate">Check-out Date *</label>
								<input
									type="date"
									id="checkOutDate"
									name="checkOutDate"
									bind:value={formData.checkOutDate}
									required
									onchange={handleDateOrGuestChange}
									min={formData.checkInDate || new Date().toISOString().split('T')[0]}
								/>
							</div>
							
							<div class="form-field">
								<label for="expectedPeopleCount">Number of Guests *</label>
								<input
									type="number"
									id="expectedPeopleCount"
									name="expectedPeopleCount"
									bind:value={formData.expectedPeopleCount}
									required
									min="1"
									max={scrapedData?.propertyInfo?.maxGuests || 20}
									onchange={handleDateOrGuestChange}
								/>
								{#if scrapedData?.propertyInfo?.maxGuests}
									<small>Max: {scrapedData.propertyInfo.maxGuests} guests</small>
								{/if}
							</div>
							
							<div class="form-field">
								<label for="totalCost">Total Cost ($) *</label>
								<input
									type="number"
									id="totalCost"
									name="totalCost"
									bind:value={formData.totalCost}
									required
									step="0.01"
									min="0"
								/>
								<small>Total rental cost including taxes and fees</small>
							</div>
						</div>
					</div>
				{/if}

				<!-- Trip Details -->
				<div class="form-section card">
					<div class="section-header">
						<h2>Trip Details</h2>
					</div>
					
					<div class="form-field">
						<label for="name">Trip Name *</label>
						<input
							type="text"
							id="name"
							name="name"
							bind:value={formData.name}
							required
							placeholder="e.g., Summer Beach House 2026"
						/>
					</div>
					
					<div class="form-field">
						<label for="description">Description</label>
						<textarea
							id="description"
							name="description"
							bind:value={formData.description}
							rows="4"
							placeholder="Optional description of the trip..."
						></textarea>
					</div>
				</div>

				<!-- Pricing Model -->
				<div class="form-section card">
					<div class="section-header">
						<h2>Pricing Model</h2>
					</div>
					
					<div class="form-field">
						<label for="pricingModel">How should costs be split? *</label>
						<select
							id="pricingModel"
							name="pricingModel"
							bind:value={formData.pricingModel}
							required
						>
							<option value="PER_PERSON_PER_NIGHT">Per Person Per Night</option>
							<option value="PER_PERSON">Per Person (Equal Split)</option>
							<option value="PER_ROOM">Per Room (Equal Split)</option>
							<option value="PER_BED">Per Bed (Weighted by Bed Type)</option>
						</select>
					</div>

					{#if pricingBreakdown}
						<div class="pricing-preview card">
							<h3>💰 Pricing Preview</h3>
							<p>{pricingBreakdown.description}</p>
						</div>
					{/if}

					<!-- Room Types & Photo Assignment -->
					<div class="form-section card">
						<div class="section-header">
							<h2>🛏️ Rooms & Photo Assignment</h2>
							<button
								type="button"
								class="btn btn-secondary btn-small"
								onclick={() => showAddRoomModal = true}
							>
								+ Add Room
							</button>
						</div>
						
						{#if allRooms.length > 0}
							<div class="rooms-assignment-grid">
								{#each allRooms as room}
									<div class="room-assignment-card" data-room-id={room.id}>
										<div class="room-header">
											<div>
												<h4>{room.name}</h4>
												<div class="beds-list">
													{#each room.beds as bed}
														<span class="bed-tag">
															{bed.quantity}x {bed.bedType.charAt(0).toUpperCase() + bed.bedType.slice(1)}
														</span>
													{/each}
												</div>
											</div>
											{#if room.isCustom}
												<button
													type="button"
													class="btn-icon"
													onclick={() => removeCustomRoom(room.id)}
													title="Remove room"
												>
													×
												</button>
											{/if}
										</div>
										
										<div class="room-photos-dropzone" data-room-id={room.id} onclick={() => openPhotoGallery(room.id)}>
											{#if selectedRoomPhotos[room.id] && selectedRoomPhotos[room.id].length > 0}
												<div class="assigned-photos">
													{#each selectedRoomPhotos[room.id] as photo}
														<div class="assigned-photo-item" onclick={(e) => e.stopPropagation()}>
															<img src={photo} alt="Room photo" />
															<button
																type="button"
																class="remove-photo-btn"
																onclick={() => {
																	const updated = { ...selectedRoomPhotos };
																	updated[room.id] = updated[room.id].filter(p => p !== photo);
																	selectedRoomPhotos = updated;
																}}
															>
																×
															</button>
														</div>
													{/each}
												</div>
											{:else}
												<div class="dropzone-placeholder">
													📷 Click to select photos for this room
												</div>
											{/if}
										</div>
										
										{#if scrapedData?.photos && scrapedData.photos.length > 0}
											<button
												type="button"
												class="btn btn-secondary btn-small"
												onclick={() => openPhotoGallery(room.id)}
											>
												Select Photos
											</button>
										{/if}
									</div>
								{/each}
							</div>
						{:else}
							<p class="section-help">No rooms found. Add rooms manually or use autofill to extract from listing.</p>
						{/if}
					</div>

					<!-- Photo Gallery Section -->
					{#if scrapedData?.photos && scrapedData.photos.length > 0}
						<div class="form-section card">
							<div class="section-header">
								<h2>📷 Available Photos ({scrapedData.photos.length})</h2>
							</div>
							<p class="section-help">Click photos to assign them to rooms above, or set as cover photo.</p>
							<div class="photo-gallery-inline">
								{#each scrapedData.photos as photo, photoIdx}
									{@const isCoverPhoto = selectedCoverPhoto === photo}
									{@const isAssigned = allRooms.some(room => selectedRoomPhotos[room.id]?.includes(photo))}
									<div class="photo-item {isCoverPhoto ? 'is-cover' : ''} {isAssigned ? 'is-assigned' : ''}">
										<img src={photo} alt={`Property photo ${photoIdx + 1}`} />
										{#if isCoverPhoto}
											<div class="photo-badge cover-badge">Cover</div>
										{/if}
										{#if isAssigned}
											<div class="photo-badge assigned-badge">Assigned</div>
										{/if}
										<div class="photo-overlay">
											<div class="photo-actions">
												<button
													type="button"
													class="btn btn-small"
													onclick={() => selectCoverPhoto(photo)}
												>
													{isCoverPhoto ? '✓ Cover' : 'Set Cover'}
												</button>
											</div>
										</div>
									</div>
								{/each}
							</div>
						</div>
					{/if}
				</div>

				<!-- Meals Section -->
				<div class="form-section card">
					<div class="section-header">
						<h2>🍽️ Meals (Optional)</h2>
					</div>
					<div class="form-field">
						<label>
							<input
								type="checkbox"
								name="enableMeals"
								bind:checked={formData.enableMeals}
							/>
							Enable meal planning for this trip
						</label>
						<small>You can add specific meal slots after creating the trip</small>
					</div>
				</div>

				<!-- Activities Section -->
				<div class="form-section card">
					<div class="section-header">
						<h2>🎯 Activities (Optional)</h2>
					</div>
					<div class="form-field">
						<label>
							<input
								type="checkbox"
								name="enableActivities"
								bind:checked={formData.enableActivities}
							/>
							Enable activities for this trip
						</label>
						<small>You can add specific activities after creating the trip</small>
					</div>
				</div>

				<!-- Extras Section -->
				<div class="form-section card">
					<div class="section-header">
						<h2>💰 Extra Costs (Optional)</h2>
					</div>
					<div class="form-field">
						<label>
							<input
								type="checkbox"
								name="enableExtras"
								bind:checked={formData.enableExtras}
							/>
							Enable extra costs (pets, cleaning fees, etc.)
						</label>
						<small>You can add specific extra cost rules after creating the trip</small>
					</div>
				</div>

				<!-- Hidden fields -->
				<input type="hidden" name="listingUrl" value={formData.listingUrl} />
				<input type="hidden" name="listingTitle" value={formData.listingTitle} />
				<input type="hidden" name="listingCoverPhoto" value={selectedCoverPhoto || formData.listingCoverPhoto} />
				<input type="hidden" name="maxGuests" value={formData.maxGuests} />
				<input type="hidden" name="allowPartialStays" value={formData.allowPartialStays ? 'true' : 'false'} />
				<input type="hidden" name="sharingExponentAlpha" value={formData.sharingExponentAlpha} />
				<input type="hidden" name="privacyPremiumP" value={formData.privacyPremiumP} />
				<input type="hidden" name="selectedRoomPhotos" value={JSON.stringify(selectedRoomPhotos)} />
				<input type="hidden" name="customRooms" value={JSON.stringify(customRooms)} />

				<div class="form-actions">
					<button type="submit" class="btn btn-primary btn-large">
						Create Trip & Continue to Room Setup
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}

<!-- Cover Photo Gallery Modal -->
{#if showCoverPhotoGallery && scrapedData?.photos}
	<div class="modal-overlay" onclick={() => showCoverPhotoGallery = false}>
		<div class="modal-content" onclick={(e) => e.stopPropagation()}>
			<div class="modal-header">
				<h2>Select Cover Photo</h2>
				<button type="button" class="modal-close" onclick={() => showCoverPhotoGallery = false}>×</button>
			</div>
			<div class="photo-gallery-grid">
				{#each scrapedData.photos as photo}
					{@const isSelected = selectedCoverPhoto === photo}
					<div
						class="photo-thumbnail {isSelected ? 'selected' : ''}"
						onclick={() => selectCoverPhoto(photo)}
					>
						<img src={photo} alt="Property photo" />
						{#if isSelected}
							<div class="photo-check">✓</div>
						{/if}
					</div>
				{/each}
			</div>
			<div class="modal-footer">
				<button type="button" class="btn btn-primary" onclick={() => showCoverPhotoGallery = false}>
					Done
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- Photo Gallery Modal -->
{#if showPhotoGallery && galleryRoomId && scrapedData?.photos}
	{@const currentRoom = allRooms.find(r => r.id === galleryRoomId)}
	<div class="modal-overlay" onclick={closePhotoGallery}>
		<div class="modal-content" onclick={(e) => e.stopPropagation()}>
			<div class="modal-header">
				<h2>Select Photos for {currentRoom?.name || 'Room'}</h2>
				<button type="button" class="modal-close" onclick={closePhotoGallery}>×</button>
			</div>
			<div class="photo-gallery-grid">
				{#each scrapedData.photos as photo}
					{@const isSelected = selectedRoomPhotos[galleryRoomId]?.includes(photo)}
					<div
						class="photo-thumbnail {isSelected ? 'selected' : ''}"
						onclick={() => togglePhotoForRoom(galleryRoomId, photo)}
					>
						<img src={photo} alt="Property photo" />
						{#if isSelected}
							<div class="photo-check">✓</div>
						{/if}
					</div>
				{/each}
			</div>
			<div class="modal-footer">
				<button type="button" class="btn btn-primary" onclick={closePhotoGallery}>
					Done ({selectedRoomPhotos[galleryRoomId]?.length || 0} selected)
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.trip-form-page {
		padding: var(--spacing-2xl) 0;
		min-height: calc(100vh - 80px);
		background: var(--color-bg-light);
	}

	.page-header {
		margin-bottom: var(--spacing-xl);
		text-align: center;
	}

	.page-header h1 {
		margin-bottom: var(--spacing-sm);
	}

	.error-container {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 60vh;
		padding: var(--spacing-2xl);
	}

	.error-card {
		max-width: 500px;
		text-align: center;
	}

	.error-banner {
		background: var(--color-error);
		color: white;
		padding: var(--spacing-md);
		border-radius: var(--radius-md);
		margin-bottom: var(--spacing-lg);
		text-align: center;
	}

	.form-section {
		margin-bottom: var(--spacing-xl);
		padding: var(--spacing-xl);
	}

	.section-header {
		margin-bottom: var(--spacing-lg);
		border-bottom: 2px solid var(--color-border);
		padding-bottom: var(--spacing-sm);
	}

	.section-header h2 {
		margin: 0;
		color: var(--color-primary);
	}

	.property-header {
		display: flex;
		gap: var(--spacing-lg);
		margin-bottom: var(--spacing-xl);
		align-items: flex-start;
	}

	.cover-photo-section {
		position: relative;
	}

	.property-cover {
		width: 200px;
		height: 150px;
		object-fit: cover;
		border-radius: var(--radius-md);
		display: block;
	}

	.cover-photo-btn {
		margin-top: var(--spacing-sm);
		width: 100%;
	}

	.property-details {
		flex: 1;
	}

	.property-details h3 {
		margin-bottom: var(--spacing-sm);
		color: var(--color-text);
	}

	.property-meta {
		display: flex;
		gap: var(--spacing-md);
		margin-bottom: var(--spacing-sm);
		color: var(--color-text-light);
		font-size: 0.95rem;
	}

	.listing-url {
		margin-top: var(--spacing-sm);
	}

	.listing-url a {
		color: var(--color-primary);
		text-decoration: none;
		word-break: break-all;
	}

	.dates-guests-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: var(--spacing-lg);
	}

	.form-field {
		margin-bottom: var(--spacing-lg);
	}

	.form-field label {
		display: block;
		margin-bottom: var(--spacing-xs);
		font-weight: 600;
		color: var(--color-text);
	}

	.form-field input,
	.form-field select,
	.form-field textarea {
		width: 100%;
		padding: var(--spacing-md);
		border: 2px solid var(--color-border);
		border-radius: var(--radius-md);
		font-size: 1rem;
		font-family: inherit;
		transition: border-color var(--transition-base);
	}

	.form-field input:focus,
	.form-field select:focus,
	.form-field textarea:focus {
		outline: none;
		border-color: var(--color-primary);
	}

	.form-field small {
		display: block;
		margin-top: var(--spacing-xs);
		color: var(--color-text-light);
		font-size: 0.875rem;
	}

	.pricing-preview {
		margin-top: var(--spacing-lg);
		padding: var(--spacing-md);
		background: rgba(37, 99, 235, 0.05);
		border-left: 4px solid var(--color-primary);
	}

	.pricing-preview h3 {
		margin-bottom: var(--spacing-sm);
		color: var(--color-primary);
	}

	.rooms-section {
		margin-top: var(--spacing-xl);
		padding-top: var(--spacing-xl);
		border-top: 2px solid var(--color-border);
	}

	.rooms-section h3 {
		margin-bottom: var(--spacing-lg);
		color: var(--color-text);
	}

	.rooms-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
		gap: var(--spacing-lg);
	}

	.room-card {
		padding: var(--spacing-lg);
	}

	.room-card h4 {
		margin-bottom: var(--spacing-md);
		color: var(--color-primary);
	}

	.beds-list {
		margin-bottom: var(--spacing-md);
	}

	.bed-item {
		padding: var(--spacing-xs) 0;
		color: var(--color-text-light);
		font-size: 0.95rem;
	}

	.form-actions {
		display: flex;
		justify-content: center;
		margin-top: var(--spacing-2xl);
	}

	/* Modal Styles */
	.modal-overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.7);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
		padding: var(--spacing-xl);
	}

	.modal-content {
		background: white;
		border-radius: var(--radius-lg);
		max-width: 900px;
		width: 100%;
		max-height: 90vh;
		display: flex;
		flex-direction: column;
		box-shadow: var(--shadow-xl);
	}

	.modal-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: var(--spacing-lg);
		border-bottom: 2px solid var(--color-border);
	}

	.modal-close {
		background: none;
		border: none;
		font-size: 2rem;
		cursor: pointer;
		color: var(--color-text-light);
		line-height: 1;
		padding: 0;
		width: 32px;
		height: 32px;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.modal-close:hover {
		color: var(--color-text);
	}

	.photo-gallery-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
		gap: var(--spacing-md);
		padding: var(--spacing-lg);
		overflow-y: auto;
		flex: 1;
	}

	.photo-thumbnail {
		position: relative;
		aspect-ratio: 1;
		border-radius: var(--radius-md);
		overflow: hidden;
		cursor: pointer;
		border: 3px solid transparent;
		transition: all var(--transition-base);
	}

	.photo-thumbnail:hover {
		transform: scale(1.05);
		box-shadow: var(--shadow-md);
	}

	.photo-thumbnail.selected {
		border-color: var(--color-primary);
	}

	.photo-thumbnail img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.photo-gallery-inline {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
		gap: var(--spacing-md);
		margin-top: var(--spacing-md);
	}

	.photo-item {
		position: relative;
		border-radius: var(--radius-md);
		overflow: hidden;
		aspect-ratio: 16 / 9;
		background: var(--color-bg-gray);
	}

	.photo-item img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}

	.photo-overlay {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.5);
		display: flex;
		align-items: center;
		justify-content: center;
		opacity: 0;
		transition: opacity var(--transition-base);
	}

	.photo-item:hover .photo-overlay {
		opacity: 1;
	}

	.photo-badge {
		position: absolute;
		top: var(--spacing-xs);
		right: var(--spacing-xs);
		background: var(--color-primary);
		color: white;
		padding: 0.25rem 0.5rem;
		border-radius: var(--radius-sm);
		font-size: 0.75rem;
		font-weight: 600;
		z-index: 2;
	}

	.section-help {
		color: var(--color-text-light);
		font-size: 0.9rem;
		margin-bottom: var(--spacing-md);
	}

	.selected-photos-preview {
		display: flex;
		gap: var(--spacing-xs);
		margin-top: var(--spacing-sm);
		flex-wrap: wrap;
	}

	.preview-thumb {
		width: 50px;
		height: 50px;
		object-fit: cover;
		border-radius: var(--radius-sm);
		border: 2px solid var(--color-primary);
	}

	.photo-check {
		position: absolute;
		top: 8px;
		right: 8px;
		background: var(--color-primary);
		color: white;
		width: 32px;
		height: 32px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		font-weight: bold;
		font-size: 1.2rem;
	}

	.modal-footer {
		padding: var(--spacing-lg);
		border-top: 2px solid var(--color-border);
		text-align: right;
	}

	@media (max-width: 768px) {
		.property-header {
			flex-direction: column;
		}

		.property-cover {
			width: 100%;
			height: 200px;
		}

		.dates-guests-grid {
			grid-template-columns: 1fr;
		}

		.rooms-grid {
			grid-template-columns: 1fr;
		}

		.photo-gallery-inline {
			grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
		}
	}

	.photo-gallery-inline {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
		gap: var(--spacing-md);
		margin-top: var(--spacing-md);
	}

	.photo-item {
		position: relative;
		border-radius: var(--radius-md);
		overflow: hidden;
		aspect-ratio: 16 / 9;
		background: var(--color-bg-gray);
	}

	.photo-item img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}

	.photo-overlay {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.5);
		display: flex;
		align-items: center;
		justify-content: center;
		opacity: 0;
		transition: opacity var(--transition-base);
	}

	.photo-item:hover .photo-overlay {
		opacity: 1;
	}

	.photo-badge {
		position: absolute;
		top: var(--spacing-xs);
		right: var(--spacing-xs);
		background: var(--color-primary);
		color: white;
		padding: 0.25rem 0.5rem;
		border-radius: var(--radius-sm);
		font-size: 0.75rem;
		font-weight: 600;
		z-index: 2;
	}

	.section-help {
		color: var(--color-text-light);
		font-size: 0.9rem;
		margin-bottom: var(--spacing-md);
	}

	.selected-photos-preview {
		display: flex;
		gap: var(--spacing-xs);
		margin-top: var(--spacing-sm);
		flex-wrap: wrap;
	}

	.preview-thumb {
		width: 50px;
		height: 50px;
		object-fit: cover;
		border-radius: var(--radius-sm);
		border: 2px solid var(--color-primary);
	}

	.rooms-assignment-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
		gap: var(--spacing-lg);
		margin-top: var(--spacing-md);
	}

	.room-assignment-card {
		border: 2px solid var(--color-border);
		border-radius: var(--radius-md);
		padding: var(--spacing-md);
		background: white;
	}

	.room-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: var(--spacing-md);
	}

	.room-header h4 {
		margin: 0 0 var(--spacing-xs) 0;
		font-size: 1.1rem;
	}

	.beds-list {
		display: flex;
		gap: var(--spacing-xs);
		flex-wrap: wrap;
		margin-top: var(--spacing-xs);
	}

	.bed-tag {
		display: inline-block;
		padding: 0.25rem 0.5rem;
		background: var(--color-bg-gray);
		border-radius: var(--radius-sm);
		font-size: 0.85rem;
		color: var(--color-text-light);
	}

	.btn-icon {
		background: none;
		border: none;
		font-size: 1.5rem;
		cursor: pointer;
		color: var(--color-text-light);
		padding: 0;
		width: 24px;
		height: 24px;
		display: flex;
		align-items: center;
		justify-content: center;
		line-height: 1;
	}

	.btn-icon:hover {
		color: var(--color-error);
	}

	.room-photos-dropzone {
		min-height: 120px;
		border: 2px dashed var(--color-border);
		border-radius: var(--radius-md);
		padding: var(--spacing-md);
		margin-bottom: var(--spacing-sm);
		background: var(--color-bg-light);
		transition: all var(--transition-base);
	}

	.room-photos-dropzone:hover {
		border-color: var(--color-primary);
		background: rgba(37, 99, 235, 0.05);
	}

	.dropzone-placeholder {
		text-align: center;
		color: var(--color-text-light);
		padding: var(--spacing-md);
		font-size: 0.9rem;
	}

	.assigned-photos {
		display: flex;
		gap: var(--spacing-sm);
		flex-wrap: wrap;
	}

	.assigned-photo-item {
		position: relative;
		width: 80px;
		height: 80px;
		border-radius: var(--radius-sm);
		overflow: hidden;
		border: 2px solid var(--color-primary);
	}

	.assigned-photo-item img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.url-input-group {
		display: flex;
		gap: var(--spacing-md);
		margin-bottom: var(--spacing-sm);
	}

	.url-input {
		flex: 1;
		padding: var(--spacing-md);
		border: 2px solid var(--color-border);
		border-radius: var(--radius-md);
		font-size: 1rem;
		font-family: inherit;
		transition: border-color var(--transition-base);
	}

	.url-input:focus {
		outline: none;
		border-color: var(--color-primary);
	}

	.remove-photo-btn {
		position: absolute;
		top: -8px;
		right: -8px;
		width: 24px;
		height: 24px;
		border-radius: 50%;
		background: var(--color-error);
		color: white;
		border: none;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 1.2rem;
		line-height: 1;
		font-weight: bold;
	}

	.photo-item.is-cover {
		border: 3px solid var(--color-primary);
	}

	.photo-item.is-assigned {
		opacity: 0.7;
	}

	.assigned-badge {
		background: #10b981;
	}

	.photo-actions {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-xs);
	}

	.bed-input-row {
		display: flex;
		align-items: center;
		gap: var(--spacing-sm);
		margin-bottom: var(--spacing-sm);
	}

	.bed-input-row select {
		flex: 1;
	}

	.modal-body {
		padding: var(--spacing-lg);
	}
</style>
