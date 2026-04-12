<script lang="ts">
	import { dev } from '$app/environment';
	import { loadStripe, type Stripe, type StripeElements } from '@stripe/stripe-js';

	const BASE_PRICE = 25;

	let {
		open = false,
		expectedGuests = 1,
		showSaveAsDraft = true,
		tripId = undefined,
		onPublish,
		onSaveDraft,
		onClose
	}: {
		open?: boolean;
		expectedGuests?: number;
		showSaveAsDraft?: boolean;
		tripId?: string;
		onPublish: (opts: {
			splitCost: boolean;
			discountWaived: boolean;
			discountCode?: string;
			paymentIntentId?: string;
		}) => Promise<void>;
		onSaveDraft?: (opts: { splitCost: boolean }) => Promise<void>;
		onClose?: () => void;
	} = $props();

	let discountInput = $state('');
	let discountApplied = $state(false);
	let discountError = $state(false);
	let splitCost = $state(false);
	let isProcessing = $state(false);
	let publishError = $state<string | null>(null);

	let paymentElementContainer = $state<HTMLDivElement | null>(null);
	let stripeUi: { stripe: Stripe; elements: StripeElements } | null = null;
	let paymentReady = $state(false);
	let stripeDisabled = $state(false);
	let intentLoading = $state(false);
	let stripeSetupGeneration = 0;

	const finalPrice = $derived(discountApplied ? 0 : BASE_PRICE);
	const safeExpected = $derived(Math.max(1, expectedGuests));
	const perPersonShare = $derived(BASE_PRICE / safeExpected);

	function teardownStripeUI() {
		try {
			stripeUi?.elements.getElement('payment')?.destroy();
		} catch {
			/* ignore */
		}
		stripeUi = null;
		if (paymentElementContainer) paymentElementContainer.innerHTML = '';
	}

	$effect(() => {
		if (!open) {
			teardownStripeUI();
			intentLoading = false;
			return;
		}

		if (typeof window === 'undefined') return;

		const container = paymentElementContainer;
		const fp = finalPrice;
		const editorTripId = tripId;
		const payDisabled = stripeDisabled;

		if (!container || fp <= 0) {
			teardownStripeUI();
			intentLoading = false;
			return;
		}

		if (payDisabled) {
			teardownStripeUI();
			intentLoading = false;
			return;
		}

		const gen = ++stripeSetupGeneration;
		intentLoading = true;
		publishError = null;

		(async () => {
			try {
				teardownStripeUI();
				const res = await fetch('/api/stripe/create-publish-intent', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						...(editorTripId ? { tripId: editorTripId } : {})
					}),
					credentials: 'include'
				});
				const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
				if (gen !== stripeSetupGeneration) return;

				if (!res.ok) {
					publishError = (data.error as string) || `Could not start payment (${res.status})`;
					return;
				}
				if (data.stripeDisabled) {
					stripeDisabled = true;
					return;
				}
				if (data.waived) {
					return;
				}
				const clientSecret = data.clientSecret as string | undefined;
				const publishableKey = data.publishableKey as string | undefined;
				if (!clientSecret || !publishableKey) {
					publishError = 'Invalid payment setup response';
					return;
				}
				const stripe = await loadStripe(publishableKey);
				if (gen !== stripeSetupGeneration) return;
				if (!stripe) {
					publishError = 'Could not load Stripe';
					return;
				}
				const elements = stripe.elements({ clientSecret });
				const paymentElement = elements.create('payment', {
					layout: { type: 'accordion', defaultCollapsed: false },
					...(dev ? { wallets: { link: 'never' } } : {})
				});
				paymentElement.mount(container);
				stripeUi = { stripe, elements };
				paymentReady = true;
			} catch (e) {
				if (gen === stripeSetupGeneration) {
					publishError = e instanceof Error ? e.message : 'Payment setup failed';
				}
			} finally {
				if (gen === stripeSetupGeneration) intentLoading = false;
			}
		})();

		return () => {
			stripeSetupGeneration++;
			intentLoading = false;
			teardownStripeUI();
		};
	});

	async function applyDiscount() {
		try {
			const res = await fetch('/api/discount/validate', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ code: discountInput.trim() })
			});
			const data = await res.json().catch(() => ({}));
			if (res.ok && data.valid) {
				discountApplied = true;
				discountError = false;
			} else {
				discountApplied = false;
				discountError = true;
			}
		} catch {
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

	async function handlePublish() {
		isProcessing = true;
		publishError = null;
		try {
			let paymentIntentId: string | undefined;

			if (finalPrice > 0) {
				if (!stripeDisabled) {
					if (intentLoading || !paymentReady || !stripeUi) {
						throw new Error('Payment form is still loading. Please wait a moment.');
					}
					const returnUrl =
						typeof window !== 'undefined' ? window.location.href.split('#')[0] : undefined;
					const { error, paymentIntent } = await stripeUi.stripe.confirmPayment({
						elements: stripeUi.elements,
						confirmParams: { return_url: returnUrl ?? window.location.origin },
						redirect: 'if_required'
					});
					if (error) throw new Error(error.message);
					if (paymentIntent?.status !== 'succeeded') {
						throw new Error('Payment did not complete. Please try again.');
					}
					paymentIntentId = paymentIntent.id;
				}
			}

			await onPublish({
				splitCost,
				discountWaived: discountApplied,
				...(discountApplied ? { discountCode: discountInput.trim() } : {}),
				...(paymentIntentId ? { paymentIntentId } : {})
			});
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
		if (finalPrice > 0 && !stripeDisabled && intentLoading) return 'Loading payment…';
		return finalPrice === 0 ? 'Publish Trip' : 'Pay & publish';
	});

	const publishDisabled = $derived(
		isProcessing || (finalPrice > 0 && !stripeDisabled && (intentLoading || !paymentReady))
	);

	function handleBackdropClick(e: MouseEvent) {
		if (e.target === e.currentTarget) onClose?.();
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') onClose?.();
	}
</script>

{#if open}
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<div
		class="modal-backdrop"
		role="dialog"
		aria-modal="true"
		aria-label="Publish trip"
		onclick={handleBackdropClick}
		onkeydown={handleKeydown}
	>
		<div class="modal-panel">
			<div class="modal-header">
				<div class="modal-header-left">
					<p class="modal-eyebrow">One-time trip fee</p>
					<div class="modal-price-row">
						{#if discountApplied}
							<span class="modal-price-strike">${BASE_PRICE.toFixed(2)}</span>
							<span class="modal-price free">$0</span>
						{:else}
							<span class="modal-price">${finalPrice.toFixed(2)}</span>
						{/if}
					</div>
				</div>
				{#if onClose}
					<button class="modal-close" type="button" onclick={onClose} aria-label="Close">
						<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
							<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
						</svg>
					</button>
				{/if}
			</div>

			<div class="modal-body">
				<!-- Stripe Payment Element -->
				{#if finalPrice > 0 && !stripeDisabled}
					<div
						class="payment-element-mount"
						bind:this={paymentElementContainer}
						data-testid="stripe-payment-element"
					></div>
				{:else if finalPrice > 0 && stripeDisabled}
					<p class="stripe-dev-note">
						Add <code>STRIPE_SECRET_KEY</code> and <code>STRIPE_PUBLISHABLE_KEY</code> to <code>.env</code> and restart dev.
					</p>
				{/if}

				{#if publishError}
					<div class="publish-error">{publishError}</div>
				{/if}

				<!-- Discount -->
				<div class="checkout-discount">
					<div class="discount-label">
						<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/>
							<line x1="7" y1="7" x2="7.01" y2="7"/>
						</svg>
						Discount Code
					</div>

					{#if discountApplied}
						<div class="discount-applied-row">
							<div class="discount-success">
								<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
								Fee waived!
							</div>
							<button type="button" class="btn-remove-discount" onclick={removeDiscount}>Remove</button>
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

				<!-- Split fee toggle -->
				<label class="checkout-split-inline">
					<div class="checkbox-wrapper">
						<input type="checkbox" bind:checked={splitCost} />
						<span class="checkbox-custom"></span>
					</div>
					<span class="checkout-split-text">
						Split this invoice with your guests (est., ${perPersonShare.toFixed(2)} per guest, if {safeExpected}
						{safeExpected === 1 ? 'guest' : 'guests'})
					</span>
				</label>

				<!-- CTAs -->
				<div class="cta-stack">
					<button
						type="button"
						class="btn-publish"
						onclick={handlePublish}
						disabled={publishDisabled}
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
					{/if}
				</div>
			</div>
		</div>
	</div>
{/if}

<style>
	.modal-backdrop {
		position: fixed;
		inset: 0;
		z-index: 1000;
		background: rgba(15, 23, 42, 0.55);
		backdrop-filter: blur(3px);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1.5rem;
	}

	.modal-panel {
		background: white;
		border-radius: 1.125rem;
		box-shadow:
			0 4px 6px rgba(15, 23, 42, 0.04),
			0 24px 60px rgba(15, 23, 42, 0.15);
		width: 100%;
		max-width: 420px;
		max-height: calc(100dvh - 3rem);
		overflow-y: auto;
		display: flex;
		flex-direction: column;
	}

	.modal-header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1rem;
		padding: 1.35rem 1.35rem 1.1rem;
		border-bottom: 1px solid rgba(15, 23, 42, 0.07);
		background: linear-gradient(135deg, #eff6ff 0%, #eef2ff 100%);
		border-radius: 1.125rem 1.125rem 0 0;
	}

	.modal-header-left {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
	}

	.modal-eyebrow {
		font-size: 0.7rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: #6366f1;
		margin: 0;
	}

	.modal-price-row {
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
	}

	.modal-price {
		font-family: 'Fraunces', Georgia, serif;
		font-size: 2.75rem;
		font-weight: 800;
		letter-spacing: -0.04em;
		color: var(--text);
		line-height: 1;
	}

	.modal-price.free {
		color: #16a34a;
	}

	.modal-price-strike {
		font-size: 1.1rem;
		color: var(--muted);
		text-decoration: line-through;
		align-self: center;
	}

	.modal-close {
		width: 2rem;
		height: 2rem;
		display: flex;
		align-items: center;
		justify-content: center;
		border: none;
		background: transparent;
		color: var(--muted);
		cursor: pointer;
		border-radius: 0.375rem;
		transition: background 0.15s, color 0.15s;
	}

	.modal-close:hover {
		background: var(--bg, #f8fafc);
		color: var(--text);
	}

	.modal-body {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		padding: 1.25rem 1.35rem 1.5rem;
	}

	/* Discount section */
	.checkout-discount {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.discount-label {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.8125rem;
		font-weight: 600;
		color: var(--text);
	}

	.discount-input-row {
		display: flex;
		gap: 0.5rem;
	}

	.discount-input {
		flex: 1;
		padding: 0.55rem 0.75rem;
		border: 1px solid var(--border);
		border-radius: 0.5rem;
		font-size: 0.9rem;
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
		padding: 0.55rem 1rem;
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
		font-size: 0.8rem;
		color: var(--danger, #ef4444);
		margin: 0;
	}

	.discount-applied-row {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.discount-success {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.875rem;
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

	/* Stripe element */
	.payment-element-mount {
		min-height: 2.5rem;
		margin: 0 -0.1rem;
	}

	.stripe-dev-note {
		font-size: 0.8125rem;
		color: var(--muted);
		line-height: 1.5;
		margin: 0;
		padding: 0.75rem 1rem;
		background: var(--bg, #f8fafc);
		border-radius: 0.5rem;
		border: 1px dashed var(--border);
	}

	.stripe-dev-note code {
		font-size: 0.75rem;
	}

	/* Split toggle */
	.checkout-split-inline {
		display: flex;
		align-items: flex-start;
		gap: 0.6rem;
		cursor: pointer;
		font-size: 0.8125rem;
		line-height: 1.45;
		color: var(--text);
	}

	.checkout-split-text {
		font-weight: 500;
		color: var(--muted);
	}

	.checkbox-wrapper {
		position: relative;
		flex-shrink: 0;
		margin-top: 1px;
	}

	.checkbox-wrapper input[type='checkbox'] {
		position: absolute;
		opacity: 0;
		width: 0;
		height: 0;
	}

	.checkbox-custom {
		display: block;
		width: 17px;
		height: 17px;
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
		width: 9px;
		height: 5px;
		border-left: 2px solid white;
		border-bottom: 2px solid white;
		transform: rotate(-45deg) translate(2px, 1px);
	}

	/* CTAs */
	.publish-error {
		padding: 0.55rem 0.65rem;
		background: rgba(239, 68, 68, 0.08);
		border: 1px solid rgba(239, 68, 68, 0.2);
		border-radius: 0.45rem;
		font-size: 0.8125rem;
		line-height: 1.4;
		color: var(--danger, #ef4444);
	}

	.cta-stack {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.btn-publish {
		width: 100%;
		padding: 0.875rem 1.15rem;
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
		padding: 0.65rem 1.15rem;
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
</style>
