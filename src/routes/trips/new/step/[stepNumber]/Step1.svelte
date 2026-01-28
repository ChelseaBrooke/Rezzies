<script lang="ts">
	import FileUploadTile from '$lib/components/wizard/FileUploadTile.svelte';
	import RoomBedPicker from '$lib/components/wizard/RoomBedPicker.svelte';
	import PriceBreakdown from '$lib/components/wizard/PriceBreakdown.svelte';
	import type { TripDraft } from '$lib/stores/tripDraft.js';
	
	let { draft, autosave }: { draft: TripDraft; autosave: () => void } = $props();
	
	// Automatically calculate bedrooms from rooms
	$effect(() => {
		if (draft.rooms && Array.isArray(draft.rooms)) {
			draft.bedrooms = draft.rooms.length;
		} else {
			draft.bedrooms = 0;
		}
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

<div class="step-content">
	<div class="two-column-layout">
		<!-- Left Column: Form Inputs -->
		<div class="section-box basics-section">
			<div class="basics-header-row">
				<h3 class="section-header">Trip Basics</h3>
				<div class="cover-photo-top">
					<label class="form-label">Main / Cover Photo *</label>
					{#if draft.coverPhoto}
						<div class="photo-preview-small">
							<img src={draft.coverPhoto} alt="Cover photo" />
							<button type="button" class="remove-photo-small" onclick={() => { draft.coverPhoto = ''; autosave(); }}>
								×
							</button>
						</div>
					{:else}
						<label class="cover-photo-upload-small">
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
							<div class="upload-tile-small">
								<span class="upload-icon">📷</span>
								<span class="upload-text">Upload</span>
							</div>
						</label>
					{/if}
				</div>
			</div>
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
				<div class="flexible-dates-wrapper">
					<label class="checkbox-label-small">
						<input
							type="checkbox"
							bind:checked={draft.flexibleDates}
							onchange={autosave}
						/>
						<span class="flexible-dates-text">Flexible dates allowed</span>
						<div class="tooltip-container">
							<span class="tooltip-icon">i</span>
							<span class="tooltip-text">Allow your guests to select dates for a partial stay</span>
						</div>
					</label>
				</div>
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
			
			<div class="basics-bottom-section">
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
			</div>
		</div>
		
		<!-- Right Column: Room/Bed Picker -->
		<div class="section-box rooms-section">
			<h3 class="section-header">Rooms & Beds</h3>
			<div class="right-column">
				<!-- Rooms & Beds Section - Prominent -->
				<div class="rooms-beds-section">
					<RoomBedPicker bind:draft {autosave} />
				</div>
			</div>
		</div>
	</div>
	
	<!-- Pricing Section - Full Width -->
	<div class="section-box pricing-section">
		<h3 class="section-header">Pricing</h3>
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
		</div>
		
		<PriceBreakdown {draft} />
	</div>
</div>

<style>
	.step-content {
		display: flex;
		flex-direction: column;
		gap: 1.75rem;
		background: #f5f5f5;
		padding: 1.5rem;
		border-radius: 0.5rem;
	}
	
	.section-box {
		background: white;
		border: 1px solid #e5e7eb;
		border-radius: 0.75rem;
		padding: 1.5rem;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06);
	}
	
	.basics-header-row {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin: 0 0 0.05rem 0;
		padding-top: 0;
		padding-bottom: 0.5rem;
		border-bottom: 1px solid #f3f4f6;
	}
	
	.section-header {
		font-size: 1rem;
		font-weight: 600;
		color: var(--text);
		margin: 0 0 1.25rem 0;
		padding-bottom: 0.75rem;
		border-bottom: 1px solid #f3f4f6;
	}
	
	.basics-header-row .section-header {
		margin: 0;
		padding-bottom: 0;
		border-bottom: none;
		line-height: 1.2;
	}
	
	.cover-photo-top {
		display: flex;
		flex-direction: row;
		align-items: center;
		gap: 0.5rem;
	}
	
	.cover-photo-top .form-label {
		font-size: 0.75rem;
		margin: 0;
		white-space: nowrap;
	}
	
	.photo-preview-small {
		position: relative;
		width: 80px;
		height: 60px;
		border-radius: 0.25rem;
		overflow: hidden;
		border: 1px solid var(--border);
	}
	
	.photo-preview-small img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	
	.remove-photo-small {
		position: absolute;
		top: 0.25rem;
		right: 0.25rem;
		width: 1.25rem;
		height: 1.25rem;
		background: rgba(0, 0, 0, 0.7);
		color: white;
		border: none;
		border-radius: 50%;
		cursor: pointer;
		font-size: 0.75rem;
		line-height: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0;
	}
	
	.cover-photo-upload-small {
		cursor: pointer;
		display: block;
	}
	
	.upload-tile-small {
		border: 2px dashed var(--border);
		border-radius: 0.25rem;
		padding: 0.5rem 0.75rem;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		transition: all 0.2s ease;
		background: white;
		gap: 0.25rem;
		min-width: 80px;
	}
	
	.upload-tile-small:hover {
		border-color: var(--primary);
		background: rgba(30, 58, 138, 0.02);
	}
	
	.upload-tile-small .upload-icon {
		font-size: 1rem;
	}
	
	.upload-tile-small .upload-text {
		font-size: 0.7rem;
		color: var(--muted);
		font-weight: 500;
	}
	
	.two-column-layout {
		display: grid;
		grid-template-columns: 35% 65%;
		gap: 1.5rem;
		align-items: stretch;
	}
	
	.left-column {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		flex: 1;
	}
	
	.basics-section {
		display: flex;
		flex-direction: column;
		height: 100%;
		min-height: 600px;
	}
	
	.basics-bottom-section {
		margin-top: auto;
		padding-top: 0.5rem;
		border-top: 1px solid #f3f4f6;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}
	
	.rooms-section {
		display: flex;
		flex-direction: column;
		height: 100%;
		min-height: 600px;
	}
	
	.right-column {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		flex: 1;
		height: 100%;
	}
	
	.right-content {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}
	
	.form-section {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
	}
	
	.form-label {
		font-size: 0.75rem;
		font-weight: 500;
		color: var(--text);
	}
	
	.form-input,
	.form-textarea,
	.form-select {
		padding: 0.375rem 0.5rem;
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
		grid-template-columns: 1fr 1fr;
		grid-template-rows: auto auto;
		gap: 0.75rem;
		align-items: end;
		position: relative;
	}
	
	.date-input-wrapper {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
	}
	
	.date-input {
		min-width: 0;
	}
	
	.flexible-dates-wrapper {
		grid-column: 2;
		grid-row: 2;
		display: flex;
		align-items: center;
		justify-content: flex-end;
		margin-top: 0.25rem;
	}
	
	.checkbox-label-small {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		cursor: pointer;
		font-size: 0.7rem;
		color: var(--text);
		margin: 0;
		position: relative;
	}
	
	.checkbox-label-small input[type="checkbox"] {
		width: 0.875rem;
		height: 0.875rem;
		cursor: pointer;
		accent-color: var(--primary);
		flex-shrink: 0;
	}

	.flexible-dates-text {
		position: relative;
	}

	.tooltip-container {
		position: absolute;
		top: -0.125rem;
		right: -1.1rem;
		display: inline-flex;
		align-items: center;
		justify-content: center;
	}

	.tooltip-icon {
		width: 0.75rem;
		height: 0.75rem;
		border-radius: 50%;
		background-color: #9ca3af;
		color: white;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		font-size: 0.5rem;
		font-weight: 700;
		font-style: italic;
		cursor: help;
		opacity: 0.7;
		transition: opacity 0.2s ease, background-color 0.2s ease;
		line-height: 1;
		padding: 0;
		margin: 0;
		text-align: center;
		transform: translateY(-0.5px);
	}

	.tooltip-icon:hover {
		opacity: 1;
		background-color: #6b7280;
	}

	.tooltip-text {
		visibility: hidden;
		opacity: 0;
		position: absolute;
		bottom: 100%;
		right: 0;
		margin-bottom: 0.5rem;
		background-color: #1f2937;
		color: white;
		text-align: left;
		padding: 0.5rem 0.75rem;
		border-radius: 0.375rem;
		font-size: 0.7rem;
		white-space: nowrap;
		z-index: 1000;
		box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
		transition: opacity 0.2s ease, visibility 0.2s ease;
		pointer-events: none;
	}

	.tooltip-text::after {
		content: "";
		position: absolute;
		top: 100%;
		right: 0.75rem;
		border: 4px solid transparent;
		border-top-color: #1f2937;
	}

	.tooltip-container:hover .tooltip-text {
		visibility: visible;
		opacity: 1;
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
		margin-top: 0.5rem;
	}
	
	.form-group {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
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
	
	.rooms-beds-section {
		background: #fafafa;
		border: 1px solid #e5e7eb;
		border-radius: 0.5rem;
		padding: 0.75rem;
		flex: 1;
		min-height: 0;
		max-height: calc(100% - 1rem);
		margin-top: 1rem;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
	}
	
	.pricing-section {
		width: 100%;
	}
	
	.pricing-inputs-row {
		display: grid;
		grid-template-columns: 1fr;
		gap: 0.75rem;
		margin-bottom: 1rem;
		max-width: 300px;
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
	}
</style>
