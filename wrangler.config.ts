import { defineWranglerConfig } from 'wrangler/experimental-config';

// dist/ is staged by scripts/stage-site.js: the landing page and the extension files it runs.
export default defineWranglerConfig({
  assetsDirectory: 'dist',
});
