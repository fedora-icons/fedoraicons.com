import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ToastProvider } from './components/ui';
import { ThemeProvider } from './lib/theme';
import { IconsPage } from './pages/IconsPage';
import NotFoundPage from './pages/NotFoundPage';

const DocsPage = lazy(() => import('./pages/DocsPage'));
const PricingPage = lazy(() => import('./pages/PricingPage'));

/** Routes and providers without a router, so the build can prerender them (see entry-server). */
export function AppShell() {
  return (
    <ThemeProvider>
      <ToastProvider>
          <Suspense fallback={<div className="p-8 text-muted">Loading…</div>}>
            <Routes>
              <Route element={<Layout />}>
                <Route index element={<IconsPage />} />
                {/* Brands moved into the style switcher; keep old links working. */}
                <Route path="brands" element={<Navigate to="/?style=brands" replace />} />
                <Route path="docs" element={<DocsPage />} />
                <Route path="pricing" element={<PricingPage />} />
                <Route path="*" element={<NotFoundPage />} />
              </Route>
            </Routes>
          </Suspense>
      </ToastProvider>
    </ThemeProvider>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  );
}
