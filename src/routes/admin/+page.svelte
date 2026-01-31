<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import type { PageData } from './$types';

	let { data } = $props();

	function formatDate(date: Date | string) {
		return new Date(date).toLocaleDateString();
	}

	function getShareLink(trip: { inviteCode: string }) {
		const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
		return `${baseUrl}/trip/${trip.inviteCode}`;
	}

	function copyToClipboard(text: string) {
		navigator.clipboard.writeText(text);
		alert('Link copied to clipboard!');
	}
</script>

<div class="admin-page">
	<div class="container">
		<header>
			<h1>Divvi - Host Dashboard</h1>
			<div class="header-actions">
				<a href="/admin/trips/new" class="btn-primary">Create New Trip</a>
				<form method="POST" action="/admin/logout" use:enhance>
					<button type="submit" class="btn-secondary">Logout</button>
				</form>
			</div>
		</header>

		<section class="stats">
			<div class="stat-card">
				<h3>Total Trips</h3>
				<p class="stat-value">{data.trips.length}</p>
			</div>
			<div class="stat-card">
				<h3>Total Reservations</h3>
				<p class="stat-value">{data.reservations.length}</p>
			</div>
			<div class="stat-card">
				<h3>Published Trips</h3>
				<p class="stat-value">{data.trips.filter(t => t.isPublished).length}</p>
			</div>
		</section>

		<section class="trips">
			<h2>Your Trips</h2>
			{#if data.trips.length === 0}
				<div class="empty-state">
					<p>You haven't created any trips yet.</p>
					<a href="/admin/trips/new" class="btn-primary">Create Your First Trip</a>
				</div>
			{:else}
				<div class="trip-grid">
					{#each data.trips as trip}
						<div class="trip-card">
							<div class="trip-header">
								<h3>{trip.name}</h3>
								<span class="status-badge" class:published={trip.isPublished}>
									{trip.isPublished ? 'Published' : 'Draft'}
								</span>
							</div>
							<p class="trip-dates">
								{formatDate(trip.checkInDate)} - {formatDate(trip.checkOutDate)}
							</p>
							<p class="trip-cost">Total Cost: ${trip.totalCost.toFixed(2)}</p>
							<p class="trip-model">Pricing: {trip.pricingModel.replace(/_/g, ' ')}</p>
							<div class="trip-stats">
								<span>{trip.rooms.length} rooms</span>
								<span>{trip.reservations.length} reservations</span>
							</div>
							{#if trip.isPublished}
								<div class="share-section">
									<label for="share-link-{trip.id}">Share Link:</label>
									<div class="share-link">
										<input type="text" id="share-link-{trip.id}" readonly value={getShareLink(trip)} />
										<button onclick={() => copyToClipboard(getShareLink(trip))}>Copy</button>
									</div>
									<small>Invite Code: <strong>{trip.inviteCode}</strong></small>
								</div>
							{/if}
							<div class="trip-actions">
								<a href="/admin/trips/{trip.id}" class="btn-link">Manage</a>
								<a href="/admin/trips/{trip.id}/reservations" class="btn-link">View Reservations</a>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</section>

		{#if data.reservations.length > 0}
			<section class="reservations">
				<h2>Recent Reservations</h2>
				<div class="table-container">
					<table>
						<thead>
							<tr>
								<th>Trip</th>
								<th>Name</th>
								<th>Email</th>
								<th>Room</th>
								<th>Bed</th>
								<th>Check-in</th>
								<th>Check-out</th>
								<th>Guests</th>
								<th>Total Price</th>
							</tr>
						</thead>
						<tbody>
							{#each data.reservations.slice(0, 10) as reservation}
								<tr>
									<td>{reservation.trip.name}</td>
									<td>{reservation.name}</td>
									<td>{reservation.email}</td>
									<td>{reservation.room.name}</td>
									<td>{reservation.bed?.bedType.toUpperCase() || 'N/A'}</td>
									<td>{formatDate(reservation.checkInDate)}</td>
									<td>{formatDate(reservation.checkOutDate)}</td>
									<td>{reservation.numberOfGuests}</td>
									<td>${reservation.calculatedPrice.toFixed(2)}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</section>
		{/if}
	</div>
</div>

<style>
	.admin-page {
		min-height: 100vh;
		padding: 2rem;
		background: #f5f7fa;
	}

	.container {
		max-width: 1400px;
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
	}

	.btn-secondary:hover {
		background: #7f8c8d;
	}

	.btn-primary {
		background: #3498db;
		color: white;
		border: none;
		padding: 0.75rem 1.5rem;
		border-radius: 4px;
		cursor: pointer;
		text-decoration: none;
		display: inline-block;
		font-size: 0.9rem;
	}

	.btn-primary:hover {
		background: #2980b9;
	}

	.btn-link {
		color: #3498db;
		text-decoration: none;
		font-size: 0.9rem;
		margin-right: 1rem;
	}

	.btn-link:hover {
		text-decoration: underline;
	}

	.header-actions {
		display: flex;
		gap: 1rem;
		align-items: center;
	}

	.stats {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 1rem;
		margin-bottom: 2rem;
	}

	.stat-card {
		background: #f8f9fa;
		padding: 1.5rem;
		border-radius: 8px;
		text-align: center;
	}

	.stat-card h3 {
		margin: 0 0 0.5rem 0;
		color: #7f8c8d;
		font-size: 0.9rem;
		text-transform: uppercase;
	}

	.stat-value {
		margin: 0;
		font-size: 2rem;
		font-weight: 600;
		color: #2c3e50;
	}

	.table-container {
		overflow-x: auto;
	}

	table {
		width: 100%;
		border-collapse: collapse;
	}

	thead {
		background: #f8f9fa;
	}

	th {
		padding: 0.75rem;
		text-align: left;
		font-weight: 600;
		color: #2c3e50;
		border-bottom: 2px solid #e0e0e0;
	}

	td {
		padding: 0.75rem;
		border-bottom: 1px solid #e0e0e0;
	}

	tbody tr:hover {
		background: #f8f9fa;
	}

	.trips {
		margin-top: 2rem;
	}

	.trips h2 {
		margin: 0 0 1rem 0;
		color: #2c3e50;
	}

	.empty-state {
		text-align: center;
		padding: 3rem;
		background: #f8f9fa;
		border-radius: 8px;
	}

	.trip-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
		gap: 1.5rem;
		margin-top: 1rem;
	}

	.trip-card {
		background: #f8f9fa;
		border: 1px solid #e0e0e0;
		border-radius: 8px;
		padding: 1.5rem;
	}

	.trip-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.5rem;
	}

	.trip-header h3 {
		margin: 0;
		color: #2c3e50;
		font-size: 1.2rem;
	}

	.status-badge {
		padding: 0.25rem 0.75rem;
		border-radius: 12px;
		font-size: 0.75rem;
		font-weight: 600;
		background: #95a5a6;
		color: white;
	}

	.status-badge.published {
		background: #27ae60;
	}

	.trip-dates, .trip-cost, .trip-model {
		margin: 0.5rem 0;
		color: #555;
		font-size: 0.9rem;
	}

	.trip-stats {
		display: flex;
		gap: 1rem;
		margin: 1rem 0;
		font-size: 0.85rem;
		color: #7f8c8d;
	}

	.share-section {
		margin: 1rem 0;
		padding: 1rem;
		background: white;
		border-radius: 4px;
		border: 1px solid #e0e0e0;
	}

	.share-section label {
		display: block;
		margin-bottom: 0.5rem;
		font-size: 0.85rem;
		font-weight: 600;
		color: #555;
	}

	.share-link {
		display: flex;
		gap: 0.5rem;
		margin-bottom: 0.5rem;
	}

	.share-link input {
		flex: 1;
		padding: 0.5rem;
		border: 1px solid #ddd;
		border-radius: 4px;
		font-size: 0.85rem;
	}

	.share-link button {
		padding: 0.5rem 1rem;
		background: #3498db;
		color: white;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		font-size: 0.85rem;
	}

	.share-link button:hover {
		background: #2980b9;
	}

	.share-section small {
		display: block;
		color: #7f8c8d;
		font-size: 0.8rem;
	}

	.trip-actions {
		margin-top: 1rem;
		padding-top: 1rem;
		border-top: 1px solid #e0e0e0;
	}

</style>

