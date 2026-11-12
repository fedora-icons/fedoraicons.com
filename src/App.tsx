import { lazy, Suspense } from 'react';
import { BrowserRouter, Link, Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ToastProvider } from './components/ui';
import { ThemeProvider } from './lib/theme';
import { IconsPage } from './pages/IconsPage';

const DocsPage = lazy(() => import('./pages/DocsPage'));

function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center">
      <h1 className="text-3xl font-semibold">Page not found</h1>
      <p className="mt-3 text-muted">That page does not exist.</p>
      <Link to="/" className="mt-6 inline-block text-brand underline underline-offset-4">Browse icons</Link>
    </div>
  );
}

export function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <BrowserRouter>
          <Suspense fallback={<div className="p-8 text-muted">Loading…</div>}>
            <Routes>
              <Route element={<Layout />}>
                <Route index element={<IconsPage />} />
                {/* Brands moved into the style switcher; keep old links working. */}
                <Route path="brands" element={<Navigate to="/?style=brands" replace />} />
                <Route path="docs" element={<DocsPage />} />
                <Route path="*" element={<NotFound />} />
              </Route>
            </Routes>
          </Suspense>
        </BrowserRouter>
      </ToastProvider>
    </ThemeProvider>
  );
}
