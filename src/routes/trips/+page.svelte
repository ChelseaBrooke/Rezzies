<script lang="ts">
	import type { PageData } from './$types';
	import { goto } from '$app/navigation';
	import { enhance } from '$app/forms';

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
						<div class="trip-card" onclick={() => goto(`/trips/${trip.id}`)} role="button" tabindex="0" onkeydown={(e) => e.key === 'Enter' && goto(`/trips/${trip.id}`)}>
							<div class="trip-card-image-wrap">
								{#if trip.listingCoverPhoto}
									<img src={trip.listingCoverPhoto} alt={trip.name} class="trip-image" />
								{:else}
									<div class="trip-image-placeholder">🏖️</div>
								{/if}
								<form
									class="trip-delete-form"
									method="POST"
									action="?/deleteTrip"
									use:enhance={({ cancel }) => {
										if (!confirm('Delete this trip? This cannot be undone.')) {
											cancel();
										}
									}}
									onclick={(e) => e.stopPropagation()}
									onkeydown={(e) => e.stopPropagation()}
								>
									<input type="hidden" name="tripId" value={trip.id} />
									<button type="submit" class="trip-delete-btn" aria-label="Delete trip {trip.name}" title="Delete trip">
										<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
											<polyline points="3 6 5 6 21 6"></polyline>
											<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
											<line x1="10" y1="11" x2="10" y2="17"></line>
											<line x1="14" y1="11" x2="14" y2="17"></line>
										</svg>
									</button>
								</form>
							</div>
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
						<div class="trip-card" onclick={() => goto(`/trips/${trip.id}`)}>
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

	.trip-card-image-wrap {
		position: relative;
	}

	.trip-delete-form {
		position: absolute;
		top: 0.5rem;
		right: 0.5rem;
		z-index: 2;
	}

	.trip-delete-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 2rem;
		height: 2rem;
		padding: 0;
		border: none;
		border-radius: var(--radius-sm, 0.375rem);
		background: rgba(0, 0, 0, 0.5);
		color: white;
		cursor: pointer;
		transition: background 0.2s;
	}

	.trip-delete-btn:hover {
		background: rgba(220, 38, 38, 0.9);
	}

	.trip-delete-btn:focus {
		outline: 2px solid white;
		outline-offset: 2px;
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
