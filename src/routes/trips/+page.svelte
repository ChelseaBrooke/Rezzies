<script lang="ts">
	import type { PageData } from './$types';
	import { goto } from '$app/navigation';

	let { data }: { data: PageData } = $props();
</script>

<div class="trips-page">
	<div class="container">
		<div class="page-header">
			<h1>My Trips</h1>
			<a href="/trips/new" class="btn btn-primary">Host a Trip</a>
		</div>

		{#if data.ownedTrips.length > 0}
			<section class="trips-section">
				<h2>Trips You Host</h2>
				<div class="trips-grid">
					{#each data.ownedTrips as trip}
						<div class="trip-card" on:click={() => goto(`/trips/${trip.id}`)}>
							{#if trip.listingCoverPhoto}
								<img src={trip.listingCoverPhoto} alt={trip.name} class="trip-image" />
							{:else}
								<div class="trip-image-placeholder">🏖️</div>
							{/if}
							<div class="trip-content">
								<h3>{trip.name}</h3>
								<p class="trip-dates">
									{trip.checkInDate.toLocaleDateString()} - {trip.checkOutDate.toLocaleDateString()}
								</p>
								{#if trip.location}
									<p class="trip-location">📍 {trip.location}</p>
								{/if}
								<div class="trip-status">
									<span class="badge {trip.isPublished ? 'published' : 'draft'}">
										{trip.isPublished ? 'Published' : 'Draft'}
									</span>
								</div>
							</div>
						</div>
					{/each}
				</div>
			</section>
		{/if}

		{#if data.invitedTrips.length > 0}
			<section class="trips-section">
				<h2>Trips You're Invited To</h2>
				<div class="trips-grid">
					{#each data.invitedTrips as trip}
						<div class="trip-card" on:click={() => goto(`/trips/${trip.id}`)}>
							{#if trip.listingCoverPhoto}
								<img src={trip.listingCoverPhoto} alt={trip.name} class="trip-image" />
							{:else}
								<div class="trip-image-placeholder">🏖️</div>
							{/if}
							<div class="trip-content">
								<h3>{trip.name}</h3>
								<p class="trip-dates">
									{trip.checkInDate.toLocaleDateString()} - {trip.checkOutDate.toLocaleDateString()}
								</p>
								{#if trip.location}
									<p class="trip-location">📍 {trip.location}</p>
								{/if}
							</div>
						</div>
					{/each}
				</div>
			</section>
		{/if}

		{#if data.ownedTrips.length === 0 && data.invitedTrips.length === 0}
			<div class="empty-state">
				<h2>No trips yet</h2>
				<p>Start by hosting your first trip!</p>
				<a href="/trips/new" class="btn btn-primary">Host a Trip</a>
			</div>
		{/if}
	</div>
</div>

<style>
	.trips-page {
		min-height: calc(100vh - 80px);
		padding: var(--spacing-xl) var(--spacing-md);
	}

	.container {
		max-width: 1200px;
		margin: 0 auto;
	}

	.page-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: var(--spacing-xl);
	}

	.page-header h1 {
		margin: 0;
	}

	.trips-section {
		margin-bottom: var(--spacing-xl);
	}

	.trips-section h2 {
		margin-bottom: var(--spacing-lg);
		font-size: 1.5rem;
	}

	.trips-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
		gap: var(--spacing-lg);
	}

	.trip-card {
		background: white;
		border-radius: var(--radius-md);
		overflow: hidden;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
		cursor: pointer;
		transition: transform 0.2s, box-shadow 0.2s;
	}

	.trip-card:hover {
		transform: translateY(-4px);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
	}

	.trip-image {
		width: 100%;
		height: 200px;
		object-fit: cover;
	}

	.trip-image-placeholder {
		width: 100%;
		height: 200px;
		background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 4rem;
	}

	.trip-content {
		padding: var(--spacing-md);
	}

	.trip-content h3 {
		margin: 0 0 var(--spacing-xs) 0;
		font-size: 1.25rem;
	}

	.trip-dates {
		color: var(--color-text-light);
		margin: var(--spacing-xs) 0;
	}

	.trip-location {
		color: var(--color-text-light);
		margin: var(--spacing-xs) 0;
		font-size: 0.9rem;
	}

	.trip-status {
		margin-top: var(--spacing-sm);
	}

	.badge {
		display: inline-block;
		padding: 0.25rem 0.75rem;
		border-radius: var(--radius-sm);
		font-size: 0.875rem;
		font-weight: 500;
	}

	.badge.published {
		background: rgba(34, 197, 94, 0.1);
		color: #16a34a;
	}

	.badge.draft {
		background: rgba(107, 114, 128, 0.1);
		color: #6b7280;
	}

	.empty-state {
		text-align: center;
		padding: var(--spacing-xl) 0;
	}

	.empty-state h2 {
		margin-bottom: var(--spacing-sm);
	}

	.empty-state p {
		color: var(--color-text-light);
		margin-bottom: var(--spacing-lg);
	}
</style>
