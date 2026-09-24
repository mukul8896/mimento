import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { isAudioType, MAX_UPLOAD_BYTES } from '@momentpath/contracts';
import { APP_ENV, type AppEnv } from '../../config/env';
import type { MediaAsset } from '../../generated/prisma/client';
import { PrismaService, type Tx } from '../../prisma/prisma.service';
import { OBJECT_STORAGE, type ObjectStorage } from '../../providers/storage';
import { AuditService } from '../audit/audit.service';
import { makeVariants, VARIANT_MIME, variantKeys } from './media-variants';
import { ClamAvScanner, type ScanVerdict } from './scanning/clamav';

export const MEDIA_SCANNER = Symbol('MEDIA_SCANNER');
export interface MediaScanner {
  scan(bytes: Buffer): Promise<ScanVerdict>;
}

export function createScanner(env: AppEnv): MediaScanner | null {
  return env.CLAMAV_HOST ? new ClamAvScanner(env.CLAMAV_HOST, env.CLAMAV_PORT) : null;
}

/** Scanning and re-encoding a 5 MB image takes well under this; it bounds a stuck clamd. */
const TX_TIMEOUT_MS = 90_000;

export type PipelineOutcome = 'clean' | 'infected' | 'unscanned' | 'missing' | 'retry';

/**
 * Background processing of every upload: malware scan with ClamAV, then re-encoded display and
 * thumbnail copies. Runs in the worker (PROCESS_ROLE != api). Rows are claimed with
 * FOR UPDATE SKIP LOCKED, so several workers never process the same upload, and anything that
 * fails transiently (clamd restarting, storage timeout) is left for the next tick.
 *
 * Without a scanner (development) files are still re-encoded but stay NOT_SCANNED, which only
 * non-production environments accept for publishing.
 */
@Injectable()
export class MediaPipeline implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger('MediaPipeline');
  private timer: NodeJS.Timeout | undefined;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
    @Inject(MEDIA_SCANNER) private readonly scanner: MediaScanner | null,
    @Inject(APP_ENV) private readonly env: AppEnv,
  ) {}

  onApplicationBootstrap(): void {
    if (this.env.MEDIA_PIPELINE_MS > 0 && this.env.PROCESS_ROLE !== 'api') {
      this.timer = setInterval(() => void this.tick(), this.env.MEDIA_PIPELINE_MS);
      this.timer.unref();
    }
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await this.processPending();
    } catch (err) {
      this.logger.error({ err: { message: (err as Error).message } }, 'Media pipeline failed');
    } finally {
      this.running = false;
    }
  }

  /**
   * Processes every upload waiting for the pipeline, one per transaction so a slow scan never
   * holds more than one row. Public for tests and operators; `experienceId` limits it to one
   * experience (tests share a database and must not process each other's uploads).
   */
  async processPending(experienceId?: string): Promise<Record<PipelineOutcome, number>> {
    const scope = experienceId ?? null;
    const totals: Record<PipelineOutcome, number> = {
      clean: 0,
      infected: 0,
      unscanned: 0,
      missing: 0,
      retry: 0,
    };
    const retry: string[] = [];
    for (;;) {
      const outcome = await this.prisma.$transaction(
        async (tx) => {
          const [asset] = await tx.$queryRaw<MediaAsset[]>`
            SELECT * FROM "MediaAsset"
            WHERE "status" = 'READY' AND "processedAt" IS NULL
              AND NOT ("id" = ANY(${retry}::uuid[]))
              AND (${scope}::uuid IS NULL OR "experienceId" = ${scope}::uuid)
            ORDER BY "createdAt" ASC
            LIMIT 1
            FOR UPDATE SKIP LOCKED`;
          if (!asset) return null;
          const result = await this.process(tx, asset);
          if (result === 'retry') retry.push(asset.id);
          return result;
        },
        { timeout: TX_TIMEOUT_MS },
      );
      if (outcome === null) return totals;
      totals[outcome] += 1;
    }
  }

  private async process(tx: Tx, asset: MediaAsset): Promise<PipelineOutcome> {
    let bytes: Buffer | null;
    try {
      bytes = await this.storage.read(asset.storageKey, MAX_UPLOAD_BYTES);
    } catch (err) {
      this.logger.warn({ mediaId: asset.id, reason: (err as Error).message }, 'Read failed');
      return 'retry';
    }
    if (!bytes) {
      await tx.mediaAsset.update({
        where: { id: asset.id },
        data: { status: 'REJECTED', processedAt: new Date() },
      });
      return 'missing';
    }

    let verdict: ScanVerdict | null = null;
    if (this.scanner) {
      try {
        verdict = await this.scanner.scan(bytes);
      } catch (err) {
        // clamd down or still loading signatures: never guess, try again later.
        this.logger.warn({ mediaId: asset.id, reason: (err as Error).message }, 'Scan failed');
        return 'retry';
      }
    }

    if (verdict && !verdict.clean) {
      await this.storage.delete(asset.storageKey);
      await tx.mediaAsset.update({
        where: { id: asset.id },
        data: { scanStatus: 'INFECTED', status: 'REJECTED', processedAt: new Date() },
      });
      await this.audit.record(
        {
          actorType: 'SYSTEM',
          actorId: null,
          action: 'media.infected',
          targetType: 'experience',
          targetId: asset.experienceId,
          requestId: null,
          metadata: { mediaId: asset.id, signature: verdict.signature },
        },
        tx,
      );
      this.logger.warn({ mediaId: asset.id, signature: verdict.signature }, 'Infected upload');
      return 'infected';
    }

    let keys: { displayKey: string; thumbKey: string } | null = null;
    // Voice notes are only scanned; they are served as uploaded.
    if (!isAudioType(asset.mimeType)) {
      try {
        const variants = await makeVariants(bytes);
        const { display, thumb } = variantKeys(asset.storageKey);
        await this.storage.write(display, variants.display, VARIANT_MIME);
        await this.storage.write(thumb, variants.thumb, VARIANT_MIME);
        keys = { displayKey: display, thumbKey: thumb };
      } catch (err) {
        // An image the encoder cannot handle keeps being served as its (stripped) original.
        this.logger.warn({ mediaId: asset.id, reason: (err as Error).message }, 'Re-encode failed');
      }
    }
    await tx.mediaAsset.update({
      where: { id: asset.id },
      data: {
        ...(verdict ? { scanStatus: 'CLEAN' as const } : {}),
        ...(keys ?? {}),
        processedAt: new Date(),
      },
    });
    return verdict ? 'clean' : 'unscanned';
  }
}
