<script lang="ts">
	import { goto } from '$app/navigation';
	
	interface Props {
		formData: any;
		nextStep: () => void;
		prevStep: () => void;
	}
	
	let { formData, nextStep, prevStep }: Props = $props();
	
	type BedType = 'KING' | 'QUEEN' | 'TWIN' | 'BUNK' | 'SOFA_BED' | 'CUSTOM';
	type RoomType = 'PRIVATE' | 'SHARED' | 'COMMON';
	
	interface Bed {
		id: string;
		bedType: BedType;
		customType?: string;
		quantity: number;
	}
	
	interface Room {
		id: string;
		name: string;
		roomType: RoomType;
		maxOccupants: number;
		photos: string[];
		beds: Bed[];
	}
	
	if (!formData.rooms || formData.rooms.length === 0) {
		formData.rooms = [];
	}
	
	function addRoom() {
		const newRoom: Room = {
			id: crypto.randomUUID(),
			name: '',
			roomType: 'PRIVATE',
			maxOccupants: 2,
			photos: [],
			beds: []
		};
		formData.rooms = [...formData.rooms, newRoom];
	}
	
	function removeRoom(roomId: string) {
		formData.rooms = formData.rooms.filter((r: Room) => r.id !== roomId);
	}
	
	function addBed(roomId: string) {
		formData.rooms = formData.rooms.map((room: Room) => {
			if (room.id === roomId) {
				return {
					...room,
					beds: [
						...room.beds,
						{
							id: crypto.randomUUID(),
							bedType: 'QUEEN',
							quantity: 1
						}
					]
				};
			}
			return room;
		});
	}
	
	function removeBed(roomId: string, bedId: string) {
		formData.rooms = formData.rooms.map((room: Room) => {
			if (room.id === roomId) {
				return {
					...room,
					beds: room.beds.filter((b: Bed) => b.id !== bedId)
				};
			}
			return room;
		});
	}
	
	function addPhotoToRoom(roomId: string, photoUrl: string) {
		if (!photoUrl.trim()) return;
		formData.rooms = formData.rooms.map((room: Room) => {
			if (room.id === roomId) {
				return {
					...room,
					photos: [...room.photos, photoUrl.trim()]
				};
			}
			return room;
		});
	}
	
	function removePhotoFromRoom(roomId: string, photoIndex: number) {
		formData.rooms = formData.rooms.map((room: Room) => {
			if (room.id === roomId) {
				return {
					...room,
					photos: room.photos.filter((_: string, i: number) => i !== photoIndex)
				};
			}
			return room;
		});
	}
	
	const bedTypeOptions: { value: BedType; label: string }[] = [
		{ value: 'KING', label: 'King' },
		{ value: 'QUEEN', label: 'Queen' },
		{ value: 'TWIN', label: 'Twin' },
		{ value: 'BUNK', label: 'Bunk' },
		{ value: 'SOFA_BED', label: 'Sofa Bed' },
		{ value: 'CUSTOM', label: 'Custom' }
	];
	
	const roomTypeOptions: { value: RoomType; label: string }[] = [
		{ value: 'PRIVATE', label: 'Private' },
		{ value: 'SHARED', label: 'Shared' },
		{ value: 'COMMON', label: 'Common Area' }
	];
</script>

