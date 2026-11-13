# Deployment

`pnpm run build` writes a static site to `dist/`. No server code is needed,
and the build doesn't need a fedora-icons checkout (the synced data is
committed). Use Node 24 (`.nvmrc`, `engines`) and pnpm (`packageManager`); dependencies
install from the public npm registry (`.npmrc`). `pnpm-workspace.yaml` allows
esbuild's install script, which fetches Vite's native bundler binary.

## Vercel

`vercel.json` holds the settings: Vite, install and build with the pinned pnpm
(`npx pnpm@<version>`, so Vercel uses the same pnpm as `packageManager`; keep
the two in step when upgrading), output
`dist/`, clean URLs without trailing slashes (canonical links are `/docs`, not
`/docs/`), immutable caching for hashed assets, short caching for artwork,
no caching for `sw.js` and the manifest, and basic security headers.

1. In Vercel, Add New → Project, and import `fedora-icons/fedoraicons.com`.
   The settings come from `vercel.json`; Node comes from `engines`.
2. Deploy. Pushes to `main` deploy to production; pull requests get previews.
3. Domains: `www.fedoraicons.com` is the production domain, and
   `fedoraicons.com` redirects to it. `SITE_URL` in `src/lib/seo.ts` must
   match the domain that serves the site (not the one that redirects), since
   canonical links, the sitemap, and share images use it.

Live at https://www.fedoraicons.com since 2026-11-13.

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

