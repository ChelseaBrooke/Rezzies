<script lang="ts">
	import { dev } from '$app/environment';
	import { loadStripe, type Stripe, type StripeElements } from '@stripe/stripe-js';

	const BASE_PRICE = 25;

	let {
		expectedGuests = 1,
		showSaveAsDraft = true,
		tripId = undefined,
		onPublish,
		onSaveDraft
	}: {
		expectedGuests?: number;
		showSaveAsDraft?: boolean;
		/** When publishing an existing draft from the trip editor */
		tripId?: string;
		onPublish: (opts: {
			splitCost: boolean;
			discountWaived: boolean;
			discountCode?: string;
			paymentIntentId?: string;
		}) => Promise<void>;
		onSaveDraft?: (opts: { splitCost: boolean }) => Promise<void>;
	} = $props();

	let discountInput = $state('');
	let discountApplied = $state(false);
	let discountError = $state(false);
	let splitCost = $state(false);
	let isProcessing = $state(false);
	let publishError = $state<string | null>(null);

	let paymentElementContainer = $state<HTMLDivElement | null>(null);
	/** Not $state: assigning a Stripe instance was retriggering $effect and spamming create-intent / loadStripe */
	let stripeUi: { stripe: Stripe; elements: StripeElements } | null = null;
	let paymentReady = $state(false);
	let stripeDisabled = $state(false);
	let intentLoading = $state(false);
	/** Bumps on effect cleanup so stale async work never leaves intentLoading stuck true */
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
				// In dev, Link often pre-selects a saved bank/card that fails until verified; use plain card + test numbers.
				const paymentElement = elements.create('payment', {
					layout: {
						type: 'accordion',
						defaultCollapsed: false
					},
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
						confirmParams: {
							return_url: returnUrl ?? window.location.origin
						},
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
		isProcessing ||
			(finalPrice > 0 && !stripeDisabled && (intentLoading || !paymentReady))
	);
</script>

<div class="publish-screen">
	<div class="content-grid">
		<div class="left-col">
			<header class="sales-hero">
				<p class="sales-eyebrow">Almost there</p>
				<h1 class="sales-title">Your group trip, finally under control.</h1>
				<p class="sales-lead">
					One link to share. Everyone RSVPs, picks a room, votes on the itinerary, and pays their share, all in one place. You stay in charge from the first invite to the last night.
				</p>
			</header>

			<div class="fee-highlight">
				<div class="fee-highlight-left">
					<p class="fee-highlight-label">One-time trip fee</p>
					<div class="fee-highlight-price">
						{#if discountApplied}
							<span class="fee-strike">${BASE_PRICE.toFixed(2)}</span>
							<span class="fee-amount free">$0</span>
						{:else}
							<span class="fee-amount">${BASE_PRICE.toFixed(2)}</span>
						{/if}
					</div>
					<p class="fee-highlight-sub">No subscription. No per-guest fees. One trip, one charge.</p>
				</div>
				<div class="fee-highlight-badges">
					<span class="fee-badge">🔒 Host approval</span>
					<span class="fee-badge">📊 Live headcount</span>
					<span class="fee-badge">🛏 Room splits</span>
				</div>
			</div>

			<div class="perks-grid">
				<div class="perk-card">
					<span class="perk-icon">✅</span>
					<div>
						<p class="perk-title">RSVPs you can trust</p>
						<p class="perk-body">Guests confirm, not just "maybe." You see real headcount before you commit to anything.</p>
					</div>
				</div>
				<div class="perk-card">
					<span class="perk-icon">🛏</span>
					<div>
						<p class="perk-title">No more room drama</p>
						<p class="perk-body">Everyone picks their own bed. Pricing updates live as more guests fill in.</p>
					</div>
				</div>
				<div class="perk-card">
					<span class="perk-icon">🗳</span>
					<div>
						<p class="perk-title">Group decisions, made easy</p>
						<p class="perk-body">Run polls on activities, meals, or anything. No more chasing replies in group chat.</p>
					</div>
				</div>
				<div class="perk-card">
					<span class="perk-icon">💸</span>
					<div>
						<p class="perk-title">Fair cost splitting</p>
						<p class="perk-body">Room costs, shared fees, add-ons, everyone sees exactly what they owe and why.</p>
					</div>
				</div>
			</div>

			<div class="social-proof">
				<p class="social-proof-text">"Finally, a way to organize a group trip that doesn't end in a group chat meltdown."</p>
				<p class="social-proof-attr">- A relieved trip host</p>
			</div>
		</div>

		<div class="right-col checkout-rail">
			<div class="checkout-panel">
				<div class="checkout-top">
					<span class="checkout-heading">Pay to publish</span>
				</div>

				<div class="checkout-discount">
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

				{#if finalPrice > 0 && !stripeDisabled}
					<div
						class="payment-element-mount"
						bind:this={paymentElementContainer}
						data-testid="stripe-payment-element"
					></div>
				{:else if finalPrice > 0 && stripeDisabled}
					<p class="stripe-dev-note">
						Add <code>STRIPE_SECRET_KEY</code> and <code>STRIPE_PUBLISHABLE_KEY</code> to <code>.env</code>,
						restart dev, or publish without card in this environment.
					</p>
				{/if}

				{#if publishError}
					<div class="publish-error">{publishError}</div>
				{/if}

				<label class="checkout-split-inline">
					<div class="checkbox-wrapper">
						<input type="checkbox" bind:checked={splitCost} />
						<span class="checkbox-custom"></span>
					</div>
					<span class="checkout-split-text">
						Split this invoice with your guests (est., {perPersonShare.toFixed(2)} per guest, if {safeExpected}
						{safeExpected === 1 ? 'guest' : 'guests'})
					</span>
				</label>

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
</div>

<style>
	.publish-screen {
		display: flex;
		flex-direction: column;
		gap: 0;
		padding-bottom: 2rem;
	}

	.content-grid {
		display: grid;
		grid-template-columns: minmax(0, 1.2fr) minmax(252px, 320px);
		gap: 2.25rem;
		align-items: start;
	}

	.left-col,
	.right-col {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}

	.checkout-rail {
		position: relative;
	}

	/* ── Left column: hero ── */
	.sales-hero {
		padding-bottom: 0.25rem;
	}

	.sales-eyebrow {
		font-size: 0.75rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: var(--primary, #2F7778);
		margin: 0 0 0.6rem;
	}

	.sales-title {
		font-family: 'Fraunces', Georgia, serif;
		font-size: clamp(1.85rem, 3.2vw, 2.55rem);
		font-weight: 700;
		color: var(--text);
		margin: 0 0 1rem;
		letter-spacing: -0.035em;
		line-height: 1.12;
	}

	.sales-lead {
		font-size: 1.0625rem;
		line-height: 1.7;
		color: var(--muted);
		margin: 0;
		max-width: 36rem;
	}

	/* ── Fee highlight block ── */
	.fee-highlight {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1.5rem;
		padding: 1.25rem 1.5rem;
		background: linear-gradient(135deg, #eff6ff 0%, #eef2ff 100%);
		border: 1px solid rgba(99, 102, 241, 0.18);
		border-radius: 1rem;
	}

	.fee-highlight-left {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.fee-highlight-label {
		font-size: 0.75rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.07em;
		color: #6366f1;
		margin: 0;
	}

	.fee-highlight-price {
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
	}

	.fee-strike {
		font-size: 1.25rem;
		color: var(--muted);
		text-decoration: line-through;
	}

	.fee-amount {
		font-family: 'Fraunces', Georgia, serif;
		font-size: 2.6rem;
		font-weight: 800;
		letter-spacing: -0.04em;
		color: var(--text);
		line-height: 1;
	}

	.fee-amount.free {
		color: #16a34a;
	}

	.fee-highlight-sub {
		font-size: 0.8125rem;
		color: var(--muted);
		margin: 0;
		line-height: 1.5;
	}

	.fee-highlight-badges {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		align-items: flex-end;
		flex-shrink: 0;
	}

	.fee-badge {
		font-size: 0.75rem;
		font-weight: 600;
		color: #3730a3;
		background: rgba(99, 102, 241, 0.1);
		border: 1px solid rgba(99, 102, 241, 0.18);
		padding: 0.25rem 0.55rem;
		border-radius: 99px;
		white-space: nowrap;
	}

	/* ── Perks grid ── */
	.perks-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.875rem;
	}

	.perk-card {
		display: flex;
		align-items: flex-start;
		gap: 0.75rem;
		padding: 1rem 1.1rem;
		background: white;
		border: 1px solid var(--border);
		border-radius: 0.875rem;
		box-shadow: 0 1px 3px rgba(15, 23, 42, 0.04);
		transition: box-shadow 0.15s, border-color 0.15s;
	}

	.perk-card:hover {
		border-color: rgba(99, 102, 241, 0.3);
		box-shadow: 0 3px 12px rgba(99, 102, 241, 0.08);
	}

	.perk-icon {
		font-size: 1.35rem;
		line-height: 1;
		flex-shrink: 0;
		margin-top: 0.1rem;
	}

	.perk-title {
		font-size: 0.9rem;
		font-weight: 700;
		color: var(--text);
		margin: 0 0 0.25rem;
		line-height: 1.3;
	}

	.perk-body {
		font-size: 0.8125rem;
		color: var(--muted);
		margin: 0;
		line-height: 1.5;
	}

	/* ── Social proof ── */
	.social-proof {
		padding: 1.1rem 1.35rem;
		background: rgba(248, 250, 252, 0.8);
		border-left: 3px solid var(--primary, #2F7778);
		border-radius: 0 0.75rem 0.75rem 0;
	}

	.social-proof-text {
		font-size: 0.9375rem;
		font-style: italic;
		color: var(--text);
		margin: 0 0 0.4rem;
		line-height: 1.55;
	}

	.social-proof-attr {
		font-size: 0.8rem;
		font-weight: 600;
		color: var(--muted);
		margin: 0;
	}

	.checkout-panel {
		position: sticky;
		top: 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.875rem;
		padding: 1.1rem 1.1rem 1rem;
		background: linear-gradient(180deg, #ffffff 0%, #fafbfc 100%);
		border: 1px solid var(--border);
		border-radius: 1rem;
		box-shadow:
			0 1px 2px rgba(15, 23, 42, 0.04),
			0 16px 36px rgba(15, 23, 42, 0.07);
	}

	.checkout-top {
		display: flex;
		align-items: center;
		padding-bottom: 0.65rem;
		border-bottom: 1px solid rgba(15, 23, 42, 0.06);
	}

	.checkout-heading {
		font-family: 'Fraunces', Georgia, serif;
		font-size: 1.125rem;
		font-weight: 700;
		letter-spacing: -0.02em;
		color: var(--text);
	}

	.checkout-discount {
		padding-bottom: 0.15rem;
	}

	.checkout-discount .discount-label {
		margin-bottom: 0.5rem;
		font-size: 0.8125rem;
	}

	.checkout-discount .discount-input-row {
		flex-direction: column;
		align-items: stretch;
		gap: 0.5rem;
	}

	.checkout-discount .btn-apply {
		width: 100%;
	}

	.checkout-discount .discount-applied-row {
		flex-direction: column;
		align-items: flex-start;
		gap: 0.5rem;
	}

	.checkout-split-inline {
		display: flex;
		align-items: flex-start;
		gap: 0.65rem;
		cursor: pointer;
		margin: 0.25rem 0 0;
		padding: 0.35rem 0 0;
		font-size: 0.8125rem;
		line-height: 1.45;
		color: var(--text);
	}

	.checkout-split-text {
		font-weight: 500;
		color: var(--muted);
	}

	.payment-element-mount {
		min-height: 2.5rem;
		margin: 0 -0.15rem;
	}

	.card {
		background: white;
		border: 1px solid var(--border);
		border-radius: 0.875rem;
		padding: 1.25rem 1.5rem;
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
		background: var(--primaryHover, #245a5b);
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

	.publish-error {
		padding: 0.55rem 0.65rem;
		background: rgba(239, 68, 68, 0.08);
		border: 1px solid rgba(239, 68, 68, 0.2);
		border-radius: 0.45rem;
		font-size: 0.8125rem;
		line-height: 1.4;
		color: var(--danger, #ef4444);
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

	.cta-stack {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.btn-publish {
		width: 100%;
		padding: 0.85rem 1.15rem;
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
		background: var(--primaryHover, #245a5b);
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

	@media (max-width: 900px) {
		.content-grid {
			grid-template-columns: 1fr;
			gap: 1.75rem;
		}

		.checkout-panel {
			position: static;
			top: auto;
		}
	}

	@media (max-width: 640px) {
		.sales-title {
			font-size: 1.6rem;
		}

		.fee-amount {
			font-size: 2rem;
		}

		.fee-highlight {
			flex-direction: column;
			gap: 1rem;
		}

		.fee-highlight-badges {
			flex-direction: row;
			flex-wrap: wrap;
			align-items: flex-start;
		}

		.perks-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
