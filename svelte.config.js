import adapter from '@sveltejs/adapter-vercel';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://svelte.dev/docs/kit/integrations
	// for more information about preprocessors
	preprocess: vitePreprocess(),

	kit: {
		// Always use adapter-vercel for Vercel deployments
		// For local Windows builds, enable Developer Mode to avoid symlink issues
		// Or use: npm run dev (which doesn't require the adapter)
		adapter: adapter()
	}
};

export default config;
