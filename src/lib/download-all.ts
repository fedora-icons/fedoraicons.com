import { LocalizedError } from '../i18n/errors';
import { catalog, loadStyle, lock, STYLE_META } from './catalog';
import { buildZip, type ZipEntry } from './zip';

/** File name of the full free set, e.g. `fos-icons-2afb7bb.zip`. */
export const fullSetName = () => `fos-icons-${lock.revision ? lock.revision.slice(0, 7) : 'snapshot'}.zip`;

/**
 * Every core icon in every style, exactly as the library ships them (the
 * site's verified snapshot, not customized), plus the license.
 * Folders use the public style names: regular/, solid/, duocolor/, duotone/.
 */
export async function buildFullSet(): Promise<Blob> {
  const [maps, license] = await Promise.all([
    Promise.all(catalog.styles.map(loadStyle)),
    fetch(`${import.meta.env.BASE_URL}licenses/fos-icons-LICENSE.txt`).then((res) => {
      if (!res.ok) throw new LocalizedError('error.loadLicense', { status: String(res.status) });
      return res.text();
    }),
  ]);
  const entries: ZipEntry[] = [{ name: 'LICENSE.txt', data: license }];
  catalog.styles.forEach((style, i) => {
    const slug = STYLE_META[style].slug;
    for (const icon of catalog.icons) {
      const svg = maps[i][icon.name];
      if (svg) entries.push({ name: `${slug}/${icon.name}.svg`, data: svg });
    }
  });
  entries.push({
    name: 'README.txt',
    data: [
      'Fos Icons',
      '',
      `${catalog.icons.length} core icons in ${catalog.styles.map((s) => STYLE_META[s].label).join(', ')}.`,
      `Source: https://github.com/${lock.repository}${lock.revision ? ` at ${lock.revision}` : ''}`,
      `License: ${catalog.license} (see LICENSE.txt). Brand icons are not included.`,
      '',
    ].join('\n'),
  });
  return buildZip(entries);
}
