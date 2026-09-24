import sharp from 'sharp';

export const DISPLAY_MAX_PX = 1600;
export const THUMB_MAX_PX = 400;
export const VARIANT_MIME = 'image/webp';

/** Storage keys for an asset's re-encoded copies, derived from (and next to) the original. */
export function variantKeys(storageKey: string) {
  return { display: `${storageKey}-display`, thumb: `${storageKey}-thumb` };
}

/** The original's key for a variant key, or the key itself. Used by the filesystem blob route. */
export function originalKeyOf(key: string): string {
  return key.replace(/-(display|thumb)$/, '');
}

/**
 * Re-encodes an image into a display copy and a thumbnail, both WebP. Re-encoding decodes the
 * pixels and writes a fresh file, so no metadata (EXIF, XMP, IPTC, GPS, comments) survives in any
 * format. Animated GIFs stay animated. EXIF orientation is applied first so photos stay upright.
 */
export async function makeVariants(bytes: Buffer): Promise<{ display: Buffer; thumb: Buffer }> {
  const render = (maxPx: number, quality: number) =>
    sharp(bytes, { animated: true, limitInputPixels: 6000 * 6000 })
      .rotate()
      .resize({ width: maxPx, height: maxPx, fit: 'inside', withoutEnlargement: true })
      .webp({ quality })
      .toBuffer();
  const [display, thumb] = await Promise.all([
    render(DISPLAY_MAX_PX, 82),
    render(THUMB_MAX_PX, 70),
  ]);
  return { display, thumb };
}