<div class="step-content">
	<h1 class="step-title">Rooms & Beds</h1>
	
	{#if formData.rooms.length === 0}
		<p class="empty-state-text">Add your first room to get started</p>
	{/if}
	
	<div class="rooms-list">
		{#each formData.rooms as room (room.id)}
			<div class="room-card">
				<div class="room-header">
					<div class="room-title-group">
						<input
							type="text"
							class="room-name-input"
							placeholder="Room name (e.g., Master Bedroom)"
							bind:value={room.name}
							required
						/>
						<select bind:value={room.roomType} class="room-type-select">
							{#each roomTypeOptions as option}
								<option value={option.value}>{option.label}</option>
							{/each}
						</select>
					</div>
					<button
						type="button"
						class="remove-room-btn"
						onclick={() => removeRoom(room.id)}
					>
						×
					</button>
				</div>
				
				<div class="room-details">
					<div class="form-group">
						<label>Max Occupants</label>
						<input
							type="number"
							bind:value={room.maxOccupants}
							min="1"
							class="small-input"
						/>
					</div>
					
					<!-- Photos -->
					<div class="photos-section">
						<label>Photos</label>
						<div class="photos-grid">
							{#each room.photos as photo, photoIdx}
								<div class="photo-thumbnail">
									<img src={photo} alt="Room photo" />
									<button
										type="button"
										class="remove-photo-btn"
										onclick={() => removePhotoFromRoom(room.id, photoIdx)}
									>
										×
									</button>
								</div>
							{/each}
							<div class="add-photo-input">
								<input
									type="text"
									placeholder="Paste photo URL"
									class="photo-url-input"
									onkeydown={(e) => {
										if (e.key === 'Enter') {
											const input = e.target as HTMLInputElement;
											if (input.value.trim()) {
												addPhotoToRoom(room.id, input.value);
												input.value = '';
											}
										}
									}}
								/>
							</div>
						</div>
					</div>
					
					<!-- Beds -->
					<div class="beds-section">
						<div class="beds-header">
							<label>Beds</label>
							<button
								type="button"
								class="btn btn-secondary btn-small"
								onclick={() => addBed(room.id)}
							>
								+ Add Bed
							</button>
						</div>
						
						<div class="beds-list">
							{#each room.beds as bed (bed.id)}
								<div class="bed-row">
									<select bind:value={bed.bedType} class="bed-type-select">
										{#each bedTypeOptions as option}
											<option value={option.value}>{option.label}</option>
										{/each}
									</select>
									{#if bed.bedType === 'CUSTOM'}
										<input
											type="text"
											placeholder="Custom bed type"
											bind:value={bed.customType}
											class="custom-bed-input"
										/>
									{/if}
									<input
										type="number"
										bind:value={bed.quantity}
										min="1"
										class="quantity-input"
										placeholder="Qty"
									/>
									<button
										type="button"
										class="remove-bed-btn"
										onclick={() => removeBed(room.id, bed.id)}
									>
										×
									</button>
								</div>
							{/each}
							{#if room.beds.length === 0}
								<p class="empty-beds">No beds added yet. Click "Add Bed" to get started.</p>
							{/if}
						</div>
					</div>
				</div>
			</div>
		{/each}
		
		<button
			type="button"
			class="add-room-btn"
			onclick={addRoom}
		>
			+ Add Room
		</button>
	</div>
	
	<div class="step-actions">
		<button type="button" class="btn-secondary" onclick={prevStep}>
			Back
		</button>
		<button
			type="button"
			class="btn-primary"
			onclick={nextStep}
			disabled={formData.rooms.length === 0 || formData.rooms.some((r: Room) => !r.name || r.beds.length === 0)}
		>
			Continue
		</button>
	</div>
</div>

<style>
	.step-title {
		font-size: 3rem;
		font-weight: 700;
		margin-bottom: 3rem;
		color: #000;
		letter-spacing: -0.02em;
		line-height: 1.1;
	}
	
	.empty-state-text {
		color: rgba(0, 0, 0, 0.5);
		font-size: 1rem;
		margin-bottom: 2rem;
	}
	
	.rooms-list {
		display: flex;
		flex-direction: column;
		gap: 0;
		margin-bottom: 2rem;
	}
	
	.room-card {
		background: rgba(255, 255, 255, 0.6);
		border: none;
		border-bottom: 1px solid rgba(0, 0, 0, 0.1);
		border-radius: 0;
		padding: 2.5rem 0;
		margin-bottom: 2rem;
	}
	
	.room-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: 2rem;
		gap: var(--spacing-md);
	}
	
	.room-title-group {
		flex: 1;
		display: flex;
		gap: var(--spacing-md);
		align-items: center;
	}
	
	.room-name-input {
		flex: 2;
		min-width: 200px;
		padding: 0.75rem 0;
		border: none;
		border-bottom: 1px solid rgba(0, 0, 0, 0.1);
		font-size: 1.125rem;
		font-weight: 600;
		font-family: inherit;
		background: transparent;
		color: #000;
	}
	
	.room-name-input:focus {
		outline: none;
		border-bottom-color: #000;
	}
	
	.room-name-input::placeholder {
		color: rgba(0, 0, 0, 0.3);
		font-weight: 400;
	}
	
	.room-type-select {
		padding: 0.75rem 0.5rem;
		border: none;
		border-bottom: 1px solid rgba(0, 0, 0, 0.1);
		font-family: inherit;
		background: transparent;
		font-size: 1rem;
		color: #000;
		cursor: pointer;
		min-width: 120px;
	}
	
	.room-type-select:focus {
		outline: none;
		border-bottom-color: #000;
	}
	
	.remove-room-btn {
		width: 28px;
		height: 28px;
		border-radius: 50%;
		background: rgba(0, 0, 0, 0.1);
		color: rgba(0, 0, 0, 0.6);
		border: none;
		font-size: 1.25rem;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		line-height: 1;
		transition: all 0.2s ease;
	}
	
	.remove-room-btn:hover {
		background: rgba(0, 0, 0, 0.15);
		color: rgba(0, 0, 0, 0.8);
	}
	
	.room-details {
		display: flex;
		flex-direction: column;
		gap: 2rem;
	}
	
	.small-input {
		width: 100px;
		padding: 0.75rem 0;
		border: none;
		border-bottom: 1px solid rgba(0, 0, 0, 0.1);
		font-family: inherit;
		background: transparent;
		font-size: 1rem;
	}
	
	.small-input:focus {
		outline: none;
		border-bottom-color: #000;
	}
	
	.photos-section {
		margin-top: 1.5rem;
	}
	
	.photos-section label {
		display: block;
		margin-bottom: var(--spacing-sm);
		font-weight: 400;
		font-size: 0.875rem;
		color: rgba(0, 0, 0, 0.5);
	}
	
	.photos-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
		gap: var(--spacing-md);
	}
	
	.photo-thumbnail {
		position: relative;
		aspect-ratio: 1;
		border-radius: 8px;
		overflow: hidden;
		border: 1px solid rgba(0, 0, 0, 0.1);
	}
	
	.photo-thumbnail img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	
	.remove-photo-btn {
		position: absolute;
		top: 4px;
		right: 4px;
		width: 24px;
		height: 24px;
		border-radius: 50%;
		background: rgba(0, 0, 0, 0.7);
		color: white;
		border: none;
		cursor: pointer;
		font-size: 1rem;
		line-height: 1;
	}
	
	.add-photo-input {
		aspect-ratio: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		border: 1px dashed rgba(0, 0, 0, 0.2);
		border-radius: 8px;
		background: rgba(255, 255, 255, 0.5);
	}
	
	.photo-url-input {
		width: 100%;
		padding: var(--spacing-sm);
		border: none;
		font-size: 0.875rem;
		text-align: center;
	}
	
	.photo-url-input:focus {
		outline: none;
	}
	
	.beds-section {
		margin-top: 1.5rem;
	}
	
	.beds-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1rem;
	}
	
	.btn-small {
		padding: 0.5rem 1rem;
		font-size: 0.875rem;
		background: transparent;
		border: 1px solid rgba(0, 0, 0, 0.2);
		border-radius: 6px;
		color: rgba(0, 0, 0, 0.7);
		cursor: pointer;
		font-weight: 500;
		transition: all 0.2s ease;
	}
	
	.btn-small:hover {
		border-color: rgba(0, 0, 0, 0.4);
		color: rgba(0, 0, 0, 0.9);
	}
	
	.beds-header label {
		font-weight: 400;
		font-size: 0.875rem;
		color: rgba(0, 0, 0, 0.5);
		margin: 0;
	}
	
	.beds-list {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-sm);
	}
	
	.bed-row {
		display: flex;
		gap: var(--spacing-md);
		align-items: center;
		padding: 1rem 0;
		background: transparent;
		border: none;
		border-bottom: 1px solid rgba(0, 0, 0, 0.08);
	}
	
	.bed-type-select {
		flex: 1;
		padding: 0.75rem 0.5rem;
		border: none;
		border-bottom: 1px solid rgba(0, 0, 0, 0.1);
		font-family: inherit;
		background: transparent;
		font-size: 1rem;
		color: #000;
		cursor: pointer;
	}
	
	.bed-type-select:focus {
		outline: none;
		border-bottom-color: #000;
	}
	
	.custom-bed-input {
		flex: 1;
		padding: 0.75rem 0;
		border: none;
		border-bottom: 1px solid rgba(0, 0, 0, 0.1);
		font-family: inherit;
		background: transparent;
		font-size: 1rem;
	}
	
	.custom-bed-input:focus {
		outline: none;
		border-bottom-color: #000;
	}
	
	.quantity-input {
		width: 80px;
		padding: 0.75rem 0;
		border: none;
		border-bottom: 1px solid rgba(0, 0, 0, 0.1);
		font-family: inherit;
		text-align: center;
		background: transparent;
		font-size: 1rem;
	}
	
	.quantity-input:focus {
		outline: none;
		border-bottom-color: #000;
	}
	
	.remove-bed-btn {
		width: 24px;
		height: 24px;
		border-radius: 50%;
		background: rgba(0, 0, 0, 0.1);
		color: rgba(0, 0, 0, 0.6);
		border: none;
		cursor: pointer;
		font-size: 1rem;
		line-height: 1;
		transition: all 0.2s ease;
	}
	
	.remove-bed-btn:hover {
		background: rgba(0, 0, 0, 0.15);
		color: rgba(0, 0, 0, 0.8);
	}
	
	.empty-beds {
		color: rgba(0, 0, 0, 0.4);
		font-style: italic;
		padding: var(--spacing-md);
		text-align: center;
		font-size: 0.95rem;
	}
	
	.add-room-btn {
		width: 100%;
		margin-top: var(--spacing-lg);
		padding: 1rem 2rem;
		background: transparent;
		border: 1px solid rgba(0, 0, 0, 0.2);
		border-radius: 8px;
		color: rgba(0, 0, 0, 0.7);
		font-size: 1rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s ease;
	}
	
	.add-room-btn:hover {
		border-color: rgba(0, 0, 0, 0.4);
		color: rgba(0, 0, 0, 0.9);
		background: rgba(0, 0, 0, 0.02);
	}
</style>
