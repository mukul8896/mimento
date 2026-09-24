import sharp from 'sharp';
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

  it('removes WebP EXIF and XMP chunks, clears their VP8X flags and keeps the image decodable', async () => {
    const webp = await sharp({ create: { width: 6, height: 4, channels: 3, background: '#f00' } })
      .webp()
      .withExif({ IFD0: { Copyright: 'GPS-SECRET-51.5N' } })
      .toBuffer();
    expect(webp.includes(Buffer.from('GPS-SECRET'))).toBe(true);
    const out = stripImageMetadata(webp, 'image/webp');
    expect(out.includes(Buffer.from('GPS-SECRET'))).toBe(false);
    expect(out.readUInt32LE(4)).toBe(out.length - 8);
    const meta = await sharp(out).metadata();
    expect(meta).toMatchObject({ format: 'webp', width: 6, height: 4 });
    expect(meta.exif).toBeUndefined();
  });

  it('removes GIF comments and XMP application blocks but keeps animation looping', async () => {
    const gif = await sharp({ create: { width: 3, height: 3, channels: 3, background: '#00f' } })
      .gif()
      .toBuffer();
    const block = (label: number, ...parts: Buffer[]) =>
      Buffer.concat([Buffer.from([0x21, label]), ...parts, Buffer.from([0x00])]);
    const sub = (text: string) => Buffer.concat([Buffer.from([text.length]), Buffer.from(text)]);
    const comment = block(0xfe, sub('GPS-SECRET comment'));
    const xmp = block(0xff, sub('XMP DataXMP'), sub('<x:xmpmeta>GPS-SECRET</x:xmpmeta>'));
    const loop = block(0xff, sub('NETSCAPE2.0'), Buffer.from([3, 1, 0, 0]));
    // Insert after the header, screen descriptor and global colour table.
    const packed = gif[10]!;
    const at = 13 + (packed & 0x80 ? 3 * 2 ** ((packed & 7) + 1) : 0);
    const tagged = Buffer.concat([gif.subarray(0, at), comment, loop, xmp, gif.subarray(at)]);

    const out = stripImageMetadata(tagged, 'image/gif');
    expect(out.includes(Buffer.from('GPS-SECRET'))).toBe(false);
    expect(out.includes(Buffer.from('NETSCAPE2.0'))).toBe(true);
    expect(await sharp(out).metadata()).toMatchObject({ format: 'gif', width: 3, height: 3 });
  });

  it('leaves files it cannot parse untouched', () => {
    const junk = Buffer.from('RIFF\x00\x00\x00\x00WEBPjunk');
    expect(stripImageMetadata(junk, 'image/webp')).toBe(junk);
    const gif = Buffer.from('GIF89a\x01\x00\x01\x00\x00\x00\x00\x99');
    expect(stripImageMetadata(gif, 'image/gif')).toBe(gif);
  });
});
