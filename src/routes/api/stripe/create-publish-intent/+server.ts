import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSessionUser } from '$lib/server/session.js';
import { isTripHost } from '$lib/server/trip-access.js';
import {
	createPublishFeePaymentIntent,
	getStripePublishableKey,
	isStripeConfigured,
	shouldWaivePlatformFee
} from '$lib/server/stripe.js';

export const POST: RequestHandler = async ({ request, cookies }) => {
	const user = await getSessionUser(cookies);
	if (!user) {
		return json({ error: 'You must be logged in' }, { status: 401 });
	}

	let body: Record<string, unknown>;
	try {
		body = (await request.json()) as Record<string, unknown>;
	} catch {
		return json({ error: 'Invalid JSON body' }, { status: 400 });
	}

	const discountCode = typeof body.discountCode === 'string' ? body.discountCode : '';
	if (shouldWaivePlatformFee(discountCode)) {
		return json({ waived: true as const });
	}

	const tripId = typeof body.tripId === 'string' ? body.tripId.trim() : '';
	if (tripId) {
		const host = await isTripHost(tripId, user.id);
		if (!host) {
			return json({ error: 'Only the trip host can pay to publish this trip' }, { status: 403 });
		}
	}

	if (!isStripeConfigured()) {
		return json({
			stripeDisabled: true as const,
			message: 'Stripe is not configured; publish will not require a card in this environment.'
		});
	}

	const publishableKey = getStripePublishableKey();
	if (!publishableKey) {
		return json({ error: 'Stripe publishable key is missing' }, { status: 500 });
	}

	try {
		const { clientSecret, paymentIntentId } = await createPublishFeePaymentIntent(user.id, {
			...(tripId ? { tripId } : {})
		});
		return json({ clientSecret, publishableKey, paymentIntentId });
	} catch (e) {
		console.error('[create-publish-intent]', e);
		return json(
		{ error: e instanceof Error ? e.message : 'Could not start payment' },
		{ status: 500 }
		);
	}
};
