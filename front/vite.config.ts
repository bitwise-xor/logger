import adapter from '@sveltejs/adapter-node';
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    tailwindcss(),
    // SvelteKit 3 takes its options here (no svelte.config.js), as in the hub.
    sveltekit({
      // A small Node server (unlike the hub's static files): it keeps the cookies, runs the form actions and checks
      // the origin of every form post against ORIGIN (compose.yaml).
      adapter: adapter({ out: 'build' }),
      // Sent as a header on every page; nonces for SvelteKit's own scripts. Nothing else may be inline: the theme
      // script is static/theme.js for that reason.
      csp: {
        mode: 'auto',
        directives: {
          'default-src': ['self'],
          'script-src': ['self'],
          'style-src': ['self', 'unsafe-inline'],
          'img-src': ['self', 'data:'],
          'font-src': ['self'],
          'connect-src': ['self'],
          'form-action': ['self'],
          'frame-ancestors': ['none'],
          'base-uri': ['none'],
          'object-src': ['none'],
        },
      },
    }),
  ],
});
