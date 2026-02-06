<script lang="ts">
	interface Props {
		formData: {
			rooms: Array<{
				id?: number;
				name: string;
				description?: string | null;
				beds?: Array<{
					id?: string;
					bedType: string;
					capacitySlots: number;
				}>;
			}>;
		};
		tripId: string;
	}

	let { formData, tripId }: Props = $props();
</script>

<div class="step-content">
	<h1 class="step-title">Rooms</h1>
	<p class="step-subtitle">Manage rooms and beds for this trip. Edit rooms from the <a href="/trips/{tripId}/rooms">Rooms page</a>.</p>
	
	<div class="rooms-list">
		{#if formData.rooms && formData.rooms.length > 0}
			{#each formData.rooms as room}
				<div class="room-card">
					<h3>{room.name}</h3>
					{#if room.description}
						<p class="room-description">{room.description}</p>
					{/if}
					{#if room.beds && room.beds.length > 0}
						<div class="beds-list">
							<strong>Beds:</strong>
							<ul>
								{#each room.beds as bed}
									<li>{bed.bedType} ({bed.capacitySlots} slot{bed.capacitySlots !== 1 ? 's' : ''})</li>
								{/each}
							</ul>
						</div>
					{/if}
				</div>
			{/each}
		{:else}
			<p class="empty-state">No rooms added yet.</p>
		{/if}
	</div>
</div>

<style>
	.step-content {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.step-title {
		font-size: 1.5rem;
		font-weight: 600;
		margin: 0 0 0.5rem 0;
		color: var(--text);
	}

	.step-subtitle {
		font-size: 0.875rem;
		color: var(--muted);
		margin: 0 0 1rem 0;
	}

	.step-subtitle a {
		color: var(--primary);
		text-decoration: none;
	}

	.step-subtitle a:hover {
		text-decoration: underline;
	}

	.rooms-list {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.room-card {
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		padding: 1.25rem;
	}

	.room-card h3 {
		font-size: 1rem;
		font-weight: 600;
		margin: 0 0 0.5rem 0;
		color: var(--text);
	}

	.room-description {
		font-size: 0.875rem;
		color: var(--muted);
		margin: 0 0 0.75rem 0;
	}

	.beds-list {
		font-size: 0.875rem;
		color: var(--text);
	}

	.beds-list strong {
		display: block;
		margin-bottom: 0.25rem;
	}

	.beds-list ul {
		margin: 0.5rem 0 0 1.25rem;
		padding: 0;
		list-style: disc;
	}

	.beds-list li {
		margin: 0.25rem 0;
	}

	.empty-state {
		font-size: 0.875rem;
		color: var(--muted);
		text-align: center;
		padding: 2rem;
		background: var(--surface2);
		border-radius: var(--radius-lg);
	}
</style>
