import {
  DeleteObjectCommand,
  GetObjectCommand,
  NoSuchKey,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { ObjectStorage, SignedUpload } from '../../../providers/storage';

export interface S3StorageOptions {
  endpoint?: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle: boolean;
}

/** S3-compatible storage (MinIO, Cloudflare R2, AWS S3) with presigned PUT/GET. */
export class S3Storage implements ObjectStorage {
  private readonly client: S3Client;

  constructor(private readonly options: S3StorageOptions) {
    this.client = new S3Client({
      endpoint: options.endpoint,
      region: options.region,
      forcePathStyle: options.forcePathStyle,
      credentials: { accessKeyId: options.accessKeyId, secretAccessKey: options.secretAccessKey },
    });
  }

  async createUpload(
    key: string,
    contentType: string,
    sizeBytes: number,
    ttlSeconds: number,
  ): Promise<SignedUpload> {
    // Content type and length are part of the signature, so the object must match them.
    const command = new PutObjectCommand({
      Bucket: this.options.bucket,
      Key: key,
      ContentType: contentType,
      ContentLength: sizeBytes,
    });
    const url = await getSignedUrl(this.client, command, {
      expiresIn: ttlSeconds,
      signableHeaders: new Set(['content-type', 'content-length']),
    });
    return {
      url,
      method: 'PUT',
      headers: { 'content-type': contentType },
      expiresAt: new Date(Date.now() + ttlSeconds * 1000),
    };
  }

  async createDownloadUrl(key: string, ttlSeconds: number): Promise<string> {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.options.bucket, Key: key }),
      {
        expiresIn: ttlSeconds,
      },
    );
  }

  async read(key: string, maxBytes: number): Promise<Buffer | null> {
    try {
      const res = await this.client.send(
        new GetObjectCommand({
          Bucket: this.options.bucket,
          Key: key,
          Range: `bytes=0-${maxBytes}`,
        }),
      );
      if (!res.Body) return null;
      return Buffer.from(await res.Body.transformToByteArray());
    } catch (err) {
      if (err instanceof NoSuchKey) return null;
      throw err;
    }
  }

  async write(key: string, body: Buffer, contentType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.options.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.options.bucket, Key: key }));
  }
}
