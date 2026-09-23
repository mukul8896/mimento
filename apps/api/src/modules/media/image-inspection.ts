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
 * Removes metadata segments that commonly carry GPS location and device details.
 * JPEG: APP1 (EXIF/XMP), APP13 (IPTC) segments. PNG: eXIf and textual chunks.
 * WebP/GIF are passed through unchanged (full re-encoding is a Phase 2 media-worker task).
 */
export function stripImageMetadata(bytes: Buffer, mime: string): Buffer {
  if (mime === 'image/jpeg') return stripJpeg(bytes);
  if (mime === 'image/png') return stripPng(bytes);
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
