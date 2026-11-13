# Deployment

`npm run build` writes a static site to `dist/`. No server code is needed,
and the build doesn't need a fedora-icons checkout (the synced data is
committed). Use Node 24 (`.nvmrc`, `engines`); dependencies install from the
public npm registry (`.npmrc`).

## Vercel

`vercel.json` holds the settings: Vite, `npm ci`, `npm run build`, output
`dist/`, clean URLs without trailing slashes (canonical links are `/docs`, not
`/docs/`), immutable caching for hashed assets, short caching for artwork,
no caching for `sw.js` and the manifest, and basic security headers.

1. In Vercel, Add New → Project, and import `fedora-icons/fedoraicons.com`.
   The settings come from `vercel.json`; Node comes from `engines`.
2. Deploy. Pushes to `main` deploy to production; pull requests get previews.
3. Domains → add `fedoraicons.com` (and `www`, redirecting to the apex) and
   set the DNS records Vercel shows. `SITE_URL` in `src/lib/seo.ts` must match
   the production domain.

## Any static host

- Every page (`/`, `/docs`, `/brands`, and each language's copies) has its own
  prerendered `index.html`. Serve `/docs` without redirecting to `/docs/`.
  `404.html` serves the app for other paths.
- `dist/icons/*.json` (whole styles, for downloads) are about 1.5–2.3 MB raw;
  the grid loads `dist/icons/<style>/<n>.json` chunks. Serve them with gzip or
  brotli compression.
- Hashed files in `dist/assets/` can be cached as immutable. Use short cache
  lifetimes for HTML and `icons/`, and none for `sw.js`.
- The site must be served over HTTPS for the Copy buttons. Browsers expose the
  Clipboard API only in secure contexts.

Hosts that support SPA fallback rewrites (Netlify, Vercel, Cloudflare Pages,
Azure Static Web Apps, GitHub Pages via `404.html`) work as is. To deploy under
a sub-path, build with `vite build --base=/sub/path/`.

Nothing has been deployed, and no DNS has been configured for fedoraicons.com.
