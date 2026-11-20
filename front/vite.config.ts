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
      // script is static/theme.js for that reason (and the barcode reader is static/zxing.min.js, loaded on first use).
      csp: {
        mode: 'auto',
        directives: {
          'default-src': ['self'],
          'script-src': ['self'],
          'style-src': ['self', 'unsafe-inline'],
          // blob: the scan sheet's label photos, shown as thumbnails before they are sent (deploy 90)
          'img-src': ['self', 'data:', 'blob:'],
          // the camera's picture (a stream; zxing falls back to a blob: address in old browsers)
          'media-src': ['self', 'blob:'],
          'font-src': ['self'],
          'connect-src': ['self'],
          // the nudges' service worker (static/sw.js) and the home-screen app's manifest (deploy 112): this origin only, said
          // here rather than left to the fallbacks (script-src, default-src)
          'worker-src': ['self'],
          'manifest-src': ['self'],
          'form-action': ['self'],
          // every page; the signed-in pages swap it for the hub's frame in hooks.server.ts (src/lib/server/frame.ts, 20.11.2026)
          'frame-ancestors': ['none'],
          'base-uri': ['none'],
          'object-src': ['none'],
        },
      },
    }),
  ],
});
