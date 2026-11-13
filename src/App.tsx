import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ToastProvider } from './components/ui';
import { DEFAULT_LOCALE, I18nProvider, localizePath, type Translation } from './i18n';
import { docsPageFor } from './i18n/content';
import { ThemeProvider } from './lib/theme';
import { IconsPage } from './pages/IconsPage';
import NotFoundPage from './pages/NotFoundPage';

const PricingPage = lazy(() => import('./pages/PricingPage'));

export interface AppProps {
  /** The page's language; its routes live under /<locale> (none for the default). */
  locale?: string;
  /** That language's messages (English is built in). */
  messages?: Translation;
}

/** Routes and providers without a router, so the build can prerender them (see entry-server). */
export function AppShell({ locale = DEFAULT_LOCALE, messages }: AppProps) {
  const base = localizePath('/', locale);
  const DocsPage = docsPageFor(locale);
  return (
    <I18nProvider locale={locale} messages={messages}>
      <ThemeProvider>
        <ToastProvider>
          <Suspense fallback={<div className="p-8 text-muted">…</div>}>
            <Routes>
              <Route path={base} element={<Layout />}>
                <Route index element={<IconsPage />} />
                {/* Brands moved into the style switcher; keep old links working. */}
                <Route path="brands" element={<Navigate to={localizePath('/?style=brands', locale)} replace />} />
                <Route path="docs" element={<DocsPage />} />
                <Route path="pricing" element={<PricingPage />} />
                <Route path="*" element={<NotFoundPage />} />
              </Route>
              {/* Outside this language's prefix (e.g. a mistyped language): still a 404 page. */}
              <Route path="*" element={<Layout />}>
                <Route path="*" element={<NotFoundPage />} />
              </Route>
            </Routes>
          </Suspense>
        </ToastProvider>
      </ThemeProvider>
    </I18nProvider>
  );
}

export function App(props: AppProps) {
  return (
    <BrowserRouter>
      <AppShell {...props} />
    </BrowserRouter>
  );
}
