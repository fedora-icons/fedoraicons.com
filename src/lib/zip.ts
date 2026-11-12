/** One file in a ZIP archive. */
export interface ZipEntry {
  name: string;
  data: Uint8Array | string;
}

/**
 * Build a ZIP in the browser. The ZIP library is loaded on first use, so it
 * stays out of the initial bundle. SVG text is deflated; PNGs are stored, as
 * they are already compressed.
 */
export async function buildZip(entries: ZipEntry[]): Promise<Blob> {
  const { zipSync } = await import('fflate');
  const encoder = new TextEncoder();
  const files: Record<string, [Uint8Array, { level: 0 | 6 }]> = {};
  const seen = new Set<string>();
  for (const entry of entries) {
    if (seen.has(entry.name)) throw new Error(`Duplicate file in ZIP: ${entry.name}`);
    seen.add(entry.name);
    // Copy into this realm's Uint8Array: fflate tells files from folders with
    // `instanceof`, which fails for arrays made by another realm's TextEncoder.
    const bytes = new Uint8Array(typeof entry.data === 'string' ? encoder.encode(entry.data) : entry.data);
    files[entry.name] = [bytes, { level: entry.name.endsWith('.png') ? 0 : 6 }];
  }
  const zipped = zipSync(files);
  return new Blob([zipped as Uint8Array<ArrayBuffer>], { type: 'application/zip' });
}
