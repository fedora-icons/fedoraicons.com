// Make client routes work on any static host: each route gets its own
// index.html, and 404.html serves the app for unknown paths.
import { copyFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const dist = new URL('../dist/', import.meta.url).pathname;
for (const route of ['brands', 'docs', 'pricing']) {
  mkdirSync(join(dist, route), { recursive: true });
  copyFileSync(join(dist, 'index.html'), join(dist, route, 'index.html'));
}
copyFileSync(join(dist, 'index.html'), join(dist, '404.html'));
console.log('Wrote route entry points: /brands/, /docs/, /pricing/, 404.html');
