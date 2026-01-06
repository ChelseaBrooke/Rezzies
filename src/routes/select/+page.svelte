<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageData, ActionData } from './$types';

	let { data, form } = $props();

	let formData = {
		name: '',
		email: '',
		checkInDate: '',
		checkOutDate: '',
		roomId: null as number | null,
		bedId: null as string | null
	};

	let selectedRoom = $state<typeof data.rooms[0] | null>(null);
	let priceCalculation = $state<{ nights: number; nightlyRate: number; totalPrice: number } | null>(null);
	let isSubmitting = $state(false);
	let error = $state<string | null>(null);

	// Wedding dates (adjust as needed)
	const weddingCheckIn = '2027-06-14';
	const weddingCheckOut = '2027-06-21';

	function selectRoom(room: typeof data.rooms[0]) {
		selectedRoom = room;
		formData.roomId = room.id;
		formData.bedId = null;
		calculatePrice();
	}

	function selectBed(bedId: string) {
		formData.bedId = bedId;
		calculatePrice();
	}

	async function calculatePrice() {
		if (!formData.bedId || !formData.checkInDate || !formData.checkOutDate) {
			priceCalculation = null;
			return;
		}

		try {
			const response = await fetch('/api/calculate-price', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					bedId: formData.bedId,
					checkInDate: formData.checkInDate,
					checkOutDate: formData.checkOutDate
				})
			});

			const result = await response.json();
			if (result.ok) {
				priceCalculation = result.data;
			}
		} catch (err) {
			console.error('Price calculation error:', err);
		}
	}

	function handleSubmit({ cancel }: Parameters<Parameters<typeof enhance>[0]>[0]) {
		if (!formData.name || !formData.email || !formData.bedId || !formData.checkInDate || !formData.checkOutDate) {
			cancel();
			error = 'Please fill in all required fields';
			return;
		}

		if (!priceCalculation) {
			cancel();
			error = 'Please select dates to calculate price';
			return;
		}

		isSubmitting = true;
		error = null;
	}

	$effect(() => {
		if (formData.checkInDate && formData.checkOutDate) {
			calculatePrice();
		}
	});

	// Handle form errors and success
	$effect(() => {
		if (form) {
			if (form.error) {
				error = form.error;
				isSubmitting = false;
			} else if (form.status === 200 || form.status === 303) {
				// Success - redirect will happen automatically
				isSubmitting = false;
			}
		}
	});
</script>

