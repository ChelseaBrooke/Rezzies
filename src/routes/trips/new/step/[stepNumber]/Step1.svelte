<script lang="ts">
	import FileUploadTile from '$lib/components/wizard/FileUploadTile.svelte';
	import RoomBedPicker from '$lib/components/wizard/RoomBedPicker.svelte';
	import PriceBreakdown from '$lib/components/wizard/PriceBreakdown.svelte';
	import type { TripDraft } from '$lib/stores/tripDraft.js';
	
	let { draft, autosave }: { draft: TripDraft; autosave: () => void } = $props();
	
	// Automatically calculate bedrooms from rooms
	$effect(() => {
		draft.bedrooms = draft.rooms.length;
	});
	
	function handleCoverPhotoUpload(event: CustomEvent<{ files: FileList }>) {
		const file = event.detail.files[0];
		if (file) {
			const reader = new FileReader();
			reader.onload = (e) => {
				draft.coverPhoto = e.target?.result as string;
				autosave();
			};
			reader.readAsDataURL(file);
		}
	}
</script>

<div class="step-content two-column-layout">
	<!-- Left Column: Form Inputs -->
	<div class="left-column">
		<div class="form-section">
			<label for="name" class="form-label">Trip Name *</label>
			<input
				type="text"
				id="name"
				class="form-input"
				bind:value={draft.name}
				oninput={autosave}
				placeholder="Enter trip name"
				required
			/>
		</div>
		
		<div class="form-section">
			<label for="description" class="form-label">Trip Description / Notes</label>
			<textarea
				id="description"
				class="form-textarea"
				bind:value={draft.description}
				oninput={autosave}
				rows="4"
				placeholder="Add any notes or description about this trip"
			></textarea>
		</div>
		
		<div class="form-section">
			<label for="destination" class="form-label">Destination</label>
			<input
				type="text"
				id="destination"
				class="form-input"
				bind:value={draft.destinationCity}
				oninput={autosave}
				placeholder="City, State/Province, Country"
			/>
		</div>
		
		<div class="form-section date-group">
			<div class="date-input-wrapper">
				<label for="checkInDate" class="form-label">Check-in Date *</label>
				<input
					type="date"
					id="checkInDate"
					class="form-input date-input"
					bind:value={draft.checkInDate}
					oninput={autosave}
					required
				/>
			</div>
			<span class="date-arrow">→</span>
			<div class="date-input-wrapper">
				<label for="checkOutDate" class="form-label">Check-out Date *</label>
				<input
					type="date"
					id="checkOutDate"
					class="form-input date-input"
					bind:value={draft.checkOutDate}
					oninput={autosave}
					required
				/>
			</div>
		</div>
		
		<div class="form-section">
			<label class="checkbox-label">
				<input
					type="checkbox"
					bind:checked={draft.flexibleDates}
					onchange={autosave}
				/>
				<span>Flexible dates allowed</span>
			</label>
		</div>
		
		<div class="form-section form-row">
			<div class="form-group">
				<label for="expectedGuestCount" class="form-label">Expected Guest Count</label>
				<input
					type="number"
					id="expectedGuestCount"
					class="form-input"
					bind:value={draft.expectedGuestCount}
					oninput={autosave}
					min="1"
					placeholder="0"
				/>
			</div>
			<div class="form-group">
				<label for="maxOccupancy" class="form-label">Max Occupancy</label>
				<input
					type="number"
					id="maxOccupancy"
					class="form-input"
					bind:value={draft.maxOccupancy}
					oninput={autosave}
					min="1"
					placeholder="0"
				/>
			</div>
		</div>
		
		<div class="form-section">
			<label class="form-label">Main / Cover Photo *</label>
			{#if draft.coverPhoto}
				<div class="photo-preview">
					<img src={draft.coverPhoto} alt="Cover photo" />
					<button type="button" class="remove-photo" onclick={() => { draft.coverPhoto = ''; autosave(); }}>
						Remove
					</button>
				</div>
			{:else}
				<label class="cover-photo-upload">
					<input
						type="file"
						accept="image/*"
						onchange={(e) => {
							const file = (e.target as HTMLInputElement).files?.[0];
							if (file) {
								const reader = new FileReader();
								reader.onload = (e) => {
									draft.coverPhoto = e.target?.result as string;
									autosave();
								};
								reader.readAsDataURL(file);
							}
						}}
						style="display: none;"
					/>
					<div class="upload-tile">
						<span class="upload-icon">📷</span>
						<span class="upload-text">Upload Cover Photo</span>
					</div>
				</label>
			{/if}
		</div>
	</div>
	
	<!-- Right Column: Room/Bed Picker + Price Breakdown -->
	<div class="right-column">
		<div class="right-content">
			<!-- Rooms & Beds Section - Prominent -->
			<div class="rooms-beds-section">
				<RoomBedPicker bind:draft {autosave} />
			</div>
			
			<div class="pricing-section">
				<div class="pricing-inputs-row">
					<div class="form-section">
						<label for="pricingModel" class="form-label">Price Model</label>
						<select id="pricingModel" class="form-select" bind:value={draft.pricingModel} onchange={autosave}>
							<option value="per-person">Per Person</option>
							<option value="per-room">Per Room</option>
							<option value="per-bed">Per Bed</option>
							<option value="hybrid">Hybrid</option>
						</select>
					</div>
					
					<div class="form-section">
						<label for="totalTripCost" class="form-label">Total Trip Cost *</label>
						<div class="currency-input-wrapper">
							<span class="currency-symbol">$</span>
							<input
								type="number"
								id="totalTripCost"
								class="form-input currency-input"
								bind:value={draft.totalTripCost}
								oninput={autosave}
								placeholder="0.00"
								step="0.01"
								required
							/>
						</div>
						<p class="cost-note">*Include fees and taxes if you would like your guests to split these costs as well</p>
					</div>
				</div>
				
				<PriceBreakdown {draft} />
			</div>
		</div>
	</div>
</div>

<style>
	.step-content {
		display: flex;
		flex-direction: column;
		gap: 0;
	}
	
	.two-column-layout {
		display: grid;
		grid-template-columns: 35% 65%;
		gap: 1rem;
		align-items: start;
	}
	
	.left-column {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	
	.right-column {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}
	
	.right-content {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}
	
	.form-section {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}
	
	.form-label {
		font-size: 0.75rem;
		font-weight: 500;
		color: var(--text);
	}
	
	.form-input,
	.form-textarea,
	.form-select {
		padding: 0.4rem 0.6rem;
		border: 1px solid var(--border);
		border-radius: 0;
		font-size: 0.8125rem;
		font-family: inherit;
		color: var(--text);
		background: white;
		transition: all 0.2s ease;
		width: 100%;
	}
	
	.form-input:focus,
	.form-textarea:focus,
	.form-select:focus {
		outline: none;
		border-color: var(--primary);
		box-shadow: 0 0 0 3px rgba(30, 58, 138, 0.1);
	}
	
	.form-input::placeholder,
	.form-textarea::placeholder {
		color: var(--muted);
	}
	
	.form-textarea {
		resize: vertical;
		min-height: 60px;
	}
	
	.form-select {
		cursor: pointer;
	}
	
	.date-group {
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		gap: 0.75rem;
		align-items: end;
	}
	
	.date-input-wrapper {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
	}
	
	.date-arrow {
		font-size: 1rem;
		color: var(--muted);
		margin-bottom: 0.375rem;
		align-self: center;
	}
	
	.date-input {
		min-width: 0;
	}
	
	.checkbox-label {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		cursor: pointer;
		font-size: 0.8125rem;
		color: var(--text);
	}
	
	.checkbox-label input[type="checkbox"] {
		width: 1rem;
		height: 1rem;
		cursor: pointer;
		accent-color: var(--primary);
	}
	
	.form-row {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.75rem;
	}
	
	.form-group {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	
	.photo-preview {
		position: relative;
		width: 100%;
		aspect-ratio: 16 / 9;
		border-radius: 0;
		overflow: hidden;
		border: 1px solid var(--border);
		max-height: 180px;
	}
	
	.photo-preview img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	
	.remove-photo {
		position: absolute;
		top: 0.5rem;
		right: 0.5rem;
		padding: 0.375rem 0.75rem;
		background: rgba(0, 0, 0, 0.7);
		color: white;
		border: none;
		border-radius: 0;
		cursor: pointer;
		font-size: 0.75rem;
		font-weight: 500;
		transition: background 0.2s ease;
	}
	
	.remove-photo:hover {
		background: rgba(0, 0, 0, 0.9);
	}
	
	.rooms-beds-section {
		background: #4a5568;
		border: 2px solid #2d3748;
		border-radius: 0.5rem;
		padding: 0.75rem;
		margin-bottom: 0.75rem;
		height: 500px;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
	}
	
	.cover-photo-upload {
		cursor: pointer;
		display: block;
	}
	
	.upload-tile {
		border: 2px dashed var(--border);
		border-radius: 0;
		padding: 1.5rem;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		transition: all 0.2s ease;
		background: white;
		gap: 0.375rem;
	}
	
	.upload-tile:hover {
		border-color: var(--primary);
		background: rgba(30, 58, 138, 0.02);
	}
	
	.upload-tile .upload-icon {
		font-size: 1.5rem;
	}
	
	.upload-tile .upload-text {
		font-size: 0.8125rem;
		color: var(--muted);
		font-weight: 500;
	}
	
	.cost-note {
		font-size: 0.75rem;
		color: var(--muted);
		margin: 0.5rem 0 0 0;
		font-style: italic;
	}
	
	.pricing-section {
		border-top: 1px solid var(--border);
		padding-top: 0.75rem;
	}
	
	.pricing-inputs-row {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.75rem;
		margin-bottom: 0.5rem;
	}
	
	.currency-input-wrapper {
		position: relative;
		display: flex;
		align-items: center;
	}
	
	.currency-symbol {
		position: absolute;
		left: 0.6rem;
		color: var(--text);
		font-size: 0.8125rem;
		font-weight: 500;
		pointer-events: none;
		z-index: 1;
	}
	
	.currency-input {
		padding-left: 1.5rem !important;
	}
	
	.cost-note {
		font-size: 0.75rem;
		color: var(--muted);
		margin: 0 0 0.75rem 0;
		font-style: italic;
	}
	
	@media (max-width: 1024px) {
		.two-column-layout {
			grid-template-columns: 1fr;
		}
		
		.date-group {
			grid-template-columns: 1fr;
		}
		
		.date-arrow {
			display: none;
		}
	}
</style>
