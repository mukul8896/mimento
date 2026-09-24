import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { APP_ENV, type AppEnv } from '../../config/env';
import { PrismaService } from '../../prisma/prisma.service';
import { OBJECT_STORAGE, type ObjectStorage } from '../../providers/storage';

const MAX_ATTEMPTS = 10;
const BATCH = 20;

interface ClaimedEvent {
  id: string;
  type: string;
  payload: unknown;
  attempts: number;
}

/**
 * In-process outbox worker for Phase 1 (no Redis yet). Rows are claimed with
 * FOR UPDATE SKIP LOCKED so several API instances can run it safely. Handlers are idempotent.
 * Phase 2 moves this to the BullMQ worker without changing producers.
 */
@Injectable()
export class OutboxProcessor implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger('OutboxProcessor');
  private timer: NodeJS.Timeout | undefined;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(APP_ENV) private readonly env: AppEnv,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
  ) {}

  onApplicationBootstrap(): void {
    if (this.env.OUTBOX_POLL_MS > 0 && this.env.PROCESS_ROLE !== 'api') {
      this.timer = setInterval(() => void this.tick(), this.env.OUTBOX_POLL_MS);
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
      await this.processDue();
      await this.housekeeping();
    } catch (err) {
      this.logger.error({ err: { message: (err as Error).message } }, 'Outbox tick failed');
    } finally {
      this.running = false;
    }
  }

  /** Processes all currently due events. Exposed for tests and operational scripts. */
  async processDue(): Promise<number> {
    let processed = 0;
    for (;;) {
      const claimed = await this.prisma.$transaction(async (tx) => {
        const rows = await tx.$queryRaw<ClaimedEvent[]>`
          SELECT "id", "type", "payload", "attempts" FROM "OutboxEvent"
          WHERE "status" = 'PENDING' AND "availableAt" <= now()
          ORDER BY "availableAt" ASC
          LIMIT ${BATCH}
          FOR UPDATE SKIP LOCKED`;
        for (const row of rows) {
          try {
            await this.handle(row);
            await tx.outboxEvent.update({
              where: { id: row.id },
              data: {
                status: 'PROCESSED',
                processedAt: new Date(),
                attempts: row.attempts + 1,
                lastError: null,
              },
            });
          } catch (err) {
            const attempts = row.attempts + 1;
            await tx.outboxEvent.update({
              where: { id: row.id },
              data: {
                attempts,
                status: attempts >= MAX_ATTEMPTS ? 'FAILED' : 'PENDING',
                availableAt: new Date(Date.now() + Math.min(2 ** attempts, 3600) * 1000),
                lastError: (err as Error).message.slice(0, 500),
              },
            });
          }
        }
        return rows.length;
      });
      processed += claimed;
      if (claimed < BATCH) return processed;
    }
  }

  private async handle(event: ClaimedEvent): Promise<void> {
    const payload = event.payload as Record<string, unknown>;
    switch (event.type) {
      case 'storage.delete': {
        const keys = Array.isArray(payload.keys)
          ? payload.keys.filter((k): k is string => typeof k === 'string')
          : [];
        for (const key of keys) await this.storage.delete(key);
        return;
      }
      case 'experience.published':
      case 'experience.deleted':
        // Domain notifications with no Phase 1 consumer (Phase 2: notifications, analytics).
        return;
      default:
        throw new Error(`Unknown outbox event type ${event.type}`);
    }
  }

  /** Retention: expired idempotency records and recipient sessions past their retention date. */
  async housekeeping(now = new Date()): Promise<void> {
    await this.prisma.idempotencyRecord.deleteMany({ where: { expiresAt: { lt: now } } });
    await this.prisma.recipientSession.deleteMany({ where: { expiresAt: { lt: now } } });
    const processedCutoff = new Date(now.getTime() - 30 * 24 * 3600 * 1000);
    await this.prisma.outboxEvent.deleteMany({
      where: { status: 'PROCESSED', processedAt: { lt: processedCutoff } },
    });
  }
}
