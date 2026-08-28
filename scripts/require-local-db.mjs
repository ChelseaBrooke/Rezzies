/**
 * Shared local-database guard for destructive dev scripts (TD4/TD5).
 *
 * `npm run db:fresh` drops the public schema and `npm run db:seed` upserts dev
 * accounts with a well-known password and rebuilds the demo trip. Neither may
 * ever run against a hosted database, so both call requireLocalDatabase()
 * before performing any write.
 *
 * Used by scripts/db-fresh.mjs and prisma/seed.ts.
 */
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '0.0.0.0']);

/** Connection variables that must all be local before we touch anything. */
export const GUARDED_URL_VARS = ['DATABASE_URL', 'DIRECT_URL'];

/**
 * Minimal .env reader -- we only need it to check the host before doing damage.
 * Prisma loads .env itself, so the guard has to look at the same file rather
 * than trusting process.env alone.
 */
/**
 * @param {string} [root]
 * @returns {Record<string, string>}
 */
export function readEnvFile(root = process.cwd()) {
	const envPath = path.join(root, '.env');
	/** @type {Record<string, string>} */
	const out = {};
	if (!existsSync(envPath)) return out;
	for (const raw of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
		const line = raw.trim();
		if (!line || line.startsWith('#')) continue;
		const eq = line.indexOf('=');
		if (eq === -1) continue;
		const key = line.slice(0, eq).trim();
		let value = line.slice(eq + 1).trim();
		if (
			(value.startsWith('"') && value.endsWith('"')) ||
			(value.startsWith("'") && value.endsWith("'"))
		) {
			value = value.slice(1, -1);
		}
		out[key] = value;
	}
	return out;
}

/**
 * True when a connection URL points at the local machine.
 * @param {string} value
 * @returns {boolean}
 */
export function isLocalDatabaseUrl(value) {
	try {
		return LOCAL_HOSTS.has(new URL(value).hostname);
	} catch {
		return false;
	}
}

/**
 * Refuse to continue unless every guarded connection URL points at localhost.
 * Prints an explanation and exits(1) on failure -- callers must invoke this
 * before their first write.
 *
 * @param {string} command  label used in the error message, e.g. 'db:seed'
 * @param {string} root     project root (defaults to cwd)
 * @returns {{ fileEnv: Record<string,string>, urls: Record<string,string> }}
 */
export function requireLocalDatabase(command, root = process.cwd()) {
	const fileEnv = readEnvFile(root);
	// Real environment wins, matching how the Prisma CLI resolves these.
	/** @param {string} key */
	const resolve = (key) => process.env[key] ?? fileEnv[key];

	/** @type {Record<string, string>} */
	const urls = {};
	for (const key of GUARDED_URL_VARS) {
		const value = resolve(key);

		if (!value) {
			console.error(`${command}: ${key} is not set. Point it at your local Supabase and retry.`);
			process.exit(1);
		}

		let hostname;
		try {
			hostname = new URL(value).hostname;
		} catch {
			console.error(`${command}: ${key} is not a valid connection URL.`);
			process.exit(1);
		}

		if (!LOCAL_HOSTS.has(hostname)) {
			console.error(
				`${command}: refusing to run -- ${key} points at "${hostname}", which is not local.\n` +
					'This command writes to the database, so it is only ever safe against a local one.'
			);
			process.exit(1);
		}

		urls[key] = value;
	}

	return { fileEnv, urls };
}
