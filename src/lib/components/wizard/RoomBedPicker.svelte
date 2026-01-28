<script lang="ts">
	import type { TripDraft } from '$lib/stores/tripDraft.js';
	
	let { draft, autosave }: { draft: TripDraft; autosave: () => void } = $props();
	
	let draggedPhoto: { url: string } | null = $state(null);
	let draggedOverRoomId: string | null = $state(null);
	let galleryPhotos: string[] = $state([]);
	let editingRoomId: string | null = $state(null);
	let newRoomBedTypes: Record<string, number> = $state({});
	let newRoomType: string = $state('bedroom');
	let newRoomCustomDesc: string = $state('');
	
	const roomTypeOptions = [
		{ value: 'bedroom', label: 'Bedroom' },
		{ value: 'master-bedroom', label: 'Master Bedroom' },
		{ value: 'guest-room', label: 'Guest Room' },
		{ value: 'living-room', label: 'Living Room' },
		{ value: 'kitchen', label: 'Kitchen' },
		{ value: 'dining-room', label: 'Dining Room' },
		{ value: 'bathroom', label: 'Bathroom' },
		{ value: 'office', label: 'Office / Study' },
		{ value: 'other', label: 'Other' }
	];
	
	const bedTypeOptions = [
		{ value: 'king', label: 'King', icon: '🛏️' },
		{ value: 'queen', label: 'Queen', icon: '🛏️' },
		{ value: 'full', label: 'Full', icon: '🛏️' },
		{ value: 'twin', label: 'Twin', icon: '🛏️' },
		{ value: 'bunk', label: 'Bunk', icon: '🛏️' },
		{ value: 'sofa', label: 'Sofa Bed', icon: '🛋️' }
	];
	
	function getRoomDisplayName(room: { roomType: string; customRoomDescription?: string }, roomIndex: number): string {
		const option = roomTypeOptions.find(opt => opt.value === room.roomType);
		let baseName = option ? option.label : room.roomType;
		
		if (room.roomType === 'other' && room.customRoomDescription) {
			baseName = room.customRoomDescription;
		}
		
		// Count how many rooms of this type exist
		const sameTypeRooms = draft.rooms.filter(r => r.roomType === room.roomType);
		const sameTypeCount = sameTypeRooms.length;
		
		// If multiple rooms of same type, add number
		if (sameTypeCount > 1) {
			// Count how many of this type come before this one
			const beforeCount = draft.rooms.slice(0, roomIndex).filter(r => r.roomType === room.roomType).length;
			return `${baseName} ${beforeCount + 1}`;
		}
		
		return baseName;
	}
	
	function getBedIcon(bedType: string): string {
		const option = bedTypeOptions.find(opt => opt.value === bedType);
		return option ? option.icon : '🛏️';
	}
	
	function startAddingRoom() {
		editingRoomId = 'new';
		newRoomType = 'bedroom';
		newRoomCustomDesc = '';
		newRoomBedTypes = {};
	}
	
	function cancelAddingRoom() {
		editingRoomId = null;
		newRoomBedTypes = {};
		newRoomCustomDesc = '';
	}
	
	function saveNewRoom() {
		// Convert bed types object to beds array
		const beds = Object.entries(newRoomBedTypes)
			.filter(([_, count]) => count > 0)
			.flatMap(([bedType, count]) => 
				Array.from({ length: count }, () => ({
					id: crypto.randomUUID(),
					bedType,
					count: 1,
					shared: false,
					notes: ''
				}))
			);
		
		draft.rooms = [
			...draft.rooms,
			{
				id: crypto.randomUUID(),
				name: '',
				roomType: newRoomType,
				customRoomDescription: newRoomType === 'other' ? newRoomCustomDesc : '',
				type: 'private',
				maxOccupants: 2,
				notes: '',
				photos: [],
				beds
			}
		];
		autosave();
		cancelAddingRoom();
	}
	
	function editRoom(roomId: string) {
		const room = draft.rooms.find(r => r.id === roomId);
		if (!room) return;
		
		editingRoomId = roomId;
		newRoomType = room.roomType;
		newRoomCustomDesc = room.customRoomDescription || '';
		
		// Convert beds array to bed types object
		newRoomBedTypes = {};
		room.beds.forEach(bed => {
			newRoomBedTypes[bed.bedType] = (newRoomBedTypes[bed.bedType] || 0) + 1;
		});
	}
	
	function saveEditedRoom() {
		if (!editingRoomId || editingRoomId === 'new') return;
		
		const room = draft.rooms.find(r => r.id === editingRoomId);
		if (!room) return;
		
		room.roomType = newRoomType;
		room.customRoomDescription = newRoomType === 'other' ? newRoomCustomDesc : '';
		
		// Convert bed types object to beds array
		room.beds = Object.entries(newRoomBedTypes)
			.filter(([_, count]) => count > 0)
			.flatMap(([bedType, count]) => 
				Array.from({ length: count }, () => ({
					id: crypto.randomUUID(),
					bedType,
					count: 1,
					shared: false,
					notes: ''
				}))
			);
		
		autosave();
		editingRoomId = null;
		newRoomBedTypes = {};
		newRoomCustomDesc = '';
	}
	
	function removeRoom(roomId: string) {
		draft.rooms = draft.rooms.filter((r) => r.id !== roomId);
		autosave();
	}
	
	function toggleBedType(bedType: string) {
		if (newRoomBedTypes[bedType]) {
			delete newRoomBedTypes[bedType];
		} else {
			newRoomBedTypes[bedType] = 1;
		}
		newRoomBedTypes = { ...newRoomBedTypes };
	}
	
	function updateBedQuantity(bedType: string, quantity: number) {
		if (quantity <= 0) {
			delete newRoomBedTypes[bedType];
		} else {
			newRoomBedTypes[bedType] = quantity;
		}
		newRoomBedTypes = { ...newRoomBedTypes };
	}
	
	function handleGalleryUpload(event: Event) {
		const input = event.target as HTMLInputElement;
		const files = input.files;
		if (!files || files.length === 0) return;
		
		Array.from(files).forEach((file) => {
			const reader = new FileReader();
			reader.onload = (e) => {
				galleryPhotos = [...galleryPhotos, e.target?.result as string];
			};
			reader.readAsDataURL(file);
		});
	}
	
	function removeGalleryPhoto(photoIndex: number) {
		galleryPhotos = galleryPhotos.filter((_, i) => i !== photoIndex);
	}
	
	function removePhoto(roomId: string, photoIndex: number) {
		const room = draft.rooms.find((r) => r.id === roomId);
		if (!room) return;
		const removedPhoto = room.photos[photoIndex];
		room.photos = room.photos.filter((_, i) => i !== photoIndex);
		// Return photo to gallery if it exists there
		if (removedPhoto && !galleryPhotos.includes(removedPhoto)) {
			galleryPhotos = [...galleryPhotos, removedPhoto];
		}
		autosave();
	}
	
	function handleDragStart(event: DragEvent, photoUrl: string) {
		if (!event.dataTransfer) return;
		event.dataTransfer.effectAllowed = 'move';
		draggedPhoto = { url: photoUrl };
	}
	
	function handleDragOver(event: DragEvent, roomId: string) {
		event.preventDefault();
		if (event.dataTransfer) {
			event.dataTransfer.dropEffect = 'move';
		}
		draggedOverRoomId = roomId;
	}
	
	function handleDrop(event: DragEvent, roomId: string) {
		event.preventDefault();
		if (draggedPhoto) {
			const room = draft.rooms.find((r) => r.id === roomId);
			if (room && !room.photos.includes(draggedPhoto.url)) {
				// Remove from any other room that has this photo
				draft.rooms.forEach(r => {
					if (r.id !== roomId && r.photos.includes(draggedPhoto.url)) {
						r.photos = r.photos.filter(url => url !== draggedPhoto.url);
					}
				});
				// Add to target room
				room.photos = [...room.photos, draggedPhoto.url];
				// Remove from gallery if it's there
				galleryPhotos = galleryPhotos.filter(url => url !== draggedPhoto.url);
				autosave();
			}
		}
		draggedPhoto = null;
		draggedOverRoomId = null;
	}
	
	function handleDragEnd() {
		draggedPhoto = null;
		draggedOverRoomId = null;
	}
