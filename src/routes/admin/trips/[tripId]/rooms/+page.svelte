<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageData, ActionData } from './$types';

	let { data, form } = $props();

	let showRoomForm = $state(false);
	let showBedForm = $state<number | null>(null);
	let error = $state<string | null>(null);

	let newRoom = $state({
		name: '',
		description: '',
		maxOccupancy: ''
	});

	let newBed = $state({
		roomId: 0,
		bedType: 'queen',
		capacity: 1,
		capacitySlots: 1
	});

	const bedTypes = ['king', 'queen', 'full', 'twin', 'bunk', 'sofa', 'other'];

	// Photo selection for extracted rooms
	let selectedPhotos = $state<string[][]>([]);
	let isRetryingExtraction = $state(false);
	let extractedDataOverride = $state<any>(null);
	
	$effect(() => {
		if (data.extractedData?.rooms) {
			selectedPhotos = data.extractedData.rooms.map(() => []);
		}
	});

	async function retryExtraction() {
		if (!data.trip.listingUrl) return;
		
		isRetryingExtraction = true;
		try {
			const response = await fetch(`/api/extract-rooms?url=${encodeURIComponent(data.trip.listingUrl)}`);
			const result = await response.json();
			
			if (result.ok && result.data) {
				extractedDataOverride = result.data;
				selectedPhotos = result.data.rooms.map(() => []);
			} else {
				error = result.message || 'Failed to extract rooms';
			}
		} catch (e) {
			error = 'Error extracting rooms. Please check the server logs.';
			console.error('Extraction error:', e);
		} finally {
			isRetryingExtraction = false;
		}
	}

	// Use override if available, otherwise use server data
	let displayExtractedData = $derived(extractedDataOverride || data.extractedData);

	function openBedForm(roomId: number) {
		newBed.roomId = roomId;
		showBedForm = roomId;
	}

	function closeForms() {
		showRoomForm = false;
		showBedForm = null;
		newRoom = { name: '', description: '', maxOccupancy: '' };
		newBed = { roomId: 0, bedType: 'queen', capacity: 1 };
	}

	$effect(() => {
		if (form?.error) {
			error = form.error;
		} else if (form?.success) {
			error = null;
			closeForms();
		}
	});
</script>

