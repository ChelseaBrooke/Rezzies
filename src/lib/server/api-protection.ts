import type { RequestEvent } from '@sveltejs/kit';
import { createErrorResponse } from './validation.js';

const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY;

if (!INTERNAL_API_KEY) {
	console.warn('WARNING: INTERNAL_API_KEY not set. API protection is disabled.');
}

export function verifyInternalApiKey(event: RequestEvent): boolean {
	if (!INTERNAL_API_KEY) {
		// Key is required in all environments. Never bypass silently.
		return false;
	}

	const providedKey = event.request.headers.get('X-Internal-Api-Key');
	return providedKey === INTERNAL_API_KEY;
}

export function requireInternalApiKey(event: RequestEvent): Response | null {
	if (!verifyInternalApiKey(event)) {
		return new Response(
			JSON.stringify(createErrorResponse('UNAUTHORIZED', 'Invalid or missing API key')),
			{
				status: 401,
				headers: { 'Content-Type': 'application/json' }
			}
		);
	}
	return null;
}

