/**
 * Object storage port. Implementations: S3-compatible (MinIO locally, R2/S3 in production)
 * and a filesystem adapter for development and tests. Browsers only ever receive
 * short-lived signed URLs; bucket objects are never public.
 */
export interface SignedUpload {
  url: string;
  method: 'PUT';
  headers: Record<string, string>;
  expiresAt: Date;
}

export interface ObjectStorage {
  createUpload(
    key: string,
    contentType: string,
    sizeBytes: number,
    ttlSeconds: number,
  ): Promise<SignedUpload>;
  createDownloadUrl(key: string, ttlSeconds: number): Promise<string>;
  /** Reads at most maxBytes; returns null when the object does not exist. */
  read(key: string, maxBytes: number): Promise<Buffer | null>;
  write(key: string, body: Buffer, contentType: string): Promise<void>;
  delete(key: string): Promise<void>;
}

export const OBJECT_STORAGE = Symbol('OBJECT_STORAGE');
