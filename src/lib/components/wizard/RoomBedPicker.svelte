<script lang="ts">
	import type { TripDraft } from '$lib/stores/tripDraft.js';
	import kingBedIconUrl from '$lib/assets/images/beds/king.svg.svg?url';
	import queenBedIconUrl from '$lib/assets/images/beds/queen.svg.svg?url';
	import twinBedIconUrl from '$lib/assets/images/beds/twin.svg.svg?url';
	import bunkBedIconUrl from '$lib/assets/images/beds/bunk.svg.svg?url';
	import sofaBedIconUrl from '$lib/assets/images/beds/sofabed.svg.svg?url';
	
	let { draft, autosave }: { draft: TripDraft; autosave: () => void } = $props();
	
	let draggedPhoto: { url: string } | null = $state(null);
	let draggedOverRoomId: string | null = $state(null);
	let galleryPhotos: string[] = $state([]);
	let editingRoomId: string | null = $state(null);
	let newRoomBedTypesArray: Array<{ bedType: string; quantity: number }> = $state([]);
	let newRoomType: string = $state('');
	let newRoomCustomDesc: string = $state('');
	let isBedTypesDropdownOpen: boolean = $state(false);
	let bedTypesDropdownElement: HTMLElement | null = $state(null);
	let bedTypesDropdownMenu: HTMLElement | null = $state(null);
	let dropdownPosition = $state({ top: 0, left: 0 });
	
	// Position dropdown when it opens
	$effect(() => {
		if (!isBedTypesDropdownOpen || !bedTypesDropdownElement) return;
		
		// Use setTimeout to ensure DOM is updated
		setTimeout(() => {
			if (bedTypesDropdownElement) {
				const triggerRect = bedTypesDropdownElement.getBoundingClientRect();
				dropdownPosition = {
					top: triggerRect.bottom + 4,
					left: triggerRect.left
				};
			}
		}, 0);
	});
	
	// Close dropdown when clicking outside
	$effect(() => {
		if (!isBedTypesDropdownOpen) return;
		
		function handleClickOutside(event: MouseEvent) {
			const target = event.target as Node;
			if (bedTypesDropdownElement && !bedTypesDropdownElement.contains(target) &&
			    bedTypesDropdownMenu && !bedTypesDropdownMenu.contains(target)) {
				isBedTypesDropdownOpen = false;
			}
		}
		
		// Use a small delay to avoid closing immediately when opening
		const timeoutId = setTimeout(() => {
			document.addEventListener('mousedown', handleClickOutside, true);
		}, 10);
		
		return () => {
			clearTimeout(timeoutId);
			document.removeEventListener('mousedown', handleClickOutside, true);
		};
	});
	
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
		{ value: 'king', label: 'King', iconUrl: kingBedIconUrl, fallbackIcon: '🛏️' },
		{ value: 'queen', label: 'Queen', iconUrl: queenBedIconUrl, fallbackIcon: '🛏️' },
		// If you add a dedicated "full" icon later, we can swap it in here.
		{ value: 'full', label: 'Full', iconUrl: queenBedIconUrl, fallbackIcon: '🛏️' },
		{ value: 'twin', label: 'Twin', iconUrl: twinBedIconUrl, fallbackIcon: '🛏️' },
		{ value: 'bunk', label: 'Bunk', iconUrl: bunkBedIconUrl, fallbackIcon: '🛏️' },
		{ value: 'sofa', label: 'Sofa Bed', iconUrl: sofaBedIconUrl, fallbackIcon: '🛋️' }
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
	
	function getBedIconMeta(bedType: string): { url?: string; alt: string; fallback: string } {
		const option = bedTypeOptions.find((opt) => opt.value === bedType);
		if (!option) return { alt: bedType, fallback: '🛏️' };
		return { url: option.iconUrl, alt: option.label, fallback: option.fallbackIcon };
	}
	
	function startAddingRoom() {
		editingRoomId = 'new';
		newRoomType = '';
		newRoomCustomDesc = '';
		newRoomBedTypesArray = [];
		isBedTypesDropdownOpen = false;
	}
	
	function cancelAddingRoom() {
		editingRoomId = null;
		newRoomBedTypesArray = [];
		newRoomCustomDesc = '';
		isBedTypesDropdownOpen = false;
	}
	
	function toggleBedTypeInDropdown(bedType: string) {
		const existing = newRoomBedTypesArray.find(b => b.bedType === bedType);
		if (existing) {
			newRoomBedTypesArray = newRoomBedTypesArray.filter(b => b.bedType !== bedType);
		} else {
			newRoomBedTypesArray = [...newRoomBedTypesArray, { bedType, quantity: 0 }];
		}
		newRoomBedTypesArray = [...newRoomBedTypesArray];
	}
	
	function getBedQuantity(bedType: string): number {
		return newRoomBedTypesArray.find(b => b.bedType === bedType)?.quantity || 0;
	}
	
	function incrementBedQuantity(bedType: string) {
		const existing = newRoomBedTypesArray.find(b => b.bedType === bedType);
		if (existing) {
			newRoomBedTypesArray = newRoomBedTypesArray.map(b => 
				b.bedType === bedType ? { ...b, quantity: b.quantity + 1 } : b
			);
		} else {
			newRoomBedTypesArray = [...newRoomBedTypesArray, { bedType, quantity: 1 }];
		}
		newRoomBedTypesArray = [...newRoomBedTypesArray];
	}
	
	function decrementBedQuantity(bedType: string) {
		const existing = newRoomBedTypesArray.find(b => b.bedType === bedType);
		if (existing) {
			if (existing.quantity <= 1) {
				newRoomBedTypesArray = newRoomBedTypesArray.filter(b => b.bedType !== bedType);
			} else {
				newRoomBedTypesArray = newRoomBedTypesArray.map(b => 
					b.bedType === bedType ? { ...b, quantity: b.quantity - 1 } : b
				);
			}
			newRoomBedTypesArray = [...newRoomBedTypesArray];
		}
	}
	
	function saveNewRoom() {
		const totalBeds = newRoomBedTypesArray.reduce((sum, b) => sum + b.quantity, 0);
		if (!newRoomType || totalBeds === 0) {
			// Validation: ensure room type is selected
			if (!newRoomType) {
				alert('Please select a room type');
				return;
			}
			if (totalBeds === 0) {
				alert('Please select at least one bed type and set quantity');
				return;
			}
			return;
		}
		
		// Convert bed types array to beds array
		const beds = newRoomBedTypesArray.flatMap(({ bedType, quantity }) => 
			Array.from({ length: quantity }, () => ({
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
	
	function getSelectedBedTypesDisplay(): string {
		const total = newRoomBedTypesArray.reduce((sum, b) => sum + b.quantity, 0);
		if (total === 0) return 'Select bed types...';
		return `${total} bed${total !== 1 ? 's' : ''} selected`;
	}
	
	function editRoom(roomId: string) {
		const room = draft.rooms.find(r => r.id === roomId);
		if (!room) return;
		
		editingRoomId = roomId;
		newRoomType = room.roomType;
		newRoomCustomDesc = room.customRoomDescription || '';
		isBedTypesDropdownOpen = false;
		
		// Convert beds array to bed types array
		const bedTypesMap: Record<string, number> = {};
		room.beds.forEach(bed => {
			bedTypesMap[bed.bedType] = (bedTypesMap[bed.bedType] || 0) + 1;
		});
		newRoomBedTypesArray = Object.entries(bedTypesMap).map(([bedType, quantity]) => ({
			bedType,
			quantity
		}));
	}
	
	function saveEditedRoom() {
		if (!editingRoomId || editingRoomId === 'new') return;
		
		const room = draft.rooms.find(r => r.id === editingRoomId);
		if (!room) return;
		
		room.roomType = newRoomType;
		room.customRoomDescription = newRoomType === 'other' ? newRoomCustomDesc : '';
		
		// Convert bed types array to beds array
		room.beds = newRoomBedTypesArray.flatMap(({ bedType, quantity }) => 
			Array.from({ length: quantity }, () => ({
				id: crypto.randomUUID(),
				bedType,
				count: 1,
				shared: false,
				notes: ''
			}))
		);
		
		autosave();
		editingRoomId = null;
		newRoomBedTypesArray = [];
		newRoomCustomDesc = '';
		isBedTypesDropdownOpen = false;
	}
	
	function removeRoom(roomId: string) {
		draft.rooms = draft.rooms.filter((r) => r.id !== roomId);
		autosave();
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
	<div class="rooms-grid">
		<!-- Add Room Card -->
		{#if editingRoomId === 'new'}
			<div class="room-card add-room-editing">
				<div class="add-room-dropdowns">
					<div class="dropdown-wrapper">
						<select class="room-type-dropdown" bind:value={newRoomType} required>
							<option value="" disabled selected>Room Type</option>
							{#each roomTypeOptions as option}
								<option value={option.value}>{option.label}</option>
							{/each}
						</select>
					</div>
					
					<div class="dropdown-wrapper" bind:this={bedTypesDropdownElement}>
						<button 
							type="button" 
							class="bed-types-dropdown-trigger"
							onclick={(e) => {
								e.preventDefault();
								e.stopPropagation();
								isBedTypesDropdownOpen = !isBedTypesDropdownOpen;
							}}
						>
							<span>{getSelectedBedTypesDisplay()}</span>
							<span class="dropdown-arrow">{isBedTypesDropdownOpen ? '▲' : '▼'}</span>
						</button>
						{#if isBedTypesDropdownOpen}
							<div 
								class="bed-types-dropdown-menu" 
								bind:this={bedTypesDropdownMenu}
								style="top: {dropdownPosition.top}px; left: {dropdownPosition.left}px;"
								onclick={(e) => e.stopPropagation()}
								onmousedown={(e) => e.stopPropagation()}
							>
								{#each bedTypeOptions as bedOption}
									<div class="bed-type-checkbox-row">
										<div class="bed-quantity-controls">
											<button
												type="button"
												class="bed-quantity-btn bed-quantity-up"
												onclick={() => incrementBedQuantity(bedOption.value)}
											>
												↑
											</button>
											<button
												type="button"
												class="bed-quantity-btn bed-quantity-down"
												onclick={() => decrementBedQuantity(bedOption.value)}
												disabled={getBedQuantity(bedOption.value) === 0}
											>
												↓
											</button>
										</div>
										<label class="bed-checkbox-label">
											<input
												type="checkbox"
												checked={getBedQuantity(bedOption.value) > 0}
												onchange={() => toggleBedTypeInDropdown(bedOption.value)}
											/>
											{#if bedOption.iconUrl}
												<img class="bed-icon-img" src={bedOption.iconUrl} alt="" />
											{:else}
												<span class="bed-icon">{bedOption.fallbackIcon}</span>
											{/if}
											<span class="bed-label">{bedOption.label}</span>
											{#if getBedQuantity(bedOption.value) > 0}
												<span class="bed-quantity-display">{getBedQuantity(bedOption.value)}</span>
											{/if}
										</label>
									</div>
								{/each}
							</div>
						{/if}
					</div>
					
					{#if newRoomType === 'other'}
						<input
							type="text"
							class="room-description-input-inline"
							bind:value={newRoomCustomDesc}
							placeholder="Describe the room..."
						/>
					{/if}
					
					<div class="add-room-actions">
						<button type="button" class="btn-save-room-small" onclick={saveNewRoom} disabled={newRoomBedTypesArray.reduce((sum, b) => sum + b.quantity, 0) === 0}>
							Save
						</button>
						<button type="button" class="btn-cancel-room" onclick={cancelAddingRoom}>
							Cancel
						</button>
					</div>
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
				<div class="room-card add-room-editing">
					<div class="add-room-dropdowns">
						<div class="dropdown-wrapper">
							<select class="room-type-dropdown" bind:value={newRoomType} required>
								<option value="" disabled selected={!newRoomType}>Room Type</option>
								{#each roomTypeOptions as option}
									<option value={option.value}>{option.label}</option>
								{/each}
							</select>
						</div>
						
						<div class="dropdown-wrapper" bind:this={bedTypesDropdownElement}>
							<button 
								type="button" 
								class="bed-types-dropdown-trigger"
								onclick={(e) => {
									e.preventDefault();
									e.stopPropagation();
									isBedTypesDropdownOpen = !isBedTypesDropdownOpen;
								}}
							>
								<span>{getSelectedBedTypesDisplay()}</span>
								<span class="dropdown-arrow">{isBedTypesDropdownOpen ? '▲' : '▼'}</span>
							</button>
							{#if isBedTypesDropdownOpen}
								<div 
									class="bed-types-dropdown-menu" 
									bind:this={bedTypesDropdownMenu}
									style="top: {dropdownPosition.top}px; left: {dropdownPosition.left}px;"
									onclick={(e) => e.stopPropagation()}
									onmousedown={(e) => e.stopPropagation()}
								>
									{#each bedTypeOptions as bedOption}
										<div class="bed-type-checkbox-row">
											<div class="bed-quantity-controls">
												<button
													type="button"
													class="bed-quantity-btn bed-quantity-down"
													onclick={() => decrementBedQuantity(bedOption.value)}
													disabled={getBedQuantity(bedOption.value) === 0}
												>
													↓
												</button>
												<button
													type="button"
													class="bed-quantity-btn bed-quantity-up"
													onclick={() => incrementBedQuantity(bedOption.value)}
												>
													↑
												</button>
											</div>
											<label class="bed-checkbox-label">
												<input
													type="checkbox"
													checked={getBedQuantity(bedOption.value) > 0}
													onchange={() => toggleBedTypeInDropdown(bedOption.value)}
												/>
												{#if bedOption.iconUrl}
													<img class="bed-icon-img" src={bedOption.iconUrl} alt="" />
												{:else}
													<span class="bed-icon">{bedOption.fallbackIcon}</span>
												{/if}
												<span class="bed-label">{bedOption.label}</span>
												{#if getBedQuantity(bedOption.value) > 0}
													<span class="bed-quantity-display">{getBedQuantity(bedOption.value)}</span>
												{/if}
											</label>
										</div>
									{/each}
								</div>
							{/if}
						</div>
						
						{#if newRoomType === 'other'}
							<input
								type="text"
								class="room-description-input-inline"
								bind:value={newRoomCustomDesc}
								placeholder="Describe the room..."
							/>
						{/if}
						
						<div class="add-room-actions">
							<button type="button" class="btn-save-room-small" onclick={saveEditedRoom} disabled={newRoomBedTypesArray.reduce((sum, b) => sum + b.quantity, 0) === 0}>
								Save
							</button>
							<button type="button" class="btn-cancel-room" onclick={() => { editingRoomId = null; isBedTypesDropdownOpen = false; }}>
								Cancel
							</button>
						</div>
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
							{@const meta = getBedIconMeta(bed.bedType)}
							<span class="bed-icon-badge" title={meta.alt}>
								{#if meta.url}
									<img class="bed-icon-badge-img" src={meta.url} alt={meta.alt} />
								{:else}
									<span aria-hidden="true">{meta.fallback}</span>
								{/if}
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
		overflow: visible;
	}
	
	.picker-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}
	
	.picker-header h3 {
		font-size: 1rem;
		font-weight: 600;
		color: var(--text);
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
		overflow: visible;
		min-height: 0;
		align-content: start;
	}
	
	.room-card {
		border: 1px solid var(--border);
		border-radius: 0;
		padding: 0.75rem;
		background: #fafafa;
		transition: all 0.2s ease;
		display: flex;
		flex-direction: column;
		min-height: 120px;
	}
	
	.room-card.display {
		cursor: default;
	}
	
	.room-card.display:hover {
		border-color: var(--primary);
		background: #f5f5f5;
	}
	
	.room-card.display.drag-over {
		border-color: var(--primary);
		background: #f0f4ff;
		box-shadow: 0 0 0 2px rgba(30, 58, 138, 0.2);
	}
	
	.add-room-editing {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		min-height: auto;
		position: relative;
		z-index: 100;
		width: 100%;
		overflow: visible;
		box-sizing: border-box;
	}
	
	.add-room-dropdowns {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		width: 100%;
		overflow: visible;
	}
	
	.dropdown-wrapper {
		position: relative;
		width: 100%;
		overflow: visible;
		z-index: 1;
	}
	
	.room-type-dropdown {
		width: 100%;
		padding: 0.5rem 0.75rem;
		border: 1px solid var(--border);
		border-radius: 0;
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--text);
		background: white;
		cursor: pointer;
		appearance: none;
		background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%231e293b' d='M6 9L1 4h10z'/%3E%3C/svg%3E");
		background-repeat: no-repeat;
		background-position: right 0.75rem center;
		padding-right: 2.5rem;
		box-sizing: border-box;
		overflow-x: hidden;
	}
	
	.room-type-dropdown option[value=""][disabled] {
		color: var(--muted);
	}
	
	.room-type-dropdown:invalid {
		color: var(--muted);
	}
	
	.room-type-dropdown:focus {
		outline: none;
		border-color: var(--primary);
		box-shadow: 0 0 0 3px rgba(30, 58, 138, 0.1);
	}
	
	.room-type-dropdown option {
		background: white;
		color: var(--text);
	}
	
	.bed-types-dropdown-trigger {
		width: 100%;
		padding: 0.5rem 0.75rem;
		border: 1px solid var(--border);
		border-radius: 0;
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--text);
		background: white;
		cursor: pointer;
		display: flex;
		justify-content: space-between;
		align-items: center;
		text-align: left;
		box-sizing: border-box;
		overflow-x: hidden;
	}
	
	.bed-types-dropdown-trigger:hover {
		border-color: var(--primary);
		background: #fafafa;
	}
	
	.bed-types-dropdown-trigger:focus {
		outline: none;
		border-color: var(--primary);
		box-shadow: 0 0 0 3px rgba(30, 58, 138, 0.1);
	}
	
	.dropdown-arrow {
		font-size: 0.75rem;
		color: var(--muted);
	}
	
	.bed-types-dropdown-menu {
		position: fixed;
		border: 1px solid #718096;
		background: #1a202c;
		padding: 0.75rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		z-index: 9999;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
		max-height: 300px;
		overflow-y: auto;
		overflow-x: hidden;
		width: max-content;
		min-width: 220px;
		max-width: 220px;
		box-sizing: border-box;
	}
	
	.room-description-input-inline {
		width: 100%;
		padding: 0.5rem 0.75rem;
		border: 1px solid var(--border);
		border-radius: 0;
		font-size: 0.875rem;
		font-weight: 400;
		color: var(--text);
		background: white;
	}
	
	.room-description-input-inline::placeholder {
		color: var(--muted);
	}
	
	.room-description-input-inline:focus {
		outline: none;
		border-color: var(--primary);
		box-shadow: 0 0 0 3px rgba(30, 58, 138, 0.1);
	}
	
	.add-room-actions {
		display: flex;
		gap: 0.5rem;
		margin-top: 0.25rem;
	}
	
	.btn-save-room-small {
		padding: 0.5rem 1rem;
		background: #ffffff;
		color: #2d3748;
		border: none;
		border-radius: 0;
		font-size: 0.8125rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s ease;
		flex: 1;
	}
	
	.btn-save-room-small:hover:not(:disabled) {
		background: #e2e8f0;
	}
	
	.btn-save-room-small:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	
	.btn-cancel-room {
		padding: 0.5rem 1rem;
		background: transparent;
		color: var(--muted);
		border: 1px solid var(--border);
		border-radius: 0;
		font-size: 0.8125rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s ease;
		flex: 1;
	}
	
	.btn-cancel-room:hover {
		border-color: var(--primary);
		color: var(--text);
		background: rgba(30, 58, 138, 0.05);
	}
	
	.add-room-card {
		background: #fafafa;
		border: 1px dashed var(--border);
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
		border-color: var(--primary);
		background: #f5f5f5;
	}
	
	.add-icon {
		font-size: 3.5rem;
		color: var(--muted);
		font-weight: 200;
		line-height: 1;
	}
	
	.add-text {
		font-size: 0.9375rem;
		color: var(--text);
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
		color: var(--text);
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
		color: var(--muted);
		border: 1px solid var(--border);
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
		background: rgba(30, 58, 138, 0.1);
		border-color: var(--primary);
		color: var(--primary);
	}
	
	.btn-close {
		width: 1.5rem;
		height: 1.5rem;
		background: transparent;
		color: var(--muted);
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
		color: var(--text);
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
		color: var(--muted);
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}
	
	.bed-types-multiselect {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		border: 1px solid var(--border);
		padding: 0.75rem;
		background: white;
		position: relative;
		z-index: 1000;
		overflow: visible;
	}
	
	.bed-type-checkbox-row {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.375rem 0;
		width: 100%;
		flex-wrap: nowrap;
		min-width: 0;
	}
	
	.bed-quantity-controls {
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
		flex-shrink: 0;
	}
	
	.bed-quantity-btn {
		width: 1.5rem;
		height: 1.25rem;
		padding: 0;
		border: 1px solid var(--border);
		background: white;
		color: var(--text);
		cursor: pointer;
		font-size: 0.75rem;
		line-height: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.2s ease;
		flex-shrink: 0;
	}
	
	.bed-quantity-btn:hover:not(:disabled) {
		background: #f5f5f5;
		border-color: var(--primary);
		color: var(--primary);
	}
	
	.bed-quantity-btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}
	
	.bed-checkbox-label {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		cursor: pointer;
		flex: 1;
		color: var(--text);
		font-size: 0.875rem;
		min-width: 0;
		flex-shrink: 1;
		overflow: visible;
	}
	
	.bed-checkbox-label .bed-label {
		white-space: nowrap;
		flex: 1;
	}
	
	.bed-quantity-display {
		font-weight: 600;
		color: var(--text);
		margin-left: auto;
		flex-shrink: 0;
	}
	
	.bed-checkbox-label input[type="checkbox"] {
		width: 1.125rem;
		height: 1.125rem;
		cursor: pointer;
		accent-color: var(--primary);
	}
	
	.bed-icon {
		font-size: 1rem;
	}
	
	.bed-icon-img {
		width: 16px;
		height: 16px;
		object-fit: contain;
		flex-shrink: 0;
	}
	
	.bed-label {
		font-weight: 500;
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
		border: 1px solid var(--border);
		cursor: move;
		transition: all 0.2s ease;
	}
	
	.room-photo-thumbnail:hover {
		border-color: var(--primary);
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
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 22px;
		height: 22px;
		line-height: 1;
	}
	
	.bed-icon-badge-img {
		width: 18px;
		height: 18px;
		object-fit: contain;
	}
	
	.no-beds {
		font-size: 0.75rem;
		color: var(--muted);
		font-style: italic;
	}
	
	.empty-state {
		text-align: center;
		padding: 2rem;
		color: var(--muted);
		font-size: 0.9375rem;
	}
	
	.gallery-section {
		border-top: 1px solid var(--border);
		padding-top: 1rem;
		margin-top: 1rem;
	}
	
	.gallery-header {
		margin-bottom: 0.75rem;
	}
	
	.gallery-header h4 {
		font-size: 0.9375rem;
		font-weight: 600;
		color: var(--text);
		margin: 0 0 0.25rem 0;
	}
	
	.gallery-description {
		font-size: 0.75rem;
		color: var(--muted);
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
		border: 2px solid var(--border);
		cursor: move;
		transition: all 0.2s ease;
	}
	
	.gallery-photo-item:hover {
		border-color: var(--primary);
		transform: scale(1.05);
		box-shadow: 0 0 0 2px rgba(30, 58, 138, 0.2);
	}
	
	.gallery-photo-item img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	
	.gallery-photo-item .remove-photo-btn {
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
		z-index: 10;
	}
	
	.gallery-photo-item:hover .remove-photo-btn {
		opacity: 1;
	}
	
	.gallery-photo-item .remove-photo-btn:hover {
		background: rgba(239, 68, 68, 0.9);
	}
	
	.gallery-upload-tile {
		aspect-ratio: 1;
		border: 2px dashed var(--border);
		border-radius: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		transition: all 0.2s ease;
		background: #fafafa;
		gap: 0.5rem;
		min-height: 120px;
	}
	
	.gallery-upload-tile:hover {
		border-color: var(--primary);
		background: #f5f5f5;
	}
	
	.upload-icon {
		font-size: 1.5rem;
		color: var(--muted);
	}
	
	.upload-text {
		font-size: 0.8125rem;
		color: var(--muted);
		font-weight: 500;
	}
</style>
