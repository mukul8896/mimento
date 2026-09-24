import { describe, expect, it } from 'vitest';
import { parseReply } from './clamav';

describe('parseReply', () => {
  it('reads clean and infected verdicts', () => {
    expect(parseReply('stream: OK')).toEqual({ clean: true });
    expect(parseReply('stream: Eicar-Test-Signature FOUND')).toEqual({
      clean: false,
      signature: 'Eicar-Test-Signature',
    });
  });
  it('treats errors and anything unexpected as no verdict, so the file is retried', () => {
    expect(parseReply('INSTREAM size limit exceeded. ERROR')).toBeNull();
    expect(parseReply('')).toBeNull();
    expect(parseReply('stream: something ERROR')).toBeNull();
  });
});
