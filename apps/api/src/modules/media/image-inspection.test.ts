import { describe, expect, it } from 'vitest';
import { makePng } from '@momentpath/test-utils';
import { inspectImage, stripImageMetadata } from './image-inspection';

describe('inspectImage', () => {
  it('accepts a real PNG and reports dimensions', () => {
    expect(inspectImage(makePng(12, 7), 'image/png')).toEqual({ ok: true, width: 12, height: 7 });
  });
  it('rejects type mismatches, non-images and oversized images', () => {
    expect(inspectImage(makePng(4, 4), 'image/jpeg').ok).toBe(false);
    expect(inspectImage(Buffer.from('<svg/>'), 'image/png').ok).toBe(false);
    expect(inspectImage(makePng(4, 4), 'image/svg+xml').ok).toBe(false);
    expect(inspectImage(makePng(6001, 1), 'image/png').ok).toBe(false);
  });
});

describe('stripImageMetadata', () => {
  it('removes PNG text chunks and keeps the image valid', () => {
    const withMeta = makePng(8, 8, true);
    const stripped = stripImageMetadata(withMeta, 'image/png');
    expect(stripped.length).toBeLessThan(withMeta.length);
    expect(stripped.includes(Buffer.from('GPS'))).toBe(false);
    expect(inspectImage(stripped, 'image/png')).toEqual({ ok: true, width: 8, height: 8 });
  });

  it('removes JPEG APP1 (EXIF) segments', () => {
    const exif = Buffer.concat([Buffer.from([0xff, 0xe1, 0x00, 0x08]), Buffer.from('Exif\0\0')]);
    const app0 = Buffer.from([0xff, 0xe0, 0x00, 0x04, 0x00, 0x00]);
    const sos = Buffer.from([0xff, 0xda, 0x00, 0x02, 0x11, 0x22, 0xff, 0xd9]);
    const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8]), app0, exif, sos]);
    const out = stripImageMetadata(jpeg, 'image/jpeg');
    expect(out.includes(Buffer.from('Exif'))).toBe(false);
    expect(out).toEqual(Buffer.concat([Buffer.from([0xff, 0xd8]), app0, sos]));
  });
});
