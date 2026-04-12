import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';

/**
 * If CRON_SECRET is set, require `Authorization: Bearer <same value>` (trimmed).
 * Returns a 401 JSON response when invalid; returns null when OK or when secret is unset.
 */
export function cronAuthDenied(request: Request): Response | null {
	const raw = env.CRON_SECRET;
	const secret = typeof raw === 'string' ? raw.trim() : '';
	if (!secret) return null;

	const auth = request.headers.get('authorization')?.trim() ?? '';
	if (auth !== `Bearer ${secret}`) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}
	return null;
}
