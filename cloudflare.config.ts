import { defineConfig } from 'cf/config';

// Assets-only Worker for the landing page. The files it serves are set in wrangler.config.ts.
export default defineConfig({
  worker: {
    name: 'tether',
    compatibilityDate: '2026-10-23',
    observability: { enabled: true },
  },
});
