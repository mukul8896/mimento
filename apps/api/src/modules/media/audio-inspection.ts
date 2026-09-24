/**
 * Byte-level check that an upload really is the audio format it claims (magic numbers), the
 * same idea as inspectImage. Nothing is decoded; clamd scans the file in the worker.
 */
export function inspectAudio(
  bytes: Buffer,
  declaredMime: string,
): { ok: true } | { ok: false; reason: string } {
  if (bytes.length < 12) return { ok: false, reason: 'File is too small to be audio' };
  const ascii = (from: number, to: number) => bytes.toString('latin1', from, to);
  const isMp3 = ascii(0, 3) === 'ID3' || (bytes[0] === 0xff && (bytes[1]! & 0xe0) === 0xe0);
  const isMp4 = ascii(4, 8) === 'ftyp';
  const isAdts = bytes[0] === 0xff && (bytes[1]! & 0xf6) === 0xf0;
  const isOgg = ascii(0, 4) === 'OggS';
  const isWebm = bytes.readUInt32BE(0) === 0x1a45dfa3;

  const matches: Record<string, boolean> = {
    'audio/mpeg': isMp3,
    'audio/mp4': isMp4,
    'audio/aac': isAdts || isMp4,
    'audio/ogg': isOgg,
    'audio/webm': isWebm,
  };
  if (!(declaredMime in matches)) return { ok: false, reason: 'Unsupported audio type' };
  return matches[declaredMime]
    ? { ok: true }
    : { ok: false, reason: 'File content does not match its declared type' };
}