<div class="select-page">
	<div class="container">
		<header>
			<h1>Choose Your Room</h1>
		</header>

		{#if error}
			<div class="error-message">{error}</div>
		{/if}

		<form method="POST" action="?/default" use:enhance={handleSubmit}>
			<!-- Guest Info -->
			<section class="form-section">
				<h2>Your Information</h2>
				<div class="form-group">
					<label for="name">Full Name *</label>
					<input
						type="text"
						id="name"
						name="name"
						bind:value={formData.name}
						required
						placeholder="John Doe"
					/>
				</div>
				<div class="form-group">
					<label for="email">Email Address *</label>
					<input
						type="email"
						id="email"
						name="email"
						bind:value={formData.email}
						required
						placeholder="john@example.com"
					/>
				</div>
			</section>

			<!-- Dates -->
			<section class="form-section">
				<h2>Stay Dates</h2>
				<div class="date-inputs">
					<div class="form-group">
						<label for="checkIn">Check-in Date *</label>
						<input
							type="date"
							id="checkIn"
							name="checkInDate"
							bind:value={formData.checkInDate}
							min={weddingCheckIn}
							max={weddingCheckOut}
							required
						/>
					</div>
					<div class="form-group">
						<label for="checkOut">Check-out Date *</label>
						<input
							type="date"
							id="checkOut"
							name="checkOutDate"
							bind:value={formData.checkOutDate}
							min={weddingCheckIn}
							max={weddingCheckOut}
							required
						/>
					</div>
				</div>
			</section>

			<!-- Room Selection -->
			<section class="form-section">
				<h2>Select Room</h2>
				<div class="room-grid">
					{#each data.rooms as room}
						<button
							type="button"
							class="room-card"
							class:selected={selectedRoom?.id === room.id}
							onclick={() => selectRoom(room)}
						>
							<h3>{room.name}</h3>
							{#if room.description}
								<p>{room.description}</p>
							{/if}
							<div class="bed-count">{room.beds.length} bed{room.beds.length !== 1 ? 's' : ''} available</div>
						</button>
					{/each}
				</div>
			</section>

			<!-- Bed Selection -->
			{#if selectedRoom}
				<section class="form-section">
					<h2>Select Bed</h2>
					<div class="bed-list">
						{#each selectedRoom.beds as bed}
							<button
								type="button"
								class="bed-option"
								class:selected={formData.bedId === bed.id}
								class:unavailable={!bed.isAvailable}
								disabled={!bed.isAvailable}
								onclick={() => selectBed(bed.id)}
							>
								<div class="bed-info">
									<span class="bed-type">{bed.bedType.toUpperCase()}</span>
									<span class="bed-price">${bed.nightlyRate.toFixed(2)}/night</span>
								</div>
								{#if !bed.isAvailable}
									<span class="unavailable-badge">Unavailable</span>
								{/if}
							</button>
						{/each}
					</div>
				</section>
			{/if}

			<!-- Price Summary -->
			{#if priceCalculation}
				<section class="form-section price-summary">
					<h2>Price Summary</h2>
					<div class="price-details">
						<div class="price-row">
							<span>Nightly Rate:</span>
							<span>${priceCalculation.nightlyRate.toFixed(2)}</span>
						</div>
						<div class="price-row">
							<span>Number of Nights:</span>
							<span>{priceCalculation.nights}</span>
						</div>
						<div class="price-row total">
							<span>Total Estimated Cost:</span>
							<span>${priceCalculation.totalPrice.toFixed(2)}</span>
						</div>
					</div>
					<p class="price-note">
						Pricing is based on bed type, room sharing, and length of stay to keep things fair for everyone.
					</p>
				</section>
			{/if}

			<!-- Hidden fields for form submission -->
			<input type="hidden" name="roomId" value={formData.roomId || ''} />
			<input type="hidden" name="bedId" value={formData.bedId || ''} />

			<!-- Submit -->
			<div class="form-actions">
				<button type="submit" class="btn-primary" disabled={isSubmitting || !priceCalculation}>
					{isSubmitting ? 'Submitting...' : 'Submit Selection'}
				</button>
			</div>
		</form>
	</div>
</div>

<style>
	.select-page {
		min-height: 100vh;
		padding: 2rem;
		background: #f5f7fa;
	}

	.container {
		max-width: 900px;
		margin: 0 auto;
		background: white;
		border-radius: 16px;
		padding: 2rem;
		box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
	}

	header {
		text-align: center;
		margin-bottom: 2rem;
	}

	h1 {
		font-size: 2rem;
		color: #2c3e50;
		margin: 0;
	}

	.error-message {
		background: #fee;
		color: #c33;
		padding: 1rem;
		border-radius: 8px;
		margin-bottom: 1.5rem;
		border: 1px solid #fcc;
	}

	.form-section {
		margin: 2rem 0;
		padding: 1.5rem;
		background: #fafbfc;
		border-radius: 8px;
	}

	h2 {
		font-size: 1.3rem;
		color: #34495e;
		margin: 0 0 1rem 0;
	}

	.form-group {
		margin: 1rem 0;
	}

	label {
		display: block;
		margin-bottom: 0.5rem;
		font-weight: 500;
		color: #555;
	}

	input[type="text"],
	input[type="email"],
	input[type="date"] {
		width: 100%;
		padding: 0.75rem;
		border: 1px solid #ddd;
		border-radius: 6px;
		font-size: 1rem;
	}

	.date-inputs {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1rem;
	}

	.room-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
		gap: 1rem;
	}

	.room-card {
		padding: 1.5rem;
		background: white;
		border: 2px solid #e0e0e0;
		border-radius: 8px;
		cursor: pointer;
		transition: all 0.2s;
		text-align: left;
	}

	.room-card:hover {
		border-color: #3498db;
		transform: translateY(-2px);
		box-shadow: 0 4px 12px rgba(52, 152, 219, 0.2);
	}

	.room-card.selected {
		border-color: #3498db;
		background: #ebf5fb;
	}

	.room-card h3 {
		margin: 0 0 0.5rem 0;
		color: #2c3e50;
	}

	.room-card p {
		margin: 0.5rem 0;
		color: #7f8c8d;
		font-size: 0.9rem;
	}

	.bed-count {
		margin-top: 0.5rem;
		font-size: 0.85rem;
		color: #95a5a6;
	}

	.bed-list {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.bed-option {
		padding: 1rem;
		background: white;
		border: 2px solid #e0e0e0;
		border-radius: 8px;
		cursor: pointer;
		transition: all 0.2s;
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.bed-option:hover:not(:disabled) {
		border-color: #3498db;
	}

	.bed-option.selected {
		border-color: #3498db;
		background: #ebf5fb;
	}

	.bed-option.unavailable {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.bed-info {
		display: flex;
		gap: 1rem;
		align-items: center;
	}

	.bed-type {
		font-weight: 600;
		color: #2c3e50;
	}

	.bed-price {
		color: #27ae60;
		font-weight: 500;
	}

	.unavailable-badge {
		background: #e74c3c;
		color: white;
		padding: 0.25rem 0.75rem;
		border-radius: 4px;
		font-size: 0.85rem;
	}

	.price-summary {
		background: #e8f5e9;
		border: 2px solid #4caf50;
	}

	.price-details {
		margin: 1rem 0;
	}

	.price-row {
		display: flex;
		justify-content: space-between;
		padding: 0.5rem 0;
		border-bottom: 1px solid #ddd;
	}

	.price-row.total {
		border-bottom: none;
		border-top: 2px solid #4caf50;
		margin-top: 0.5rem;
		padding-top: 0.75rem;
		font-size: 1.2rem;
		font-weight: 600;
		color: #2c3e50;
	}

	.price-note {
		margin-top: 1rem;
		font-size: 0.9rem;
		color: #555;
		font-style: italic;
	}

	.form-actions {
		text-align: center;
		margin-top: 2rem;
	}

	.btn-primary {
		background: #3498db;
		color: white;
		border: none;
		padding: 1rem 2.5rem;
		font-size: 1.1rem;
		border-radius: 8px;
		cursor: pointer;
		transition: background 0.2s;
		font-weight: 500;
	}

	.btn-primary:hover:not(:disabled) {
		background: #2980b9;
	}

	.btn-primary:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}
</style>

