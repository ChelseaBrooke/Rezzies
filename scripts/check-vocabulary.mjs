import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const TARGET_DIRS = [
	path.join(ROOT, 'src', 'routes'),
	path.join(ROOT, 'src', 'lib', 'components'),
	path.join(ROOT, 'src', 'lib', 'config')
];
const SCANNED_EXTENSIONS = new Set(['.svelte', '.ts']);

const DISALLOWED = [
	{ label: 'reservation', regex: /\breservations?\b/gi },
	{ label: 'booking', regex: /\bbookings?\b/gi }
];

// Intentional legacy/technical contexts that can remain for now.
const ALLOWED_PHRASES = [
	/legacy bookings?/i,
	/bookings from the public trip link/i,
	/grsvp-reservation/i,
	/inset reservation module/i,
	/current reservation price/i,
	/>reservations</i
];

async function walk(dir) {
	const entries = await readdir(dir, { withFileTypes: true });
	const files = [];
	for (const entry of entries) {
		const fullPath = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			files.push(...(await walk(fullPath)));
			continue;
		}
		if (SCANNED_EXTENSIONS.has(path.extname(entry.name))) {
			files.push(fullPath);
		}
	}
	return files;
}

function shouldScanFile(filePath) {
	const rel = path.relative(ROOT, filePath).replace(/\\/g, '/');
	if (rel.startsWith('src/lib/config/')) return rel.endsWith('.ts');
	return rel.endsWith('.svelte');
}

function shouldIgnoreLine(line) {
	return ALLOWED_PHRASES.some((pattern) => pattern.test(line));
}

function findViolations(content, filePath) {
	const lines = content.split(/\r?\n/);
	const violations = [];

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		if (shouldIgnoreLine(line)) continue;

		for (const rule of DISALLOWED) {
			rule.regex.lastIndex = 0;
			if (!rule.regex.test(line)) continue;
			violations.push({
				filePath,
				lineNumber: i + 1,
				term: rule.label,
				line: line.trim()
			});
		}
	}

	return violations;
}

async function run() {
	const allFiles = (await Promise.all(TARGET_DIRS.map((dir) => walk(dir)))).flat();
	const allViolations = [];

	for (const filePath of allFiles) {
		if (!shouldScanFile(filePath)) continue;
		const content = await readFile(filePath, 'utf8');
		allViolations.push(...findViolations(content, filePath));
	}

	if (allViolations.length === 0) {
		console.log('Vocabulary guard passed: no disallowed terms found.');
		return;
	}

	console.error('Vocabulary guard failed. Disallowed terms found:\n');
	for (const violation of allViolations) {
		const relativePath = path.relative(ROOT, violation.filePath);
		console.error(
			`- ${relativePath}:${violation.lineNumber} (${violation.term}) -> ${violation.line}`
		);
	}
	console.error(
		'\nUse Divvi vocabulary (trip, guest, room assignment, RSVP) instead of reservation/booking wording.'
	);
	process.exit(1);
}

run().catch((err) => {
	console.error('Vocabulary guard crashed:', err);
	process.exit(1);
});
