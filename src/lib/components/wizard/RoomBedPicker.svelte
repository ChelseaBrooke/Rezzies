<script lang="ts">
	import type { TripDraft } from '$lib/stores/tripDraft.js';
	
	let { draft, autosave }: { draft: TripDraft; autosave: () => void } = $props();
	
	let draggedPhoto: { url: string } | null = $state(null);
	let draggedOverRoomId: string | null = $state(null);
	
	function addRoom() {
		draft.rooms = [
			...draft.rooms,
			{
				id: crypto.randomUUID(),
				name: '',
				type: 'private',
				maxOccupants: 2,
				notes: '',
				photos: [],
				beds: []
			}
		];
		autosave();
	}
	
	function removeRoom(roomId: string) {
		draft.rooms = draft.rooms.filter((r) => r.id !== roomId);
		autosave();
	}
	
	function addBed(roomId: string) {
		const room = draft.rooms.find((r) => r.id === roomId);
		if (!room) return;
		room.beds = [
			...room.beds,
			{
				id: crypto.randomUUID(),
				bedType: 'queen',
				count: 1,
				shared: false,
				notes: ''
			}
		];
		autosave();
	}
	
	function removeBed(roomId: string, bedId: string) {
		const room = draft.rooms.find((r) => r.id === roomId);
		if (!room) return;
		room.beds = room.beds.filter((b) => b.id !== bedId);
		autosave();
	}
	
	function handlePhotoUpload(event: Event, roomId: string) {
		const input = event.target as HTMLInputElement;
		const files = input.files;
		if (!files || files.length === 0) return;
		
		const room = draft.rooms.find((r) => r.id === roomId);
		if (!room) return;
		
		Array.from(files).forEach((file) => {
			const reader = new FileReader();
			reader.onload = (e) => {
				room.photos = [...room.photos, e.target?.result as string];
				autosave();
			};
			reader.readAsDataURL(file);
		});
	}
	
	function removePhoto(roomId: string, photoIndex: number) {
		const room = draft.rooms.find((r) => r.id === roomId);
		if (!room) return;
		room.photos = room.photos.filter((_, i) => i !== photoIndex);
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
				room.photos = [...room.photos, draggedPhoto.url];
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
		<button type="button" class="btn-add-room" onclick={addRoom}>
			+ Add Room
		</button>
	</div>
	
	<div class="rooms-container">
		{#each draft.rooms as room}
			<div class="room-card" class:drag-over={draggedOverRoomId === room.id}>
				<div class="room-header">
					<input
						type="text"
						class="room-name-input"
						bind:value={room.name}
						oninput={autosave}
						placeholder="Room name (e.g., Master Bedroom)"
					/>
					<button type="button" class="btn-remove" onclick={() => removeRoom(room.id)}>
						×
					</button>
				</div>
				
				<!-- Room Photos -->
				<div class="room-photos-section">
					<div class="photos-grid">
						{#each room.photos as photo, photoIndex}
							<div
								class="photo-item"
								draggable="true"
								ondragstart={(e) => handleDragStart(e, photo)}
								ondragend={handleDragEnd}
							>
								<img src={photo} alt="Room photo" />
								<button
									type="button"
									class="remove-photo-btn"
									onclick={() => removePhoto(room.id, photoIndex)}
								>
									×
								</button>
							</div>
						{/each}
						<label class="photo-upload-tile" ondrop={(e) => handleDrop(e, room.id)} ondragover={(e) => handleDragOver(e, room.id)}>
							<input
								type="file"
								accept="image/*"
								multiple
								onchange={(e) => handlePhotoUpload(e, room.id)}
								style="display: none;"
							/>
							<span class="upload-icon">📷</span>
							<span class="upload-text">Add Photos</span>
						</label>
					</div>
				</div>
				
				<!-- Beds -->
				<div class="beds-section">
					<div class="beds-list">
						{#each room.beds as bed}
							<div class="bed-item">
								<select bind:value={bed.bedType} onchange={autosave}>
									<option value="king">King</option>
									<option value="queen">Queen</option>
									<option value="twin">Twin</option>
									<option value="bunk">Bunk</option>
									<option value="sofa">Sofa Bed</option>
								</select>
								<button
									type="button"
									class="btn-remove-small"
									onclick={() => removeBed(room.id, bed.id)}
								>
									×
								</button>
							</div>
						{/each}
						<button type="button" class="btn-add-bed" onclick={() => addBed(room.id)}>
							+ Add Bed
						</button>
					</div>
				</div>
			</div>
		{:else}
			<div class="empty-state">
				<p>No rooms added yet. Click "Add Room" to get started.</p>
			</div>
		{/each}
	</div>
</div>

<style>
	.room-bed-picker {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
		height: 100%;
	}
	
	.picker-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}
	
	.picker-header h3 {
		font-size: 1.25rem;
		font-weight: 600;
		color: var(--text);
		margin: 0;
	}
	
	.btn-add-room {
		padding: 0.5rem 1rem;
		background: var(--primary);
		color: white;
		border: none;
		border-radius: 0.5rem;
		font-size: 0.875rem;
		font-weight: 500;
		cursor: pointer;
		transition: background 0.2s ease;
	}
	
	.btn-add-room:hover {
		background: var(--primary-dark);
	}
	
	.rooms-container {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		max-height: 500px;
		overflow-y: auto;
	}
	
	.room-card {
		border: 1px solid var(--border);
		border-radius: 0.75rem;
		padding: 1rem;
		background: #fafafa;
		transition: all 0.2s ease;
	}
	
	.room-card.drag-over {
		border-color: var(--primary);
		background: rgba(30, 58, 138, 0.05);
	}
	
	.room-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1rem;
		gap: 0.5rem;
	}
	
	.room-name-input {
		flex: 1;
		padding: 0.5rem 0.75rem;
		border: 1px solid var(--border);
		border-radius: 0.5rem;
		font-size: 0.9375rem;
		font-weight: 500;
		color: var(--text);
		background: white;
	}
	
	.room-name-input:focus {
		outline: none;
		border-color: var(--primary);
		box-shadow: 0 0 0 3px rgba(30, 58, 138, 0.1);
	}
	
	.btn-remove {
		width: 1.75rem;
		height: 1.75rem;
		background: transparent;
		color: var(--muted);
		border: 1px solid var(--border);
		border-radius: 0.375rem;
		cursor: pointer;
		font-size: 1.25rem;
		line-height: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.2s ease;
	}
	
	.btn-remove:hover {
		background: #ef4444;
		color: white;
		border-color: #ef4444;
	}
	
	.room-photos-section {
		margin-bottom: 1rem;
	}
	
	.photos-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
		gap: 0.5rem;
	}
	
	.photo-item {
		position: relative;
		aspect-ratio: 1;
		border-radius: 0.5rem;
		overflow: hidden;
		border: 2px solid var(--border);
		cursor: move;
		transition: all 0.2s ease;
	}
	
	.photo-item:hover {
		border-color: var(--primary);
		transform: scale(1.05);
	}
	
	.photo-item img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	
	.remove-photo-btn {
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
	}
	
	.photo-item:hover .remove-photo-btn {
		opacity: 1;
	}
	
	.photo-upload-tile {
		aspect-ratio: 1;
		border: 2px dashed var(--border);
		border-radius: 0.5rem;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		transition: all 0.2s ease;
		background: white;
	}
	
	.photo-upload-tile:hover {
		border-color: var(--primary);
		background: rgba(30, 58, 138, 0.02);
	}
	
	.upload-icon {
		font-size: 1.5rem;
		margin-bottom: 0.25rem;
	}
	
	.upload-text {
		font-size: 0.75rem;
		color: var(--muted);
	}
	
	.beds-section {
		margin-top: 1rem;
	}
	
	.beds-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	
	.bed-item {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 0.5rem;
		align-items: center;
		padding: 0.5rem;
		background: white;
		border: 1px solid var(--border);
		border-radius: 0.5rem;
	}
	
	.bed-item select {
		padding: 0.5rem 0.75rem;
		border: 1px solid var(--border);
		border-radius: 0.375rem;
		font-size: 0.875rem;
		background: white;
		color: var(--text);
		cursor: pointer;
	}
	
	.btn-remove-small {
		width: 1.5rem;
		height: 1.5rem;
		background: transparent;
		color: var(--muted);
		border: 1px solid var(--border);
		border-radius: 0.375rem;
		cursor: pointer;
		font-size: 1rem;
		line-height: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.2s ease;
	}
	
	.btn-remove-small:hover {
		background: #ef4444;
		color: white;
		border-color: #ef4444;
	}
	
	.btn-add-bed {
		padding: 0.5rem;
		background: transparent;
		color: var(--primary);
		border: 1px dashed var(--primary);
		border-radius: 0.5rem;
		cursor: pointer;
		font-size: 0.875rem;
		font-weight: 500;
		transition: all 0.2s ease;
	}
	
	.btn-add-bed:hover {
		background: rgba(30, 58, 138, 0.05);
		border-style: solid;
	}
	
	.empty-state {
		text-align: center;
		padding: 2rem;
		color: var(--muted);
		font-size: 0.9375rem;
	}
</style>
