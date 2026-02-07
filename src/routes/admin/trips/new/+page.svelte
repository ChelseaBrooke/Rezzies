<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData } from './$types';

	let { form } = $props();
	
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
	
	// Rooms (manual only)
	let allRooms = $derived.by(() =>
		customRooms.map((room) => ({
			id: room.id,
			name: room.name,
			beds: room.beds.map(bed => ({ type: bed.bedType, quantity: bed.quantity })),
			isCustom: true
		}))
	);

	// Photo gallery state
	let showPhotoGallery = $state(false);
	let galleryRoomId = $state<string | null>(null);
	let showCoverPhotoGallery = $state(false);
	let showAddRoomModal = $state(false);
	let newRoomName = $state('');
	let newRoomBeds = $state<Array<{ bedType: string; quantity: number }>>([{ bedType: 'sofa', quantity: 1 }]);

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
		const roomCount = allRooms.length;

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

	<div class="trip-form-page">
		<div class="container container-narrow">
			<div class="page-header">
				<h1>Create New Trip</h1>
			</div>

			{#if error}
				<div class="error-banner">{error}</div>
			{/if}

			<form method="POST" action="?/create" use:enhance={handleSubmit}>
				<!-- Listing URL (optional) and Dates/Guests/Cost -->
				<div class="form-section card">
					<div class="section-header">
						<h2>Property & Dates</h2>
					</div>
					<div class="form-field">
						<label for="listingUrlInput">Listing URL (Optional)</label>
						<input
							type="url"
							id="listingUrlInput"
							name="listingUrl"
							placeholder="https://www.vrbo.com/... or https://www.airbnb.com/..."
							bind:value={formData.listingUrl}
							class="url-input"
						/>
						{#if formData.listingUrl}
							<p class="listing-url"><small>🔗 <a href={formData.listingUrl} target="_blank" rel="noopener noreferrer">{formData.listingUrl}</a></small></p>
						{/if}
					</div>

					<div class="dates-guests-grid">
						<div class="form-field">
							<label for="checkInDate">Check-in Date *</label>
							<input
								type="date"
								id="checkInDate"
								name="checkInDate"
								bind:value={formData.checkInDate}
								required
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
								max="20"
							/>
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
										
									</div>
								{/each}
							</div>
						{:else}
							<p class="section-help">No rooms yet. Add rooms manually below.</p>
						{/if}
					</div>

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
