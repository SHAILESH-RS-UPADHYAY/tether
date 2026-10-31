// Stages the landing page for Cloudflare: site/ plus the extension files it runs, at the same
// relative paths, so nothing else in the repo is published. Output: dist/ (gitignored).
import { cpSync, rmSync, writeFileSync } from 'node:fs';

const files = ['site', 'brand/mark.svg', 'brand/wordmark.svg', 'extension/src/capsule.js', 'extension/styles', 'extension/fonts'];
rmSync('dist', { recursive: true, force: true });
for (const f of files) cpSync(f, `dist/${f}`, { recursive: true, filter: (src) => !src.includes('.hallmark') });
writeFileSync('dist/_redirects', '/ /site/ 301\n');
