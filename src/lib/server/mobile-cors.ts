/**
 * CORS for native / mobile auth HTTP clients.
 * Set `MOBILE_AUTH_CORS_ORIGINS` to a comma-separated list (e.g. `https://app.example.com,capacitor://localhost`).
 * If unset: dev uses `*`; production falls back to `PUBLIC_APP_URL` or `*`.
 * Native apps often omit `Origin`; we then allow the first entry in the list.
 */
export function mobileAuthCorsHeaders(request: Request): Record<string, string> {
	const base: Record<string, string> = {
		'Access-Control-Allow-Methods': 'POST, OPTIONS',
		'Access-Control-Allow-Headers': 'Content-Type, Authorization'
	};
	const list = (process.env.MOBILE_AUTH_CORS_ORIGINS ?? '')
		.split(',')
		.map((s) => s.trim())
		.filter(Boolean);
	const origin = request.headers.get('Origin');

	if (list.length > 0) {
		if (origin && list.includes(origin)) {
			return { ...base, 'Access-Control-Allow-Origin': origin, Vary: 'Origin' };
		}
		if (!origin) {
			return { ...base, 'Access-Control-Allow-Origin': list[0]!, Vary: 'Origin' };
		}
		return { ...base, 'Access-Control-Allow-Origin': 'null' };
	}

	if (process.env.NODE_ENV !== 'production') {
		return { ...base, 'Access-Control-Allow-Origin': '*' };
	}

	const vercel = process.env.VERCEL_URL;
	const pub =
		process.env.PUBLIC_APP_URL?.replace(/\/$/, '') ||
		process.env.APP_BASE_URL?.replace(/\/$/, '') ||
		(vercel ? `https://${vercel.replace(/\/$/, '')}` : undefined);
	if (pub) {
		return { ...base, 'Access-Control-Allow-Origin': pub, Vary: 'Origin' };
	}
	return { ...base, 'Access-Control-Allow-Origin': '*' };
}
