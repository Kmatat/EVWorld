#!/usr/bin/env node
/**
 * Packs the web build (dist/) into ONE self-contained HTML page: the JS
 * bundle, icon font and images are all embedded. The result can be shared
 * as a single file or hosted anywhere, with no server paths to configure.
 *
 * Usage:
 *   npm run build:web
 *   node scripts/build-demo-page.js dist demo/evworld-demo.html
 */
const fs = require('fs');
const path = require('path');

const [distDir = 'dist', outFile = 'demo/evworld-demo.html'] = process.argv.slice(2);
const html = fs.readFileSync(path.join(distDir, 'index.html'), 'utf8');

const scripts = [...html.matchAll(/<script[^>]*src="([^"]+)"[^>]*><\/script>/g)].map((m) => m[1]);
if (scripts.length === 0) throw new Error('No bundle found in index.html. Run `npm run build:web` first.');

const MIME = { '.png': 'image/png', '.ttf': 'font/ttf', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };

let js = scripts.map((src) => fs.readFileSync(path.join(distDir, src), 'utf8')).join('\n;\n');

// Replace "/assets/..." file references with embedded data URIs.
js = js.replace(/"(\/assets\/[^"?]+)"/g, (whole, assetPath) => {
  const file = path.join(distDir, decodeURIComponent(assetPath));
  if (!fs.existsSync(file)) return whole;
  const mime = MIME[path.extname(file)] ?? 'application/octet-stream';
  return `"data:${mime};base64,${fs.readFileSync(file).toString('base64')}"`;
});

// Keep the HTML parser from seeing tags inside the inline script.
js = js.replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '\\x3C!--');

const page = `<title>EVWorld App Demo</title>
<meta name="description" content="Prototype of EVWorld: EV charger map, range & trip planner and EV marketplace for Egypt (demo data).">
<style>
  :root { --bg: #F3F5F7; --fg: #111827; color-scheme: light; }
  html, body { height: 100%; }
  body { background: var(--bg); color: var(--fg); overflow: hidden; }
  #root { display: flex; height: 100%; flex: 1; }
</style>
<div id="root"></div>
<script>${js}</script>
`;

fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, page);
console.log(`Wrote ${outFile} (${(page.length / 1024 / 1024).toFixed(2)} MB)`);
