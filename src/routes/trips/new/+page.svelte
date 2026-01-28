<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { enhance } from '$app/forms';
	import type { PageData, ActionData } from './$types';
	import RoomsStep from './steps/RoomsStep.svelte';
	import PricingPoliciesStep from './steps/PricingPoliciesStep.svelte';
	import InvitePeopleStep from './steps/InvitePeopleStep.svelte';
	import ReviewStep from './steps/ReviewStep.svelte';
	
	let { data, form }: { data: PageData; form: ActionData } = $props();
	
	type Step = 'basics' | 'rooms' | 'pricing-policies' | 'invite-people' | 'review';
	
	let currentStep = $state<Step>('basics');
	let isAutofilling = $state(false);
	let autofillError = $state<string | null>(null);
	let showAutofillInput = $state(false);
	let coverPhotoUploading = $state(false);
	
	// Form data state
	let formData = $state({
		// Trip Basics
		name: data.draft?.name || '',
		description: data.draft?.description || '',
		destination: data.draft?.destination || '',
		checkInDate: data.draft?.checkInDate || '',
		checkOutDate: data.draft?.checkOutDate || '',
		flexibleDates: data.draft?.flexibleDates || false,
		coverPhoto: data.draft?.coverPhoto || '',
		listingUrl: data.draft?.listingUrl || '',
		
		// Rooms (will be populated from autofill or manual entry)
		rooms: data.draft?.rooms || [],
		
		// Pricing & Policies
		totalCost: data.draft?.totalCost || '',
		cleaningFees: data.draft?.cleaningFees || '',
		serviceFees: data.draft?.serviceFees || '',
		taxes: data.draft?.taxes || '',
		pricingModel: data.draft?.pricingModel || 'PER_PERSON',
		allowPartialStays: data.draft?.allowPartialStays || false,
		paymentDueDates: data.draft?.paymentDueDates || [],
		installments: data.draft?.installments || false,
		refundPolicy: data.draft?.refundPolicy || '',
		cancellationCutoff: data.draft?.cancellationCutoff || '',
		latePaymentHandling: data.draft?.latePaymentHandling || '',
		rsvpDeadline: data.draft?.rsvpDeadline || '',
		autoReminders: data.draft?.autoReminders || false,
		overbookingAllowed: data.draft?.overbookingAllowed || false,
		houseRules: data.draft?.houseRules || '',
		quietHours: data.draft?.quietHours || '',
		petPolicy: data.draft?.petPolicy || '',
		smokingPolicy: data.draft?.smokingPolicy || '',
		accessibilityNotes: data.draft?.accessibilityNotes || '',
		checkInInstructions: data.draft?.checkInInstructions || '',
		checkOutInstructions: data.draft?.checkOutInstructions || '',
		
		// Invite People
		inviteEmails: data.draft?.inviteEmails || [],
		inviteMessage: data.draft?.inviteMessage || ''
	});
	
	const steps: { id: Step; label: string }[] = [
		{ id: 'basics', label: 'Trip Basics' },
		{ id: 'rooms', label: 'Rooms' },
		{ id: 'pricing-policies', label: 'Pricing & Policies' },
		{ id: 'invite-people', label: 'Invite People' },
		{ id: 'review', label: 'Review & Publish' }
	];
	
	// Calculate number of nights
	const numberOfNights = $derived(() => {
		if (!formData.checkInDate || !formData.checkOutDate) return 0;
		const checkIn = new Date(formData.checkInDate);
		const checkOut = new Date(formData.checkOutDate);
		const diffTime = checkOut.getTime() - checkIn.getTime();
		const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
		return diffDays > 0 ? diffDays : 0;
	});
	
	const currentStepIndex = $derived(steps.findIndex(s => s.id === currentStep));
	
	// Autosave draft
	let autosaveTimeout: ReturnType<typeof setTimeout> | null = null;
	
	function autosave() {
		if (autosaveTimeout) clearTimeout(autosaveTimeout);
		autosaveTimeout = setTimeout(async () => {
			try {
				const body = new URLSearchParams();
				body.set('formData', JSON.stringify(formData));
				const response = await fetch('?/saveDraft', {
					method: 'POST',
					headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
					body: body.toString()
				});
				if (response.ok) {
					console.log('Draft autosaved');
				}
			} catch (err) {
				console.error('Autosave failed:', err);
			}
		}, 2000); // Debounce 2 seconds
	}
	
	// Watch formData for changes and autosave
	$effect(() => {
		autosave();
	});
	
	// Handle autofill
	async function handleAutofill() {
		if (!formData.listingUrl.trim()) {
			autofillError = 'Please enter a listing URL';
			return;
		}
		
		isAutofilling = true;
		autofillError = null;
		
		try {
			const response = await fetch('/api/autofill', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ listingUrl: formData.listingUrl.trim() })
			});
			
			const result = await response.json();
			
			if (!response.ok) {
				throw new Error(result.error || 'Failed to fetch property data');
			}
			
			// Populate form with autofilled data
			if (result.data) {
				const { propertyInfo, rooms, photos } = result.data;
				
				// Map property info
				if (propertyInfo) {
					if (propertyInfo.title) formData.name = propertyInfo.title;
					if (propertyInfo.checkInDate) formData.checkInDate = propertyInfo.checkInDate;
					if (propertyInfo.checkOutDate) formData.checkOutDate = propertyInfo.checkOutDate;
					if (propertyInfo.totalPrice) formData.totalCost = String(propertyInfo.totalPrice);
					if (propertyInfo.coverPhoto) formData.coverPhoto = propertyInfo.coverPhoto;
					if (propertyInfo.location) formData.destination = propertyInfo.location;
				}
				
				// Use photos array if available
				if (photos && photos.length > 0) {
					formData.coverPhoto = photos[0] || formData.coverPhoto;
				}
				
				// Map rooms from autofill response
				if (rooms && Array.isArray(rooms)) {
					formData.rooms = rooms.map((room: any) => ({
						id: crypto.randomUUID(),
						name: room.name || 'Room',
						roomType: 'PRIVATE',
						maxOccupants: room.maxOccupants || 2,
						photos: room.photos || [],
						beds: (room.beds || []).map((bed: any) => ({
							id: crypto.randomUUID(),
							bedType: bed.bedType?.toUpperCase() || 'QUEEN',
							customType: bed.customType || '',
							quantity: bed.quantity || 1
						}))
					}));
				}
			}
			
			showAutofillInput = false;
			autosave();
		} catch (error) {
			autofillError = error instanceof Error ? error.message : 'Failed to autofill property data';
			console.error('Autofill error:', error);
		} finally {
			isAutofilling = false;
		}
	}
	
	function nextStep() {
		const nextIndex = currentStepIndex + 1;
		if (nextIndex < steps.length) {
			currentStep = steps[nextIndex].id;
			autosave();
		}
	}
	
	function prevStep() {
		const prevIndex = currentStepIndex - 1;
		if (prevIndex >= 0) {
			currentStep = steps[prevIndex].id;
		}
	}
	
	function goToStep(step: Step) {
		currentStep = step;
	}
