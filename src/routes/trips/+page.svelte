<script lang="ts">
	import type { PageData } from './$types';
	import { goto } from '$app/navigation';
	import { enhance } from '$app/forms';
	import MarketingShell from '$lib/components/MarketingShell.svelte';

	let { data }: { data: PageData } = $props();

	// Delete confirmation modal state
	let deletingTrip = $state<{ id: string; name: string } | null>(null);

	function requestDelete(tripId: string, tripName: string, event: Event) {
		event.stopPropagation();
		deletingTrip = { id: tripId, name: tripName };
	}

	function cancelDelete() {
		deletingTrip = null;
	}
</script>

<MarketingShell user={data?.user}>
	<div class="marketing-container trips-container">
		<div class="marketing-card trips-header-card">
			<div class="page-header">
				<h1 class="marketing-page-title">My Trips</h1>
				<a href="/trips/new" class="header-cta">Host a Trip</a>
		</div>
	</div>

		{#if data.pendingInvites?.length > 0}
			<section class="marketing-card">
				<h2 class="section-heading">Pending invites</h2>
				<p class="section-hint">You’ve been invited to these trips. Open the link to accept.</p>
				<ul class="pending-invites-list">
					{#each data.pendingInvites as inv}
						<li>
							<a href="/invite/{inv.token}" class="pending-invite-link">{inv.trip.name}</a>
						</li>
					{/each}
				</ul>
			</section>
		{/if}

		{#if data.ownedTrips.length > 0}
			<section class="marketing-card">
				<h2 class="section-heading">Trips you host</h2>
				<div class="trips-grid">
					{#each data.ownedTrips as trip}
						<div
							class="trip-card"
							onclick={() => goto(`/trips/${trip.id}`)}
							role="button"
							tabindex="0"
							onkeydown={(e) => e.key === 'Enter' && goto(`/trips/${trip.id}`)}
						>
							<div class="trip-card-image-wrap">
								{#if trip.listingCoverPhoto}
									<img src={trip.listingCoverPhoto} alt={trip.name} class="trip-image" />
								{:else}
									<div class="trip-image-placeholder">🏖️</div>
								{/if}
								<button
									type="button"
									class="trip-delete-btn"
									aria-label="Delete trip {trip.name}"
									title="Delete trip"
									onclick={(e) => requestDelete(trip.id, trip.name, e)}
									onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') requestDelete(trip.id, trip.name, e); }}
								>
									<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
										<polyline points="3 6 5 6 21 6"></polyline>
										<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
										<line x1="10" y1="11" x2="10" y2="17"></line>
										<line x1="14" y1="11" x2="14" y2="17"></line>
									</svg>
								</button>
							</div>
							<div class="trip-content">
								<h3>{trip.name}</h3>
								<p class="trip-dates">
									{trip.checkInDate.toLocaleDateString()} – {trip.checkOutDate.toLocaleDateString()}
								</p>
								{#if trip.location}
									<p class="trip-location">📍 {trip.location}</p>
								{/if}
								<span class="badge {trip.isPublished ? 'published' : 'draft'}">
									{trip.isPublished ? 'Published' : 'Draft'}
								</span>
							</div>
						</div>
					{/each}
				</div>
			</section>
		{/if}

		{#if data.invitedTrips.length > 0}
			<section class="marketing-card">
				<h2 class="section-heading">Trips you're invited to</h2>
				<div class="trips-grid">
					{#each data.invitedTrips as trip}
						<div class="trip-card" onclick={() => goto(`/trips/${trip.id}`)} role="button" tabindex="0" onkeydown={(e) => e.key === 'Enter' && goto(`/trips/${trip.id}`)}>
							<div class="trip-card-image-wrap">
								{#if trip.listingCoverPhoto}
									<img src={trip.listingCoverPhoto} alt={trip.name} class="trip-image" />
								{:else}
									<div class="trip-image-placeholder">🏖️</div>
								{/if}
							</div>
							<div class="trip-content">
								<h3>{trip.name}</h3>
								<p class="trip-dates">
									{trip.checkInDate.toLocaleDateString()} – {trip.checkOutDate.toLocaleDateString()}
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

		{#if data.ownedTrips.length === 0 && data.invitedTrips.length === 0 && (data.pendingInvites?.length ?? 0) === 0}
			<div class="marketing-card empty-state">
				<h2 class="section-heading">No trips yet</h2>
				<p class="empty-text">Start by hosting your first trip!</p>
				<a href="/trips/new" class="cta-btn">Host a Trip</a>
			</div>
		{/if}
	</div>
</MarketingShell>

<!-- Delete confirmation modal — replaces browser confirm() -->
{#if deletingTrip}
	<div class="modal-backdrop" role="presentation" onclick={cancelDelete}>
		<div
			class="modal"
			role="dialog"
			aria-modal="true"
			aria-labelledby="delete-modal-title"
			onclick={(e) => e.stopPropagation()}
		>
			<h2 id="delete-modal-title">Delete "{deletingTrip.name}"?</h2>
			<p>This will permanently delete the trip and all associated rooms, guests, RSVPs, and data. This cannot be undone.</p>
			<div class="modal-actions">
				<button type="button" class="btn-cancel" onclick={cancelDelete}>Cancel</button>
				<form
					method="POST"
					action="?/deleteTrip"
					use:enhance={() => {
						deletingTrip = null;
					}}
				>
					<input type="hidden" name="tripId" value={deletingTrip.id} />
					<button type="submit" class="btn-confirm-delete">Delete Trip</button>
				</form>
			</div>
		</div>
	</div>
{/if}

<style>
	.trips-header-card {
		display: flex;
		align-items: center;
		justify-content: space-between;
		flex-wrap: wrap;
		gap: 1rem;
	}
	.page-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		flex-wrap: wrap;
		gap: 1rem;
		width: 100%;
	}
	.page-header .marketing-page-title {
		margin: 0;
	}
	.header-cta {
		padding: 0.625rem 1.25rem;
		font-size: 0.9375rem;
		font-weight: 600;
		color: white;
		background: var(--copper, #bf4e30);
		border-radius: 8px;
		text-decoration: none;
		transition: background 0.2s;
	}
	.header-cta:hover {
		background: var(--primaryHover, #a03d24);
	}

	.section-heading {
		font-family: 'Fraunces', Georgia, serif;
		font-size: 1.5rem;
		font-weight: 600;
		color: #fffbf7;
		margin: 0 0 1.25rem 0;
	}
	.section-hint {
		font-size: 0.875rem;
		color: rgba(255, 255, 255, 0.75);
		margin: -0.5rem 0 1rem 0;
	}
	.pending-invites-list {
		list-style: none;
		padding: 0;
		margin: 0;
	}
	.pending-invites-list li {
		margin-bottom: 0.5rem;
	}
	.pending-invite-link {
		color: var(--copper, #e07d5a);
		font-weight: 500;
		text-decoration: none;
	}
	.pending-invite-link:hover {
		text-decoration: underline;
	}

	.trips-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
		gap: 1.5rem;
	}

	.trip-card {
		background: rgba(255, 255, 255, 0.06);
		border-radius: 12px;
		overflow: hidden;
		border: 1px solid rgba(255, 255, 255, 0.1);
		cursor: pointer;
		transition: background 0.2s, border-color 0.2s, transform 0.2s;
	}
	.trip-card:hover {
		background: rgba(255, 255, 255, 0.1);
		border-color: rgba(255, 255, 255, 0.18);
		transform: translateY(-2px);
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
		border-radius: 6px;
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
		height: 180px;
		object-fit: cover;
	}
	.trip-image-placeholder {
		width: 100%;
		height: 180px;
		background: rgba(0, 27, 46, 0.4);
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 3rem;
		border-bottom: 1px solid rgba(255, 255, 255, 0.08);
	}

	.trip-content {
		padding: 1rem 1.25rem;
	}
	.trip-content h3 {
		font-size: 1.125rem;
		font-weight: 600;
		color: #fffbf7;
		margin: 0 0 0.35rem 0;
	}
	.trip-dates {
		font-size: 0.875rem;
		color: rgba(255, 255, 255, 0.8);
		margin: 0;
	}
	.trip-location {
		font-size: 0.875rem;
		color: rgba(255, 255, 255, 0.75);
		margin: 0.25rem 0 0 0;
	}
	.badge {
		display: inline-block;
		margin-top: 0.5rem;
		padding: 0.2rem 0.6rem;
		border-radius: 6px;
		font-size: 0.75rem;
		font-weight: 600;
	}
	.badge.published {
		background: rgba(34, 197, 94, 0.25);
		color: #86efac;
	}
	.badge.draft {
		background: rgba(255, 255, 255, 0.15);
		color: rgba(255, 255, 255, 0.9);
	}

	.empty-state {
		text-align: center;
	}
	.empty-text {
		margin-bottom: 1.5rem;
		color: rgba(255, 255, 255, 0.85);
	}
	.cta-btn {
		display: inline-block;
		padding: 0.875rem 2rem;
		font-size: 1rem;
		font-weight: 600;
		color: white;
		background: var(--copper, #bf4e30);
		border-radius: 8px;
		text-decoration: none;
		transition: background 0.2s;
	}
	.cta-btn:hover {
		background: var(--primaryHover, #a03d24);
	}

	@media (max-width: 768px) {
		.trips-grid {
			grid-template-columns: 1fr;
		}
	}

	/* Delete confirmation modal */
	.modal-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.65);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
		padding: 1rem;
	}

	.modal {
		background: white;
		border-radius: 12px;
		padding: 2rem;
		max-width: 440px;
		width: 100%;
		box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
	}

	.modal h2 {
		font-size: 1.25rem;
		color: #1a1a1a;
		margin: 0 0 0.75rem 0;
	}

	.modal p {
		font-size: 0.9375rem;
		color: #555;
		line-height: 1.6;
		margin: 0 0 1.5rem 0;
	}

	.modal-actions {
		display: flex;
		gap: 0.75rem;
		justify-content: flex-end;
	}

	.btn-cancel {
		padding: 0.625rem 1.25rem;
		border-radius: 8px;
		border: 1px solid #ddd;
		background: white;
		color: #555;
		font-size: 0.9375rem;
		font-weight: 500;
		cursor: pointer;
		font-family: inherit;
		transition: background 0.15s;
	}

	.btn-cancel:hover {
		background: #f5f5f5;
	}

	.btn-confirm-delete {
		padding: 0.625rem 1.25rem;
		border-radius: 8px;
		border: none;
		background: #dc2626;
		color: white;
		font-size: 0.9375rem;
		font-weight: 600;
		cursor: pointer;
		font-family: inherit;
		transition: background 0.15s;
	}

	.btn-confirm-delete:hover {
		background: #b91c1c;
	}
</style>
