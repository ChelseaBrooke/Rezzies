import adapterVercel from '@sveltejs/adapter-vercel';
import adapterAuto from '@sveltejs/adapter-auto';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://svelte.dev/docs/kit/integrations
	// for more information about preprocessors
	preprocess: vitePreprocess(),

	kit: {
		// Use adapter-vercel for Vercel deployments (when VERCEL env var is set)
		// Use adapter-auto for local builds (avoids symlink permission issues on Windows)
		adapter: process.env.VERCEL ? adapterVercel() : adapterAuto()
	}
};

export default config;
