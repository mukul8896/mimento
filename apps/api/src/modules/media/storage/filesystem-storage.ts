import { createHmac } from 'node:crypto';
import { mkdir, open, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { safeEqual } from '../../../common/crypto';
import type { ObjectStorage, SignedUpload } from '../../../providers/storage';

export type BlobOperation = 'get' | 'put';

export interface BlobGrant {
  key: string;
  op: BlobOperation;
  exp: number;
  contentType?: string;
  size?: number;
}

/**
 * Development/test storage on local disk. Signed URLs point at the API's MediaBlobController
 * (through the web BFF) and carry an HMAC over operation, key, expiry and constraints.
 * Refused in production by configuration validation.
 */
export class FilesystemStorage implements ObjectStorage {
  constructor(
    private readonly root: string,
    private readonly secret: string,
    private readonly publicBaseUrl: string,
  ) {}

  private filePath(key: string): string {
    if (!/^[a-z0-9/-]+$/.test(key) || key.includes('..')) throw new Error('Invalid storage key');
    return path.join(path.resolve(this.root), key);
  }

  private sign(grant: BlobGrant): string {
    const material = [
      grant.op,
      grant.key,
      grant.exp,
      grant.contentType ?? '',
      grant.size ?? '',
    ].join('\n');
    return createHmac('sha256', this.secret).update(material).digest('base64url');
  }

  private url(grant: BlobGrant): string {
    const params = new URLSearchParams({ op: grant.op, exp: String(grant.exp) });
    if (grant.contentType) params.set('ct', grant.contentType);
    if (grant.size !== undefined) params.set('len', String(grant.size));
    params.set('sig', this.sign(grant));
    const encodedKey = Buffer.from(grant.key).toString('base64url');
    return `${this.publicBaseUrl.replace(/\/$/, '')}/v1/media/blob/${encodedKey}?${params.toString()}`;
  }

  /** Verifies a signed request; returns the grant or null. */
  verify(encodedKey: string, query: Record<string, unknown>, now = Date.now()): BlobGrant | null {
    const op = query.op;
    const exp = Number(query.exp);
    const sig = typeof query.sig === 'string' ? query.sig : '';
    if ((op !== 'get' && op !== 'put') || !Number.isFinite(exp) || exp * 1000 < now) return null;
    let key: string;
    try {
      key = Buffer.from(encodedKey, 'base64url').toString('utf8');
      this.filePath(key);
    } catch {
      return null;
    }
    const grant: BlobGrant = {
      key,
      op,
      exp,
      contentType: typeof query.ct === 'string' ? query.ct : undefined,
      size: query.len !== undefined ? Number(query.len) : undefined,
    };
    return safeEqual(this.sign(grant), sig) ? grant : null;
  }

  async createUpload(
    key: string,
    contentType: string,
    sizeBytes: number,
    ttlSeconds: number,
  ): Promise<SignedUpload> {
    const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
    return {
      url: this.url({ key, op: 'put', exp, contentType, size: sizeBytes }),
      method: 'PUT',
      headers: { 'content-type': contentType },
      expiresAt: new Date(exp * 1000),
    };
  }

  async createDownloadUrl(key: string, ttlSeconds: number): Promise<string> {
    return this.url({ key, op: 'get', exp: Math.floor(Date.now() / 1000) + ttlSeconds });
  }

  async read(key: string, maxBytes: number): Promise<Buffer | null> {
    let handle;
    try {
      handle = await open(this.filePath(key), 'r');
    } catch {
      return null;
    }
    try {
      const buffer = Buffer.alloc(maxBytes + 1);
      const { bytesRead } = await handle.read(buffer, 0, maxBytes + 1, 0);
      return buffer.subarray(0, bytesRead);
    } finally {
      await handle.close();
    }
  }

  async write(key: string, body: Buffer): Promise<void> {
    const target = this.filePath(key);
    await mkdir(path.dirname(target), { recursive: true });
    const tmp = `${target}.${process.pid}.tmp`;
    await writeFile(tmp, body);
    await rename(tmp, target);
  }

  async delete(key: string): Promise<void> {
    await rm(this.filePath(key), { force: true });
  }
}
