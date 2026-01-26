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
													value="1"
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
												<span>
													{bed.bedType.toUpperCase()} 
													(capacity: {bed.capacity}, slots: {bed.capacitySlots || bed.capacity})
												</span>
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
</style>