</script>

<div class="room-bed-picker">
	<div class="picker-header">
		<h3>Rooms & Beds</h3>
	</div>
	
	<div class="rooms-grid">
		<!-- Add Room Card -->
		{#if editingRoomId === 'new'}
			<div class="room-card editing">
				<div class="room-card-header">
					<h4>Add Room</h4>
					<button type="button" class="btn-close" onclick={cancelAddingRoom}>×</button>
				</div>
				<div class="room-edit-content">
					<div class="edit-field">
						<label>Room Type</label>
						<select class="room-type-select" bind:value={newRoomType}>
							{#each roomTypeOptions as option}
								<option value={option.value}>{option.label}</option>
							{/each}
						</select>
					</div>
					{#if newRoomType === 'other'}
						<div class="edit-field">
							<label>Description</label>
							<input
								type="text"
								class="room-description-input"
								bind:value={newRoomCustomDesc}
								placeholder="Describe the room..."
							/>
						</div>
					{/if}
					<div class="edit-field">
						<label>Bed Types</label>
						<div class="bed-types-multiselect">
							{#each bedTypeOptions as bedOption}
								<div class="bed-type-checkbox-row">
									<label class="bed-checkbox-label">
										<input
											type="checkbox"
											checked={!!newRoomBedTypes[bedOption.value]}
											onchange={() => toggleBedType(bedOption.value)}
										/>
										<span class="bed-icon">{bedOption.icon}</span>
										<span class="bed-label">{bedOption.label}</span>
									</label>
									{#if newRoomBedTypes[bedOption.value]}
										<input
											type="number"
											class="bed-quantity-input"
											min="1"
											value={newRoomBedTypes[bedOption.value] || 1}
											oninput={(e) => updateBedQuantity(bedOption.value, parseInt((e.target as HTMLInputElement).value) || 1)}
										/>
									{/if}
								</div>
							{/each}
						</div>
					</div>
					<button type="button" class="btn-save-room" onclick={saveNewRoom}>
						Save Room
					</button>
				</div>
			</div>
		{:else}
			<button type="button" class="room-card add-room-card" onclick={startAddingRoom}>
				<span class="add-icon">+</span>
				<span class="add-text">Add Room</span>
			</button>
		{/if}
		
		<!-- Existing Room Cards -->
		{#each draft.rooms as room, index}
			{#if editingRoomId === room.id}
				<div class="room-card editing">
					<div class="room-card-header">
						<h4>Edit Room</h4>
						<button type="button" class="btn-close" onclick={() => { editingRoomId = null; }}>×</button>
					</div>
					<div class="room-edit-content">
						<div class="edit-field">
							<label>Room Type</label>
							<select class="room-type-select" bind:value={newRoomType}>
								{#each roomTypeOptions as option}
									<option value={option.value}>{option.label}</option>
								{/each}
							</select>
						</div>
						{#if newRoomType === 'other'}
							<div class="edit-field">
								<label>Description</label>
								<input
									type="text"
									class="room-description-input"
									bind:value={newRoomCustomDesc}
									placeholder="Describe the room..."
								/>
							</div>
						{/if}
						<div class="edit-field">
							<label>Bed Types</label>
							<div class="bed-types-multiselect">
								{#each bedTypeOptions as bedOption}
									<div class="bed-type-checkbox-row">
										<label class="bed-checkbox-label">
											<input
												type="checkbox"
												checked={!!newRoomBedTypes[bedOption.value]}
												onchange={() => toggleBedType(bedOption.value)}
											/>
											<span class="bed-icon">{bedOption.icon}</span>
											<span class="bed-label">{bedOption.label}</span>
										</label>
										{#if newRoomBedTypes[bedOption.value]}
											<input
												type="number"
												class="bed-quantity-input"
												min="1"
												value={newRoomBedTypes[bedOption.value] || 1}
												oninput={(e) => updateBedQuantity(bedOption.value, parseInt((e.target as HTMLInputElement).value) || 1)}
											/>
										{/if}
									</div>
								{/each}
							</div>
						</div>
						<button type="button" class="btn-save-room" onclick={saveEditedRoom}>
							Save Changes
						</button>
					</div>
				</div>
			{:else}
				<div 
					class="room-card display"
					class:drag-over={draggedOverRoomId === room.id}
					ondrop={(e) => handleDrop(e, room.id)}
					ondragover={(e) => handleDragOver(e, room.id)}
				>
					<div class="room-card-header">
						<h4>{getRoomDisplayName(room, index)}</h4>
						<div class="room-actions">
							<button type="button" class="btn-edit-room" onclick={() => editRoom(room.id)} title="Edit room">
								✎
							</button>
							<button type="button" class="btn-remove-room" onclick={() => removeRoom(room.id)} title="Remove room">
								×
							</button>
						</div>
					</div>
					{#if room.photos.length > 0}
						<div class="room-photos-display">
							<div class="room-photos-grid">
								{#each room.photos.slice(0, 4) as photo, photoIndex}
									<div
										class="room-photo-thumbnail"
										draggable="true"
										ondragstart={(e) => handleDragStart(e, photo)}
										ondragend={handleDragEnd}
									>
										<img src={photo} alt="Room photo" />
										<button
											type="button"
											class="remove-photo-btn"
											onclick={() => removePhoto(room.id, photoIndex)}
											title="Remove photo"
										>
											×
										</button>
									</div>
								{/each}
								{#if room.photos.length > 4}
									<div class="photo-more-badge">
										+{room.photos.length - 4}
									</div>
								{/if}
							</div>
						</div>
					{/if}
					<div class="room-beds-display">
						{#each room.beds as bed}
							<span class="bed-icon-badge" title={bed.bedType}>
								{getBedIcon(bed.bedType)}
							</span>
						{/each}
						{#if room.beds.length === 0}
							<span class="no-beds">No beds</span>
						{/if}
					</div>
				</div>
			{/if}
		{/each}
	</div>
	
	<!-- Gallery Section -->
	<div class="gallery-section">
		<div class="gallery-header">
			<h4>Photo Gallery</h4>
			<p class="gallery-description">Upload photos so your guests can see where they're staying. Drag to assign them to the rooms you've built above.</p>
		</div>
		<div class="gallery-grid" ondrop={(e) => e.preventDefault()} ondragover={(e) => e.preventDefault()}>
			{#each galleryPhotos as photo, photoIndex}
				<div
					class="gallery-photo-item"
					draggable="true"
					ondragstart={(e) => handleDragStart(e, photo)}
					ondragend={handleDragEnd}
				>
					<img src={photo} alt="Gallery photo" />
					<button
						type="button"
						class="remove-photo-btn"
						onclick={() => removeGalleryPhoto(photoIndex)}
					>
						×
					</button>
				</div>
			{/each}
			<label class="gallery-upload-tile">
				<input
					type="file"
					accept="image/*"
					multiple
					onchange={handleGalleryUpload}
					style="display: none;"
				/>
				<span class="upload-icon">📷</span>
				<span class="upload-text">Upload Photos</span>
			</label>
		</div>
	</div>
</div>

<style>
	.room-bed-picker {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		height: 100%;
		min-height: 0;
	}
	
	.picker-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}
	
	.picker-header h3 {
		font-size: 1rem;
		font-weight: 600;
		color: #ffffff;
		margin: 0;
	}
	
	.btn-add-room {
		padding: 0.4rem 0.75rem;
		background: #ffffff;
		color: #2d3748;
		border: none;
		border-radius: 0;
		font-size: 0.8125rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s ease;
	}
	
	.btn-add-room:hover {
		background: #e2e8f0;
		color: #1a202c;
	}
	
	.rooms-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
		gap: 0.75rem;
		flex: 1;
		overflow-y: auto;
		min-height: 0;
		align-content: start;
	}
	
	.room-card {
		border: 1px solid #718096;
		border-radius: 0;
		padding: 0.75rem;
		background: #2d3748;
		transition: all 0.2s ease;
		display: flex;
		flex-direction: column;
		min-height: 120px;
	}
	
	.room-card.display {
		cursor: default;
	}
	
	.room-card.display:hover {
		border-color: #cbd5e0;
	}
	
	.room-card.display.drag-over {
		border-color: #ffffff;
		background: #4a5568;
		box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.3);
	}
	
	.room-card.editing {
		grid-column: span 2;
		min-height: auto;
	}
	
	.add-room-card {
		background: #2d3748;
		border: 1px solid #718096;
		cursor: pointer;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.75rem;
		transition: all 0.2s ease;
		min-height: 150px;
		padding: 1.5rem;
		aspect-ratio: 1;
	}
	
	.add-room-card:hover {
		border-color: #ffffff;
		background: #4a5568;
	}
	
	.add-icon {
		font-size: 3.5rem;
		color: #ffffff;
		font-weight: 200;
		line-height: 1;
	}
	
	.add-text {
		font-size: 0.9375rem;
		color: #ffffff;
		font-weight: 500;
	}
	
	.room-card-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.75rem;
	}
	
	.room-card-header h4 {
		font-size: 0.9375rem;
		font-weight: 600;
		color: #ffffff;
		margin: 0;
	}
	
	.room-actions {
		display: flex;
		gap: 0.25rem;
	}
	
	.btn-edit-room {
		width: 1.5rem;
		height: 1.5rem;
		background: transparent;
		color: #cbd5e0;
		border: 1px solid #718096;
		border-radius: 0;
		cursor: pointer;
		font-size: 0.875rem;
		line-height: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.2s ease;
		padding: 0;
	}
	
	.btn-edit-room:hover {
		background: rgba(255, 255, 255, 0.1);
		border-color: #ffffff;
		color: #ffffff;
	}
	
	.btn-close {
		width: 1.5rem;
		height: 1.5rem;
		background: transparent;
		color: #cbd5e0;
		border: none;
		cursor: pointer;
		font-size: 1.25rem;
		line-height: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.2s ease;
		padding: 0;
	}
	
	.btn-close:hover {
		color: #ffffff;
	}
	
	.room-type-select {
		padding: 0.5rem 0.75rem;
		border: 1px solid #718096;
		border-radius: 0;
		font-size: 0.875rem;
		font-weight: 500;
		color: #ffffff;
		background: #1a202c;
		cursor: pointer;
		width: 100%;
	}
	
	.room-type-select:focus {
		outline: none;
		border-color: #ffffff;
		box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.2);
	}
	
	.room-type-select option {
		background: #1a202c;
		color: #ffffff;
	}
	
	.room-description-input {
		padding: 0.5rem 0.75rem;
		border: 1px solid #718096;
		border-radius: 0;
		font-size: 0.875rem;
		font-weight: 400;
		color: #ffffff;
		background: #1a202c;
		width: 100%;
	}
	
	.room-description-input::placeholder {
		color: #a0aec0;
	}
	
	.room-description-input:focus {
		outline: none;
		border-color: #ffffff;
		box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.2);
	}
	
	.btn-remove-room {
		width: 1.75rem;
		height: 1.75rem;
		background: transparent;
		color: #cbd5e0;
		border: 1px solid #718096;
		border-radius: 0;
		cursor: pointer;
		font-size: 1.25rem;
		line-height: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.2s ease;
		flex-shrink: 0;
	}
	
	.btn-remove-room:hover {
		background: #ef4444;
		color: white;
		border-color: #ef4444;
	}
	
	.room-edit-content {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}
	
	.edit-field {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	
	.edit-field label {
		font-size: 0.75rem;
		font-weight: 500;
		color: #cbd5e0;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}
	
	.room-type-select {
		padding: 0.5rem 0.75rem;
		border: 1px solid #718096;
		border-radius: 0;
		font-size: 0.875rem;
		font-weight: 500;
		color: #ffffff;
		background: #1a202c;
		cursor: pointer;
		width: 100%;
	}
	
	.room-type-select:focus {
		outline: none;
		border-color: #ffffff;
		box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.2);
	}
	
	.room-type-select option {
		background: #1a202c;
		color: #ffffff;
	}
	
	.room-description-input {
		padding: 0.5rem 0.75rem;
		border: 1px solid #718096;
		border-radius: 0;
		font-size: 0.875rem;
		font-weight: 400;
		color: #ffffff;
		background: #1a202c;
		width: 100%;
	}
	
	.room-description-input::placeholder {
		color: #a0aec0;
	}
	
	.room-description-input:focus {
		outline: none;
		border-color: #ffffff;
		box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.2);
	}
	
	.bed-types-multiselect {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		border: 1px solid #718096;
		padding: 0.75rem;
		background: #1a202c;
		max-height: 200px;
		overflow-y: auto;
	}
	
	.bed-type-checkbox-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		padding: 0.375rem 0;
	}
	
	.bed-checkbox-label {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		cursor: pointer;
		flex: 1;
		color: #ffffff;
		font-size: 0.875rem;
	}
	
	.bed-checkbox-label input[type="checkbox"] {
		width: 1.125rem;
		height: 1.125rem;
		cursor: pointer;
		accent-color: #ffffff;
	}
	
	.bed-icon {
		font-size: 1rem;
	}
	
	.bed-label {
		font-weight: 500;
	}
	
	.bed-quantity-input {
		width: 60px;
		padding: 0.375rem 0.5rem;
		border: 1px solid #718096;
		border-radius: 0;
		font-size: 0.8125rem;
		background: #2d3748;
		color: #ffffff;
		text-align: center;
	}
	
	.bed-quantity-input:focus {
		outline: none;
		border-color: #ffffff;
		box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.2);
	}
	
	.btn-save-room {
		padding: 0.625rem 1rem;
		background: #ffffff;
		color: #2d3748;
		border: none;
		border-radius: 0;
		font-size: 0.875rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s ease;
		margin-top: 0.5rem;
	}
	
	.btn-save-room:hover {
		background: #e2e8f0;
	}
	
	.room-photos-display {
		margin-bottom: 0.75rem;
	}
	
	.room-photos-grid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 0.375rem;
	}
	
	.room-photo-thumbnail {
		position: relative;
		aspect-ratio: 1;
		border-radius: 0;
		overflow: hidden;
		border: 1px solid #718096;
		cursor: move;
		transition: all 0.2s ease;
	}
	
	.room-photo-thumbnail:hover {
		border-color: #ffffff;
		transform: scale(1.05);
	}
	
	.room-photo-thumbnail img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	
	.room-photo-thumbnail .remove-photo-btn {
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
		font-size: 0.875rem;
		line-height: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		opacity: 0;
		transition: opacity 0.2s ease;
		padding: 0;
	}
	
	.room-photo-thumbnail:hover .remove-photo-btn {
		opacity: 1;
	}
	
	.photo-more-badge {
		aspect-ratio: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		background: #1a202c;
		border: 1px solid #718096;
		border-radius: 0;
		color: #cbd5e0;
		font-size: 0.75rem;
		font-weight: 500;
	}
	
	.room-beds-display {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		align-items: center;
		margin-top: auto;
	}
	
	.bed-icon-badge {
		font-size: 1.25rem;
		line-height: 1;
	}
	
	.no-beds {
		font-size: 0.75rem;
		color: #a0aec0;
		font-style: italic;
	}
	
	.empty-state {
		text-align: center;
		padding: 2rem;
		color: #cbd5e0;
		font-size: 0.9375rem;
	}
	
	.gallery-section {
		border-top: 1px solid #718096;
		padding-top: 1rem;
		margin-top: 1rem;
	}
	
	.gallery-header {
		margin-bottom: 0.75rem;
	}
	
	.gallery-header h4 {
		font-size: 0.9375rem;
		font-weight: 600;
		color: #ffffff;
		margin: 0 0 0.25rem 0;
	}
	
	.gallery-description {
		font-size: 0.75rem;
		color: #cbd5e0;
		margin: 0;
		line-height: 1.4;
	}
	
	.gallery-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
		gap: 0.5rem;
	}
	
	.gallery-photo-item {
		position: relative;
		aspect-ratio: 1;
		border-radius: 0.5rem;
		overflow: hidden;
		border: 2px solid #718096;
		cursor: move;
		transition: all 0.2s ease;
	}
	
	.gallery-photo-item:hover {
		border-color: #ffffff;
		transform: scale(1.05);
		box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.3);
	}
	
	.gallery-photo-item img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	
	.gallery-upload-tile {
		aspect-ratio: 1;
		border: 2px dashed #718096;
		border-radius: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		transition: all 0.2s ease;
		background: #1a202c;
		gap: 0.5rem;
		min-height: 120px;
	}
	
	.gallery-upload-tile:hover {
		border-color: #ffffff;
		background: #2d3748;
	}
	
	.upload-icon {
		font-size: 1.5rem;
		color: #cbd5e0;
	}
	
	.upload-text {
		font-size: 0.8125rem;
		color: #cbd5e0;
		font-weight: 500;
	}
</style>
