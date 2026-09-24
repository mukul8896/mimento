import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { isAudioType, maxBytesFor } from '@momentpath/contracts';
import { APP_ENV, type AppEnv } from '../../config/env';
import { requireOwnedExperience } from '../../common/ownership';
import { Problem } from '../../common/problem';
import { PrismaService } from '../../prisma/prisma.service';
import { OBJECT_STORAGE, type ObjectStorage } from '../../providers/storage';
import type { MediaAsset } from '../../generated/prisma/client';
import type { Principal } from '../identity/principal';
import { inspectAudio } from './audio-inspection';
import { inspectImage, stripImageMetadata } from './image-inspection';

/** What to hand out: the pipeline's re-encoded copy once it exists, else the stripped original. */
function servedKey(asset: Pick<MediaAsset, 'storageKey' | 'displayKey'>): string {
  return asset.displayKey ?? asset.storageKey;
}

export const UPLOAD_URL_TTL_SECONDS = 10 * 60;
export const CREATOR_MEDIA_URL_TTL_SECONDS = 30 * 60;
export const RECIPIENT_MEDIA_URL_TTL_SECONDS = 60 * 60;
const MAX_MEDIA_PER_EXPERIENCE = 40;

@Injectable()
export class MediaService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
    @Inject(APP_ENV) private readonly env: AppEnv,
  ) {}

  async createUpload(
    principal: Principal,
    experienceId: string,
    contentType: string,
    sizeBytes: number,
  ) {
    await requireOwnedExperience(this.prisma, principal, experienceId);
    const count = await this.prisma.mediaAsset.count({
      where: { experienceId, status: { not: 'DELETED' } },
    });
    if (count >= MAX_MEDIA_PER_EXPERIENCE) {
      throw Problem.conflict(
        'MEDIA_LIMIT',
        `An experience can have at most ${MAX_MEDIA_PER_EXPERIENCE} images`,
      );
    }
    const id = randomUUID();
    // Keys contain only server-generated identifiers, never user-supplied file names.
    const storageKey = `media/${principal.userId}/${experienceId}/${id}`;
    const asset = await this.prisma.mediaAsset.create({
      data: {
        id,
        ownerId: principal.userId,
        experienceId,
        storageKey,
        mimeType: contentType,
        declaredSize: sizeBytes,
      },
    });
    const upload = await this.storage.createUpload(
      storageKey,
      contentType,
      sizeBytes,
      UPLOAD_URL_TTL_SECONDS,
    );
    return { mediaId: asset.id, upload: { ...upload, expiresAt: upload.expiresAt.toISOString() } };
  }

  /**
   * Validates the uploaded bytes server-side and marks the asset READY. Images are checked and
   * stripped of location metadata; voice notes are checked by their bytes. Both are then
   * scanned by the worker before recipients can get them.
   */
  async completeUpload(principal: Principal, experienceId: string, mediaId: string) {
    await requireOwnedExperience(this.prisma, principal, experienceId);
    const asset = await this.prisma.mediaAsset.findFirst({
      where: { id: mediaId, experienceId, ownerId: principal.userId },
    });
    if (!asset || asset.status === 'DELETED') throw Problem.notFound('Media');
    if (asset.status === 'READY') return this.toDto(asset, CREATOR_MEDIA_URL_TTL_SECONDS);
    if (asset.status === 'REJECTED')
      throw Problem.unprocessable('MEDIA_REJECTED', 'This upload was rejected');

    const maxBytes = maxBytesFor(asset.mimeType);
    const bytes = await this.storage.read(asset.storageKey, maxBytes);
    const reject = async (reason: string) => {
      await this.prisma.mediaAsset.update({
        where: { id: asset.id },
        data: { status: 'REJECTED' },
      });
      await this.storage.delete(asset.storageKey);
      throw Problem.unprocessable('MEDIA_REJECTED', reason);
    };
    if (!bytes) throw Problem.conflict('UPLOAD_MISSING', 'The file has not been uploaded yet');
    if (bytes.length > maxBytes || bytes.length !== asset.declaredSize) {
      return reject('The uploaded file size does not match the declared size');
    }
    if (isAudioType(asset.mimeType)) {
      const audio = inspectAudio(bytes, asset.mimeType);
      if (!audio.ok) return reject(audio.reason);
      const ready = await this.prisma.mediaAsset.update({
        where: { id: asset.id },
        data: { status: 'READY', sizeBytes: bytes.length },
      });
      return this.toDto(ready, CREATOR_MEDIA_URL_TTL_SECONDS);
    }
    const inspection = inspectImage(bytes, asset.mimeType);
    if (!inspection.ok) return reject(inspection.reason);

    const cleaned = stripImageMetadata(bytes, asset.mimeType);
    if (cleaned.length !== bytes.length)
      await this.storage.write(asset.storageKey, cleaned, asset.mimeType);

    const updated = await this.prisma.mediaAsset.update({
      where: { id: asset.id },
      data: {
        status: 'READY',
        sizeBytes: cleaned.length,
        width: inspection.width,
        height: inspection.height,
      },
    });
    return this.toDto(updated, CREATOR_MEDIA_URL_TTL_SECONDS);
  }

  /**
   * Whether an asset may be shown to recipients. In production an asset must have passed the
   * worker's ClamAV scan; development and test environments (often without clamd) also accept
   * unscanned files, never infected ones.
   */
  isPublishable(asset: Pick<MediaAsset, 'status' | 'scanStatus'>): boolean {
    if (asset.status !== 'READY') return false;
    if (this.env.APP_ENV === 'production') return asset.scanStatus === 'CLEAN';
    return asset.scanStatus !== 'INFECTED';
  }

  async signedUrl(storageKey: string, ttlSeconds: number): Promise<string> {
    return this.storage.createDownloadUrl(storageKey, ttlSeconds);
  }

  async toDto(asset: MediaAsset, ttlSeconds: number) {
    return {
      id: asset.id,
      status: asset.status === 'DELETED' ? ('REJECTED' as const) : asset.status,
      mimeType: asset.mimeType,
      sizeBytes: asset.sizeBytes,
      width: asset.width,
      height: asset.height,
      url: asset.status === 'READY' ? await this.signedUrl(servedKey(asset), ttlSeconds) : null,
    };
  }

  /** All READY assets of an experience with creator-scoped signed URLs (editor thumbnails). */
  async ownerMedia(experienceId: string) {
    const assets = await this.prisma.mediaAsset.findMany({
      where: { experienceId, status: 'READY' },
      orderBy: { createdAt: 'asc' },
    });
    return Promise.all(
      assets.map(async (a) => ({
        id: a.id,
        url: await this.signedUrl(servedKey(a), CREATOR_MEDIA_URL_TTL_SECONDS),
        width: a.width,
        height: a.height,
      })),
    );
  }

  /** Signed URLs for a set of READY, publishable assets (used by draft and recipient payloads). */
  async publicMedia(ids: string[], experienceId: string, ttlSeconds: number) {
    if (ids.length === 0) return [];
    const assets = await this.prisma.mediaAsset.findMany({
      where: { id: { in: [...new Set(ids)] }, experienceId, status: 'READY' },
    });
    return Promise.all(
      assets
        .filter((a) => this.isPublishable(a))
        .map(async (a) => ({
          id: a.id,
          url: await this.signedUrl(servedKey(a), ttlSeconds),
          width: a.width,
          height: a.height,
        })),
    );
  }
}
