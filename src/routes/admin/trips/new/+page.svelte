<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import type { ActionData } from './$types';
	import AutofillLoader from '$lib/components/AutofillLoader.svelte';

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
		privacyPremiumP: 0.00
	});

	let error = $state<string | null>(null);
	let selectedRoomPhotos = $state<Record<string, string[]>>({});

	// Photo gallery state
	let showPhotoGallery = $state(false);
	let galleryRoomId = $state<string | null>(null);

	// On mount, if autofill mode, fetch data
	onMount(async () => {
		if (isAutofillMode) {
			const url = sessionStorage.getItem('autofillUrl');
			if (url) {
				await performAutofill(url);
			} else {
				error = 'No listing URL found. Please go back and try again.';
			}
		}
	});

	async function performAutofill(listingUrl: string) {
		isLoading = true;
		loadingProgress = 0;
		loadingStatus = 'Starting extraction...';
		
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
			const { propertyInfo, rooms, photos } = result.data;
			
			// Populate form data
			formData.listingUrl = listingUrl;
			formData.listingTitle = propertyInfo.title || '';
			formData.listingCoverPhoto = propertyInfo.coverPhoto || '';
			
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
			error = err instanceof Error ? err.message : 'Failed to extract property data';
			isLoading = false;
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
</script>

{#if isLoading}
	<AutofillLoader progress={loadingProgress} status={loadingStatus} />
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
				<!-- Listing URL (read-only if autofilled) -->
				{#if formData.listingUrl}
					<div class="form-section card">
						<div class="section-header">
							<h2>Property Information</h2>
						</div>
						
						<div class="property-header">
							{#if scrapedData?.propertyInfo?.coverPhoto}
								<img src={scrapedData.propertyInfo.coverPhoto} alt={scrapedData.propertyInfo.title} class="property-cover" />
							{/if}
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

					<!-- Room Types (shown when pricing model is selected and rooms are available) -->
					{#if formData.pricingModel && scrapedData?.rooms && scrapedData.rooms.length > 0}
						<div class="rooms-section">
							<h3>Room Types from Listing</h3>
							<div class="rooms-grid">
								{#each scrapedData.rooms as room, roomIdx}
									{@const roomId = `room-${roomIdx}`}
									<div class="room-card card">
										<h4>{room.name}</h4>
										<div class="beds-list">
											{#each room.beds as bed}
												<div class="bed-item">
													{bed.quantity}x {bed.bedType.charAt(0).toUpperCase() + bed.bedType.slice(1)} Bed
												</div>
											{/each}
										</div>
										
										{#if scrapedData.photos.length > 0}
											<button
												type="button"
												class="btn btn-secondary btn-small"
												onclick={() => openPhotoGallery(roomId)}
											>
												📷 Select Photos ({selectedRoomPhotos[roomId]?.length || 0} selected)
											</button>
										{/if}
									</div>
								{/each}
							</div>
						</div>
					{/if}
				</div>

				<!-- Hidden fields -->
				<input type="hidden" name="listingUrl" value={formData.listingUrl} />
				<input type="hidden" name="listingTitle" value={formData.listingTitle} />
				<input type="hidden" name="listingCoverPhoto" value={formData.listingCoverPhoto} />
				<input type="hidden" name="maxGuests" value={formData.maxGuests} />
				<input type="hidden" name="allowPartialStays" value={formData.allowPartialStays ? 'true' : 'false'} />
				<input type="hidden" name="sharingExponentAlpha" value={formData.sharingExponentAlpha} />
				<input type="hidden" name="privacyPremiumP" value={formData.privacyPremiumP} />

				<div class="form-actions">
					<button type="submit" class="btn btn-primary btn-large">
						Create Trip & Continue to Room Setup
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}

<!-- Photo Gallery Modal -->
{#if showPhotoGallery && galleryRoomId && scrapedData?.photos}
	<div class="modal-overlay" onclick={closePhotoGallery}>
		<div class="modal-content" onclick={(e) => e.stopPropagation()}>
			<div class="modal-header">
				<h2>Select Photos</h2>
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

	.property-cover {
		width: 200px;
		height: 150px;
		object-fit: cover;
		border-radius: var(--radius-md);
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
	}
</style>
