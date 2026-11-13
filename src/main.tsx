import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles/index.css';

// The app replaces the prerendered HTML: stop its entrance animation first,
// then enable interaction motion once the first render has painted.
const html = document.documentElement;
html.setAttribute('data-hydrated', '');
requestAnimationFrame(() => requestAnimationFrame(() => html.setAttribute('data-motion', '')));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Installable app and offline support (production only; see public/sw.js).
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => { /* the site works without it */ });
  });
}