</script>

<div class="wizard-page">
	<!-- Background Image with Overlay -->
	<div class="wizard-background">
		<div class="background-overlay"></div>
	</div>
	
	<!-- Step Indicator -->
	<div class="step-indicator">
		<div class="step-indicator-content">
			{#each steps as step, index}
				<button
					class="step-link"
					class:active={currentStep === step.id}
					onclick={() => goToStep(step.id)}
					type="button"
				>
					{step.label}
				</button>
				{#if index < steps.length - 1}
					<span class="step-separator">·</span>
				{/if}
			{/each}
		</div>
	</div>
	
	<!-- Main Content -->
	<div class="wizard-content">
		<div class="step-content">
			{#if currentStep === 'basics'}
				<!-- Step 1: Trip Basics & Source -->
				<h1 class="step-title">Trip Basics & Source</h1>
				
				<!-- Subtle Autofill Link -->
				<div class="autofill-section">
					{#if !showAutofillInput}
						<button
							type="button"
							class="autofill-link"
							onclick={() => showAutofillInput = true}
						>
							Have an Airbnb or VRBO link?
						</button>
					{:else}
						<div class="autofill-input-wrapper">
							<input
								type="url"
								placeholder="Paste listing URL"
								bind:value={formData.listingUrl}
								class="autofill-input"
								disabled={isAutofilling}
								onkeydown={(e) => {
									if (e.key === 'Enter' && formData.listingUrl.trim()) {
										handleAutofill();
									}
								}}
							/>
							<button
								type="button"
								class="autofill-btn"
								onclick={handleAutofill}
								disabled={isAutofilling || !formData.listingUrl.trim()}
							>
								{isAutofilling ? 'Loading...' : 'Autofill'}
							</button>
							<button
								type="button"
								class="autofill-cancel"
								onclick={() => {
									showAutofillInput = false;
									formData.listingUrl = '';
								}}
							>
								Cancel
							</button>
						</div>
						{#if autofillError}
							<p class="autofill-error">{autofillError}</p>
						{/if}
					{/if}
				</div>
				
				<!-- Trip Name -->
				<div class="form-section">
					<input
						type="text"
						id="name"
						name="name"
						bind:value={formData.name}
						required
						class="form-input large"
						placeholder="Trip name"
					/>
				</div>
				
				<!-- Trip Description -->
				<div class="form-section">
					<textarea
						id="description"
						name="description"
						bind:value={formData.description}
						rows="4"
						class="form-textarea"
						placeholder="Trip description / notes"
					></textarea>
				</div>
				
				<!-- Destination -->
				<div class="form-section">
					<input
						type="text"
						id="destination"
						name="destination"
						bind:value={formData.destination}
						class="form-input"
						placeholder="Destination"
					/>
				</div>
				
				<!-- Dates -->
				<div class="form-section">
					<div class="inline-fields">
						<input
							type="date"
							id="checkInDate"
							name="checkInDate"
							bind:value={formData.checkInDate}
							required
							class="form-input"
						/>
						<span class="field-separator">to</span>
						<input
							type="date"
							id="checkOutDate"
							name="checkOutDate"
							bind:value={formData.checkOutDate}
							required
							class="form-input"
						/>
					</div>
					{#if numberOfNights > 0}
						<p class="helper-text">{numberOfNights} night{numberOfNights !== 1 ? 's' : ''}</p>
					{/if}
				</div>
				
				<!-- Flexible Dates -->
				<div class="form-section">
					<label class="toggle-label">
						<input
							type="checkbox"
							bind:checked={formData.flexibleDates}
							class="toggle-input"
						/>
						<span class="toggle-text">Flexible dates allowed?</span>
					</label>
				</div>
				
				<!-- Cover Photo -->
				<div class="form-section">
					<label class="section-label">Main / Cover Photo</label>
					{#if formData.coverPhoto}
						<div class="cover-photo-preview">
							<img src={formData.coverPhoto} alt="Cover photo" />
							<button
								type="button"
								class="remove-photo"
								onclick={() => formData.coverPhoto = ''}
							>
								Remove
							</button>
						</div>
					{:else}
						<div class="cover-photo-options">
							<input
								type="file"
								accept="image/jpeg,image/png,image/webp,image/gif"
								class="cover-photo-file-input"
								id="cover-photo-file-input"
								onchange={handleCoverPhotoUpload}
							/>
							<button type="button" class="upload-from-computer-btn" onclick={() => document.getElementById('cover-photo-file-input')?.click()}>
								{coverPhotoUploading ? 'Uploading…' : 'Upload from computer'}
							</button>
							<span class="cover-photo-or">or paste URL</span>
							<input
								type="text"
								id="coverPhoto"
								name="coverPhoto"
								bind:value={formData.coverPhoto}
								class="form-input"
								placeholder="https://…"
							/>
						</div>
					{/if}
				</div>
				
				<div class="step-actions">
					<button type="button" class="btn-secondary" onclick={() => goto('/trips')}>
						Cancel
					</button>
					<button type="button" class="btn-primary" onclick={nextStep}>
						Continue
					</button>
				</div>
				{:else if currentStep === 'rooms'}
				<!-- Step 2: Rooms -->
				<RoomsStep bind:formData {nextStep} {prevStep} />
			{:else if currentStep === 'pricing-policies'}
				<!-- Step 3: Pricing, Invites & Policies -->
				<PricingPoliciesStep bind:formData {nextStep} {prevStep} />
			{:else if currentStep === 'invite-people'}
				<!-- Step 4: Invite People -->
				<InvitePeopleStep bind:formData {nextStep} {prevStep} />
			{:else if currentStep === 'review'}
				<!-- Step 5: Review & Publish -->
				<ReviewStep {formData} {prevStep} numberOfNights={numberOfNights} />
			{/if}
		</div>
	</div>
</div>

<style>
	.wizard-page {
		position: relative;
		min-height: 100vh;
		background: #fafafa;
	}
	
	.wizard-background {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		z-index: 0;
		background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
		background-image: url('/images/homepage-bg.jpg');
		background-size: cover;
		background-position: center;
	}
	
	.background-overlay {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.5);
	}
	
	.step-indicator {
		position: relative;
		z-index: 10;
		padding: 2rem 0 1rem;
		background: #fff;
		border-bottom: 1px solid rgba(0, 0, 0, 0.08);
	}
	
	.step-indicator-content {
		max-width: 70%;
		margin: 0;
		margin-left: 15%;
		padding: 0 2rem;
		display: flex;
		align-items: center;
		justify-content: flex-start;
		flex-wrap: wrap;
		gap: 0.5rem;
	}
	
	.step-link {
		background: none;
		border: none;
		font-size: 0.95rem;
		color: rgba(0, 0, 0, 0.4);
		cursor: pointer;
		padding: 0.5rem 0.25rem;
		transition: color 0.2s ease;
		font-family: inherit;
		font-weight: 400;
	}
	
	.step-link:hover {
		color: rgba(0, 0, 0, 0.6);
	}
	
	.step-link.active {
		color: #000;
		font-weight: 600;
	}
	
	.step-separator {
		color: rgba(0, 0, 0, 0.2);
		font-size: 1.25rem;
		line-height: 1;
		margin: 0 0.25rem;
	}
	
	.wizard-content {
		position: relative;
		z-index: 5;
		width: 65%;
		margin: 0;
		margin-left: 15%;
		padding: 4rem 0;
	}
	
	.step-content {
		background: #fff;
		border-radius: 8px;
		padding: 3rem 2.5rem;
		box-shadow: 0 4px 20px rgba(0, 0, 0, 0.12);
	}
	
	.step-title {
		font-size: 3rem;
		font-weight: 700;
		margin-bottom: 3rem;
		color: #000;
		letter-spacing: -0.02em;
		line-height: 1.1;
	}
	
	.autofill-section {
		margin-bottom: 3rem;
		padding-bottom: 2rem;
		border-bottom: 1px solid rgba(0, 0, 0, 0.08);
	}
	
	.autofill-link {
		background: none;
		border: none;
		color: rgba(0, 0, 0, 0.5);
		font-size: 0.95rem;
		cursor: pointer;
		text-decoration: underline;
		text-underline-offset: 3px;
		text-decoration-color: rgba(0, 0, 0, 0.2);
		transition: color 0.2s ease;
		padding: 0;
		font-family: inherit;
	}
	
	.autofill-link:hover {
		color: rgba(0, 0, 0, 0.7);
		text-decoration-color: rgba(0, 0, 0, 0.4);
	}
	
	.autofill-input-wrapper {
		display: flex;
		gap: 0.75rem;
		align-items: center;
	}
	
	.autofill-input {
		flex: 1;
		padding: 0.75rem 1rem;
		border: 1px solid rgba(0, 0, 0, 0.1);
		border-radius: 8px;
		font-size: 0.95rem;
		font-family: inherit;
		background: white;
	}
	
	.autofill-input:focus {
		outline: none;
		border-color: rgba(0, 0, 0, 0.3);
	}
	
	.autofill-btn {
		padding: 0.75rem 1.5rem;
		background: #000;
		color: white;
		border: none;
		border-radius: 8px;
		font-size: 0.95rem;
		font-weight: 500;
		cursor: pointer;
		font-family: inherit;
		transition: background 0.2s ease;
	}
	
	.autofill-btn:hover:not(:disabled) {
		background: #333;
	}
	
	.autofill-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	
	.autofill-cancel {
		background: none;
		border: none;
		color: rgba(0, 0, 0, 0.5);
		font-size: 0.9rem;
		cursor: pointer;
		padding: 0.75rem 0.5rem;
		font-family: inherit;
	}
	
	.autofill-cancel:hover {
		color: rgba(0, 0, 0, 0.7);
	}
	
	.autofill-error {
		margin-top: 0.75rem;
		color: #d32f2f;
		font-size: 0.875rem;
	}
	
	.form-section {
		margin-bottom: 2.5rem;
	}
	
	.form-input {
		width: 100%;
		padding: 1rem 0;
		border: none;
		border-bottom: 1px solid rgba(0, 0, 0, 0.1);
		font-size: 1.125rem;
		font-family: inherit;
		background: transparent;
		color: #000;
		transition: border-color 0.2s ease;
	}
	
	.form-input.large {
		font-size: 1.5rem;
		font-weight: 600;
		padding: 1.25rem 0;
	}
	
	.form-input:focus {
		outline: none;
		border-bottom-color: #000;
	}
	
	.form-input::placeholder {
		color: rgba(0, 0, 0, 0.3);
		font-weight: 400;
	}
	
	.inline-fields {
		display: flex;
		align-items: center;
		gap: 1rem;
	}
	
	.field-separator {
		color: rgba(0, 0, 0, 0.3);
		font-size: 0.95rem;
		flex-shrink: 0;
	}
	
	.form-textarea {
		width: 100%;
		padding: 1rem 0;
		border: none;
		border-bottom: 1px solid rgba(0, 0, 0, 0.1);
		font-size: 1rem;
		font-family: inherit;
		background: transparent;
		color: #000;
		resize: none;
		transition: border-color 0.2s ease;
		line-height: 1.6;
	}
	
	.form-textarea:focus {
		outline: none;
		border-bottom-color: #000;
	}
	
	.form-textarea::placeholder {
		color: rgba(0, 0, 0, 0.3);
	}
	
	.section-label {
		font-size: 0.875rem;
		color: rgba(0, 0, 0, 0.5);
		font-weight: 400;
		margin-bottom: 0.75rem;
		display: block;
	}
	
	.helper-text {
		font-size: 0.875rem;
		color: rgba(0, 0, 0, 0.5);
		margin-top: 0.5rem;
	}
	
	.toggle-label {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		cursor: pointer;
	}
	
	.toggle-input {
		width: 18px;
		height: 18px;
		cursor: pointer;
	}
	
	.toggle-text {
		font-size: 1rem;
		color: rgba(0, 0, 0, 0.7);
	}
	
	.cover-photo-options {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}
	
	.cover-photo-file-input {
		position: absolute;
		width: 0.1px;
		height: 0.1px;
		opacity: 0;
		overflow: hidden;
		z-index: -1;
	}
	
	.upload-from-computer-btn {
		align-self: flex-start;
		padding: 0.75rem 1.5rem;
		background: #000;
		color: white;
		border: none;
		border-radius: 8px;
		font-size: 0.95rem;
		font-weight: 500;
		cursor: pointer;
		font-family: inherit;
		transition: background 0.2s ease;
	}
	
	.upload-from-computer-btn:hover:not(:disabled) {
		background: #333;
	}
	
	.upload-from-computer-btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}
	
	.cover-photo-or {
		font-size: 0.875rem;
		color: rgba(0, 0, 0, 0.5);
	}
	
	.cover-photo-preview {
		position: relative;
		width: 100%;
		aspect-ratio: 16 / 9;
		border-radius: 12px;
		overflow: hidden;
		margin-top: 1rem;
	}
	
	.cover-photo-preview img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	
	.remove-photo {
		position: absolute;
		top: 1rem;
		right: 1rem;
		background: rgba(0, 0, 0, 0.7);
		color: white;
		border: none;
		padding: 0.5rem 1rem;
		border-radius: 6px;
		cursor: pointer;
		font-size: 0.875rem;
		font-weight: 500;
		font-family: inherit;
	}
	
	.step-actions {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		margin-top: 4rem;
		padding-top: 2rem;
		border-top: 1px solid rgba(0, 0, 0, 0.08);
	}
	
	.btn-primary,
	.btn-secondary {
		padding: 1rem 2rem;
		border-radius: 8px;
		font-size: 1rem;
		font-weight: 500;
		cursor: pointer;
		font-family: inherit;
		transition: all 0.2s ease;
		border: none;
	}
	
	.btn-primary {
		background: #000;
		color: white;
	}
	
	.btn-primary:hover {
		background: #333;
	}
	
	.btn-secondary {
		background: transparent;
		color: rgba(0, 0, 0, 0.6);
	}
	
	.btn-secondary:hover {
		color: rgba(0, 0, 0, 0.8);
	}
	
	@media (max-width: 1024px) {
		.wizard-content {
			width: 85%;
			margin-left: 7.5%;
		}
		
		.step-indicator-content {
			max-width: 85%;
			margin-left: 7.5%;
		}
	}
	
	@media (max-width: 768px) {
		.wizard-content {
			width: 100%;
			margin-left: 0;
			padding: 2rem 1rem;
		}
		
		.step-content {
			padding: 2.5rem 1.5rem;
			border-radius: 0;
		}
		
		.step-title {
			font-size: 2rem;
			margin-bottom: 2rem;
		}
		
		.step-indicator-content {
			max-width: 100%;
			margin-left: 0;
			padding: 0 1rem;
			font-size: 0.875rem;
		}
		
		.inline-fields {
			flex-direction: column;
			align-items: stretch;
			gap: 1.5rem;
		}
		
		.field-separator {
			display: none;
		}
	}
</style>