<div class="rooms-page">
	<div class="container">
		<header>
			<h1>Room Setup: {data.trip.name}</h1>
			<a href="/admin" class="btn-secondary">Back to Dashboard</a>
		</header>

		<div class="trip-info">
			<p><strong>Dates:</strong> {new Date(data.trip.checkInDate).toLocaleDateString()} - {new Date(data.trip.checkOutDate).toLocaleDateString()}</p>
			<p><strong>Pricing Model:</strong> {data.trip.pricingModel.replace(/_/g, ' ')}</p>
			<p><strong>Status:</strong> {data.trip.isPublished ? 'Published' : 'Draft'}</p>
		</div>

		{#if error}
			<div class="error-message">{error}</div>
		{/if}

		{#if !data.trip.isPublished}
			<div class="publish-section">
				<form method="POST" action="?/publish" use:enhance>
					<button type="submit" class="btn-primary" disabled={data.trip.rooms.length === 0}>
						Publish Trip
					</button>
					{#if data.trip.rooms.length === 0}
						<small>Add at least one room before publishing</small>
					{/if}
				</form>
			</div>
		{:else}
			<div class="published-banner">
				<p>✓ Trip is published! Share the invite code: <strong>{data.trip.inviteCode}</strong></p>
				<a href="/trip/{data.trip.inviteCode}" target="_blank" class="btn-link">View Guest Page</a>
			</div>
		{/if}

		{#if data.trip.listingUrl && data.trip.rooms.length === 0}
			<section class="extracted-rooms-section">
				<div class="extracted-header">
					<h2>Rooms & Beds from Listing</h2>
					{#if displayExtractedData && displayExtractedData.rooms.length > 0}
						<p class="extracted-subtitle">We found {displayExtractedData.rooms.length} room(s) from your listing. Review and import them below.</p>
					{:else}
						<p class="extracted-subtitle error-text">
							⚠️ Could not automatically extract rooms from the listing.
						</p>
						<p class="extracted-subtitle">
							<small>Listing URL: {data.trip.listingUrl}</small>
						</p>
						<button 
							type="button" 
							class="btn-primary"
							onclick={retryExtraction}
							disabled={isRetryingExtraction}
						>
							{isRetryingExtraction ? 'Extracting...' : '🔄 Retry Extraction'}
						</button>
					{/if}
				</div>

				{#if displayExtractedData && displayExtractedData.rooms.length > 0}

				<div class="extracted-rooms-list">
					{#each displayExtractedData.rooms as room, roomIdx}
						<div class="extracted-room-card card">
							<div class="room-name-section">
								<h3>{room.name}</h3>
								<div class="pricing-badge pricing-preview">
									Pricing will be calculated after import
								</div>
							</div>

							<div class="beds-list">
								<h4>Beds:</h4>
								<ul>
									{#each room.beds as bed}
										<li>
											{bed.quantity}x {bed.bedType.charAt(0).toUpperCase() + bed.bedType.slice(1)} Bed
											{#if bed.capacity}
												<span class="bed-capacity">(sleeps {bed.capacity * bed.quantity})</span>
											{/if}
											<div class="bed-pricing">
												Pricing calculated after import
											</div>
										</li>
									{/each}
								</ul>
							</div>

							{#if displayExtractedData.photos.length > 0}
								<div class="photo-selection">
									<h4>Select Photos for {room.name}</h4>
									<div class="photo-gallery">
										{#each displayExtractedData.photos as photo, photoIdx}
											<label class="photo-thumbnail">
												<input
													type="checkbox"
													checked={selectedPhotos[roomIdx]?.includes(photo) || false}
													onchange={(e) => {
														if (!selectedPhotos[roomIdx]) {
															selectedPhotos[roomIdx] = [];
														}
														if (e.currentTarget.checked) {
															selectedPhotos[roomIdx] = [...selectedPhotos[roomIdx], photo];
														} else {
															selectedPhotos[roomIdx] = selectedPhotos[roomIdx].filter(p => p !== photo);
														}
													}}
												/>
												<img src={photo} alt="Property photo {photoIdx + 1}" />
											</label>
										{/each}
									</div>
								</div>
							{/if}
						</div>
					{/each}
				</div>

					<form method="POST" action="?/importRooms" use:enhance>
						<input type="hidden" name="rooms" value={JSON.stringify(displayExtractedData.rooms)} />
						<input type="hidden" name="photos" value={JSON.stringify(displayExtractedData.photos)} />
						<input type="hidden" name="selectedPhotos" value={JSON.stringify(selectedPhotos)} />
						<button type="submit" class="btn-primary btn-large">Import All Rooms</button>
					</form>
				{/if}
			</section>
		{/if}

		<section class="rooms-section">
			<div class="section-header">
				<h2>Rooms ({data.trip.rooms.length})</h2>
				{#if !showRoomForm}
					<button onclick={() => showRoomForm = true} class="btn-primary">Add Room</button>
				{/if}
			</div>

			{#if showRoomForm}
				<div class="form-card">
					<h3>Add New Room</h3>
					<form method="POST" action="?/createRoom" use:enhance>
						<div class="form-group">
							<label for="roomName">Room Name *</label>
							<input
								type="text"
								id="roomName"
								name="name"
								bind:value={newRoom.name}
								required
								placeholder="Master Bedroom"
							/>
						</div>
						<div class="form-group">
							<label for="roomDescription">Description</label>
							<textarea
								id="roomDescription"
								name="description"
								bind:value={newRoom.description}
								rows="2"
								placeholder="Optional description"
							></textarea>
						</div>
						<div class="form-group">
							<label for="maxOccupancy">Max Occupancy</label>
							<input
								type="number"
								id="maxOccupancy"
								name="maxOccupancy"
								bind:value={newRoom.maxOccupancy}
								min="1"
								placeholder="2"
							/>
							<small>Maximum number of people for this room (for per-person pricing)</small>
						</div>
						<div class="form-actions">
							<button type="submit" class="btn-primary">Add Room</button>
							<button type="button" onclick={closeForms} class="btn-secondary">Cancel</button>
						</div>
					</form>
				</div>
			{/if}

			{#if data.trip.rooms.length === 0}
				<div class="empty-state">
					<p>No rooms added yet. Add your first room to get started!</p>
				</div>
			{:else}
				<div class="rooms-list">
					{#each data.trip.rooms as room}
						<div class="room-card">
							<div class="room-header">
								<h3>{room.name}</h3>
								{#if data.pricingDisplay}
									{@const roomPricing = data.pricingDisplay.roomPricing.find(r => r.roomId === room.id)}
									{#if roomPricing}
										<div class="pricing-badge">
											{roomPricing.priceDisplay}
										</div>
									{/if}
								{/if}
								<form method="POST" action="?/deleteRoom" use:enhance>
									<input type="hidden" name="roomId" value={room.id} />
									<button type="submit" class="btn-delete">Delete</button>
								</form>
							</div>
							{#if room.description}
								<p class="room-description">{room.description}</p>
							{/if}
							{#if room.maxOccupancy}
								<p class="room-meta">Max Occupancy: {room.maxOccupancy}</p>
							{/if}

							<div class="beds-section">
								<h4>Beds ({room.beds.length})</h4>
								{#if showBedForm === room.id}
									<div class="form-card">
										<h5>Add Bed</h5>
										<form method="POST" action="?/createBed" use:enhance>
											<input type="hidden" name="roomId" value={room.id} />
											<div class="form-group">
												<label for="bedType">Bed Type *</label>
												<select id="bedType" name="bedType" bind:value={newBed.bedType} required>
													{#each bedTypes as type}
														<option value={type}>{type.charAt(0).toUpperCase() + type.slice(1)}</option>
													{/each}
												</select>
											</div>
											<div class="form-group">
												<label for="bedCapacity">Capacity (people) *</label>
												<input
													type="number"
													id="bedCapacity"
													name="capacity"
													bind:value={newBed.capacity}
													min="1"
													required
												/>
											</div>
											<div class="form-group">
												<label for="bedCapacitySlots">Sleep Slots *</label>
												<input
													type="number"
													id="bedCapacitySlots"
													name="capacitySlots"
													bind:value={newBed.capacitySlots}
													min="1"
													required
												/>
												<small>Number of sleep positions (e.g., bunk bed = 2 slots)</small>
											</div>
											<div class="form-actions">
												<button type="submit" class="btn-primary">Add Bed</button>
												<button type="button" onclick={closeForms} class="btn-secondary">Cancel</button>
											</div>
										</form>
									</div>
								{:else}
									<button onclick={() => openBedForm(room.id)} class="btn-link">+ Add Bed</button>
								{/if}

								{#if room.beds.length > 0}
									<ul class="beds-list">
										{#each room.beds as bed}
											<li class="bed-item">
												<div class="bed-info">
													<span>
														{bed.bedType.toUpperCase()} 
														(capacity: {bed.capacity}, slots: {bed.capacitySlots || bed.capacity})
													</span>
													{#if data.pricingDisplay}
														{@const roomPricing = data.pricingDisplay.roomPricing.find(r => r.roomId === room.id)}
														{@const bedPricing = roomPricing?.bedPricing?.find(b => b.bedId === bed.id || b.bedType === bed.bedType)}
														{#if bedPricing}
															<div class="bed-pricing-small">{bedPricing.priceDisplay}</div>
														{/if}
													{/if}
												</div>
												<form method="POST" action="?/deleteBed" use:enhance>
													<input type="hidden" name="bedId" value={bed.id} />
													<button type="submit" class="btn-delete-small">×</button>
												</form>
											</li>
										{/each}
									</ul>
								{/if}
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</section>
	</div>
</div>

<style>
	.rooms-page {
		min-height: 100vh;
		padding: 2rem;
		background: #f5f7fa;
	}

	.container {
		max-width: 1000px;
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

	.trip-info {
		background: #f8f9fa;
		padding: 1rem;
		border-radius: 4px;
		margin-bottom: 1.5rem;
	}

	.trip-info p {
		margin: 0.25rem 0;
		color: #555;
	}

	.publish-section {
		background: #e8f5e9;
		padding: 1rem;
		border-radius: 4px;
		margin-bottom: 1.5rem;
		text-align: center;
	}

	.published-banner {
		background: #d4edda;
		padding: 1rem;
		border-radius: 4px;
		margin-bottom: 1.5rem;
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.btn-link {
		color: #3498db;
		text-decoration: none;
	}

	.btn-link:hover {
		text-decoration: underline;
	}

	.error-message {
		background: #fee;
		color: #c33;
		padding: 1rem;
		border-radius: 8px;
		margin-bottom: 1.5rem;
		border: 1px solid #fcc;
	}

	.rooms-section {
		margin-top: 2rem;
	}

	.section-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1rem;
	}

	h2 {
		margin: 0;
		color: #2c3e50;
	}

	.btn-primary {
		background: #3498db;
		color: white;
		border: none;
		padding: 0.75rem 1.5rem;
		border-radius: 4px;
		cursor: pointer;
		font-size: 0.9rem;
	}

	.btn-primary:hover:not(:disabled) {
		background: #2980b9;
	}

	.btn-primary:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.form-card {
		background: #f8f9fa;
		padding: 1.5rem;
		border-radius: 8px;
		margin-bottom: 1rem;
		border: 1px solid #e0e0e0;
	}

	h3, h4, h5 {
		margin: 0 0 1rem 0;
		color: #2c3e50;
	}

	.form-group {
		margin: 1rem 0;
	}

	label {
		display: block;
		margin-bottom: 0.5rem;
		font-weight: 500;
		color: #555;
		font-size: 0.9rem;
	}

	input[type="text"],
	input[type="number"],
	textarea,
	select {
		width: 100%;
		padding: 0.5rem;
		border: 1px solid #ddd;
		border-radius: 4px;
		font-size: 0.9rem;
		font-family: inherit;
	}

	small {
		display: block;
		margin-top: 0.25rem;
		color: #7f8c8d;
		font-size: 0.8rem;
	}

	.form-actions {
		display: flex;
		gap: 0.5rem;
		margin-top: 1rem;
	}

	.empty-state {
		text-align: center;
		padding: 3rem;
		background: #f8f9fa;
		border-radius: 8px;
		color: #7f8c8d;
	}

	.rooms-list {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		margin-top: 1rem;
	}

	.room-card {
		background: #f8f9fa;
		border: 1px solid #e0e0e0;
		border-radius: 8px;
		padding: 1.5rem;
	}

	.room-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.5rem;
	}

	.room-header h3 {
		margin: 0;
	}

	.btn-delete {
		background: #e74c3c;
		color: white;
		border: none;
		padding: 0.5rem 1rem;
		border-radius: 4px;
		cursor: pointer;
		font-size: 0.85rem;
	}

	.btn-delete:hover {
		background: #c0392b;
	}

	.room-description {
		color: #555;
		margin: 0.5rem 0;
		font-size: 0.9rem;
	}

	.room-meta {
		color: #7f8c8d;
		margin: 0.25rem 0;
		font-size: 0.85rem;
	}

	.beds-section {
		margin-top: 1rem;
		padding-top: 1rem;
		border-top: 1px solid #e0e0e0;
	}

	h4 {
		font-size: 1rem;
		margin: 0 0 0.5rem 0;
	}

	.beds-list {
		list-style: none;
		padding: 0;
		margin: 0.5rem 0;
	}

	.bed-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.5rem;
		background: white;
		border-radius: 4px;
		margin: 0.25rem 0;
	}

	.btn-delete-small {
		background: #e74c3c;
		color: white;
		border: none;
		width: 24px;
		height: 24px;
		border-radius: 50%;
		cursor: pointer;
		font-size: 1rem;
		line-height: 1;
	}

	.btn-delete-small:hover {
		background: #c0392b;
	}

	.extracted-rooms-section {
		margin-bottom: 2rem;
		padding: 1.5rem;
		background: #f0f8ff;
		border-radius: 8px;
		border: 2px solid #3498db;
	}

	.extracted-header {
		margin-bottom: 1.5rem;
	}

	.extracted-header h2 {
		margin: 0 0 0.5rem 0;
		color: #2c3e50;
	}

	.extracted-subtitle {
		color: #555;
		margin: 0;
		font-size: 0.9rem;
	}

	.extracted-subtitle.error-text {
		color: #e74c3c;
		font-weight: 500;
	}

	.extracted-rooms-list {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
		margin-bottom: 1.5rem;
	}

	.extracted-room-card {
		background: white;
		border: 1px solid #ddd;
		border-radius: 8px;
		padding: 1.5rem;
	}

	.room-name-section {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1rem;
	}

	.room-name-section h3 {
		margin: 0;
	}

	.pricing-badge {
		background: #3498db;
		color: white;
		padding: 0.5rem 1rem;
		border-radius: 4px;
		font-size: 0.9rem;
		font-weight: 600;
	}

	.pricing-badge.pricing-preview {
		background: #95a5a6;
		font-size: 0.85rem;
	}

	.beds-list h4 {
		margin: 0 0 0.5rem 0;
		font-size: 0.95rem;
		color: #555;
	}

	.beds-list ul {
		list-style: none;
		padding: 0;
		margin: 0;
	}

	.beds-list li {
		padding: 0.5rem 0;
		border-bottom: 1px solid #eee;
	}

	.bed-capacity {
		color: #7f8c8d;
		font-size: 0.85rem;
		margin-left: 0.5rem;
	}

	.bed-pricing {
		margin-top: 0.25rem;
		color: #27ae60;
		font-size: 0.85rem;
		font-weight: 500;
	}

	.bed-pricing-small {
		margin-top: 0.25rem;
		color: #27ae60;
		font-size: 0.8rem;
	}

	.photo-selection {
		margin-top: 1.5rem;
		padding-top: 1.5rem;
		border-top: 1px solid #eee;
	}

	.photo-selection h4 {
		margin: 0 0 1rem 0;
		font-size: 0.95rem;
		color: #555;
	}

	.photo-gallery {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
		gap: 0.75rem;
	}

	.photo-thumbnail {
		position: relative;
		cursor: pointer;
		border: 2px solid #ddd;
		border-radius: 4px;
		overflow: hidden;
		aspect-ratio: 1;
	}

	.photo-thumbnail input[type="checkbox"] {
		position: absolute;
		top: 0.5rem;
		left: 0.5rem;
		width: 20px;
		height: 20px;
		z-index: 1;
		cursor: pointer;
	}

	.photo-thumbnail img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}

	.photo-thumbnail:has(input:checked) {
		border-color: #3498db;
		box-shadow: 0 0 0 2px rgba(52, 152, 219, 0.3);
	}

	.btn-large {
		padding: 1rem 2rem;
		font-size: 1rem;
		width: 100%;
		margin-top: 1rem;
	}

	.bed-info {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		flex: 1;
	}
</style>
