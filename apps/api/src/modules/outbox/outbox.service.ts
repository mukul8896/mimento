import { Injectable } from '@nestjs/common';
import type { Tx } from '../../prisma/prisma.service';

export type OutboxEventType =
  'storage.delete' | 'identity.delete' | 'experience.published' | 'experience.deleted';

export interface OutboxPayloads {
  'storage.delete': { keys: string[] };
  'identity.delete': { subject: string };
  'experience.published': { experienceId: string; versionNumber: number };
  'experience.deleted': { experienceId: string };
}

/** Writes events in the same transaction as the state change they describe. */
@Injectable()
export class OutboxService {
  async enqueue<T extends OutboxEventType>(
    tx: Tx,
    type: T,
    payload: OutboxPayloads[T],
  ): Promise<void> {
    await tx.outboxEvent.create({ data: { type, payload } });
  }
}
