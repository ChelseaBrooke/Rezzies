import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	test: {
		// Unit tests only: exclude e2e specs and SvelteKit server-entry generated files.
		include: ['src/**/*.{test,spec}.{ts,js}'],
		exclude: ['e2e/**', 'src/**/*.svelte.test.ts'],
		environment: 'node',
		globals: true,
		coverage: {
			provider: 'v8',
			// Focus coverage on the server-side business-logic modules that carry the most risk.
			include: ['src/lib/server/**/*.ts', 'src/lib/pricing/**/*.ts', 'src/lib/trips/**/*.ts'],
			exclude: ['src/lib/server/prisma.ts', '**/*.test.ts', '**/*.spec.ts'],
			reporter: ['text', 'html'],
			// Aspirational starting thresholds — raise as coverage grows.
			thresholds: {
				lines: 10,
				functions: 10
			}
		}
	}
});
