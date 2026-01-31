<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	let addRoomOpen = $state(false);
	let newRoomName = $state('');

	function openAddRoom() {
		addRoomOpen = true;
	}
	function closeAddRoom() {
		addRoomOpen = false;
		newRoomName = '';
	}
	function submitAddRoom() {
		// Stub: store in local state or call API
		closeAddRoom();
	}
</script>

<div class="page">
	<div class="page-header">
		<h1>Rooms & Beds</h1>
		<p class="subtitle">Manage rooms and bed assignments</p>
		<button type="button" class="btn-primary" onclick={openAddRoom}>Add room</button>
	</div>

	<div class="card">
		<div class="card-body">
			{#if data.rooms?.length > 0}
				<ul class="room-list">
					{#each data.rooms as room}
						<li class="room-item">
							<div class="room-name">{room.name}</div>
							<div class="room-meta">
								{#if room.beds?.length}
									<span>{room.beds.length} bed(s): {room.beds.map(b => b.bedType).join(', ')}</span>
								{:else}
									<span>No beds</span>
								{/if}
								{#if room.maxOccupancy}
									<span> · Max {room.maxOccupancy} guests</span>
								{/if}
							</div>
						</li>
					{/each}
				</ul>
			{:else}
				<p class="empty">No rooms yet. Add a room to get started.</p>
			{/if}
		</div>
	</div>
</div>

{#if addRoomOpen}
	<div class="modal-backdrop" onclick={closeAddRoom} role="presentation"></div>
	<div class="modal" role="dialog">
		<h2>Add room</h2>
		<form onsubmit={(e) => { e.preventDefault(); submitAddRoom(); }}>
			<div class="form-group">
				<label for="room-name">Room name</label>
				<input id="room-name" type="text" bind:value={newRoomName} placeholder="e.g. Master Bedroom" />
			</div>
			<div class="modal-actions">
				<button type="button" class="btn-secondary" onclick={closeAddRoom}>Cancel</button>
				<button type="submit" class="btn-primary">Add</button>
			</div>
		</form>
	</div>
{/if}

<style>
	.page { padding: 0; }
	.page-header { margin-bottom: 1.5rem; }
	.page-header h1 { font-size: 1.5rem; font-weight: 600; margin: 0 0 0.25rem 0; }
	.subtitle { font-size: 0.875rem; color: var(--muted); margin: 0 0 1rem 0; }
	.btn-primary { padding: 0.5rem 1rem; background: var(--primary); color: white; border: none; border-radius: 0.5rem; font-weight: 500; cursor: pointer; }
	.card { background: var(--surface); border-radius: var(--radius-lg); border: 1px solid var(--border); overflow: hidden; }
	.card-body { padding: 1.5rem; }
	.room-list { list-style: none; margin: 0; padding: 0; }
	.room-item { padding: 1rem; border-bottom: 1px solid var(--border); transition: background var(--transition-fast); }
	.room-item:hover { background: var(--surface2); }
	.room-item:last-child { border-bottom: none; }
	.room-name { font-weight: 500; margin-bottom: 0.25rem; }
	.room-meta { font-size: 0.875rem; color: var(--muted); }
	.empty { color: var(--muted); margin: 0; }
	.modal-backdrop { position: fixed; inset: 0; background: rgba(0, 27, 46, 0.3); z-index: 100; }
	.modal { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: white; padding: 1.5rem; border-radius: var(--radius-lg); border: 1px solid var(--border); box-shadow: var(--shadow-xl); z-index: 101; min-width: 20rem; }
	.modal h2 { margin: 0 0 1rem 0; font-size: 1.25rem; }
	.form-group { margin-bottom: 1rem; }
	.form-group label { display: block; font-size: 0.875rem; font-weight: 500; margin-bottom: 0.25rem; }
	.form-group input { width: 100%; padding: 0.5rem 0.75rem; border: 1px solid var(--border); border-radius: 0.5rem; font-size: 0.875rem; }
	.modal-actions { display: flex; gap: 0.75rem; justify-content: flex-end; margin-top: 1.25rem; }
	.btn-secondary { padding: 0.5rem 1rem; background: transparent; border: 1px solid var(--border); border-radius: 0.5rem; cursor: pointer; }
</style>
