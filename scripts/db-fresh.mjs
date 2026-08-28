#!/usr/bin/env node
/**
 * db:fresh -- rebuild a LOCAL database from the migration history and seed it (TD4).
 *
 * Drops the public schema, replays every migration with `prisma migrate deploy`,
 * then runs the dev seed. This is the supported way to get a working database
 * from scratch, and it is what keeps the migration history honest: if a
 * migration is ever missing again, this command is where it shows up.
 *
 * Safety: refuses to run unless DATABASE_URL and DIRECT_URL both point at
 * localhost. This script is destructive by design and must never touch a
 * hosted database.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '0.0.0.0']);

/** Minimal .env reader -- we only need it to check the host before destroying anything. */
function readEnvFile() {
	const envPath = path.join(ROOT, '.env');
	if (!existsSync(envPath)) return {};
	const out = {};
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

const fileEnv = readEnvFile();
/** Real environment wins, matching how the Prisma CLI resolves these. */
const resolve = (key) => process.env[key] ?? fileEnv[key];

function assertLocal(key) {
	const value = resolve(key);
	if (!value) {
		console.error(`db:fresh: ${key} is not set. Point it at your local Supabase and retry.`);
		process.exit(1);
	}
	let host;
	try {
		host = new URL(value).hostname;
	} catch {
		console.error(`db:fresh: ${key} is not a valid connection URL.`);
		process.exit(1);
	}
	if (!LOCAL_HOSTS.has(host)) {
		console.error(
			`db:fresh: refusing to run -- ${key} points at "${host}", which is not local.\n` +
				'This command drops the public schema, so it is only ever safe against a local database.'
		);
		process.exit(1);
	}
	return value;
}

const databaseUrl = assertLocal('DATABASE_URL');
assertLocal('DIRECT_URL');

const targetDb = new URL(databaseUrl).pathname.replace(/^\//, '') || '(default)';
console.log(`db:fresh: rebuilding local database "${targetDb}" from the migration history.\n`);

const childEnv = { ...fileEnv, ...process.env };

function run(args, { input } = {}) {
	execFileSync('npx', args, {
		cwd: ROOT,
		env: childEnv,
		input,
		stdio: [input === undefined ? 'inherit' : 'pipe', 'inherit', 'inherit']
	});
}

try {
	console.log('==> dropping and recreating the public schema');
	run(['prisma', 'db', 'execute', '--url', databaseUrl, '--stdin'], {
		input: 'DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;'
	});

	console.log('\n==> applying migrations');
	run(['prisma', 'migrate', 'deploy']);

	console.log('\n==> generating Prisma client');
	run(['prisma', 'generate']);

	console.log('\n==> seeding dev data');
	run(['tsx', 'prisma/seed.ts']);

	console.log('\ndb:fresh: done. Start the app with `npm run dev`.');
} catch {
	// The failing command has already printed its own diagnostics.
	console.error('\ndb:fresh: failed. See the error above.');
	process.exit(1);
}
