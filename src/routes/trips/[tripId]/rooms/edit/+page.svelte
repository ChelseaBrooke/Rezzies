<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const tripId = data.trip?.id ?? '';
	const rooms = $derived(data.rooms ?? []);
	const isHost = data.isHost ?? false;

	const bedTypeOptions = [
		{ value: 'king', label: 'King' },
		{ value: 'queen', label: 'Queen' },
		{ value: 'twin', label: 'Twin' },
		{ value: 'bunk', label: 'Bunk' },
		{ value: 'sofa_bed', label: 'Sofa Bed' },
		{ value: 'full', label: 'Full' },
		{ value: 'other', label: 'Other' }
	];

	let roomPhotoUploading = $state(false);
	let pendingUploadRoomId = $state<number | null>(null);
	let uploadingRoomId = $state<number | null>(null);
	let photoUrlInput = $state<Record<number, string>>({});

	async function addRoom() {
		const res = await fetch(`/api/trips/${tripId}/rooms`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ name: 'New Room', maxOccupancy: 2, photoUrls: [] })
		});
		if (res.ok) await invalidateAll();
	}

	async function removeRoom(roomId: number) {
		if (!confirm('Remove this room? Bed assignments for this room will be cleared.')) return;
		const res = await fetch(`/api/trips/${tripId}/rooms/${roomId}`, { method: 'DELETE' });
		if (res.ok) await invalidateAll();
	}

	async function updateRoom(roomId: number, updates: { name?: string; maxOccupancy?: number | null; photoUrls?: string[] }) {
		const res = await fetch(`/api/trips/${tripId}/rooms/${roomId}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(updates)
		});
		if (res.ok) await invalidateAll();
	}

	function startRoomPhotoUpload(roomId: number) {
		pendingUploadRoomId = roomId;
		document.getElementById('room-photo-file-input')?.click();
	}

	async function handleRoomPhotoUpload(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		const roomId = pendingUploadRoomId;
		pendingUploadRoomId = null;
		input.value = '';
		if (!file || roomId == null) return;
		roomPhotoUploading = true;
		uploadingRoomId = roomId;
		try {
			const fd = new FormData();
			fd.set('file', file);
			const res = await fetch('/api/upload-image', { method: 'POST', body: fd });
			const json = await res.json();
			if (res.ok && json.url) {
				const room = rooms.find((r) => r.id === roomId);
				const urls = [...(room?.photoUrls ?? []), json.url];
				await updateRoom(roomId, { photoUrls: urls });
			}
		} finally {
			roomPhotoUploading = false;
			uploadingRoomId = null;
		}
	}

	function removePhotoFromRoom(roomId: number, photoIndex: number) {
		const room = rooms.find((r) => r.id === roomId);
		if (!room) return;
		const urls = (room.photoUrls ?? []).filter((_, i) => i !== photoIndex);
		updateRoom(roomId, { photoUrls: urls });
	}

	function addPhotoUrl(roomId: number) {
		const url = (photoUrlInput[roomId] ?? '').trim();
		if (!url) return;
		const room = rooms.find((r) => r.id === roomId);
		const urls = [...(room?.photoUrls ?? []), url];
		photoUrlInput = { ...photoUrlInput, [roomId]: '' };
		updateRoom(roomId, { photoUrls: urls });
	}

	async function addBed(roomId: number) {
		const res = await fetch(`/api/trips/${tripId}/rooms/${roomId}/beds`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ bedType: 'queen' })
		});
		if (res.ok) await invalidateAll();
	}

	async function removeBed(bedId: string) {
		const res = await fetch(`/api/trips/${tripId}/beds/${bedId}`, { method: 'DELETE' });
		if (res.ok) await invalidateAll();
	}

	async function updateBedType(bedId: string, bedType: string) {
		const normalized = bedType.toLowerCase().replace(/\s+/g, '_');
		const res = await fetch(`/api/trips/${tripId}/beds/${bedId}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ bedType: normalized })
		});
		if (res.ok) await invalidateAll();
	}
</script>

