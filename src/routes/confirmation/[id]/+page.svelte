<script lang="ts">
	import type { PageData } from './$types';

	let { data } = $props();
</script>

<div class="confirmation-page">
	<div class="container">
		<div class="success-icon">✓</div>
		<h1>Thank You!</h1>
		<p class="subtitle">Your room selection has been submitted</p>

		<div class="summary-card">
			<h2>Reservation Summary</h2>
			<div class="summary-details">
				<div class="detail-row">
					<span class="label">Guest Name:</span>
					<span class="value">{data.submission.name}</span>
				</div>
				<div class="detail-row">
					<span class="label">Email:</span>
					<span class="value">{data.submission.email}</span>
				</div>
				<div class="detail-row">
					<span class="label">Room:</span>
					<span class="value">{data.submission.room.name}</span>
				</div>
				<div class="detail-row">
					<span class="label">Bed Type:</span>
					<span class="value">{data.submission.bed.bedType.toUpperCase()}</span>
				</div>
				<div class="detail-row">
					<span class="label">Check-in:</span>
					<span class="value">{new Date(data.submission.checkInDate).toLocaleDateString()}</span>
				</div>
				<div class="detail-row">
					<span class="label">Check-out:</span>
					<span class="value">{new Date(data.submission.checkOutDate).toLocaleDateString()}</span>
				</div>
				<div class="detail-row">
					<span class="label">Nights:</span>
					<span class="value">{data.submission.nights}</span>
				</div>
				<div class="detail-row total">
					<span class="label">Total Estimated Cost:</span>
					<span class="value">${data.submission.calculatedPrice.toFixed(2)}</span>
				</div>
			</div>
		</div>

		<div class="message">
			<p>
				<strong>What's next?</strong>
			</p>
			<p>
				This is a reservation request, not a payment. We'll follow up with you soon with
				details about payment and any additional information you need.
			</p>
			<p>
				A confirmation email has been sent to <strong>{data.submission.email}</strong>.
			</p>
		</div>
	</div>
</div>

<style>
	.confirmation-page {
		min-height: 100vh;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 2rem;
		background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
	}

	.container {
		max-width: 600px;
		width: 100%;
		background: white;
		border-radius: 16px;
		padding: 3rem;
		box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
		text-align: center;
	}

	.success-icon {
		width: 80px;
		height: 80px;
		margin: 0 auto 1.5rem;
		background: #27ae60;
		color: white;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 3rem;
		font-weight: bold;
	}

	h1 {
		font-size: 2.5rem;
		color: #2c3e50;
		margin: 0 0 0.5rem 0;
	}

	.subtitle {
		font-size: 1.2rem;
		color: #7f8c8d;
		margin: 0 0 2rem 0;
	}

	.summary-card {
		background: #f8f9fa;
		border-radius: 12px;
		padding: 2rem;
		margin: 2rem 0;
		text-align: left;
	}

	.summary-card h2 {
		font-size: 1.5rem;
		color: #2c3e50;
		margin: 0 0 1.5rem 0;
		text-align: center;
	}

	.summary-details {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.detail-row {
		display: flex;
		justify-content: space-between;
		padding: 0.75rem 0;
		border-bottom: 1px solid #e0e0e0;
	}

	.detail-row.total {
		border-bottom: none;
		border-top: 2px solid #27ae60;
		margin-top: 0.5rem;
		padding-top: 1rem;
		font-size: 1.2rem;
		font-weight: 600;
	}

	.label {
		color: #7f8c8d;
		font-weight: 500;
	}

	.value {
		color: #2c3e50;
		font-weight: 600;
	}

	.message {
		margin-top: 2rem;
		padding: 1.5rem;
		background: #e8f5e9;
		border-radius: 8px;
		text-align: left;
		line-height: 1.8;
	}

	.message p {
		margin: 0.75rem 0;
		color: #555;
	}

	.message strong {
		color: #2c3e50;
	}
</style>

