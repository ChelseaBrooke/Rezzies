<script lang="ts">
	const BASE_PRICE = 25;
	const DISCOUNT_CODE = 'BearsBestFriend#1';

	let {
		expectedGuests = 1,
		showSaveAsDraft = true,
		onPublish,
		onSaveDraft
	}: {
		expectedGuests?: number;
		showSaveAsDraft?: boolean;
		onPublish: (opts: { splitCost: boolean; discountWaived: boolean }) => Promise<void>;
		onSaveDraft?: (opts: { splitCost: boolean }) => Promise<void>;
	} = $props();

	let discountInput = $state('');
	let discountApplied = $state(false);
	let discountError = $state(false);
	let splitCost = $state(false);
	let isProcessing = $state(false);
	let publishError = $state<string | null>(null);

	const finalPrice = $derived(discountApplied ? 0 : BASE_PRICE);
	const safeExpected = $derived(Math.max(1, expectedGuests));
	const perPersonShare = $derived(BASE_PRICE / safeExpected);

	function applyDiscount() {
		if (discountInput.trim() === DISCOUNT_CODE) {
			discountApplied = true;
			discountError = false;
		} else {
			discountApplied = false;
			discountError = true;
		}
	}

	function handleDiscountKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') applyDiscount();
	}

	function removeDiscount() {
		discountApplied = false;
		discountError = false;
		discountInput = '';
	}

	/**
	 * Card capture is not integrated yet (no Stripe/Checkout in this repo).
	 * Returning true allows publish to proceed; replace with a real payment
	 * flow when you have a processor, and return false if the charge fails.
	 */
	async function processPayment(_amount: number): Promise<boolean> {
		return true;
	}

	async function handlePublish() {
		isProcessing = true;
		publishError = null;
		try {
			if (finalPrice > 0) {
				const paid = await processPayment(finalPrice);
				if (!paid) throw new Error('Payment could not be processed. Please try again.');
			}
			await onPublish({ splitCost, discountWaived: discountApplied });
		} catch (e) {
			publishError = e instanceof Error ? e.message : 'Something went wrong. Please try again.';
		} finally {
			isProcessing = false;
		}
	}

	async function handleSaveDraftClick() {
		if (!onSaveDraft) return;
		isProcessing = true;
		publishError = null;
		try {
			await onSaveDraft({ splitCost });
		} catch (e) {
			publishError = e instanceof Error ? e.message : 'Something went wrong. Please try again.';
		} finally {
			isProcessing = false;
		}
	}

	const ctaLabel = $derived(() => {
		if (isProcessing) return finalPrice === 0 ? 'Publishing…' : 'Processing…';
		return finalPrice === 0 ? 'Publish Trip' : 'Publish';
	});
</script>

