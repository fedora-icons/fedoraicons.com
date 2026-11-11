# Deployment

`npm run build` writes a static site to `dist/`. No server code is needed.

- Client routes `/`, `/brands`, and `/docs` each get an `index.html`, so they
  load directly on any static host. `404.html` serves the app for other paths.
- `dist/icons/*.json` are about 1.5–2.3 MB raw (about 280 KB gzipped). Serve
  them with gzip or brotli compression.
- Hashed files in `dist/assets/` can be cached as immutable. Use short cache
  lifetimes for `index.html` and `icons/*.json`.
- The site must be served over HTTPS for the Copy buttons. Browsers expose the
  Clipboard API only in secure contexts.

Hosts that support SPA fallback rewrites (Netlify, Vercel, Cloudflare Pages,
Azure Static Web Apps, GitHub Pages via `404.html`) work as is. To deploy under
a sub-path, build with `vite build --base=/sub/path/`.

Nothing has been deployed, and no DNS has been configured for fedoraicons.com.
