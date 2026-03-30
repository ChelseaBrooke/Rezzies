import Stripe from 'stripe';
import { env } from '$env/dynamic/private';
import { prisma } from '$lib/server/prisma.js';
import { PLATFORM_PUBLISH_FEE_CENTS } from '$lib/server/platform-publish-fee.js';

export { PLATFORM_PUBLISH_DISCOUNT_CODE, shouldWaivePlatformFee } from '$lib/server/platform-publish-fee.js';

function stripeSecretKey(): string | undefined {
	const k = env.STRIPE_SECRET_KEY?.trim();
	return k || undefined;
}

/** Publishable key: prefer STRIPE_PUBLISHABLE_KEY; STRIPE_PUBLIC_KEY is a common alternate name. */
function stripePublishableKey(): string | undefined {
	const a = env.STRIPE_PUBLISHABLE_KEY?.trim();
	const b = env.STRIPE_PUBLIC_KEY?.trim();
	return (a || b) || undefined;
}

/**
 * Ensures secret + publishable keys are the same mode (test vs live).
 * Mismatched account pairs (two different pk_test from two accounts) are not detectable here —
 * copy both keys from the same place: Stripe Dashboard → Developers → API keys.
 */
function assertPublishableKeyMatchesSecretMode(): void {
	const sk = stripeSecretKey();
	const pk = stripePublishableKey();
	if (!sk || !pk) return;

	const secretTest = sk.startsWith('sk_test_');
	const secretLive = sk.startsWith('sk_live_');
	const pubTest = pk.startsWith('pk_test_');
	const pubLive = pk.startsWith('pk_live_');

	if (!secretTest && !secretLive) {
		throw new Error(
			'Stripe STRIPE_SECRET_KEY must start with sk_test_ or sk_live_ (same Dashboard as your publishable key).'
		);
	}
	if (!pubTest && !pubLive) {
		throw new Error(
			'Stripe publishable key must start with pk_test_ or pk_live_ (pair it with your secret key from the same account).'
		);
	}
	if (secretTest !== pubTest || secretLive !== pubLive) {
		throw new Error(
			'Stripe key mismatch: use sk_test_ with pk_test_, or sk_live_ with pk_live_ — both from the same Stripe account (Developers → API keys).'
		);
	}
}

let stripeClient: Stripe | null = null;
let cachedSecret: string | undefined;

export function isStripeConfigured(): boolean {
	return !!(stripeSecretKey() && stripePublishableKey());
}

export function getStripePublishableKey(): string | null {
	return stripePublishableKey() ?? null;
}

function getStripe(): Stripe {
	const sk = stripeSecretKey();
	if (!sk) {
		throw new Error('Stripe is not configured. Set STRIPE_SECRET_KEY and STRIPE_PUBLISHABLE_KEY in .env.');
	}
	if (!stripeClient || cachedSecret !== sk) {
		stripeClient = new Stripe(sk);
		cachedSecret = sk;
	}
	return stripeClient;
}

/**
 * Creates a PaymentIntent for the one-time publish fee (full amount charged to the host).
 */
export async function createPublishFeePaymentIntent(
	userId: string,
	opts?: { tripId?: string }
): Promise<{ clientSecret: string; paymentIntentId: string }> {
	assertPublishableKeyMatchesSecretMode();
	const stripe = getStripe();

	const pi = await stripe.paymentIntents.create({
		amount: PLATFORM_PUBLISH_FEE_CENTS,
		currency: 'usd',
		// Card only: hides Klarna, Amazon Pay, and other redirect methods from the Payment Element
		payment_method_types: ['card'],
		metadata: {
			userId,
			purpose: 'platform_publish_fee',
			...(opts?.tripId ? { tripId: opts.tripId } : {})
		}
	});

	if (!pi.client_secret) {
		throw new Error('Stripe did not return a client secret');
	}

	return { clientSecret: pi.client_secret, paymentIntentId: pi.id };
}

export async function verifyPublishPaymentIntent(
	paymentIntentId: string,
	expectedUserId: string
): Promise<{ ok: true } | { ok: false; reason: string }> {
	if (!isStripeConfigured()) {
		return { ok: true };
	}

	const stripe = getStripe();
	let pi: Stripe.PaymentIntent;
	try {
		pi = await stripe.paymentIntents.retrieve(paymentIntentId);
	} catch {
		return { ok: false, reason: 'Invalid payment reference' };
	}

	if (pi.status !== 'succeeded') {
		return { ok: false, reason: 'Payment has not completed yet' };
	}
	if (pi.amount !== PLATFORM_PUBLISH_FEE_CENTS) {
		return { ok: false, reason: 'Payment amount does not match the publish fee' };
	}
	if ((pi.currency || '').toLowerCase() !== 'usd') {
		return { ok: false, reason: 'Invalid currency' };
	}
	if (pi.metadata?.purpose !== 'platform_publish_fee') {
		return { ok: false, reason: 'Payment is not for a trip publish fee' };
	}
	if (pi.metadata?.userId !== expectedUserId) {
		return { ok: false, reason: 'Payment does not match this account' };
	}

	const alreadyUsed = await prisma.trip.findFirst({
		where: { publishFeePaymentIntentId: paymentIntentId },
		select: { id: true }
	});
	if (alreadyUsed) {
		return { ok: false, reason: 'This payment was already used to publish a trip' };
	}

	return { ok: true };
}
