import { describe, expect, it } from 'vitest';
import { inspectAudio } from './audio-inspection';

const pad = (head: Buffer) => Buffer.concat([head, Buffer.alloc(32)]);

describe('inspectAudio', () => {
  it('recognises each allowed format by its bytes', () => {
    expect(inspectAudio(pad(Buffer.from('ID3')), 'audio/mpeg')).toEqual({ ok: true });
    expect(inspectAudio(pad(Buffer.from([0xff, 0xfb])), 'audio/mpeg')).toEqual({ ok: true });
    expect(inspectAudio(pad(Buffer.from('\0\0\0\x20ftypM4A ', 'latin1')), 'audio/mp4')).toEqual({
      ok: true,
    });
    expect(inspectAudio(pad(Buffer.from([0xff, 0xf1])), 'audio/aac')).toEqual({ ok: true });
    expect(inspectAudio(pad(Buffer.from('OggS')), 'audio/ogg')).toEqual({ ok: true });
    expect(inspectAudio(pad(Buffer.from([0x1a, 0x45, 0xdf, 0xa3])), 'audio/webm')).toEqual({
      ok: true,
    });
  });
  it('rejects mismatches, other files and unknown types', () => {
    expect(inspectAudio(pad(Buffer.from('OggS')), 'audio/mpeg').ok).toBe(false);
    expect(inspectAudio(pad(Buffer.from('<html>')), 'audio/webm').ok).toBe(false);
    expect(inspectAudio(pad(Buffer.from('ID3')), 'audio/x-evil').ok).toBe(false);
    expect(inspectAudio(Buffer.from('ID3'), 'audio/mpeg').ok).toBe(false);
  });
});
