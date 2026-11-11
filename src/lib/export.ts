/** Browser export helpers. Each rejects with a user-presentable message. */

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Give the browser time to start the download before revoking.
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export const svgBlob = (svg: string) => new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });

/**
 * Rasterize a standalone SVG to a transparent PNG. `pixels` is the output
 * edge length; the SVG is drawn at that size rather than scaled from a bitmap.
 */
export async function svgToPng(svg: string, pixels: number): Promise<Blob> {
  const url = URL.createObjectURL(svgBlob(svg));
  try {
    const image = new Image();
    image.decoding = 'async';
    image.src = url;
    await image.decode().catch(() => {
      throw new Error('The browser could not render this SVG as an image.');
    });
    const canvas = document.createElement('canvas');
    canvas.width = pixels;
    canvas.height = pixels;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas is unavailable in this browser.');
    context.clearRect(0, 0, pixels, pixels);
    context.drawImage(image, 0, 0, pixels, pixels);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('PNG encoding failed.'))), 'image/png'),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function copyText(text: string) {
  if (!navigator.clipboard?.writeText) {
    throw new Error('Clipboard access is unavailable here. Use a secure (https) page or copy manually.');
  }
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    throw new Error('The browser blocked clipboard access.');
  }
}

/** Copy a PNG to the clipboard. The promise form keeps Safari's user-gesture. */
export async function copyPng(png: Promise<Blob>) {
  if (typeof ClipboardItem === 'undefined' || !navigator.clipboard?.write) {
    throw new Error('This browser cannot copy images. Download the PNG instead.');
  }
  try {
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]);
  } catch (error) {
    if (error instanceof Error && /render|encod|canvas/i.test(error.message)) throw error;
    throw new Error('The browser blocked copying the image. Download the PNG instead.');
  }
}
