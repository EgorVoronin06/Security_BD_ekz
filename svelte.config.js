import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		csrf: {
			trustedOrigins: ['http://localhost:3000', 'http://127.0.0.1:3000']
		},
		adapter: adapter({
			out: 'build',
			precompress: true
		})
	}
};

export default config;
