import { defineConfig } from 'astro/config';

// Static output: one HTML file per URL, so every page works as a direct link.
export default defineConfig({
  site: 'https://freight-operations-simulator.netlify.app',
  output: 'static',
  trailingSlash: 'ignore',
  build: { format: 'directory' },
});
