#!/usr/bin/env node
/**
 * Render the social share image and the app (PWA) icons into public/.
 *
 *   node scripts/brand-images.mjs
 *
 * Uses real library artwork (from the synced public/icons/*.json) and the
 * Fedora Icons mark, laid out in HTML and captured with headless Chrome
 * (set CHROME to its path if it isn't in the default macOS location).
 * Re-run after changing the mark or the showcase icons; the PNGs are
 * committed so builds don't need a browser.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const icons = (style) => JSON.parse(readFileSync(join(ROOT, 'public/icons', `${style}.json`), 'utf8'));
const markFilled = readFileSync(join(ROOT, 'src/brand/mark-filled.svg'), 'utf8').replace(/fill="#212121"/g, 'fill="currentColor"');
const markRegular = readFileSync(join(ROOT, 'src/brand/mark-regular.svg'), 'utf8');
const font = (pkg, file) => pathToFileURL(join(ROOT, 'node_modules/@fontsource-variable', pkg, 'files', file)).href;

const INK = '#212121';
const BRAND = '#245B9E';
const CANVAS = '#FBFBFA';
const LINE = '#E7E7E4';

/** One row per style; the same icons across, so the styles read side by side. */
const SHOWCASE = ['rocket', 'calendar', 'message-smile-square', 'camera', 'sparkles'];
const STYLES = [['regular', 'Regular'], ['filled', 'Solid'], ['duocolor', 'Duocolor'], ['duotone', 'Duotone']];

const page = (width, height, body) => `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face { font-family: 'Funnel Display'; src: url('${font('funnel-display', 'funnel-display-latin-wght-normal.woff2')}') format('woff2'); font-weight: 300 800; }
@font-face { font-family: 'Asta Sans'; src: url('${font('asta-sans', 'asta-sans-latin-wght-normal.woff2')}') format('woff2'); font-weight: 300 800; }
* { box-sizing: border-box; margin: 0; }
html, body { width: ${width}px; height: ${height}px; overflow: hidden; }
body { font-family: 'Asta Sans', system-ui, sans-serif; color: ${INK}; background: ${CANVAS}; }
svg { display: block; width: 100%; height: 100%; }
</style></head><body>${body}</body></html>`;

function shoot(html, width, height, out) {
  const dir = mkdtempSync(join(tmpdir(), 'fedora-brand-'));
  const file = join(dir, 'page.html');
  writeFileSync(file, html);
  execFileSync(CHROME, [
    '--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1', '--default-background-color=00000000',
    `--window-size=${width},${height}`, '--virtual-time-budget=2000', `--screenshot=${join(ROOT, out)}`, pathToFileURL(file).href,
  ], { stdio: 'ignore' });
  rmSync(dir, { recursive: true, force: true });
  console.log(`Wrote ${out}`);
}

// Social share image: 1200×630 (Open Graph and X/Twitter large card).
const sets = Object.fromEntries(STYLES.map(([s]) => [s, icons(s)]));
for (const [style] of STYLES) for (const name of SHOWCASE) if (!sets[style][name]) throw new Error(`Missing ${style}/${name}`);
const grid = STYLES.map(([style, label]) => `
  <div style="display:flex;align-items:center;gap:14px">
    <div style="width:92px;font-size:17px;font-weight:500;color:#5C5C5C">${label}</div>
    ${SHOWCASE.map((name) => `<div style="width:76px;height:76px;border-radius:18px;background:#fff;border:1px solid ${LINE};display:flex;align-items:center;justify-content:center;color:${style.startsWith('duo') ? BRAND : INK}"><div style="width:40px;height:40px">${sets[style][name]}</div></div>`).join('')}
  </div>`).join('');
shoot(page(1200, 630, `
  <div style="position:absolute;inset:0;background-image:linear-gradient(${LINE} 1px,transparent 1px),linear-gradient(90deg,${LINE} 1px,transparent 1px);background-size:24px 24px;opacity:.55;-webkit-mask-image:radial-gradient(ellipse at 80% 50%,#000 20%,transparent 75%)"></div>
  <div style="position:relative;display:flex;height:100%;padding:72px 72px 64px 80px;gap:56px">
    <div style="flex:1;display:flex;flex-direction:column">
      <div style="display:flex;align-items:center;gap:14px">
        <div style="width:48px;height:48px;color:${INK}">${markRegular}</div>
        <div style="font-family:'Funnel Display';font-size:34px;font-weight:600;letter-spacing:-0.02em">Fedora Icons</div>
      </div>
      <div style="margin-top:auto;font-family:'Funnel Display';font-size:66px;line-height:1.02;font-weight:600;letter-spacing:-0.035em">Find the <span style="color:${BRAND}">right</span> icon, then ship it.</div>
      <div style="margin-top:22px;font-size:24px;line-height:1.35;color:#5C5C5C;max-width:470px">Open-source SVG icons in four styles. Recolor, resize, and export in seconds.</div>
      <div style="margin-top:30px;display:flex;gap:10px">
        ${['SVG', 'PNG', 'React', 'Vue', 'Figma', 'MIT'].map((t) => `<div style="padding:7px 14px;border-radius:999px;border:1px solid #CFCFCB;background:#fff;font-size:17px;font-weight:500">${t}</div>`).join('')}
      </div>
    </div>
    <div style="display:flex;flex-direction:column;justify-content:center;gap:14px">${grid}</div>
  </div>`), 1200, 630, 'public/og-image.png');

// App icons: the filled mark in white on the brand blue. "any" icons are
// rounded; maskable and Apple icons are full-bleed with the mark inside the
// 80% safe zone, since the platform applies its own shape.
const appIcon = (size, { rounded, scale }) => page(size, size, `
  <div style="width:${size}px;height:${size}px;background:${BRAND};border-radius:${rounded ? size * 0.22 : 0}px;display:flex;align-items:center;justify-content:center;color:#fff">
    <div style="width:${size * scale}px;height:${size * scale}px">${markFilled}</div>
  </div>`).replace(`background: ${CANVAS}`, 'background: transparent');
shoot(appIcon(192, { rounded: true, scale: 0.6 }), 192, 192, 'public/app/icon-192.png');
shoot(appIcon(512, { rounded: true, scale: 0.6 }), 512, 512, 'public/app/icon-512.png');
shoot(appIcon(512, { rounded: false, scale: 0.5 }), 512, 512, 'public/app/icon-maskable-512.png');
shoot(appIcon(180, { rounded: false, scale: 0.56 }), 180, 180, 'public/apple-touch-icon.png');
