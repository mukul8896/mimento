import { mkdtempSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { FilesystemStorage } from './filesystem-storage';

const storage = new FilesystemStorage(
  mkdtempSync(path.join(os.tmpdir(), 'fs-')),
  's'.repeat(40),
  'http://web/bff/api',
);

function parse(url: string) {
  const u = new URL(url);
  return { key: u.pathname.split('/').at(-1)!, query: Object.fromEntries(u.searchParams) };
}

describe('FilesystemStorage signed URLs', () => {
  it('verifies its own signatures and rejects tampering and expiry', async () => {
    const { key, query } = parse(await storage.createDownloadUrl('media/u/e/m', 60));
    expect(storage.verify(key, query)).toMatchObject({ key: 'media/u/e/m', op: 'get' });
    expect(storage.verify(key, { ...query, op: 'put' })).toBeNull();
    expect(storage.verify(key, { ...query, sig: 'x' })).toBeNull();
    expect(storage.verify(Buffer.from('media/u/e/other').toString('base64url'), query)).toBeNull();
    expect(storage.verify(key, query, Date.now() + 120_000)).toBeNull();
  });

  it('binds uploads to content type and size', async () => {
    const upload = await storage.createUpload('media/u/e/m', 'image/png', 100, 60);
    const { key, query } = parse(upload.url);
    expect(storage.verify(key, query)).toMatchObject({
      op: 'put',
      contentType: 'image/png',
      size: 100,
    });
    expect(storage.verify(key, { ...query, len: '5000000' })).toBeNull();
    expect(storage.verify(key, { ...query, ct: 'text/html' })).toBeNull();
  });

  it('refuses path traversal keys', async () => {
    await expect(storage.write('../../etc/passwd', Buffer.from('x'))).rejects.toThrow();
    expect(
      storage.verify(Buffer.from('../x').toString('base64url'), {
        op: 'get',
        exp: '9999999999',
        sig: 'x',
      }),
    ).toBeNull();
  });
});
