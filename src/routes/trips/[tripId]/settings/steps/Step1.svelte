<script lang="ts">
	import AddressAutocomplete from '$lib/components/wizard/AddressAutocomplete.svelte';

	interface Props {
		formData: {
			name: string;
			description: string;
			location: string;
			checkInDate: string;
			checkOutDate: string;
			listingUrl: string;
			listingTitle: string;
			listingCoverPhoto: string;
		};
		tripId: string;
		numberOfNights: number;
	}

	let { formData, tripId, numberOfNights }: Props = $props();

	function handleAddressSelect(address: string) {
		formData.location = address;
	}
</script>

<div class="step-content">
	<h1 class="step-title">Trip Basics</h1>
	
	<div class="form-section">
		<label for="name" class="form-label">Trip Name *</label>
		<input
			type="text"
			id="name"
			class="form-input large"
			bind:value={formData.name}
			placeholder="Trip name"
			required
		/>
	</div>
	
	<div class="form-section">
		<label for="description" class="form-label">Trip Description / Notes</label>
		<textarea
			id="description"
			class="form-textarea"
			bind:value={formData.description}
			rows="4"
			placeholder="Trip description / notes"
		></textarea>
	</div>
	
	<div class="form-section">
		<label for="location" class="form-label">Destination</label>
		<AddressAutocomplete
			bind:value={formData.location}
			onSelect={handleAddressSelect}
			placeholder="Enter address"
		/>
	</div>
	
	<div class="form-section">
		<label class="form-label">Dates</label>
		<div class="inline-fields">
			<input
				type="date"
				id="checkInDate"
				class="form-input"
				bind:value={formData.checkInDate}
				required
			/>
			<span class="field-separator">to</span>
			<input
				type="date"
				id="checkOutDate"
				class="form-input"
				bind:value={formData.checkOutDate}
				required
			/>
		</div>
		{#if numberOfNights > 0}
			<p class="helper-text">{numberOfNights} night{numberOfNights !== 1 ? 's' : ''}</p>
		{/if}
	</div>
	
	<div class="form-section">
		<label for="listingUrl" class="form-label">Listing URL (optional)</label>
		<input
			type="url"
			id="listingUrl"
			class="form-input"
			bind:value={formData.listingUrl}
			placeholder="https://…"
		/>
	</div>
	
	<div class="form-section">
		<label for="listingCoverPhoto" class="form-label">Cover Photo URL (optional)</label>
		<input
			type="url"
			id="listingCoverPhoto"
			class="form-input"
			bind:value={formData.listingCoverPhoto}
			placeholder="https://…"
		/>
		{#if formData.listingCoverPhoto}
			<div class="photo-preview">
				<img src={formData.listingCoverPhoto} alt="Cover photo" />
			</div>
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

	.form-section {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.form-label {
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--text);
	}

	.form-input,
	.form-textarea {
		padding: 0.625rem 0.75rem;
		border: 1px solid var(--border-strong);
		border-radius: var(--radius-md);
		font-size: 0.875rem;
		font-family: inherit;
		transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
	}

	.form-input:focus,
	.form-textarea:focus {
		outline: none;
		border-color: var(--primary);
		box-shadow: 0 0 0 3px var(--focusRing);
	}

	.form-input.large {
		font-size: 1rem;
		padding: 0.75rem;
	}

	.form-textarea {
		resize: vertical;
		min-height: 100px;
	}

	.inline-fields {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.field-separator {
		color: var(--muted);
		font-size: 0.875rem;
	}

	.helper-text {
		font-size: 0.8125rem;
		color: var(--muted);
		margin: 0.25rem 0 0 0;
	}

	.photo-preview {
		margin-top: 0.5rem;
		border-radius: var(--radius-md);
		overflow: hidden;
		max-width: 400px;
	}

	.photo-preview img {
		width: 100%;
		height: auto;
		display: block;
	}
</style>