<div class="publish-screen">
	<div class="screen-header">
		<h1 class="screen-title">Publish your trip</h1>
		<p class="screen-subtitle">Invite guests and start planning together</p>
	</div>

	<div class="content-grid">
		<div class="left-col">
			<div class="card pricing-card">
				<div class="card-header">
					<span class="card-label">Divvi Trip Fee</span>
					<div class="price-display">
						{#if discountApplied}
							<span class="price-original">${BASE_PRICE.toFixed(2)}</span>
							<span class="price-final free">$0.00</span>
						{:else}
							<span class="price-final">${BASE_PRICE.toFixed(2)}</span>
						{/if}
					</div>
				</div>
				<p class="price-description">
					One-time fee to create and share your trip with guests. No subscriptions, no recurring charges.
				</p>
			</div>

			<div class="card discount-card">
				<div class="discount-label">
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/>
						<line x1="7" y1="7" x2="7.01" y2="7"/>
					</svg>
					Discount Code
				</div>

				{#if discountApplied}
					<div class="discount-applied-row">
						<div class="discount-success">
							<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
								<polyline points="20 6 9 17 4 12"/>
							</svg>
							Discount applied, trip fee is free!
						</div>
						<button type="button" class="btn-remove-discount" onclick={removeDiscount}>
							Remove
						</button>
					</div>
				{:else}
					<div class="discount-input-row">
						<input
							type="text"
							class="discount-input"
							class:error={discountError}
							placeholder="Enter discount code"
							bind:value={discountInput}
							onkeydown={handleDiscountKeydown}
						/>
						<button
							type="button"
							class="btn-apply"
							onclick={applyDiscount}
							disabled={!discountInput.trim()}
						>
							Apply
						</button>
					</div>
					{#if discountError}
						<p class="discount-error">Invalid code. Please check and try again.</p>
					{/if}
				{/if}
			</div>

			<div class="card split-card">
				<label class="split-label">
					<div class="checkbox-wrapper">
						<input type="checkbox" bind:checked={splitCost} />
						<span class="checkbox-custom"></span>
					</div>
					<div class="split-label-text">
						<span class="split-title">Split this cost between your guests</span>
						<span class="split-subtitle">Factor the fee into your trip pricing</span>
					</div>
				</label>

				{#if splitCost}
					<div class="split-details">
						<div class="split-detail-row">
							<span class="split-detail-label">Estimated per person</span>
							<span class="split-detail-value">
								${perPersonShare.toFixed(2)}
							</span>
						</div>
						<div class="split-detail-row">
							<span class="split-detail-label">Based on min headcount (realistic low)</span>
							<span class="split-detail-value">{safeExpected} {safeExpected === 1 ? 'person' : 'people'}</span>
						</div>
						<p class="split-note">
							We'll automatically factor this into your trip pricing so each guest contributes a small portion.
							If that minimum headcount is reached, your total cost will be fully covered.
						</p>
					</div>
				{/if}
			</div>
		</div>

		<div class="right-col">
			<div class="card summary-card">
				<h3 class="summary-title">Order Summary</h3>

				<div class="summary-line">
					<span>Divvi Trip Fee</span>
					<span>${BASE_PRICE.toFixed(2)}</span>
				</div>

				{#if discountApplied}
					<div class="summary-line discount-line">
						<span>Discount (BearsBestFriend#1)</span>
						<span>−${BASE_PRICE.toFixed(2)}</span>
					</div>
				{/if}

				{#if splitCost && safeExpected > 1}
					<div class="summary-line muted-line">
						<span>Split across {safeExpected} people (min headcount)</span>
						<span>${perPersonShare.toFixed(2)}/person</span>
					</div>
				{/if}

				<div class="summary-divider"></div>

				<div class="summary-total">
					<span>You pay now</span>
					<span class="total-amount" class:free={discountApplied}>
						{discountApplied ? '$0.00' : `$${finalPrice.toFixed(2)}`}
					</span>
				</div>

				{#if discountApplied}
					<p class="free-badge">🎉 Free with your discount code</p>
				{/if}
			</div>

			<div class="card perks-card">
				<h4 class="perks-title">What's included</h4>
				<ul class="perks-list">
					<li>
						<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
						Shareable trip link for guests
					</li>
					<li>
						<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
						RSVP & room selection
					</li>
					<li>
						<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
						Polls, games & group chat
					</li>
					<li>
						<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
						Itinerary & meal planning
					</li>
					<li>
						<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
						Host approval for all joiners
					</li>
				</ul>
			</div>

			{#if publishError}
				<div class="publish-error">{publishError}</div>
			{/if}

			<div class="cta-stack">
				<button
					type="button"
					class="btn-publish"
					onclick={handlePublish}
					disabled={isProcessing}
				>
					{ctaLabel()}
					{#if finalPrice > 0 && !discountApplied}
						<span class="btn-price-badge">${finalPrice.toFixed(2)}</span>
					{/if}
				</button>

				{#if showSaveAsDraft && onSaveDraft}
					<button
						type="button"
						class="btn-draft"
						onclick={handleSaveDraftClick}
						disabled={isProcessing}
					>
						Save as Draft
					</button>

					<p class="draft-note">
						Drafts are private. Guests can't join until you publish.
					</p>
				{/if}
			</div>
		</div>
	</div>
</div>

<style>
	.publish-screen {
		display: flex;
		flex-direction: column;
		gap: 2rem;
		padding-bottom: 2rem;
	}

	.screen-header {
		padding-bottom: 1.5rem;
		border-bottom: 1px solid var(--border);
	}

	.screen-title {
		font-size: 1.75rem;
		font-weight: 700;
		color: var(--text);
		margin: 0 0 0.375rem;
		letter-spacing: -0.02em;
	}

	.screen-subtitle {
		font-size: 1rem;
		color: var(--muted);
		margin: 0;
	}

	.content-grid {
		display: grid;
		grid-template-columns: 1fr 380px;
		gap: 1.5rem;
		align-items: start;
	}

	.left-col,
	.right-col {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.card {
		background: white;
		border: 1px solid var(--border);
		border-radius: 0.875rem;
		padding: 1.25rem 1.5rem;
	}

	.pricing-card .card-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: 0.75rem;
	}

	.card-label {
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--muted);
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}

	.price-display {
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
	}

	.price-original {
		font-size: 1rem;
		color: var(--muted);
		text-decoration: line-through;
	}

	.price-final {
		font-size: 2rem;
		font-weight: 800;
		color: var(--text);
		line-height: 1;
		letter-spacing: -0.03em;
	}

	.price-final.free {
		color: #16a34a;
	}

	.price-description {
		font-size: 0.875rem;
		color: var(--muted);
		margin: 0;
		line-height: 1.5;
	}

	.discount-label {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--text);
		margin-bottom: 0.875rem;
	}

	.discount-input-row {
		display: flex;
		gap: 0.5rem;
	}

	.discount-input {
		flex: 1;
		padding: 0.625rem 0.875rem;
		border: 1px solid var(--border);
		border-radius: 0.5rem;
		font-size: 0.9375rem;
		font-family: inherit;
		color: var(--text);
		background: var(--bg, #fafafa);
		transition: border-color 0.15s;
		outline: none;
	}

	.discount-input:focus {
		border-color: var(--primary);
		background: white;
	}

	.discount-input.error {
		border-color: var(--danger, #ef4444);
	}

	.btn-apply {
		padding: 0.625rem 1.125rem;
		background: var(--primary);
		color: white;
		border: none;
		border-radius: 0.5rem;
		font-size: 0.875rem;
		font-weight: 600;
		font-family: inherit;
		cursor: pointer;
		white-space: nowrap;
		transition: background 0.15s, opacity 0.15s;
	}

	.btn-apply:hover:not(:disabled) {
		background: var(--primary-dark, #1e3a8a);
	}

	.btn-apply:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}

	.discount-error {
		font-size: 0.8125rem;
		color: var(--danger, #ef4444);
		margin: 0.5rem 0 0;
	}

	.discount-applied-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
	}

	.discount-success {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.9rem;
		font-weight: 600;
		color: #16a34a;
	}

	.btn-remove-discount {
		font-size: 0.8125rem;
		color: var(--muted);
		background: none;
		border: none;
		cursor: pointer;
		padding: 0;
		font-family: inherit;
		text-decoration: underline;
		text-underline-offset: 2px;
	}

	.btn-remove-discount:hover {
		color: var(--text);
	}

	.split-label {
		display: flex;
		align-items: flex-start;
		gap: 0.75rem;
		cursor: pointer;
	}

	.checkbox-wrapper {
		position: relative;
		flex-shrink: 0;
		margin-top: 2px;
	}

	.checkbox-wrapper input[type='checkbox'] {
		position: absolute;
		opacity: 0;
		width: 0;
		height: 0;
	}

	.checkbox-custom {
		display: block;
		width: 18px;
		height: 18px;
		border: 2px solid var(--border);
		border-radius: 4px;
		background: white;
		transition: all 0.15s;
		cursor: pointer;
	}

	.checkbox-wrapper input[type='checkbox']:checked + .checkbox-custom {
		background: var(--primary);
		border-color: var(--primary);
	}

	.checkbox-wrapper input[type='checkbox']:checked + .checkbox-custom::after {
		content: '';
		display: block;
		width: 10px;
		height: 6px;
		border-left: 2px solid white;
		border-bottom: 2px solid white;
		transform: rotate(-45deg) translate(2px, 1px);
	}

	.split-label-text {
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
	}

	.split-title {
		font-size: 0.9375rem;
		font-weight: 600;
		color: var(--text);
	}

	.split-subtitle {
		font-size: 0.8125rem;
		color: var(--muted);
	}

	.split-details {
		margin-top: 1rem;
		padding: 1rem;
		background: var(--bg, #f8fafc);
		border-radius: 0.625rem;
		border: 1px solid var(--border);
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.split-detail-row {
		display: flex;
		justify-content: space-between;
		font-size: 0.875rem;
	}

	.split-detail-label {
		color: var(--muted);
	}

	.split-detail-value {
		font-weight: 600;
		color: var(--text);
	}

	.split-note {
		font-size: 0.8125rem;
		color: var(--muted);
		margin: 0.375rem 0 0;
		line-height: 1.5;
		border-top: 1px solid var(--border);
		padding-top: 0.625rem;
	}

	.summary-title {
		font-size: 1rem;
		font-weight: 700;
		color: var(--text);
		margin: 0 0 1rem;
	}

	.summary-line {
		display: flex;
		justify-content: space-between;
		font-size: 0.9rem;
		color: var(--text);
		padding: 0.3125rem 0;
	}

	.discount-line {
		color: #16a34a;
		font-weight: 500;
	}

	.muted-line {
		color: var(--muted);
		font-size: 0.8125rem;
	}

	.summary-divider {
		border: none;
		border-top: 1px solid var(--border);
		margin: 0.75rem 0;
	}

	.summary-total {
		display: flex;
		justify-content: space-between;
		align-items: center;
		font-weight: 700;
		font-size: 1rem;
		color: var(--text);
	}

	.total-amount {
		font-size: 1.375rem;
		font-weight: 800;
		letter-spacing: -0.02em;
	}

	.total-amount.free {
		color: #16a34a;
	}

	.free-badge {
		margin: 0.75rem 0 0;
		font-size: 0.875rem;
		color: #16a34a;
		font-weight: 500;
		text-align: center;
		padding: 0.5rem;
		background: #f0fdf4;
		border-radius: 0.5rem;
	}

	.perks-card {
		background: var(--bg, #f8fafc);
		border-color: transparent;
	}

	.perks-title {
		font-size: 0.8125rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--muted);
		margin: 0 0 0.75rem;
	}

	.perks-list {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.perks-list li {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.875rem;
		color: var(--text);
	}

	.perks-list li svg {
		color: var(--primary);
		flex-shrink: 0;
	}

	.publish-error {
		padding: 0.75rem 1rem;
		background: rgba(239, 68, 68, 0.08);
		border: 1px solid rgba(239, 68, 68, 0.2);
		border-radius: 0.5rem;
		font-size: 0.875rem;
		color: var(--danger, #ef4444);
	}

	.cta-stack {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.btn-publish {
		width: 100%;
		padding: 1rem 1.5rem;
		background: var(--primary);
		color: white;
		border: none;
		border-radius: 0.75rem;
		font-size: 1rem;
		font-weight: 700;
		font-family: inherit;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.625rem;
		transition: background 0.15s, transform 0.1s, opacity 0.15s;
		letter-spacing: -0.01em;
	}

	.btn-publish:hover:not(:disabled) {
		background: var(--primary-dark, #1e3a8a);
		transform: translateY(-1px);
	}

	.btn-publish:active:not(:disabled) {
		transform: translateY(0);
	}

	.btn-publish:disabled {
		opacity: 0.55;
		cursor: not-allowed;
	}

	.btn-price-badge {
		background: rgba(255, 255, 255, 0.2);
		padding: 0.125rem 0.5rem;
		border-radius: 99px;
		font-size: 0.875rem;
		font-weight: 600;
	}

	.btn-draft {
		width: 100%;
		padding: 0.875rem 1.5rem;
		background: white;
		color: var(--text);
		border: 1.5px solid var(--border);
		border-radius: 0.75rem;
		font-size: 0.9375rem;
		font-weight: 600;
		font-family: inherit;
		cursor: pointer;
		transition: background 0.15s, border-color 0.15s, opacity 0.15s;
	}

	.btn-draft:hover:not(:disabled) {
		background: var(--bg, #f8fafc);
		border-color: var(--text);
	}

	.btn-draft:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.draft-note {
		font-size: 0.8125rem;
		color: var(--muted);
		text-align: center;
		margin: 0;
	}

	@media (max-width: 900px) {
		.content-grid {
			grid-template-columns: 1fr;
		}

		.right-col {
			order: -1;
		}
	}

	@media (max-width: 640px) {
		.screen-title {
			font-size: 1.5rem;
		}

		.price-final {
			font-size: 1.625rem;
		}
	}
</style>