<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" class="room-photo-file-input" id="room-photo-file-input" onchange={handleRoomPhotoUpload} />

<div class="page">
	<div class="page-header">
		<a href="/trips/{tripId}/rooms" class="back-link">← Rooms & Beds</a>
		<h1 class="page-title">Manage rooms & beds</h1>
	</div>

	<div class="rooms-list">
		{#each rooms as room (room.id)}
			<div class="room-card">
				<header class="room-header">
					<input
						type="text"
						class="room-name-input"
						placeholder="Room name"
						value={room.name}
						onblur={(e) => {
							const v = (e.currentTarget as HTMLInputElement).value.trim();
							if (v && v !== room.name) updateRoom(room.id, { name: v });
						}}
					/>
					<input
						type="number"
						value={room.maxOccupancy ?? ''}
						min="1"
						class="max-occupants-input"
						placeholder="Max"
						title="Max occupants"
						onchange={(e) => {
							const v = (e.currentTarget as HTMLInputElement).value;
							const n = v === '' ? null : parseInt(v, 10);
							if (n != null && n > 0 && n !== room.maxOccupancy) updateRoom(room.id, { maxOccupancy: n });
						}}
					/>
					<button type="button" class="remove-room-btn" onclick={() => removeRoom(room.id)} title="Remove room">×</button>
				</header>
				<div class="room-body">
					<div class="photos-block">
						<label class="block-label">Photos</label>
						<div class="photos-grid">
							{#each (room.photoUrls ?? []) as photo, photoIdx}
								<div class="photo-thumbnail">
									<img src={photo} alt="" />
									<button type="button" class="remove-photo-btn" onclick={() => removePhotoFromRoom(room.id, photoIdx)}>×</button>
								</div>
							{/each}
							<div class="add-photo-cell">
								<button type="button" class="upload-btn" onclick={() => startRoomPhotoUpload(room.id)} disabled={roomPhotoUploading}>
									{roomPhotoUploading && uploadingRoomId === room.id ? '…' : '+ Photo'}
								</button>
								<input
									type="text"
									placeholder="Or paste URL"
									class="photo-url-input"
									value={photoUrlInput[room.id] ?? ''}
									oninput={(e) => { photoUrlInput = { ...photoUrlInput, [room.id]: (e.currentTarget as HTMLInputElement).value }; }}
									onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addPhotoUrl(room.id); } }}
								/>
							</div>
						</div>
					</div>
					<div class="beds-block">
						<div class="beds-block-header">
							<span class="block-label">Beds</span>
							<button type="button" class="add-bed-btn" onclick={() => addBed(room.id)}>+ Bed</button>
						</div>
						<div class="beds-chips">
							{#each (room.beds ?? []) as bed (bed.id)}
								<div class="bed-chip">
									<select
										class="bed-type-select"
										value={bed.bedType}
										onchange={(e) => { const v = (e.currentTarget as HTMLSelectElement).value; if (v !== bed.bedType) updateBedType(bed.id, v); }}
									>
										{#each bedTypeOptions as option}
											<option value={option.value}>{option.label}</option>
										{/each}
									</select>
									<button type="button" class="chip-remove" onclick={() => removeBed(bed.id)}>×</button>
								</div>
							{/each}
							{#if (room.beds ?? []).length === 0}
								<span class="no-beds">None</span>
							{/if}
						</div>
					</div>
				</div>
			</div>
		{/each}
		<button type="button" class="add-room-card" onclick={addRoom}>
			<span class="add-room-icon">+</span>
			<span>Add Room</span>
		</button>
	</div>
</div>

<style>
	.page { padding: 0; }
	.page-header { margin-bottom: 1.25rem; }
	.back-link { font-size: 0.875rem; color: var(--primary); text-decoration: none; display: inline-block; margin-bottom: 0.25rem; }
	.back-link:hover { text-decoration: underline; }
	.page-title { font-size: 1.25rem; font-weight: 600; margin: 0; color: var(--text); }
	.rooms-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 1.25rem; }
	.room-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); overflow: hidden; padding: 1rem; }
	.room-header { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 1rem; flex-wrap: wrap; }
	.room-name-input { flex: 1; min-width: 0; padding: 0.35rem 0; border: none; border-bottom: 1px solid var(--border); font-size: 1rem; font-weight: 600; background: transparent; color: var(--text); }
	.room-name-input:focus { outline: none; border-bottom-color: var(--primary); }
	.max-occupants-input { width: 3rem; padding: 0.35rem; border: 1px solid var(--border); border-radius: var(--radius-sm); font-size: 0.8125rem; text-align: center; background: var(--surface2); color: var(--text); }
	.remove-room-btn { width: 1.75rem; height: 1.75rem; border-radius: 50%; background: var(--surface2); color: var(--muted); border: none; cursor: pointer; font-size: 1.1rem; line-height: 1; }
	.remove-room-btn:hover { background: var(--error, #b91c1c); color: white; }
	.room-body { display: flex; flex-direction: column; gap: 1rem; }
	.block-label { font-size: 0.8125rem; font-weight: 500; color: var(--muted); margin-bottom: 0.5rem; display: block; }
	.photos-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(88px, 1fr)); gap: 0.5rem; }
	.photo-thumbnail { position: relative; aspect-ratio: 1; border-radius: var(--radius-md); overflow: hidden; background: var(--surface2); }
	.photo-thumbnail img { width: 100%; height: 100%; object-fit: cover; }
	.remove-photo-btn { position: absolute; top: 2px; right: 2px; width: 20px; height: 20px; border-radius: 50%; background: rgba(0,0,0,0.65); color: white; border: none; cursor: pointer; font-size: 0.9rem; line-height: 1; }
	.room-photo-file-input { position: absolute; width: 0.1px; height: 0.1px; opacity: 0; overflow: hidden; z-index: -1; }
	.add-photo-cell { aspect-ratio: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.35rem; border: 1px dashed var(--border); border-radius: var(--radius-md); background: var(--surface2); padding: 0.5rem; min-height: 88px; }
	.upload-btn { padding: 0.35rem 0.6rem; background: var(--primary); color: white; border: none; border-radius: var(--radius-sm); font-size: 0.75rem; font-weight: 500; cursor: pointer; }
	.upload-btn:disabled { opacity: 0.6; cursor: not-allowed; }
	.photo-url-input { width: 100%; padding: 0.2rem 0.35rem; border: none; border-bottom: 1px solid var(--border); font-size: 0.7rem; background: transparent; color: var(--text); }
	.beds-block-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; }
	.add-bed-btn { padding: 0.25rem 0.5rem; font-size: 0.75rem; border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--surface2); color: var(--text); cursor: pointer; }
	.beds-chips { display: flex; flex-wrap: wrap; gap: 0.35rem; }
	.bed-chip { display: inline-flex; align-items: center; gap: 0.25rem; padding: 0.25rem 0.5rem; background: var(--surface2); border: 1px solid var(--border); border-radius: var(--radius-md); font-size: 0.8125rem; }
	.bed-type-select { border: none; background: transparent; font-size: 0.8125rem; color: var(--text); cursor: pointer; padding: 0; min-width: 4.5rem; }
	.chip-remove { width: 1.25rem; height: 1.25rem; border-radius: 50%; background: transparent; color: var(--muted); border: none; cursor: pointer; font-size: 1rem; line-height: 1; }
	.chip-remove:hover { background: rgba(185, 28, 28, 0.15); color: var(--error, #b91c1c); }
	.no-beds { font-size: 0.8125rem; color: var(--muted); font-style: italic; }
	.add-room-card { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.5rem; min-height: 140px; padding: 1.25rem; background: var(--surface); border: 1px dashed var(--border); border-radius: var(--radius-lg); color: var(--muted); font-size: 0.9375rem; font-weight: 500; cursor: pointer; }
	.add-room-card:hover { border-color: var(--primary); color: var(--primary); background: rgba(0,0,0,0.03); }
	.add-room-icon { font-size: 1.5rem; line-height: 1; }
</style>
