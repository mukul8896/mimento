import { imageSize } from 'image-size';
import { MAX_IMAGE_DIMENSION } from '@momentpath/contracts';

const TYPE_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

export type InspectionResult =
  { ok: true; width: number; height: number } | { ok: false; reason: string };

/** Server-side check of the actual bytes: real image format matching the declared type and bounded dimensions. */
export function inspectImage(bytes: Buffer, declaredMime: string): InspectionResult {
  const expected = TYPE_BY_MIME[declaredMime];
  if (!expected) return { ok: false, reason: 'Unsupported image type' };
  let info;
  try {
    info = imageSize(bytes);
  } catch {
    return { ok: false, reason: 'File is not a readable image' };
  }
  if (info.type !== expected)
    return { ok: false, reason: 'File content does not match its declared type' };
  const width = info.width ?? 0;
  const height = info.height ?? 0;
  if (width < 1 || height < 1) return { ok: false, reason: 'Image has no dimensions' };
  if (width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION) {
    return { ok: false, reason: `Images must be at most ${MAX_IMAGE_DIMENSION}px on each side` };
  }
  return { ok: true, width, height };
}

/**
 * Removes metadata that commonly carries GPS location and device details, at upload time.
 * JPEG: APP1 (EXIF/XMP), APP13 (IPTC). PNG: eXIf and textual chunks. WebP: EXIF and XMP chunks.
 * GIF: comment and non-animation application extensions (XMP). The media pipeline later
 * re-encodes every image, which drops whatever this misses; this covers the gap until then.
 * Any layout it does not understand is returned unchanged rather than risk corrupting it.
 */
export function stripImageMetadata(bytes: Buffer, mime: string): Buffer {
  if (mime === 'image/jpeg') return stripJpeg(bytes);
  if (mime === 'image/png') return stripPng(bytes);
  if (mime === 'image/webp') return stripWebp(bytes);
  if (mime === 'image/gif') return stripGif(bytes);
  return bytes;
}

function stripJpeg(bytes: Buffer): Buffer {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return bytes;
  const out: Buffer[] = [bytes.subarray(0, 2)];
  let offset = 2;
  while (offset + 4 <= bytes.length) {
    if (bytes[offset] !== 0xff) return bytes; // unexpected layout: leave untouched
    const marker = bytes[offset + 1] ?? 0;
    if (marker === 0xda) {
      // Start of scan: the rest is entropy-coded image data.
      out.push(bytes.subarray(offset));
      return Buffer.concat(out);
    }
    const length = bytes.readUInt16BE(offset + 2);
    const end = offset + 2 + length;
    if (length < 2 || end > bytes.length) return bytes;
    const isMetadata = marker === 0xe1 || marker === 0xed;
    if (!isMetadata) out.push(bytes.subarray(offset, end));
    offset = end;
  }
  return bytes;
}

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const PNG_DROP = new Set(['eXIf', 'tEXt', 'iTXt', 'zTXt', 'tIME']);

function stripPng(bytes: Buffer): Buffer {
  if (bytes.length < 8 || !bytes.subarray(0, 8).equals(PNG_SIGNATURE)) return bytes;
  const out: Buffer[] = [PNG_SIGNATURE];
  let offset = 8;
  while (offset + 12 <= bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.toString('latin1', offset + 4, offset + 8);
    const end = offset + 12 + length;
    if (end > bytes.length) return bytes;
    if (!PNG_DROP.has(type)) out.push(bytes.subarray(offset, end));
    offset = end;
    if (type === 'IEND') break;
  }
  return Buffer.concat(out);
}

const VP8X_EXIF = 0x08;
const VP8X_XMP = 0x04;

function stripWebp(bytes: Buffer): Buffer {
  if (
    bytes.length < 12 ||
    bytes.toString('latin1', 0, 4) !== 'RIFF' ||
    bytes.toString('latin1', 8, 12) !== 'WEBP'
  ) {
    return bytes;
  }
  const out: Buffer[] = [];
  let offset = 12;
  let dropped = false;
  while (offset + 8 <= bytes.length) {
    const fourcc = bytes.toString('latin1', offset, offset + 4);
    const size = bytes.readUInt32LE(offset + 4);
    const end = offset + 8 + size + (size % 2); // chunks are padded to an even length
    if (end > bytes.length) return bytes;
    if (fourcc === 'EXIF' || fourcc === 'XMP ') {
      dropped = true;
    } else if (fourcc === 'VP8X' && size >= 1) {
      const chunk = Buffer.from(bytes.subarray(offset, end));
      chunk[8] = (chunk[8] ?? 0) & ~(VP8X_EXIF | VP8X_XMP);
      out.push(chunk);
    } else {
      out.push(bytes.subarray(offset, end));
    }
    offset = end;
  }
  if (!dropped || offset !== bytes.length) return bytes;
  const body = Buffer.concat(out);
  const header = Buffer.alloc(12);
  header.write('RIFF', 0, 'latin1');
  header.writeUInt32LE(body.length + 4, 4);
  header.write('WEBP', 8, 'latin1');
  return Buffer.concat([header, body]);
}

/** Application extensions that only control animation looping; everything else is dropped. */
const GIF_KEEP_APPS = new Set(['NETSCAPE2.0', 'ANIMEXTS1.0']);

function stripGif(bytes: Buffer): Buffer {
  const signature = bytes.toString('latin1', 0, 6);
  if (bytes.length < 13 || (signature !== 'GIF87a' && signature !== 'GIF89a')) return bytes;
  const colorTable = (packed: number) => (packed & 0x80 ? 3 * 2 ** ((packed & 0x07) + 1) : 0);

  // Skips a run of data sub-blocks; returns the offset after the terminator, or -1.
  const skipSubBlocks = (from: number): number => {
    let at = from;
    while (at < bytes.length) {
      const len = bytes[at]!;
      at += 1 + len;
      if (len === 0) return at;
    }
    return -1;
  };

  let offset = 13 + colorTable(bytes[10]!);
  if (offset > bytes.length) return bytes;
  const out: Buffer[] = [bytes.subarray(0, offset)];
  let dropped = false;
  while (offset < bytes.length) {
    const introducer = bytes[offset];
    if (introducer === 0x3b) {
      out.push(bytes.subarray(offset, offset + 1));
      return dropped ? Buffer.concat(out) : bytes;
    }
    if (introducer === 0x2c) {
      // Image descriptor (10 bytes), optional local colour table, LZW code size, image data.
      if (offset + 10 > bytes.length) return bytes;
      const dataStart = offset + 10 + colorTable(bytes[offset + 9]!) + 1;
      const end = skipSubBlocks(dataStart);
      if (end < 0) return bytes;
      out.push(bytes.subarray(offset, end));
      offset = end;
      continue;
    }
    if (introducer === 0x21) {
      const label = bytes[offset + 1];
      const end = skipSubBlocks(offset + 2);
      if (end < 0) return bytes;
      let keep = label !== 0xfe; // comment extension
      if (label === 0xff) {
        const idLength = bytes[offset + 2] ?? 0;
        const id = bytes.toString('latin1', offset + 3, offset + 3 + Math.min(idLength, 11));
        keep = GIF_KEEP_APPS.has(id);
      }
      if (keep) out.push(bytes.subarray(offset, end));
      else dropped = true;
      offset = end;
      continue;
    }
    return bytes; // unknown block
  }
  return bytes; // no trailer
}
