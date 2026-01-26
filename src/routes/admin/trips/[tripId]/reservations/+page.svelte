<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageData, ActionData } from './$types';

	let { data, form } = $props();

	function formatDate(date: Date | string) {
		return new Date(date).toLocaleDateString();
	}

	function exportCSV() {
		if (!form?.csv) return;

		const blob = new Blob([form.csv], { type: 'text/csv' });
		const url = window.URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = form.filename || 'ledger.csv';
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		window.URL.revokeObjectURL(url);
	}

	$effect(() => {
		if (form?.csv) {
			exportCSV();
		}
	});
</script>

<div class="reservations-page">
	<div class="container">
		<header>
			<h1>Reservations: {data.trip?.name || 'Trip Not Found'}</h1>
			<div class="header-actions">
				{#if data.trip}
					<form method="POST" action="?/exportCSV" use:enhance>
						<button type="submit" class="btn-primary">Export CSV Ledger</button>
					</form>
				{/if}
				<a href="/admin" class="btn-secondary">Back to Dashboard</a>
			</div>
		</header>

		{#if data.trip}
			<section class="stats">
				<div class="stat-card">
					<h3>Total Reservations</h3>
					<p class="stat-value">{data.stats.totalReservations}</p>
				</div>
				<div class="stat-card">
					<h3>Total Revenue</h3>
					<p class="stat-value">${data.stats.totalRevenue.toFixed(2)}</p>
				</div>
				<div class="stat-card">
					<h3>Total Nights</h3>
					<p class="stat-value">{data.stats.totalNights}</p>
				</div>
				<div class="stat-card">
					<h3>Average Price</h3>
					<p class="stat-value">${data.stats.averagePrice.toFixed(2)}</p>
				</div>
			</section>

			<section class="reservations">
				<h2>Guest Ledger</h2>
				{#if data.reservations.length === 0}
					<div class="empty-state">
						<p>No reservations yet.</p>
					</div>
				{:else}
					<div class="table-container">
						<table>
							<thead>
								<tr>
									<th>Name</th>
									<th>Email</th>
									<th>Room</th>
									<th>Bed</th>
									<th>Check-in</th>
									<th>Check-out</th>
									<th>Nights</th>
									<th>Guests</th>
									<th>Total Price</th>
									<th>Submitted</th>
								</tr>
							</thead>
							<tbody>
								{#each data.reservations as reservation}
									<tr>
										<td>{reservation.name}</td>
										<td>{reservation.email}</td>
										<td>{reservation.room.name}</td>
										<td>{reservation.bed?.bedType.toUpperCase() || 'N/A'}</td>
										<td>{formatDate(reservation.checkInDate)}</td>
										<td>{formatDate(reservation.checkOutDate)}</td>
										<td>{reservation.nights}</td>
										<td>{reservation.numberOfGuests}</td>
										<td>${reservation.calculatedPrice.toFixed(2)}</td>
										<td>{formatDate(reservation.submittedAt)}</td>
									</tr>
								{/each}
							</tbody>
							<tfoot>
								<tr class="total-row">
									<td colspan="8"><strong>Total</strong></td>
									<td><strong>${data.stats.totalRevenue.toFixed(2)}</strong></td>
									<td></td>
								</tr>
							</tfoot>
						</table>
					</div>
				{/if}
			</section>
		{:else}
			<div class="error-message">
				<p>Trip not found.</p>
			</div>
		{/if}
	</div>
</div>

<style>
	.reservations-page {
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

	.header-actions {
		display: flex;
		gap: 1rem;
		align-items: center;
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

	.reservations {
		margin-top: 2rem;
	}

	.reservations h2 {
		margin: 0 0 1rem 0;
		color: #2c3e50;
	}

	.empty-state {
		text-align: center;
		padding: 3rem;
		background: #f8f9fa;
		border-radius: 8px;
		color: #7f8c8d;
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

	tfoot .total-row {
		background: #f8f9fa;
		font-weight: 600;
	}

	.error-message {
		background: #fee;
		color: #c33;
		padding: 1rem;
		border-radius: 8px;
		border: 1px solid #fcc;
	}
</style>
