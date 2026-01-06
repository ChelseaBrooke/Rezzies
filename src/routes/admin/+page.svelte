<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageData } from './$types';

	let { data } = $props();
</script>

<div class="admin-page">
	<div class="container">
		<header>
			<h1>Admin Dashboard</h1>
			<form method="POST" action="/admin/logout" use:enhance>
				<button type="submit" class="btn-secondary">Logout</button>
			</form>
		</header>

		<section class="stats">
			<div class="stat-card">
				<h3>Total Submissions</h3>
				<p class="stat-value">{data.submissions.length}</p>
			</div>
			<div class="stat-card">
				<h3>Total Rooms</h3>
				<p class="stat-value">{data.rooms.length}</p>
			</div>
		</section>

		<section class="submissions">
			<h2>Guest Submissions</h2>
			<div class="table-container">
				<table>
					<thead>
						<tr>
							<th>Name</th>
							<th>Email</th>
							<th>Room</th>
							<th>Bed Type</th>
							<th>Check-in</th>
							<th>Check-out</th>
							<th>Nights</th>
							<th>Total Price</th>
							<th>Submitted</th>
						</tr>
					</thead>
					<tbody>
						{#each data.submissions as submission}
							<tr>
								<td>{submission.name}</td>
								<td>{submission.email}</td>
								<td>{submission.room.name}</td>
								<td>{submission.bed.bedType.toUpperCase()}</td>
								<td>{new Date(submission.checkInDate).toLocaleDateString()}</td>
								<td>{new Date(submission.checkOutDate).toLocaleDateString()}</td>
								<td>{submission.nights}</td>
								<td>${submission.calculatedPrice.toFixed(2)}</td>
								<td>{new Date(submission.submittedAt).toLocaleDateString()}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</section>
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

	.submissions {
		margin-top: 2rem;
	}

	.submissions h2 {
		margin: 0 0 1rem 0;
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
</style>

