import { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { downloadBlob } from '../lib/export';
import { buildFullSet, fullSetName } from '../lib/download-all';
import { FIGMA_URL, LIBRARY_URL } from '../lib/links';
import { UiIcon, useToast } from './ui';

const base = 'inline-flex h-9 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-3 text-sm font-medium transition disabled:cursor-wait disabled:opacity-60';
const primary = `${base} bg-brand text-brand-ink hover:brightness-110 active:brightness-95`;
const ghost = `${base} text-ink hover:bg-sunken`;
/** Plain text links for the header bar. */
const linkBase = 'whitespace-nowrap rounded text-sm font-medium underline-offset-4 transition hover:underline disabled:cursor-wait disabled:opacity-60';
const textLink = `${linkBase} text-muted hover:text-ink`;
const NEW_TAB = <span className="sr-only"> (opens in a new tab)</span>;

/** Builds and downloads the full free set; shared by the bar and the phone menu. */
function useDownloadAll() {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const run = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const name = fullSetName();
      downloadBlob(await buildFullSet(), name);
      toast('success', `Downloaded ${name}`);
    } catch (error) {
      toast('error', error instanceof Error ? error.message : 'Could not build the download.');
    } finally {
      setBusy(false);
    }
  };
  return { busy, run };
}

export function HeaderActions() {
  const download = useDownloadAll();
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setOpen(false); toggleRef.current?.focus(); }
    };
    const onPointer = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer);
    };
  }, [open]);

  const downloadLabel = download.busy ? 'Preparing…' : 'Download';
  const close = () => setOpen(false);

  return (
    <>
      <nav aria-label="Main" className="hidden items-center gap-5 md:flex">
        <a href={LIBRARY_URL} target="_blank" rel="noreferrer" className={`${linkBase} text-brand`}>
          Get started{NEW_TAB}
        </a>
        <button type="button" className={textLink} onClick={download.run} disabled={download.busy} aria-describedby="download-all-desc">
          {downloadLabel}
        </button>
        {FIGMA_URL && (
          <a href={FIGMA_URL} target="_blank" rel="noreferrer" className={textLink}>
            Figma{NEW_TAB}
          </a>
        )}
        <Link to="/pricing" className={textLink}>Pricing</Link>
      </nav>
      <span id="download-all-desc" className="sr-only">ZIP of every free icon in every style, with the license.</span>

      <div ref={wrapRef} className="relative md:hidden">
        <button
          ref={toggleRef}
          type="button"
          aria-label="Menu"
          aria-expanded={open}
          aria-controls={menuId}
          onClick={() => setOpen((v) => !v)}
          className="inline-flex size-9 items-center justify-center rounded-lg text-ink transition hover:bg-sunken"
        >
          <UiIcon name={open ? 'x' : 'menu'} />
        </button>
        <nav
          id={menuId}
          aria-label="Main"
          hidden={!open}
          className="absolute right-0 top-11 z-40 w-60 space-y-1 rounded-2xl border border-line bg-surface p-2 shadow-lg"
        >
          <a href={LIBRARY_URL} target="_blank" rel="noreferrer" onClick={close} className={`${primary} w-full`}>
            Get started{NEW_TAB}
          </a>
          <button type="button" className={`${ghost} w-full justify-start`} onClick={download.run} disabled={download.busy} aria-describedby="download-all-desc">
            <UiIcon name="download" className="size-[18px]" />
            {downloadLabel}
          </button>
          {FIGMA_URL && (
            <a href={FIGMA_URL} target="_blank" rel="noreferrer" onClick={close} className={`${ghost} w-full justify-start`}>
              Figma{NEW_TAB}
            </a>
          )}
          <Link to="/pricing" onClick={close} className={`${ghost} w-full justify-start`}>Pricing</Link>
        </nav>
      </div>
    </>
  );
}
