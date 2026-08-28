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
 * localhost (see scripts/require-local-db.mjs). This script is destructive by
 * design and must never touch a hosted database.
 */
import { execFileSync } from 'node:child_process';
import { requireLocalDatabase } from './require-local-db.mjs';

const ROOT = process.cwd();

// Guard first -- nothing below this line is safe against a hosted database.
const { fileEnv, urls } = requireLocalDatabase('db:fresh', ROOT);
const databaseUrl = urls.DATABASE_URL;

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
